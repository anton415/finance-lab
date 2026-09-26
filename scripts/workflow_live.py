"""Apply the accepted dry-run decisions to existing issue/Project state."""

import json
import os
from pathlib import Path
import subprocess

from scripts.workflow_controller import dry_run


ISSUE_QUERY = """
query($owner: String!, $name: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    label(name: "needs:review") { id }
    issue(number: $number) {
      id
      labels(first: 100, after: $cursor) {
        nodes { id name }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}
"""
PROJECT_QUERY = """
query($issue: ID!, $project: ID!, $cursor: String) {
  project: node(id: $project) {
    ... on ProjectV2 {
      field(name: "Status") {
        ... on ProjectV2SingleSelectField { id options { id name } }
      }
    }
  }
  issue: node(id: $issue) {
    ... on Issue {
      projectItems(first: 100, after: $cursor, includeArchived: false) {
        nodes {
          id
          project { id }
          fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue { optionId }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}
"""
STATUS_MUTATION = """
mutation($input: UpdateProjectV2ItemFieldValueInput!) {
  updateProjectV2ItemFieldValue(input: $input) { projectV2Item { id } }
}
"""
REMOVE_LABELS = """
mutation($input: RemoveLabelsFromLabelableInput!) {
  removeLabelsFromLabelable(input: $input) { labelable { id } }
}
"""
ADD_LABELS = """
mutation($input: AddLabelsToLabelableInput!) {
  addLabelsToLabelable(input: $input) { labelable { id } }
}
"""


def graphql(query, variables, *, project=False):
    """Keep credentials in the environment and all API text out of logs."""
    env = os.environ.copy()
    project_token = env.pop("PROJECT_TOKEN", "")
    if project:
        env["GH_TOKEN"] = project_token
    try:
        result = subprocess.run(
            ["gh", "api", "graphql", "--input", "-"],
            input=json.dumps({"query": query, "variables": variables}),
            env=env, text=True, capture_output=True, check=True, timeout=30,
        )
        body = json.loads(result.stdout)
        if body.get("errors") or not isinstance(body["data"], dict):
            raise ValueError
        return body["data"]
    except (OSError, subprocess.SubprocessError, ValueError, KeyError, TypeError, AttributeError):
        raise LookupError("GitHub API operation failed.") from None


def text_id(value):
    if not isinstance(value, str) or not value:
        raise ValueError
    return value


def next_page(connection, seen):
    """Reject incomplete pagination instead of acting on partial state."""
    if not isinstance(connection["nodes"], list):
        raise ValueError
    page = connection["pageInfo"]
    if type(page["hasNextPage"]) is not bool:
        raise ValueError
    if not page["hasNextPage"]:
        return None
    cursor = text_id(page["endCursor"])
    if cursor in seen:
        raise ValueError
    seen.add(cursor)
    return cursor


class GitHub:
    def read(self, repository, number, project):
        """Read all labels and Project memberships before allowing any write."""
        owner, name = repository.split("/")
        labels, cursor, seen = {}, None, set()
        while True:
            repo = graphql(ISSUE_QUERY, {
                "owner": owner, "name": name, "number": number, "cursor": cursor,
            })["repository"]
            issue_id = text_id(repo["issue"]["id"])
            review_id = text_id(repo["label"]["id"]) if repo["label"] else None
            connection = repo["issue"]["labels"]
            cursor = next_page(connection, seen)
            for label in connection["nodes"]:
                labels[text_id(label["name"])] = text_id(label["id"])
            if cursor is None:
                break

        items, cursor, seen = [], None, set()
        while True:
            data = graphql(PROJECT_QUERY, {
                "issue": issue_id, "project": project, "cursor": cursor,
            }, project=True)
            field = data["project"]["field"]
            field_id = text_id(field["id"])
            options = {}
            for option in field["options"]:
                name = text_id(option["name"])
                if name in options:
                    raise ValueError
                options[name] = text_id(option["id"])
            connection = data["issue"]["projectItems"]
            cursor = next_page(connection, seen)
            for item in connection["nodes"]:
                if item["project"]["id"] == project:
                    items.append(item)
            if cursor is None:
                break
        if len(items) != 1:
            raise ValueError
        item = items[0]
        value = item["fieldValueByName"]
        return {
            "issue_id": issue_id, "labels": labels, "review_id": review_id,
            "item_id": text_id(item["id"]), "field_id": field_id, "options": options,
            "status": text_id(value["optionId"]) if value is not None else None,
        }

    def remove_labels(self, state, names):
        data = graphql(REMOVE_LABELS, {"input": {
            "labelableId": state["issue_id"],
            "labelIds": [state["labels"][name] for name in names],
        }})
        if data["removeLabelsFromLabelable"]["labelable"]["id"] != state["issue_id"]:
            raise LookupError

    def set_status(self, state, project, status):
        data = graphql(STATUS_MUTATION, {"input": {
            "projectId": project, "itemId": state["item_id"],
            "fieldId": state["field_id"],
            "value": {"singleSelectOptionId": state["options"][status]},
        }}, project=True)
        if data["updateProjectV2ItemFieldValue"]["projectV2Item"]["id"] != state["item_id"]:
            raise LookupError

    def add_review(self, state):
        data = graphql(ADD_LABELS, {"input": {
            "labelableId": state["issue_id"], "labelIds": [state["review_id"]],
        }})
        if data["addLabelsToLabelable"]["labelable"]["id"] != state["issue_id"]:
            raise LookupError


