"""Live adapter tests with synthetic state and intercepted GitHub calls."""

from contextlib import redirect_stdout
from copy import deepcopy
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch

from scripts import workflow_live as live
from test_workflow_controller import CASES, REPOSITORY, RUN, SENTINEL, decide, event_for, gh_result


PROJECT = "PVT_synthetic"


def snapshot(status="Ready", labels=("learning", "needs:implementation")):
    options = {name: str(index) for index, name in enumerate(
        ("Backlog", "Ready", "In progress", "Review", "Done"))}
    return {
        "issue_id": "I_synthetic", "item_id": "PVTI_synthetic", "field_id": "PVTSSF_synthetic",
        "options": options, "status": options.get(status), "review_id": "L_review",
        "labels": {name: "L_review" if name == "needs:review" else f"L_{index}"
                   for index, name in enumerate(labels)},
    }


class FakeGitHub:
    def __init__(self, state=None):
        self.state = deepcopy(state or snapshot())
        self.calls = []

    def read(self, repository, number, project):
        self.calls.append(("read", repository, number, project))
        return deepcopy(self.state)

    def remove_labels(self, state, names):
        self.calls.append(("remove", names))
        for name in names:
            del self.state["labels"][name]

    def set_status(self, state, project, status):
        self.calls.append(("status", status))
        self.state["status"] = self.state["options"][status]

    def add_review(self, state):
        self.calls.append(("add", "needs:review"))
        assert not any(name.startswith("needs:") for name in self.state["labels"])
        self.state["labels"]["needs:review"] = self.state["review_id"]


def apply(case, api, done_owner="controller"):
    evidence = decide(event_for(case), Mock(return_value=case["issues"]))
    return live.apply_decision(evidence, REPOSITORY, PROJECT, done_owner, api)


