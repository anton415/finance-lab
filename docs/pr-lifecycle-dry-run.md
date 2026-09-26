# PR lifecycle dry-run

[Issue #41](https://github.com/anton415/finance-lab/issues/41) adapts the existing
[Python controller](../scripts/workflow_controller.py) to the
[Status + needs:* contract](https://github.com/anton415/finance-lab/issues/81).
It logs proposed changes only. It has no Project or label mutation path.

## Event mapping

The following applies only when exactly one same-repository closing issue is
resolved. Descriptive labels such as `learning` are outside these decisions.

| PR action/state | Intended Status | Intended workflow label change |
| --- | --- | --- |
| `opened`, draft | In progress | Remove `needs:implementation` |
| `opened`, ready | Review | Replace all `needs:*` labels with `needs:review` |
| `ready_for_review` | Review | Replace all `needs:*` labels with `needs:review` |
| `converted_to_draft` | In progress | Remove `needs:review` and `needs:human` |
| `reopened`, draft | In progress | No label change |
| `reopened`, ready | Review | Replace all `needs:*` labels with `needs:review` |
| `closed`, merged | Done | Clear all `needs:*` labels |
| `closed`, unmerged | No change | No change |

Review transitions replace other workflow labels to preserve #81's at-most-one
invariant. A reopened draft changes only Status, as specified in #41.

## Target resolution and failures

The controller reads GitHub's
[`closingIssuesReferences`](https://docs.github.com/en/graphql/reference/pulls#pullrequest)
relationship using a fixed GraphQL query through `gh api`. It reads every page,
keeps distinct issue numbers whose repository matches the PR's base repository,
and requires exactly one. Foreign-repository relationships cannot become targets.
Branch names, titles, bodies, and PR-head repositories do not select the issue.
GitHub's relationship is authoritative; the controller does not recreate closing
keyword rules or fall back to text parsing when no relationship is available.

Zero matching issues produces `missing`; multiple matches produces `ambiguous`.
Both are successful, explicit no-ops. API, permission, timeout, or malformed
response failures produce `lookup_failed`, no intended changes, and exit code 1.
Partial API results are discarded. Invalid event payloads also fail safely.

## Evidence and retries

Each invocation writes one JSON record to the **Log intended lifecycle state**
step of the **PR lifecycle dry-run** workflow. Fields include:

- `event`, `action`, `run.id`, `run.attempt`, and `pr_number` for traceability;
- `target.issue_number` and `target.resolution` for the resolved target or no-op;
- `decision` (`action` or `no-op`), `intended_status`, and `intended_needs`;
- `dry_run: true` and a fixed, human-readable `reason`.

`intended_needs` describes an operation: clear all `needs:*` labels when
`clear_all` is true, remove the explicitly listed labels, then add the listed
labels. These are intentions only; no current labels or Project fields are read
or written. A no-op has null Status and empty label operations.

The same event and relationship data produce the same decision. A rerun's
attempt number changes only the trace fields. Relationship data is read anew,
so an edited relationship is a changed input. There is no clock-dependent
decision, automatic API retry, or persistent deduplication store. #82 will be
responsible for reading current state and skipping already-satisfied writes.

## Security boundary

The [workflow](../.github/workflows/pr-lifecycle-dry-run.yml) handles
`pull_request_target` with only `contents: read`, `pull-requests: read`, and
`issues: read`. It explicitly checks out trusted `main`, disables persisted Git
credentials, and executes no PR-head code or artifacts. The token is available
only to the read-only lookup step. PR-controlled strings are never interpolated
into shell commands, and title/body/branch text and raw API errors are not logged.

The separate ordinary CI workflow tests candidate code with synthetic fixtures;
it does not run live lookups. The new lifecycle workflow executes the version
on `main`, so this PR's code will handle real PR events only after it is merged.

## Verification and human acceptance

Use Python 3.12+ and the standard library. From the repository root:

```bash
.venv/bin/python -m unittest discover -s tests/python -p 'test_workflow_controller.py' -v
.venv/bin/python -m tests.python.check_workflow_controller
```

The [controlled fixtures](../fixtures/pr-lifecycle/cases.json) cover all ten
required action/no-op cases. The tests also cover cross-repository relationships,
pagination, API failures, malformed inputs, untrusted PR text, CLI output/exit
status, and deterministic retries. CI runs the new test suite with Python 3.12.

To inspect all ten structured records locally without network access:

```bash
PYTHONPATH=tests/python .venv/bin/python - <<'PY'
import json
from unittest.mock import patch
from test_workflow_controller import (
    CASES, controller, decide, event_for, gh_result, issue, response,
)

for case in CASES:
    api = gh_result(response([issue(number) for number in case["issues"]]))
    with patch.object(controller.subprocess, "run", return_value=api):
        print(json.dumps(decide(event_for(case)), sort_keys=True))
PY
```

Before #82 starts, the human must inspect representative dry-run evidence and
explicitly accept or reject it. Check event/PR/issue identity, every mapped
Status/label intent, missing and ambiguous targets, and a repeated input. After
merge, also inspect real event logs to confirm GitHub relationship resolution.
Passing tests or creating/merging this PR does not record that human acceptance.
Final PR review and merge remain human decisions.
