"""Synthetic event/API fixtures: no network, credentials, or GitHub writes."""

from contextlib import redirect_stdout
from copy import deepcopy
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch

from scripts import workflow_controller as controller


ROOT = Path(__file__).resolve().parents[2]
CASES = json.loads((ROOT / "fixtures/pr-lifecycle/cases.json").read_text())
REPOSITORY = "example/finance-demo"
RUN = {"id": "1000", "attempt": "1"}
SENTINEL = "SYNTHETIC_UNTRUSTED_TEXT"


def event_for(case):
    return {
        "action": case["action"],
        "number": 17,
        "pull_request": {
            "number": 17, "draft": case.get("event_draft", case["draft"]), "merged": case["merged"],
            "body": "\n".join(f"Closes #{number}" for number in case.get("event_issues", [])),
            "base": {"repo": {"full_name": REPOSITORY}},
        },
    }


def issue(number, repository=REPOSITORY):
    return {"number": number, "repository": {"nameWithOwner": repository}}


def pr_snapshot(case=None):
    case = case or CASES[0]
    return {
        "number": 17, "state": case["state"], "draft": case["draft"], "merged": case["merged"],
        "head_sha": "a" * 40, "updated_at": "2026-01-01T00:00:00Z",
        "closing_issues": [{"repository": REPOSITORY, "number": number} for number in case["issues"]],
    }


def response(nodes, has_next=False, cursor=None, case=None):
    current = pr_snapshot(case)
    return {"data": {"repository": {"pullRequest": {
        "number": current["number"],
        "state": "MERGED" if current["merged"] else current["state"].upper(),
        "isDraft": current["draft"], "merged": current["merged"],
        "headRefOid": current["head_sha"], "updatedAt": current["updated_at"],
        "closingIssuesReferences": {
            "nodes": nodes, "pageInfo": {"hasNextPage": has_next, "endCursor": cursor},
        },
    }}}}


def gh_result(body):
    return subprocess.CompletedProcess([], 0, stdout=json.dumps(body), stderr="")


def decide(event, lookup=controller.read_pr_snapshot, run=None):
    return controller.dry_run("pull_request_target", event, REPOSITORY, run or RUN, lookup)


class LifecycleTests(unittest.TestCase):
    def test_every_wakeup_uses_the_same_current_state_decision_core(self):
        for case in CASES[:8]:
            current = pr_snapshot(case)
            for action in controller.ACTIONS:
                with self.subTest(state=current["state"], draft=current["draft"], action=action):
                    event = event_for(case)
                    event["action"] = action
                    # Historical state and even absent state fields are irrelevant.
                    event["pull_request"].pop("draft")
                    event["pull_request"].pop("merged")
                    with patch.object(controller, "desired_pr_status", wraps=controller.desired_pr_status) as core:
                        result = decide(event, Mock(return_value=current))
                    core.assert_called_once_with(current["state"], current["draft"], current["merged"])
                    self.assertEqual(result["intended_status"], case["expected"]["status"])
                    self.assertEqual(result["snapshot"], current)

    def test_all_required_fixture_decisions_through_api_adapter(self):
        self.assertEqual(len(CASES), 16)
        for case in CASES:
            with self.subTest(case=case["name"]):
                event = event_for(case)
                original = deepcopy(event)
                body = response([issue(number) for number in case["issues"]], case=case)
                with patch.object(controller.subprocess, "run", return_value=gh_result(body)):
                    result = decide(event)
                expected = case["expected"]
                self.assertEqual(result["decision"], expected["decision"])
                self.assertEqual(result["intended_status"], expected["status"])
                self.assertEqual(result["intended_needs"], {
                    key: expected[key] for key in ("add", "remove", "clear_all")
                })
                self.assertEqual(result["target"], {
                    "issue_number": case["issues"][0] if expected["resolution"] == "resolved" else None,
                    "resolution": expected["resolution"],
                })
                self.assertEqual((result["event"], result["action"], result["pr_number"]),
                                 ("pull_request_target", case["action"], 17))
                self.assertEqual(result["run"], RUN)
                self.assertTrue(result["dry_run"])
                self.assertTrue(result["reason"])
                self.assertEqual(event, original)

    def test_retries_have_identical_decisions_for_every_fixture(self):
        for case in CASES:
            with self.subTest(case=case["name"]):
                lookup = Mock(return_value=pr_snapshot(case))
                first = decide(event_for(case), lookup)
                self.assertEqual(first, decide(event_for(case), lookup))
                retry = decide(event_for(case), lookup, {"id": "1000", "attempt": "2"})
                retry["run"] = first["run"]
                self.assertEqual(first, retry)

    def test_pr_text_and_fork_head_are_neither_executed_nor_logged(self):
        event = event_for(CASES[0])
        event["pull_request"].update(
            title=f"Closes #999 $(echo {SENTINEL})",
            body=f"Closes #999\n::warning::{SENTINEL}",
            head={"ref": f"issue-999/{SENTINEL}", "repo": {"full_name": "fork/demo"}},
        )
        for numbers in ([23], []):
            with self.subTest(numbers=numbers):
                lookup = Mock(return_value={**pr_snapshot(), "closing_issues": [
                    {"repository": REPOSITORY, "number": number} for number in numbers
                ]})
                result = decide(event, lookup)
                lookup.assert_called_once_with(REPOSITORY, 17)
                self.assertNotIn(SENTINEL, json.dumps(result))
                self.assertNotIn("999", json.dumps(result))
                self.assertEqual(result["target"]["issue_number"], 23 if numbers else None)

    def test_invalid_payloads_do_not_resolve_a_target(self):
        malformed = [None, [], {}, {"action": "opened"}]
        for key, value in (("number", True), ("number", -1), ("number", "17"),
                           ("base", None),
                           ("base", {"repo": {"full_name": "another/repository"}})):
            event = event_for(CASES[0])
            event["pull_request"][key] = value
            malformed.append(event)
        for event in malformed:
            with self.subTest(event=event):
                lookup = Mock()
                result = decide(event, lookup)
                self.assertEqual(result["decision"], "no-op")
                self.assertIsNone(result["intended_status"])
                lookup.assert_not_called()

    def test_unhandled_event_or_action_is_noop(self):
        for event_name, action in (("push", "opened"), ("pull_request_target", "labeled")):
            event = event_for(CASES[0])
            event["action"] = action
            lookup = Mock()
            result = controller.dry_run(event_name, event, REPOSITORY, RUN, lookup)
            self.assertEqual(result["decision"], "no-op")
            lookup.assert_not_called()