class ApplyTests(unittest.TestCase):
    def test_all_accepted_fixtures_and_repeated_deliveries(self):
        for case in CASES:
            with self.subTest(case=case["name"]):
                api = FakeGitHub()
                original = deepcopy(api.state)
                result = apply(case, api)
                expected = case["expected"]
                if expected["decision"] == "no-op":
                    self.assertEqual(api.calls, [])
                    self.assertEqual(api.state, original)
                else:
                    self.assertEqual(api.calls[0], ("read", REPOSITORY, 23, PROJECT))
                    self.assertEqual(api.state["status"], api.state["options"][expected["status"]])
                    labels = {"needs:implementation"} if not expected["clear_all"] else set()
                    labels.difference_update(expected["remove"])
                    labels.update(expected["add"])
                    self.assertEqual(set(api.state["labels"]), labels | {"learning"})
                    self.assertEqual(result["outcome"], "updated")
                api.calls.clear()
                again = apply(case, api)
                self.assertEqual(again["outcome"], "no-op")
                self.assertEqual(again["writes"], [])
                self.assertTrue(all(call[0] == "read" for call in api.calls))

    def test_already_satisfied_status_or_labels_are_independently_skipped(self):
        cases = [
            (snapshot("Review"), ["remove", "add"]),
            (snapshot("Ready", ("learning", "needs:review")), ["status"]),
            (snapshot("Review", ("learning", "needs:review")), []),
            (snapshot(None, ("learning", "needs:review")), ["status"]),
        ]
        for state, operations in cases:
            with self.subTest(operations=operations):
                api = FakeGitHub(state)
                apply(CASES[1], api)
                self.assertEqual([call[0] for call in api.calls[1:]], operations)

    def test_replace_conflicting_labels_removes_before_adding_and_preserves_metadata(self):
        api = FakeGitHub(snapshot(labels=("learning", "needs:human", "needs:spec", "needs:custom")))
        result = apply(CASES[1], api)
        self.assertEqual([call[0] for call in api.calls], ["read", "remove", "status", "add"])
        self.assertEqual(set(api.state["labels"]), {"learning", "needs:review"})
        self.assertEqual(result["outcome"], "updated")

    def test_draft_clears_only_the_accepted_labels(self):
        for label in ("needs:review", "needs:human"):
            api = FakeGitHub(snapshot("Review", ("learning", label)))
            apply(CASES[3], api)
            self.assertEqual(set(api.state["labels"]), {"learning"})
        for case, label in ((CASES[0], "needs:spec"), (CASES[4], "needs:human")):
            api = FakeGitHub(snapshot(labels=("learning", label)))
            apply(case, api)
            self.assertEqual(set(api.state["labels"]), {"learning", label})

    def test_unresolvable_label_conflict_is_noop(self):
        api = FakeGitHub(snapshot(labels=("learning", "needs:human", "needs:spec")))
        original = deepcopy(api.state)
        result = apply(CASES[4], api)
        self.assertEqual(result["outcome"], "no-op")
        self.assertIn("human correction", result["reason"])
        self.assertEqual(api.state, original)
        self.assertEqual(len(api.calls), 1)

    def test_builtin_done_never_writes_status_even_before_builtin_runs(self):
        for status in ("Review", "Done"):
            api = FakeGitHub(snapshot(status, ("learning", "needs:human", "needs:custom")))
            original_status = api.state["status"]
            result = apply(CASES[6], api, "project")
            self.assertEqual(api.state["status"], original_status)
            self.assertEqual(set(api.state["labels"]), {"learning"})
            self.assertEqual(result["writes"], ["remove_workflow_labels"])
            self.assertIn("Built-in Project automation owns Done", result["reason"])
            self.assertEqual(apply(CASES[6], api, "project")["writes"], [])

    def test_missing_configuration_prevents_all_mutations(self):
        for missing in ("read", "options", "review_id"):
            with self.subTest(missing=missing):
                api = FakeGitHub()
                if missing == "read":
                    api.read = Mock(side_effect=LookupError(SENTINEL))
                elif missing == "options":
                    del api.state["options"]["Review"]
                else:
                    api.state["review_id"] = None
                result = apply(CASES[1], api)
                self.assertEqual(result["outcome"], "error")
                self.assertEqual(result["writes"], [])
                self.assertTrue(all(call[0] == "read" for call in api.calls))
                self.assertNotIn(SENTINEL, json.dumps(result))
        api = Mock()
        evidence = decide(event_for(CASES[0]), Mock(return_value=[23]))
        for project, owner in (("", "project"), (PROJECT, ""), (PROJECT, "both")):
            result = live.apply_decision(evidence, REPOSITORY, project, owner, api)
            self.assertEqual(result["outcome"], "error")
        api.read.assert_not_called()

    def test_failure_at_each_write_converges_on_retry_including_uncertain_response(self):
        for operation in ("remove_labels", "set_status", "add_review"):
            for accepted in (False, True):
                with self.subTest(operation=operation, accepted=accepted):
                    api = FakeGitHub()
                    original = getattr(api, operation)

                    def fail(*args):
                        if accepted:
                            original(*args)
                        raise LookupError(SENTINEL)

                    with patch.object(api, operation, side_effect=fail):
                        failed = apply(CASES[1], api)
                    self.assertEqual(failed["outcome"], "error")
                    self.assertNotIn(SENTINEL, json.dumps(failed))
                    before_retry = deepcopy(api.state)
                    api.calls.clear()
                    retried = apply(CASES[1], api)
                    self.assertNotEqual(retried["outcome"], "error")
                    self.assertEqual(set(api.state["labels"]), {"learning", "needs:review"})
                    self.assertEqual(api.state["status"], api.state["options"]["Review"])
                    if before_retry["status"] == api.state["status"]:
                        self.assertNotIn("status", [call[0] for call in api.calls])
                    self.assertEqual(apply(CASES[1], api)["writes"], [])


def connection(nodes, more=False, cursor=None):
    return {"nodes": nodes, "pageInfo": {"hasNextPage": more, "endCursor": cursor}}


def issue_data(labels=None):
    state = snapshot()
    return {"repository": {"label": {"id": state["review_id"]}, "issue": {
        "id": state["issue_id"], "labels": labels or connection([
            {"name": name, "id": label_id} for name, label_id in state["labels"].items()
        ]),
    }}}


def project_item(project=PROJECT):
    return {"id": "PVTI_synthetic", "project": {"id": project},
            "fieldValueByName": {"optionId": "1"}}