def apply_decision(evidence, repository, project, done_owner, api):
    """Diff the #41 intent against current state; do not remap PR events."""
    result = {**evidence, "dry_run": False, "outcome": "no-op", "writes": []}
    if evidence["decision"] != "action":
        return result
    if not project or done_owner not in ("project", "controller"):
        result.update(outcome="error", reason="Missing Project ID or explicit Done owner; no writes.")
        return result
    try:
        state = api.read(repository, evidence["target"]["issue_number"], project)
        current = {name for name in state["labels"] if name.startswith("needs:")}
        intent = evidence["intended_needs"]
        desired = (set() if intent["clear_all"] else current.copy())
        desired.difference_update(intent["remove"])
        desired.update(intent["add"])
        if len(desired) > 1:
            result["reason"] = "Conflicting workflow labels remain; human correction required; no writes."
            return result
        remove = sorted(current - desired)
        add_review = "needs:review" in desired - current
        status = evidence["intended_status"]
        manage_status = status != "Done" or done_owner == "controller"
        if manage_status and status not in state["options"]:
            raise ValueError
        if add_review and not state["review_id"]:
            raise ValueError
        update_status = manage_status and state["status"] != state["options"][status]
    except (LookupError, ValueError, TypeError, AttributeError):
        result.update(outcome="error", reason="Cannot read complete issue/Project configuration; no writes.")
        return result

    # Remove first: replacement never temporarily creates two needs:* labels.
    # Each successful operation is independent and skipped on a later retry.
    try:
        if remove:
            api.remove_labels(state, remove)
            result["writes"].append("remove_workflow_labels")
        if update_status:
            api.set_status(state, project, status)
            result["writes"].append("set_status")
        if add_review:
            api.add_review(state)
            result["writes"].append("add_needs_review")
    except (LookupError, TypeError, ValueError, AttributeError):
        result.update(outcome="error", reason="Write failed or response is uncertain; rerun to read current state.")
        return result
    result["outcome"] = "updated" if result["writes"] else "no-op"
    result["reason"] = "Applied required changes." if result["writes"] else "Required changes already satisfied."
    if not manage_status:
        result["reason"] += " Built-in Project automation owns Done; no custom Done write."
    return result


def main():
    try:
        event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8"))
    except (OSError, UnicodeError, ValueError, KeyError):
        event = None
    repository = os.environ.get("GITHUB_REPOSITORY", "")
    evidence = dry_run(
        os.environ.get("GITHUB_EVENT_NAME", "unknown"), event, repository,
        {"id": os.environ.get("GITHUB_RUN_ID"), "attempt": os.environ.get("GITHUB_RUN_ATTEMPT")},
    )
    if evidence["decision"] == "action" and not os.environ.get("PROJECT_TOKEN"):
        result = {**evidence, "dry_run": False, "outcome": "error", "writes": [],
                  "reason": "Missing Project token; no writes."}
    else:
        result = apply_decision(
            evidence, repository, os.environ.get("LIFECYCLE_PROJECT_ID", ""),
            os.environ.get("LIFECYCLE_DONE_OWNER", ""), GitHub(),
        )
    print(json.dumps(result, sort_keys=True))
    return int(result["outcome"] == "error"
               or result["target"]["resolution"] in ("lookup_failed", "invalid_event"))


if __name__ == "__main__":
    raise SystemExit(main())
