# PR and CI observations

The `Collect PR observations` workflow writes append-only raw JSON snapshots to the separate `metrics` branch at `data/prs/<number>/<run-id>-<attempt>.json`. No generated observations or reports belong on `main`.

Each observation contains a PR's timestamps, commit count, additions, deletions, changed-file count, review states, and CI workflow-run attempts. `data/report.json` is regenerated deterministically from all raw observations by `scripts/metrics/report.mjs`. It uses the latest `collected_at` snapshot for PR fields and reviews. CI attempts are combined across that PR's snapshots by `(id, run_attempt)`, keeping the latest observed state of each attempt. The report includes one row per PR, ordered by PR number.

CI writes an artifact and job-summary record with the tested SHA, GitHub Actions run ID, attempt, and run URL.

## Definitions and limits

- Cycle time is the time from PR creation to closing. Open PRs are `unknown`.
- CI attempts count distinct retained pull-request workflow-run attempts, including pending attempts. Repeated snapshots count once; a retained retry counts separately. The collector queries only the current PR head, so missed heads or retry attempts remain unobserved. These counts are not guaranteed complete lifecycle totals.
- The existing `ci_failures` field counts completed retained pull-request attempts whose conclusion is not `success`. This is a non-success count, not a diagnosis of product defects: a cancellation, skip, or unknown conclusion would also match. Non-PR runs, including skipped collectors after a `push` CI run, are excluded by the collector's API query and workflow guard. No failed or retried CI attempt is present in the validated sample; see the [M3 evidence note](agentops-metrics-validation.md).
- Review/correction rounds count observable `CHANGES_REQUESTED` reviews. They do not prove that a later commit corrected a particular comment.
- First-pass success remains `unknown`. GitHub PR/CI data cannot reliably establish that an agent implementation was accepted without an implementation correction after review.
- Records intentionally contain no prompts, conversation text, token/cost data, or inference about whether a human or AI authored a change.

The collector and report transformations are covered by Node tests in `scripts/metrics`.

## Privileged PR observation trigger

`Collect PR observations` intentionally uses `pull_request_target` for PR lifecycle events. A `pull_request` workflow from a fork receives a read-only token and therefore cannot publish the append-only snapshots to the `metrics` branch. The collector needs that write permission; the separate `workflow_run` trigger records completed CI runs, and manual dispatch supports backfills.

This is safe only because the workflow checks out `main`, and executes the collector and report scripts from that trusted checkout. It must never check out, fetch, build, test, install, or execute PR-head code, nor download and execute artifacts from PR workflows. PR numbers and GitHub API responses are treated only as data.

Before November 2, 2026, a repository administrator must create an active repository Actions policy scoped to `.github/workflows/collect-pr-observations.yml` with a `restrict_action_events` rule that allows exactly `pull_request_target`, `workflow_run`, and `workflow_dispatch`. This explicit allowlist keeps the collector running after GitHub enforces the public-repository default that blocks `pull_request_target`; it should be removed if the collector is redesigned so that it no longer needs a write-capable PR-event workflow. Verify the policy in **Settings → Actions → Policies** and use policy insights before changing the workflow's trust boundary.