def project_data(items=None):
    state = snapshot()
    return {"project": {"field": {
        "id": state["field_id"],
        "options": [{"name": name, "id": value} for name, value in state["options"].items()],
    }}, "issue": {"projectItems": items or connection([project_item()])}}


class ApiTests(unittest.TestCase):
    def test_read_paginates_labels_and_memberships_before_selecting_item(self):
        pages = [
            issue_data(connection([{"id": "L_meta", "name": "learning"}], True, "labels-next")),
            issue_data(connection([{"id": "L_human", "name": "needs:human"}])),
            project_data(connection([project_item("PVT_other")], True, "items-next")),
            project_data(),
        ]
        with patch.object(live, "graphql", side_effect=pages) as api:
            state = live.GitHub().read(REPOSITORY, 23, PROJECT)
        self.assertEqual(state["labels"], {"learning": "L_meta", "needs:human": "L_human"})
        self.assertEqual(state["item_id"], "PVTI_synthetic")
        self.assertEqual([call.args[1]["cursor"] for call in api.call_args_list],
                         [None, "labels-next", None, "items-next"])
        self.assertTrue(all(call.kwargs.get("project") for call in api.call_args_list[2:]))

    def test_missing_ambiguous_or_malformed_project_state_blocks_writes(self):
        malformed = [
            project_data(connection([])),
            project_data(connection([project_item(), project_item()])),
            project_data(connection([project_item("PVT_other")])),
            project_data(connection(None)),
            project_data(connection([project_item()], True, None)),
            {"project": None},
        ]
        for field in (None, {}, {"id": "field", "options": None}):
            data = project_data()
            data["project"]["field"] = field
            malformed.append(data)
        data = project_data()
        data["issue"]["projectItems"]["nodes"][0]["fieldValueByName"] = {}
        malformed.append(data)
        for data in malformed:
            with self.subTest(data=data):
                with patch.object(live, "graphql", side_effect=[issue_data(), data]) as api:
                    result = apply(CASES[1], live.GitHub())
                self.assertEqual(result["outcome"], "error")
                self.assertEqual(result["writes"], [])
                self.assertEqual(api.call_count, 2)

    def test_partial_read_failure_or_repeated_cursor_does_not_write(self):
        page = project_data(connection([project_item()], True, "next"))
        for failure in (LookupError(SENTINEL), page):
            with patch.object(live, "graphql", side_effect=[issue_data(), page, failure]) as api:
                result = apply(CASES[1], live.GitHub())
            self.assertEqual(result["outcome"], "error")
            self.assertEqual(result["writes"], [])
            self.assertEqual(api.call_count, 3)

    def test_exact_mutation_targets_and_separate_credentials(self):
        replies = [issue_data(), project_data(),
                   {"removeLabelsFromLabelable": {"labelable": {"id": "I_synthetic"}}},
                   {"updateProjectV2ItemFieldValue": {"projectV2Item": {"id": "PVTI_synthetic"}}},
                   {"addLabelsToLabelable": {"labelable": {"id": "I_synthetic"}}}]
        env = {"GH_TOKEN": "REPO_TOKEN_SYNTHETIC", "PROJECT_TOKEN": "PROJECT_TOKEN_SYNTHETIC"}
        with patch.dict(live.os.environ, env, clear=True):
            with patch.object(live.subprocess, "run", side_effect=[
                gh_result({"data": data}) for data in replies
            ]) as run:
                result = apply(CASES[1], live.GitHub())
        self.assertEqual(result["outcome"], "updated")
        calls = run.call_args_list
        self.assertEqual([call.kwargs["env"]["GH_TOKEN"] for call in calls],
                         [env["GH_TOKEN"], env["PROJECT_TOKEN"], env["GH_TOKEN"],
                          env["PROJECT_TOKEN"], env["GH_TOKEN"]])
        for call in calls:
            self.assertEqual(call.args[0], ["gh", "api", "graphql", "--input", "-"])
            self.assertNotIn("shell", call.kwargs)
            self.assertNotIn("PROJECT_TOKEN", call.kwargs["env"])
            self.assertNotIn("TOKEN", call.kwargs["input"])
        inputs = [json.loads(call.kwargs["input"])["variables"] for call in calls]
        self.assertEqual(inputs[2], {"input": {"labelableId": "I_synthetic", "labelIds": ["L_1"]}})
        self.assertEqual(inputs[3], {"input": {
            "projectId": PROJECT, "itemId": "PVTI_synthetic", "fieldId": "PVTSSF_synthetic",
            "value": {"singleSelectOptionId": "3"},
        }})
        self.assertEqual(inputs[4], {"input": {"labelableId": "I_synthetic", "labelIds": ["L_review"]}})

    def test_api_errors_are_sanitized(self):
        failures = [
            subprocess.CalledProcessError(1, "gh", stderr=SENTINEL),
            subprocess.TimeoutExpired("gh", 30, output=SENTINEL), OSError(SENTINEL),
            gh_result({"data": issue_data(), "errors": [{"message": SENTINEL}]}),
            gh_result({"data": None}), gh_result([]),
            subprocess.CompletedProcess([], 0, stdout=SENTINEL),
        ]
        for failure in failures:
            with patch.object(live.subprocess, "run", side_effect=[failure]):
                with self.assertRaisesRegex(LookupError, "^GitHub API operation failed.$"):
                    live.graphql(live.ISSUE_QUERY, {})

    def test_missing_or_wrong_mutation_receipt_stops_remaining_writes(self):
        for receipt in ({}, {"removeLabelsFromLabelable": None},
                        {"removeLabelsFromLabelable": {"labelable": {"id": "I_other"}}}):
            with patch.object(live, "graphql", side_effect=[issue_data(), project_data(), receipt]) as api:
                result = apply(CASES[1], live.GitHub())
            self.assertEqual(result["outcome"], "error")
            self.assertEqual(result["writes"], [])
            self.assertEqual(api.call_count, 3)


