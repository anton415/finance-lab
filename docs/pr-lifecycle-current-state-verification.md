# Issue #94 verification

## Synthetic checks

Observed locally with Python 3.14.5: all 49 lifecycle tests passed, the standalone
controller assertions passed, and all 16 fixture replays matched the table below.
Every repeat made zero writes. Workflow YAML parsing and assertions confirmed the
seven wake-ups, read-only default permissions, issue-write-only live permissions,
and trusted `main` checkout with persisted credentials disabled. `git diff --check`
passed. These checks make no GitHub mutations.

Run from the repository root with Python 3.12+:

```bash
.venv/bin/python -m unittest discover -s tests/python -p 'test_workflow*.py' -v
.venv/bin/python -m tests.python.check_workflow_controller
```

Replay all controlled fixtures through the live adapter with intercepted APIs:

```bash
PYTHONPATH=tests/python .venv/bin/python - <<'PY'
import json
from test_workflow_live import CASES, apply, fixture_api

for case in CASES:
    api = fixture_api(case)
    first = apply(case, api)
    repeat = apply(case, api)
    assert repeat["outcome"] == "no-op" and repeat["writes"] == []
    print(json.dumps({
        "fixture": case["name"], "target": first["target"],
        "status": first["intended_status"], "outcome": first["outcome"],
        "diagnostic": first.get("diagnostic"), "writes": first["writes"],
        "repeat_writes": repeat["writes"],
    }, sort_keys=True))
PY
```

Expected results with these synthetic starting states:

| Fixture | First result | Confirmed writes |
| --- | --- | --- |
| Opened draft | In progress, no workflow labels | Remove labels, set Status |
| Opened ready | Review, `needs:review` | Remove labels, set Status, add review label |
| Ready for review | Review, `needs:review` | Remove labels, set Status, add review label |
| Converted to draft | In progress, no workflow labels | Remove labels, set Status |
| Reopened draft | In progress, no workflow labels | Remove labels, set Status |
| Reopened ready | Review, `needs:review` | Remove labels, set Status, add review label |
| Merged close, controller owns Done | Done, no workflow labels | Remove labels, set Status |
| Unmerged close | No-op | None |
| No closing issue | `missing` no-op | None |
| Multiple closing issues | `ambiguous` no-op | None |
| Delayed ready event, currently draft | In progress, no workflow labels | Remove labels, set Status |
| Delayed draft event, currently ready | Review, `needs:review` | Remove labels, set Status, add review label |
| Edited relationship from issue 23 to 24 | Only current issue 24 reconciled | Remove labels, set Status, add review label |
| Synchronize after `needs:human` handoff | Review, `needs:review` | Remove labels, add review label |
| Synchronize with Review already satisfied | No-op | None |
| Fingerprint changes before first write | `stale_snapshot` no-op | None |

Every repeated fixture must produce zero writes. Unit tests also check each
fingerprint field independently, a changed relationship without a changed
`updatedAt`, failed rechecks, inconsistent paginated snapshots, and both Done
owners. Timestamp-only changes allow writes and pagination to finish while the
timestamp remains in evidence. Project-owned Done only clears workflow labels.

## Real controlled rollout — pending human merge

The candidate PR remains draft for inspection of its draft-open transition.
That transition executes the existing trusted `main` implementation and cannot
prove that #94 is deployed. Local fixtures do not establish live acceptance.

After human review and merge, use disposable synthetic issues already in the
configured Project and a disposable PR with one closing relationship:

1. Open it as draft and record the lifecycle run ID/attempt, snapshot, confirmed
   writes, issue labels, and Project Status.
2. Mark it ready; record that run ID. Convert it back to draft and let that run
   finish. Rerun the earlier ready-event run while the PR is still draft. Expect
   a current draft snapshot, In Progress, no workflow labels, and zero writes if
   the draft transition already converged. The old ready action must not restore
   Review. Record the exact rerun ID/attempt and observed writes/no-writes.
3. Alternatively, edit the closing relationship from synthetic issue A to B.
   Inspect the `edited` run, then rerun an older run. Both must resolve only B
   from current state. Record A's unchanged state and B's observed state.
4. Rerun once more without changing PR/issue state: expect `outcome: no-op` and
   `writes: []`. Record exact run ID/attempt and final labels/Status.

The live evidence record must include PR/issue URLs, run IDs/attempts, snapshot
and target, confirmed `writes`, and observed issue labels/Project Status. Leave
this criterion pending until the evidence is inspected. The controller never
merges a PR or grants final approval; any merge stays human-controlled.
