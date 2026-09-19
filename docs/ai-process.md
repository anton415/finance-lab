# PR and CI observations

The `Collect PR observations` workflow writes append-only raw JSON snapshots to the separate `metrics` branch at `data/prs/<number>/<run-id>-<attempt>.json`. No generated observations or reports belong on `main`.

Each observation contains a PR's timestamps, commit count, additions, deletions, changed-file count, review states, and CI workflow-run attempts. `data/report.json` is regenerated deterministically from all raw observations by `scripts/metrics/report.mjs`; it provides cycle time, commits per PR, change size, CI attempts/failures, and observed `CHANGES_REQUESTED` reviews. The report includes one row per captured observation, ordered by PR number.

CI writes an artifact and job-summary record with the tested SHA, GitHub Actions run ID, attempt, and run URL.

## Definitions and limits

- Cycle time is the time from PR creation to closing. Open PRs are `unknown`.
- A CI failure is a completed pull-request workflow run whose conclusion is not `success`.
- Review/correction rounds count observable `CHANGES_REQUESTED` reviews. They do not prove that a later commit corrected a particular comment.
- First-pass success remains `unknown`. GitHub PR/CI data cannot reliably establish that an agent implementation was accepted without an implementation correction after review.
- Records intentionally contain no prompts, conversation text, token/cost data, or inference about whether a human or AI authored a change.

The collector and report transformations are covered by Node tests in `scripts/metrics`.
