# PR lifecycle dry-run

[Issue #94](https://github.com/anton415/finance-lab/issues/94) makes the
[Python controller](../scripts/workflow_controller.py) reconcile current PR
state using `desired_pr_status(state, draft, merged)` from #97. It logs proposed
changes only. The [live adapter](pr-lifecycle-live.md) consumes the same decisions
and checks the PR fingerprint again before writing.

## Current-state decisions

Events wake the controller. `opened`, `edited`, `synchronize`, `ready_for_review`,
`converted_to_draft`, `reopened`, and `closed` all use the same current-state
rules. Event-time draft/merged fields, titles, and bodies do not decide the result.
Exactly one current same-repository closing issue is required.

| Current PR state | Intended Status | Intended workflow label change |
| --- | --- | --- |
| Open, draft | In progress | Clear all `needs:*` labels |
| Open, ready | Review | Replace all `needs:*` labels with `needs:review` |
| Closed, merged | Done | Clear all `needs:*` labels |
| Closed, unmerged | No change | No change |

Descriptive labels are preserved. A delayed ready event on a currently draft PR
produces In progress. A delayed draft event on a currently ready PR produces
Review. `synchronize` on a ready PR restores `needs:review` after a human handoff.
The original `workflow_controller(event, draft, merged)` remains for its learning
checks; production decisions call only the state-based core.

## Snapshot, target resolution, and failures

One fixed GraphQL query reads PR number, state, draft and merged flags, head SHA,
`updatedAt`, and GitHub's
[`closingIssuesReferences`](https://docs.github.com/en/graphql/reference/pulls#pullrequest).
It reads every relationship page and rejects a lifecycle state or head SHA change
between pages. `updatedAt` remains evidence only; timestamp changes caused by
conversation activity do not invalidate pagination or the pre-write fingerprint.
References are deduplicated and sorted. Exactly one distinct issue whose
repository matches the PR's base repository is required; foreign references
remain in the fingerprint but cannot become targets. GraphQL `MERGED` normalizes
to `closed` with `merged: true` for the decision core.

Branch names, titles, bodies, and PR-head repositories do not select the issue.
The controller does not recreate closing-keyword rules or fall back to parsing
text. An edited relationship selects the current issue; it does not undo changes
to an issue linked previously.

Zero matching issues produces `missing`; multiple matches produces `ambiguous`.
Both are successful no-ops. API, permission, timeout, missing PR, malformed or
inconsistent snapshot failures produce `lookup_failed`, no intended changes, and
exit code 1. Partial results are discarded. Invalid event identities fail safely.

## Evidence and retries

Each invocation emits one JSON record. Fields include:

- `event`, `action`, `run.id`, `run.attempt`, and `pr_number` for traceability;
- `snapshot`: validated PR identity, state, revision, and all closing references;
- `target.issue_number` and `target.resolution`;
- `decision`, `intended_status`, and `intended_needs`;
- `dry_run: true` and a fixed, human-readable `reason`.

`intended_needs` clears all workflow labels when `clear_all` is true, removes the
explicitly listed labels, then adds the listed labels. These are intentions only;
the dry-run CLI does not read or write issue labels or Project fields. A no-op
has null Status and empty label operations.

The same current snapshot produces the same decision regardless of the event
that woke the controller. Every rerun reads a fresh snapshot. There is no
internal retry loop or persistent deduplication store. The live adapter skips
already-satisfied writes and returns a sanitized `stale_snapshot` no-op if the
fingerprint changed before its first mutation.

## Security boundary

The read-only job in the [workflow](../.github/workflows/pr-lifecycle.yml) handles
`pull_request_target` with only `contents: read`, `pull-requests: read`, and
`issues: read`. It checks out trusted `main`, disables persisted Git credentials,
and executes no PR-head code or artifacts. The token is available only to the
lookup step. Queries and variables go through stdin with no shell interpolation;
PR title/body/branch text, raw API errors, and secrets are not logged. Repository
queries remove the Project token from the subprocess environment.

Ordinary CI tests candidate code with synthetic fixtures. The privileged
lifecycle workflow runs the code on `main`, so candidate code handles real events
only after human review and merge. This preserves GitHub's
[trusted-code guidance](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target).

## Verification

Use Python 3.12+ and the standard library. From the repository root:

```bash
.venv/bin/python -m unittest discover -s tests/python -p 'test_workflow*.py' -v
.venv/bin/python -m tests.python.check_workflow_controller
```

The [16 controlled fixtures](../fixtures/pr-lifecycle/cases.json) cover normal
lifecycle states, delayed events, changed relationships, missing/ambiguous targets,
review restoration, stale fingerprints, and idempotent repeats. Additional tests
cover pagination, malformed snapshots, API errors, credentials, both Done owners,
partial-write retries, CLI output, and exit status. See the
[verification record](pr-lifecycle-current-state-verification.md) for replay and
post-merge live checks. Final PR review and merge remain human decisions.