class RelationshipTests(unittest.TestCase):
    def test_missing_or_malformed_snapshot_never_proposes_changes(self):
        malformed = [None, {}]
        for key, value in (
            ("number", True), ("number", 18), ("state", "UNKNOWN"),
            ("isDraft", "false"), ("merged", None), ("merged", True),
            ("state", "MERGED"), ("headRefOid", SENTINEL), ("headRefOid", None),
            ("updatedAt", SENTINEL), ("updatedAt", None), ("closingIssuesReferences", None),
        ):
            pr = response([issue(23)])["data"]["repository"]["pullRequest"]
            pr[key] = value
            malformed.append(pr)
        for pr in malformed:
            with self.subTest(pr=pr):
                body = {"data": {"repository": {"pullRequest": pr}}}
                with patch.object(controller.subprocess, "run", return_value=gh_result(body)):
                    result = decide(event_for(CASES[0]))
                self.assertEqual(result["target"]["resolution"], "lookup_failed")
                self.assertIsNone(result["snapshot"])
                self.assertEqual(result["decision"], "no-op")
                self.assertNotIn(SENTINEL, json.dumps(result))

    def test_revision_change_during_pagination_discards_partial_snapshot(self):
        for key, value in (("isDraft", False), ("state", "CLOSED"),
                           ("headRefOid", "b" * 40)):
            pages = [response([issue(23)], True, "next"), response([issue(24)])]
            pages[1]["data"]["repository"]["pullRequest"][key] = value
            with patch.object(controller.subprocess, "run", side_effect=list(map(gh_result, pages))):
                result = decide(event_for(CASES[0]))
            self.assertEqual(result["target"]["resolution"], "lookup_failed")
            self.assertIsNone(result["snapshot"])

    def test_timestamp_only_change_during_pagination_preserves_complete_snapshot(self):
        pages = [response([issue(23, "other/repo")], True, "next"), response([issue(24)])]
        pages[1]["data"]["repository"]["pullRequest"]["updatedAt"] = "2026-01-01T00:00:01Z"
        with patch.object(controller.subprocess, "run", side_effect=list(map(gh_result, pages))):
            result = decide(event_for(CASES[0]))
        self.assertEqual(result["decision"], "action")
        self.assertEqual(result["target"], {"issue_number": 24, "resolution": "resolved"})
        self.assertEqual(result["snapshot"]["updated_at"], "2026-01-01T00:00:01Z")
        self.assertEqual(result["snapshot"]["closing_issues"], [
            {"repository": REPOSITORY, "number": 24},
            {"repository": "other/repo", "number": 23},
        ])

    def test_reference_order_duplicates_and_repository_case_do_not_change_fingerprint(self):
        snapshots = []
        for nodes in ([issue(24), issue(23)],
                      [issue(23, REPOSITORY.upper()), issue(24), issue(23)]):
            with patch.object(controller.subprocess, "run", return_value=gh_result(response(nodes))):
                snapshots.append(controller.read_pr_snapshot(REPOSITORY, 17))
        self.assertEqual(*snapshots)

    def test_cross_repository_issues_are_never_targets(self):
        for nodes, resolution, number in (
            ([issue(23, "other/repo")], "missing", None),
            ([issue(23, "other/repo"), issue(24)], "resolved", 24),
            ([issue(23), issue(24)], "ambiguous", None),
        ):
            with self.subTest(nodes=nodes):
                with patch.object(controller.subprocess, "run", return_value=gh_result(response(nodes))):
                    result = decide(event_for(CASES[0]))
                self.assertEqual(result["target"], {"issue_number": number, "resolution": resolution})

    def test_pagination_prevents_false_unique_target(self):
        pages = [response([issue(23)], True, "next-page"), response([issue(24)])]
        with patch.object(controller.subprocess, "run", side_effect=list(map(gh_result, pages))) as run:
            result = decide(event_for(CASES[0]))
        self.assertEqual(result["target"]["resolution"], "ambiguous")
        self.assertEqual(run.call_count, 2)
        for call, cursor in zip(run.call_args_list, [None, "next-page"]):
            self.assertEqual(call.args[0], ["gh", "api", "graphql", "--input", "-"])
            payload = json.loads(call.kwargs["input"])
            self.assertEqual(payload["variables"], {
                "owner": "example", "name": "finance-demo", "number": 17, "cursor": cursor,
            })
            self.assertTrue(payload["query"].lstrip().startswith("query("))
            self.assertNotIn("mutation", payload["query"])
            self.assertNotIn("shell", call.kwargs)
            self.assertTrue(call.kwargs["capture_output"])

    def test_same_repository_target_after_foreign_page(self):
        pages = [response([issue(23, "other/repo")], True, "next"),
                 response([issue(24, REPOSITORY.upper()), issue(24)])]
        with patch.object(controller.subprocess, "run", side_effect=list(map(gh_result, pages))):
            self.assertEqual(controller.read_pr_snapshot(REPOSITORY, 17)["closing_issues"], [
                {"repository": "example/finance-demo", "number": 24},
                {"repository": "other/repo", "number": 23},
            ])

    def test_api_failures_never_use_partial_results_or_log_errors(self):
        failures = [
            subprocess.CalledProcessError(1, "gh", stderr=SENTINEL),
            subprocess.TimeoutExpired("gh", 30, output=SENTINEL),
            OSError(SENTINEL),
            gh_result({"errors": [{"message": SENTINEL}], **response([issue(23)])}),
            gh_result({"data": {"repository": None}}),
            gh_result(response([issue(True)])),
            gh_result(response(None)),
            gh_result(response([None])),
            gh_result(response([issue(24)], True, None)),
            gh_result(response([issue(24)], "false")),
            gh_result(response([issue(24)], True, "next")),
            subprocess.CompletedProcess([], 0, stdout=SENTINEL),
        ]
        for failure in failures:
            with self.subTest(failure=type(failure).__name__):
                first_page = gh_result(response([issue(23)], True, "next"))
                with patch.object(controller.subprocess, "run", side_effect=[first_page, failure]):
                    result = decide(event_for(CASES[0]))
                self.assertEqual(result["target"], {"issue_number": None, "resolution": "lookup_failed"})
                self.assertEqual(result["decision"], "no-op")
                self.assertIsNone(result["intended_status"])
                self.assertNotIn(SENTINEL, json.dumps(result))