class CliTests(unittest.TestCase):
    def invoke(self, case, env_extra=None, lookup=None):
        with tempfile.TemporaryDirectory() as directory:
            event_path = Path(directory) / "event.json"
            event_path.write_text(json.dumps(event_for(case)))
            env = {
                "GITHUB_EVENT_PATH": str(event_path), "GITHUB_EVENT_NAME": "pull_request_target",
                "GITHUB_REPOSITORY": REPOSITORY, "GITHUB_RUN_ID": RUN["id"],
                "GITHUB_RUN_ATTEMPT": RUN["attempt"], "LIFECYCLE_PROJECT_ID": PROJECT,
                "LIFECYCLE_DONE_OWNER": "controller", "PROJECT_TOKEN": SENTINEL,
                **(env_extra or {}),
            }
            output, api = io.StringIO(), FakeGitHub()
            evidence = decide(event_for(case), lookup or Mock(return_value=case["issues"]))
            with patch.dict(live.os.environ, env, clear=True), redirect_stdout(output):
                with patch.object(live, "dry_run", return_value=evidence), patch.object(live, "GitHub", return_value=api):
                    code = live.main()
        self.assertEqual(len(output.getvalue().splitlines()), 1)
        self.assertNotIn(SENTINEL, output.getvalue())
        return code, json.loads(output.getvalue()), api

    def test_exit_status_trace_and_no_write_guards(self):
        code, result, _ = self.invoke(CASES[1])
        self.assertEqual((code, result["outcome"]), (0, "updated"))
        self.assertEqual(result["run"], RUN)
        self.assertFalse(result["dry_run"])
        for case in CASES[7:]:
            code, result, api = self.invoke(case, {"PROJECT_TOKEN": ""})
            self.assertEqual((code, result["outcome"]), (0, "no-op"))
            self.assertEqual(api.calls, [])
        code, result, api = self.invoke(CASES[1], {"PROJECT_TOKEN": ""})
        self.assertEqual((code, result["outcome"]), (1, "error"))
        self.assertEqual(api.calls, [])
        code, result, api = self.invoke(CASES[1], lookup=Mock(side_effect=LookupError(SENTINEL)))
        self.assertEqual((code, result["target"]["resolution"]), (1, "lookup_failed"))
        self.assertEqual(api.calls, [])


if __name__ == "__main__":
    unittest.main()
