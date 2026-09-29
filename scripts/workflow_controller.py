"""Read-only PR lifecycle decisions; no Project or label writes."""

import json
import os
from pathlib import Path
import re
import subprocess


def workflow_controller(event, draft, merged):
    if event in ("opened", "reopened") and draft:
        return "In progress"
    elif event == "converted_to_draft":
        return "In progress"
    elif event == "ready_for_review":
        return "Review"
    elif event == "closed" and merged:
        return "Done"
    elif event in ("opened", "reopened") and not draft:
        return "Review"
    return None

def desired_pr_status(state, draft, merged):
    if state == "open" and merged:
        return None
    elif state == "open" and draft:
        return "In progress"
    elif state == "open" and not draft:
        return "Review"
    elif state == "closed" and merged:
        return "Done"
    return None


ACTIONS = ("opened", "edited", "synchronize", "ready_for_review", "converted_to_draft", "reopened", "closed")
PR_SNAPSHOT_QUERY = """
query($owner: String!, $name: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      number state isDraft merged headRefOid updatedAt
      closingIssuesReferences(first: 100, after: $cursor) {
        nodes { number repository { nameWithOwner } }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}
"""


def positive_integer(value):
    return type(value) is int and value > 0


def read_pr_snapshot(repository, pr_number):
    """Read current PR state and all closing references together.

    Each page repeats the PR revision fields; discard the entire read if they
    change. The same fixed query also supplies the pre-write fingerprint.
    """
    references = set()
    snapshot = None
    cursor = None
    seen_cursors = set()
    env = os.environ.copy()
    env.pop("PROJECT_TOKEN", None)
    try:
        owner, name = repository.split("/")
        while True:
            response = subprocess.run(
                ["gh", "api", "graphql", "--input", "-"],
                input=json.dumps({
                    "query": PR_SNAPSHOT_QUERY,
                    "variables": {
                        "owner": owner, "name": name,
                        "number": pr_number, "cursor": cursor,
                    },
                }),
                env=env, text=True, capture_output=True, check=True, timeout=30,
            )
            result = json.loads(response.stdout)
            if result.get("errors"):
                raise ValueError
            pr = result["data"]["repository"]["pullRequest"]
            if (not positive_integer(pr["number"]) or pr["number"] != pr_number
                    or pr["state"] not in ("OPEN", "CLOSED", "MERGED")
                    or type(pr["isDraft"]) is not bool or type(pr["merged"]) is not bool
                    or pr["merged"] != (pr["state"] == "MERGED")
                    or not re.fullmatch(r"[0-9a-f]{40}", pr["headRefOid"])
                    or not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", pr["updatedAt"])):
                raise ValueError
            revision = {
                "number": pr["number"], "state": "open" if pr["state"] == "OPEN" else "closed",
                "draft": pr["isDraft"], "merged": pr["merged"],
                "head_sha": pr["headRefOid"], "updated_at": pr["updatedAt"],
            }
            if snapshot is not None and revision != snapshot:
                raise ValueError
            snapshot = revision
            connection = pr["closingIssuesReferences"]
            if not isinstance(connection["nodes"], list):
                raise ValueError
            for issue in connection["nodes"]:
                number = issue["number"]
                issue_repository = issue["repository"]["nameWithOwner"]
                if (not positive_integer(number)
                        or not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", issue_repository)):
                    raise ValueError
                references.add((issue_repository.casefold(), number))
            page = connection["pageInfo"]
            if type(page["hasNextPage"]) is not bool:
                raise ValueError
            if not page["hasNextPage"]:
                return {**snapshot, "closing_issues": [
                    {"repository": repo, "number": number} for repo, number in sorted(references)
                ]}
            cursor = page["endCursor"]
            if not isinstance(cursor, str) or not cursor or cursor in seen_cursors:
                raise ValueError
            seen_cursors.add(cursor)
    except (OSError, subprocess.SubprocessError, ValueError, KeyError, TypeError, AttributeError):
        # Do not log API responses, command stderr, credentials, or partial data.
        raise LookupError("Current PR snapshot lookup failed; no changes proposed.") from None


def dry_run(event_name, event, repository, run, lookup=read_pr_snapshot):
    """Events wake the controller; only the current snapshot decides the intent."""
    action = event.get("action") if isinstance(event, dict) else None
    evidence = {
        "dry_run": True,
        "event": event_name,
        "action": action if action in ACTIONS else None,
        "run": run,
        "pr_number": None,
        "snapshot": None,
        "target": {"issue_number": None, "resolution": "invalid_event"},
        "decision": "no-op",
        "intended_status": None,
        "intended_needs": {"add": [], "remove": [], "clear_all": False},
        "reason": "Invalid PR event; no changes proposed.",
    }
    if not isinstance(event, dict):
        return evidence
    if event_name != "pull_request_target" or action not in ACTIONS:
        evidence["reason"] = "Unsupported event/action; no changes proposed."
        evidence["target"]["resolution"] = "not_resolved"
        return evidence

    try:
        pr = event["pull_request"]
        if not positive_integer(pr["number"]):
            return evidence
        evidence["pr_number"] = pr["number"]
        if pr["base"]["repo"]["full_name"].casefold() != repository.casefold():
            return evidence
    except (KeyError, TypeError, AttributeError):
        return evidence

    try:
        snapshot = lookup(repository, pr["number"])
    except LookupError:
        evidence["target"]["resolution"] = "lookup_failed"
        evidence["reason"] = "Current PR snapshot lookup failed; no changes proposed."
        return evidence

    evidence["snapshot"] = snapshot
    issues = [issue["number"] for issue in snapshot["closing_issues"]
              if issue["repository"] == repository.casefold()]
    if len(issues) != 1:
        evidence["target"]["resolution"] = "missing" if not issues else "ambiguous"
        evidence["reason"] = (
            "No same-repository closing issue; no changes proposed." if not issues else
            "Multiple same-repository closing issues; target is ambiguous; no changes proposed."
        )
        return evidence

    evidence["target"] = {"issue_number": issues[0], "resolution": "resolved"}
    status = desired_pr_status(snapshot["state"], snapshot["draft"], snapshot["merged"])
    if status is None:
        evidence["reason"] = "PR closed without merge; leave Status and workflow labels unchanged."
        return evidence

    labels = evidence["intended_needs"]
    if status == "Review":
        labels.update(add=["needs:review"], clear_all=True)
        reason = "PR is ready for review; set Review and make needs:review the only workflow label."
    elif status == "Done":
        labels["clear_all"] = True
        reason = "PR merged; set Done and clear all needs:* labels."
    else:
        labels["clear_all"] = True
        reason = "PR is currently draft; set In progress and clear all needs:* labels."
    evidence.update(decision="action", intended_status=status, reason=reason)
    return evidence


def main():
    """Read the Actions event file and emit one JSON record, including on failure."""
    try:
        event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8"))
    except (OSError, UnicodeError, ValueError, KeyError):
        event = None
    evidence = dry_run(
        os.environ.get("GITHUB_EVENT_NAME", "unknown"), event,
        os.environ.get("GITHUB_REPOSITORY", ""),
        {"id": os.environ.get("GITHUB_RUN_ID"), "attempt": os.environ.get("GITHUB_RUN_ATTEMPT")},
    )
    print(json.dumps(evidence, sort_keys=True))
    return 1 if evidence["target"]["resolution"] in ("lookup_failed", "invalid_event") else 0


if __name__ == "__main__":
    raise SystemExit(main())