class CliTests(unittest.TestCase):
    def invoke(self, event_text, api_result=None):
        with tempfile.TemporaryDirectory() as directory:
            event_path = Path(directory) / "event.json"
            event_path.write_text(event_text, encoding="utf-8")
            env = {
                "GITHUB_EVENT_NAME": "pull_request_target", "GITHUB_EVENT_PATH": str(event_path),
                "GITHUB_REPOSITORY": REPOSITORY, "GITHUB_RUN_ID": RUN["id"],
                "GITHUB_RUN_ATTEMPT": RUN["attempt"], "GH_TOKEN": SENTINEL,
            }
            output = io.StringIO()
            with patch.dict(controller.os.environ, env, clear=True), redirect_stdout(output):
                with patch.object(controller.subprocess, "run", return_value=api_result) as run:
                    code = controller.main()
        self.assertEqual(len(output.getvalue().splitlines()), 1)
        self.assertNotIn(SENTINEL, output.getvalue())
        return code, json.loads(output.getvalue()), run.call_count

    def test_cli_outputs_action_and_trace(self):
        code, result, calls = self.invoke(json.dumps(event_for(CASES[0])), gh_result(response([issue(23)])))
        self.assertEqual((code, calls), (0, 1))
        self.assertEqual(result["decision"], "action")
        self.assertEqual(result["run"], RUN)

    def test_cli_expected_noop_succeeds(self):
        code, result, _ = self.invoke(json.dumps(event_for(CASES[0])), gh_result(response([])))
        self.assertEqual(code, 0)
        self.assertEqual(result["target"]["resolution"], "missing")

    def test_cli_lookup_failure_fails_with_structured_noop(self):
        code, result, _ = self.invoke(json.dumps(event_for(CASES[0])), gh_result({"errors": [SENTINEL]}))
        self.assertEqual(code, 1)
        self.assertEqual(result["decision"], "no-op")
        self.assertEqual(result["target"]["resolution"], "lookup_failed")

    def test_cli_invalid_event_fails_without_lookup(self):
        for text in (SENTINEL, "null", '{"action":"opened"}'):
            with self.subTest(text=text):
                code, result, calls = self.invoke(text)
                self.assertEqual((code, calls), (1, 0))
                self.assertEqual(result["target"]["resolution"], "invalid_event")


if __name__ == "__main__":
    unittest.main()
