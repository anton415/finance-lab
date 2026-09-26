# Live PR lifecycle updates

[Issue #82](https://github.com/anton415/finance-lab/issues/82) adds
[`scripts/workflow_live.py`](../scripts/workflow_live.py) around the accepted
[#41 dry-run](pr-lifecycle-dry-run.md). `dry_run()` remains the only source of
event mapping, issue resolution, and label intentions. The live adapter reads
current state and applies the difference. The original dry-run CLI stays read-only.

## Behavior

The adapter resolves exactly one same-repository closing issue through GitHub's
relationship, then reads all issue labels and Project memberships. Only the
existing, unarchived issue item in the configured Project is eligible. It reads
the Project's `Status` field, available options, and the item's current value.
It never adds an item, creates a field/option/label, or infers targets from PR text.

For an action, all reads and configuration checks finish before any mutation:

1. Calculate desired workflow labels from the dry-run intent.
2. If that would leave multiple `needs:*` labels, log a no-op requiring human
   correction. Do not choose an arbitrary label to keep.
3. Remove only obsolete workflow labels, in one mutation.
4. Set Status only when needed and owned by this adapter.
5. Add `needs:review` only when missing, after conflicting labels are removed.

Descriptive labels are preserved. An already-satisfied delivery makes no writes.
A retry rereads current state, so partial writes and uncertain API responses
converge without a deduplication store. Missing/ambiguous closing relationships
and closed-unmerged PRs remain logged no-ops, with no Project reads or mutations.
Incomplete state, missing configuration, or API failures stop writes and exit 1.

The workflow serializes runs for the same PR without cancelling a running write.
GitHub concurrency is not a durable event queue; newer pending runs can replace
older pending runs. The adapter implements the received event's accepted intent.
It does not replay history or reconcile manual edits made concurrently with an
API write. Before manually rerunning an old event, confirm it is still relevant.

## Human configuration and Done ownership

Live execution is disabled until `LIFECYCLE_PROJECT_ID` is configured. Until then,
the existing read-only job continues to log intentions. Configure these under
repository **Settings → Secrets and variables → Actions**:

| Setting | Kind | Value |
| --- | --- | --- |
| `LIFECYCLE_PROJECT_TOKEN` | Secret | Token with access to the intended Project |
| `LIFECYCLE_DONE_OWNER` | Variable | Exactly `project` or `controller`, as below |
| `LIFECYCLE_PROJECT_ID` | Variable | ProjectV2 node ID (`PVT_…`), set last to enable live execution |

Select exactly one Done authority before enabling:

- `project`: retain the Project's built-in **closed issue → Done** automation.
  On merged close the adapter only clears workflow labels; it never writes Done,
  even if the built-in automation has not run yet. Verify that closing the linked
  issue actually triggers the configured built-in workflow.
- `controller`: disable the built-in Done automation for these issues. The
  adapter writes Done on merged close only if it is not already satisfied.

An absent or invalid Done owner prevents all live writes. The setting records the
human's choice; the adapter does not configure or infer Project automation settings.
Disable other Project automations that conflict with the accepted #81 transitions.

The Project must contain a single-select `Status` field with `In progress` and
`Review` options, plus `Done` when the controller owns Done. The repository's
`needs:review` label must already exist. Field and option IDs are discovered from
the Project, so they do not need separate variables. Ensure controlled issues
are added to the Project before generating events. A missing item fails safely;
rerun a still-relevant event after adding the item.

## Permissions and trusted code

The live job uses `GITHUB_TOKEN` with `contents: read`, `pull-requests: read`, and
`issues: write`. That token resolves relationships and reads/updates labels.
There is no repository-content write, PR write, Actions write, or merge permission.

Project requests use only `LIFECYCLE_PROJECT_TOKEN`. Prefer a fine-grained token
limited to the repository, with **Issues: read** and the owning user's or
organization's **Projects: read and write** permission. Select only the Project
where the token UI supports that restriction. No Contents, Pull requests, or
Issues write permission is needed on this separate token. A classic token's
`project` scope is broader; avoid adding unrelated scopes. Follow GitHub's
[Project API authentication guidance](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects).
Never put a token in a command argument, fixture, log, or PR comment.

Both jobs explicitly check out trusted `main` with persisted Git credentials
disabled. They execute no PR-head code or artifacts and install no repository
dependencies. Credentials are passed only to the relevant execution step. API
queries use fixed GraphQL documents and JSON variables through stdin, without a
shell. Logs retain the dry-run trace and add `outcome` and confirmed `writes`;
raw API responses/errors, label names, and PR text are not logged.

Read failures include a fixed `diagnostic` code and a sanitized `reason`:

| Diagnostic | Failed stage |
| --- | --- |
| `repository_read` | Repository issue/label query, response validation, or label pagination |
| `project_query` | Project query (including token authorization failures), or missing/wrong-type Project node |
| `project_membership` | Missing, ambiguous, malformed, or incompletely paginated item membership |
| `status_validation` | Missing/malformed Status field, options, or current value; desired option unavailable |
| `workflow_label_lookup` | Malformed `needs:review` lookup, or label absent when it must be added |

These codes identify the failed stage, not the underlying API error. In particular,
`project_query` does not prove an authorization problem. Project-node type is
checked using `__typename`; API error text and response values are never copied
into diagnostics. Every categorized failure exits 1 with `outcome: error` and
`writes: []`. An unset current Status remains valid, and a missing `needs:review`
label only blocks an action that needs to add it.

No agent starts, comments, merge automation, or automatic final approval are added.

## Verification and rollout

Controlled tests use only synthetic fixtures and intercepted GitHub APIs:

```bash
.venv/bin/python -m unittest discover -s tests/python -p 'test_workflow*.py' -v
.venv/bin/python -m tests.python.check_workflow_controller
```

They cover the ten accepted fixtures, minimal/idempotent mutations, both Done
owners, label invariants, pagination, incomplete reads, API failures, retries at
each write (including uncertain success), credentials, and structured CLI output.
CI runs the same lifecycle test suite on Python 3.12.

After human review and merge deploy the adapter to trusted `main`, configure
the settings above and exercise synthetic, disposable issues already in the
Project. Use a PR with one GitHub-recognized same-repository closing relationship:

1. Open a draft: inspect `In progress` and cleared `needs:implementation`.
2. Mark ready: inspect `Review` and only `needs:review`.
3. Rerun that workflow before another transition: expect `outcome: no-op`,
   `writes: []`, and unchanged Project/labels.
4. Perform the final review and merge **manually**: inspect `Done` and no workflow
   labels. With `project` ownership, confirm the adapter made no Done write.
5. On a separate controlled PR, record issue state then close without merging:
   confirm the state is unchanged and the log reports a no-op.

Record run URLs, observed Project Status/labels, and the repeated-run evidence.
Local fixtures and read-only API checks do not establish this live acceptance
criterion. Keep #82 open until the real controlled lifecycle is verified; use a
closing keyword only after its full acceptance criteria are satisfied.

To disable live execution, remove `LIFECYCLE_PROJECT_ID`; future runs return to
dry-run. Inspect any already-running job before making manual state corrections.
