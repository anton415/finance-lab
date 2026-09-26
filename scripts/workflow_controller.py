"""Read-only PR lifecycle decisions; no Project or label writes."""

import json
import os
from pathlib import Path
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


ACTIONS = ("opened", "ready_for_review", "converted_to_draft", "reopened", "closed")
CLOSING_ISSUES_QUERY = """
query($owner: String!, $name: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
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


def closing_issue_numbers(repository, pr_number):
    """Read all relationship pages, returning only same-repository issues.

    gh receives a fixed GraphQL query and JSON variables through stdin, never a
    shell command built from PR data. API errors must not become partial targets.
    """
    numbers = set()
    cursor = None
    seen_cursors = set()
    try:
        owner, name = repository.split("/")
        while True:
            response = subprocess.run(
                ["gh", "api", "graphql", "--input", "-"],
                input=json.dumps({
                    "query": CLOSING_ISSUES_QUERY,
                    "variables": {
                        "owner": owner, "name": name,
                        "number": pr_number, "cursor": cursor,
                    },
                }),
                text=True, capture_output=True, check=True, timeout=30,
            )
            result = json.loads(response.stdout)
            if result.get("errors"):
                raise ValueError
            connection = result["data"]["repository"]["pullRequest"]["closingIssuesReferences"]
            if not isinstance(connection["nodes"], list):
                raise ValueError
            for issue in connection["nodes"]:
                number = issue["number"]
                issue_repository = issue["repository"]["nameWithOwner"]
                if not positive_integer(number) or not isinstance(issue_repository, str):
                    raise ValueError
                if issue_repository.casefold() == repository.casefold():
                    numbers.add(number)
            page = connection["pageInfo"]
            if type(page["hasNextPage"]) is not bool:
                raise ValueError
            if not page["hasNextPage"]:
                return sorted(numbers)
            cursor = page["endCursor"]
            if not isinstance(cursor, str) or not cursor or cursor in seen_cursors:
                raise ValueError
            seen_cursors.add(cursor)
    except (OSError, subprocess.SubprocessError, ValueError, KeyError, TypeError, AttributeError):
        # Do not log API responses, command stderr, credentials, or partial data.
        raise LookupError("Closing-issue lookup failed; no changes proposed.") from None


def dry_run(event_name, event, repository, run, lookup=closing_issue_numbers):
    """Build traceable evidence from the event and a read-only target lookup."""
    action = event.get("action") if isinstance(event, dict) else None
    evidence = {
        "dry_run": True,
        "event": event_name,
        "action": action if action in ACTIONS else None,
        "run": run,
        "pr_number": None,
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
        if (type(pr["draft"]) is not bool or type(pr["merged"]) is not bool
                or pr["base"]["repo"]["full_name"].casefold() != repository.casefold()):
            return evidence
    except (KeyError, TypeError, AttributeError):
        return evidence

    try:
        issues = lookup(repository, pr["number"])
    except LookupError:
        evidence["target"]["resolution"] = "lookup_failed"
        evidence["reason"] = "Closing-issue lookup failed; no changes proposed."
        return evidence

    if len(issues) != 1:
        evidence["target"]["resolution"] = "missing" if not issues else "ambiguous"
        evidence["reason"] = (
            "No same-repository closing issue; no changes proposed." if not issues else
            "Multiple same-repository closing issues; target is ambiguous; no changes proposed."
        )
        return evidence

    evidence["target"] = {"issue_number": issues[0], "resolution": "resolved"}
    status = workflow_controller(action, pr["draft"], pr["merged"])
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
    elif action == "opened":
        labels["remove"] = ["needs:implementation"]
        reason = "Draft PR opened; set In progress and clear needs:implementation."
    elif action == "converted_to_draft":
        labels["remove"] = ["needs:review", "needs:human"]
        reason = "PR converted to draft; set In progress and clear review/human workflow labels."
    else:
        reason = "Draft PR reopened; set In progress without changing workflow labels."
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
