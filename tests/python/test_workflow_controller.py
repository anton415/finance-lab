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
            "number": 17, "draft": case["draft"], "merged": case["merged"],
            "base": {"repo": {"full_name": REPOSITORY}},
        },
    }


def issue(number, repository=REPOSITORY):
    return {"number": number, "repository": {"nameWithOwner": repository}}


def response(nodes, has_next=False, cursor=None):
    return {"data": {"repository": {"pullRequest": {"closingIssuesReferences": {
        "nodes": nodes, "pageInfo": {"hasNextPage": has_next, "endCursor": cursor},
    }}}}}


def gh_result(body):
    return subprocess.CompletedProcess([], 0, stdout=json.dumps(body), stderr="")


def decide(event, lookup=controller.closing_issue_numbers, run=None):
    return controller.dry_run("pull_request_target", event, REPOSITORY, run or RUN, lookup)


class LifecycleTests(unittest.TestCase):
    def test_all_required_fixture_decisions_through_api_adapter(self):
        self.assertEqual(len(CASES), 10)
        for case in CASES:
            with self.subTest(case=case["name"]):
                event = event_for(case)
                original = deepcopy(event)
                body = response([issue(number) for number in case["issues"]])
                with patch.object(controller.subprocess, "run", return_value=gh_result(body)):
                    result = decide(event)
                expected = case["expected"]
                self.assertEqual(result["decision"], expected["decision"])
                self.assertEqual(result["intended_status"], expected["status"])
                self.assertEqual(result["intended_needs"], {
                    key: expected[key] for key in ("add", "remove", "clear_all")
                })
                self.assertEqual(result["target"], {
                    "issue_number": 23 if expected["resolution"] == "resolved" else None,
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
                lookup = Mock(return_value=case["issues"])
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
                lookup = Mock(return_value=numbers)
                result = decide(event, lookup)
                lookup.assert_called_once_with(REPOSITORY, 17)
                self.assertNotIn(SENTINEL, json.dumps(result))
                self.assertNotIn("999", json.dumps(result))
                self.assertEqual(result["target"]["issue_number"], 23 if numbers else None)

    def test_invalid_payloads_do_not_resolve_a_target(self):
        malformed = [None, [], {}, {"action": "opened"}]
        for key, value in (("number", True), ("number", -1), ("number", "17"),
                           ("draft", "false"), ("merged", None), ("base", None),
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
        for event_name, action in (("push", "opened"), ("pull_request_target", "synchronize")):
            event = event_for(CASES[0])
            event["action"] = action
            lookup = Mock()
            result = controller.dry_run(event_name, event, REPOSITORY, RUN, lookup)
            self.assertEqual(result["decision"], "no-op")
            lookup.assert_not_called()


class RelationshipTests(unittest.TestCase):
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
            self.assertEqual(controller.closing_issue_numbers(REPOSITORY, 17), [24])

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
