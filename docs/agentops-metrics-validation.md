# M3 AgentOps metrics validation

Validated for [#42](https://github.com/anton415/finance-lab/issues/42) on
2026-09-26. The report discarded CI runs from earlier PR heads. Combining retained
attempts corrects the pinned dataset from **21 to 33 observed CI attempts** across
21 PRs. This supports a small descriptive baseline with the limitations below.

## Sample and method

Sources are pinned so later collector runs cannot change this result:

- Raw observations and stored report: metrics commit
  [`cb6e594`](https://github.com/anton415/finance-lab/tree/cb6e594aa8211ba7940b75fce73cdee22ee739eb/data).
- Original collector, report and workflow definitions: main commit
  [`8346be0`](https://github.com/anton415/finance-lab/tree/8346be09795e254b1915f861d19869eb00385ff4).
- Corrected calculation: [`report.mjs`](../scripts/metrics/report.mjs) in this PR.

The source has 88 snapshots for 21 completed PRs, collected from
2026-09-19 16:28:52.335 UTC through 2026-09-26 08:24:23.271 UTC. Snapshot identity
is `(PR number, collector_run.id, collector_run.attempt)`; none is duplicated.
There are 88 CI entries but only 33 distinct `(PR number, id, run_attempt)` keys.
Repeated entries include pending and completed states of the same attempt.
All 33 latest retained states are `completed/success`, and every `run_attempt`
is 1. No real failed attempt or same-run retry is available in this source.

Selected four completed lifecycles by evidence shape, before changing code:

| PR / pinned raw folder | Reason | Snapshots | CI run IDs (each attempt 1) |
| --- | --- | ---: | --- |
| [#17](https://github.com/anton415/finance-lab/tree/cb6e594aa8211ba7940b75fce73cdee22ee739eb/data/prs/17) | Clean lifecycle: one head, one successful run | 3 | `35497660185` |
| [#29](https://github.com/anton415/finance-lab/tree/cb6e594aa8211ba7940b75fce73cdee22ee739eb/data/prs/29) | Four heads/runs and observable review metadata | 9 | `35632676983`, `35633891196`, `35682770563`, `35683898219` |
| [#80](https://github.com/anton415/finance-lab/tree/cb6e594aa8211ba7940b75fce73cdee22ee739eb/data/prs/80) | Recent two-head lifecycle confirming the same undercount | 5 | `36030369469`, `36035475350` |
| [#85](https://github.com/anton415/finance-lab/tree/cb6e594aa8211ba7940b75fce73cdee22ee739eb/data/prs/85) | Recent implementation PR for #82 live workflow automation | 3 | `36228709300` |

Inspected every raw file in these folders, reproduced the stored report with the
original script, and traced each metric through
[`collectObservation`](../scripts/metrics/collect.mjs) and
[`buildReport`](../scripts/metrics/report.mjs). Compared the corrected report with
the original across all 21 PRs. GitHub run metadata was read only to spot-check
the exclusion of surrounding non-PR runs; it is not an input to the calculations.

## Definitions, classifications and results

**Verified** means raw evidence and calculation agree. **Corrected** means an
evidenced defect was fixed. **Limited** means interpretation or coverage is
partial. **Unavailable** means the observations cannot support the measurement.

| Metric | Classification | Source and calculation / limit |
| --- | --- | --- |
| CI attempts | **Corrected** | Combine all snapshots per PR, deduplicate by CI `(id, run_attempt)`, use the latest `collected_at` state per attempt, then count. Pending attempts count. Coverage is limited to retained attempts. |
| CI failures | **Limited** | Count retained attempts with `status = completed` and `conclusion != success`. All sampled results are 0, consistent with the raw states. This existing definition counts non-success outcomes, including a cancellation, skip or unknown conclusion if returned for a PR run; it does not identify product defects. Positive failure and retry behavior has only synthetic test evidence. |
| Skipped / non-PR runs | **Verified** | The collector requests `event=pull_request`; the workflow skips `workflow_run` deliveries whose originating event is not `pull_request`. These excluded runs are absent from `ci_runs` and contribute neither attempts nor failures. This verifies exclusion, not a total count of skipped repository workflows. |
| PR cycle time | **Verified** | Latest `pr.closed_at - pr.created_at`, in hours; timestamps are UTC. Open PRs remain `unknown`. Includes waiting and draft time; does not measure active work. |
| Commits | **Verified** | Collector counts the paginated PR commits response; report copies latest `pr.commits`. This is the final observed PR commit-list size, not every commit ever pushed or a correction count. |
| Files changed | **Verified** | Collector counts the paginated PR files response; report copies latest `pr.changed_files`. This describes the final diff, not cumulative file edits. |
| Review / correction rounds | **Limited** | Count latest snapshot reviews whose state is `CHANGES_REQUESTED`. #29 has five `COMMENTED` reviews and reports 0; the other sample PRs have no retained reviews. Zero does not establish that no feedback or correction occurred. Comment text and causal links to fixes are not retained. |
| First-pass success | **Unavailable** | Remains `unknown` for every PR. Successful CI, no change-request reviews, or one commit cannot establish acceptance without correction. |

The following values agree with the pinned raw observations. Hours are rounded
here to six decimals; the report keeps the unrounded division by 3,600,000.

| PR | Created → closed (UTC) | Cycle hours | Commits | Files | Attempts before → after | Non-success attempts | Change-request reviews |
| --- | --- | ---: | ---: | ---: | --- | ---: | ---: |
| #17 | Sep 20 07:43:58 → Sep 20 07:53:03 | 0.151389 | 1 | 2 | 1 → 1 | 0 | 0 |
| #29 | Sep 21 17:32:34 → Sep 22 03:55:07 | 10.375833 | 4 | 3 | 1 → 4 | 0 | 0 |
| #80 | Sep 24 16:52:22 → Sep 24 17:41:48 | 0.823889 | 2 | 7 | 1 → 2 | 0 | 0 |
| #85 | Sep 26 08:04:50 → Sep 26 08:24:15 | 0.323611 | 1 | 7 | 1 → 1 | 0 | 0 |

## Discrepancy and fix

**High confidence; material undercount for lifecycle comparisons.** The collector
queries CI using the current `pr.head.sha`. The old report selected the latest
PR snapshot before counting its `ci_runs`, losing runs retained for earlier heads.

For #80, [`36030466021-1.json`](https://github.com/anton415/finance-lab/blob/cb6e594aa8211ba7940b75fce73cdee22ee739eb/data/prs/80/36030466021-1.json)
retains successful run `36030369469`; the final
[`36036106622-1.json`](https://github.com/anton415/finance-lab/blob/cb6e594aa8211ba7940b75fce73cdee22ee739eb/data/prs/80/36036106622-1.json)
retains successful run `36035475350` on a different head. The stored report counts
only the latter. #29 similarly retains four distinct runs but reports one.

The fix combines CI evidence across snapshots while retaining the existing latest
snapshot rule for PR fields and reviews. Deduplication uses both run ID and attempt
number, so repeated observations do not inflate counts and an observed retry does
not erase an earlier failure. A lone `run_attempt = 3` counts as one observed
attempt; it does not fabricate records or outcomes for attempts 1 and 2.

Only `ci_attempts` changes in the pinned report: #12 1→2, #21 1→2, #29 1→4,
#31 1→2, #76 1→2, #78 1→3, #79 1→3, #80 1→2. Every other report field agrees
with the original. Raw records, the collector and workflow remain unchanged.

### Skipped-run spot-check

Near #85's merge, GitHub reports [CI run `36229673919`](https://github.com/anton415/finance-lab/actions/runs/36229673919)
as `push/success` and [collector run `36229721798`](https://github.com/anton415/finance-lab/actions/runs/36229721798)
as `workflow_run/skipped`. Neither ID occurs in the retained `ci_runs`.
This agrees with the API filter and job guard in
[`collect-pr-observations.yml`](../.github/workflows/collect-pr-observations.yml).
The skipped collector is not a failed product check. Its ID is distinct from the
collector IDs in raw filenames and from the PR CI IDs counted in the report.

## Reproduce and verify

Run from this PR's checkout with Git and Node installed. Outputs stay in a
temporary directory; generated observations and reports belong on `metrics`.

```bash
set -e
git fetch origin main metrics
metrics_ref=cb6e594aa8211ba7940b75fce73cdee22ee739eb
baseline_ref=8346be09795e254b1915f861d19869eb00385ff4
validation_dir=$(mktemp -d)
git archive "$metrics_ref" data | tar -x -C "$validation_dir"
git show "${baseline_ref}:scripts/metrics/report.mjs" > "$validation_dir/report-before.mjs"
node "$validation_dir/report-before.mjs" "$validation_dir/data/prs" "$validation_dir/report-before.json"
cmp "$validation_dir/data/report.json" "$validation_dir/report-before.json"
node scripts/metrics/report.mjs "$validation_dir/data/prs" "$validation_dir/report-after.json"
node scripts/metrics/report.mjs "$validation_dir/data/prs" "$validation_dir/report-repeat.json"
cmp "$validation_dir/report-after.json" "$validation_dir/report-repeat.json"
node --input-type=module - "$validation_dir" <<'JS'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const read = async (name) => JSON.parse(await readFile(`${process.argv[2]}/${name}`, 'utf8'))
const before = (await read('report-before.json')).prs
const after = (await read('report-after.json')).prs
assert.equal(after.length, 21)
assert.equal(before.reduce((sum, pr) => sum + pr.ci_attempts, 0), 21)
assert.equal(after.reduce((sum, pr) => sum + pr.ci_attempts, 0), 33)
assert.deepEqual(after.map(({ ci_attempts, ...pr }) => pr), before.map(({ ci_attempts, ...pr }) => pr))
const changes = after.filter((pr, i) => pr.ci_attempts !== before[i].ci_attempts)
assert.deepEqual(changes.map((pr) => [pr.pr_number, pr.ci_attempts]),
  [[12, 2], [21, 2], [29, 4], [31, 2], [76, 2], [78, 3], [79, 3], [80, 2]])
for (const [number, attempts, seconds, commits, files] of
  [[17, 1, 545, 1, 2], [29, 4, 37353, 4, 3], [80, 2, 2966, 2, 7], [85, 1, 1165, 1, 7]]) {
  const pr = after.find((row) => row.pr_number === number)
  assert.deepEqual([pr.ci_attempts, pr.cycle_time_hours, pr.commits, pr.changed_files,
    pr.ci_failures, pr.review_correction_rounds, pr.first_pass_success],
  [attempts, seconds / 3600, commits, files, 0, 0, 'unknown'])
}
console.log('Verified 21 PRs; attempts 21 -> 33; only 8 attempt counts changed; 4 sample rows agree.')
JS
```

Observed local verification on Node v22.19.0:

- `npm run test:metrics` — 7 tests passed. Before the fix, new regressions exposed
  lost runs across heads, lost retry history, and loss when a later snapshot is empty.
  Fixtures use synthetic PRs/runs and test duplicate snapshots, input order,
  pending-to-completed updates, failure followed by retry success, missing retry
  history, PR field selection and unknown first-pass success.
- `npm run lint` — passed.
- Reproduction block above — both `cmp` checks passed; assertions confirmed the
  four sample rows and all eight changed attempt counts. The original script
  reproduces the retained report byte for byte; the corrected script is repeatable.
- `git diff --check` — passed.

Product tests/build were not rerun: changes are confined to the metrics report,
its tests and documentation. GitHub checks and live #82 automation results are
not established by these local checks.

## Remaining limits and safe conclusions

- The collector reads only the current head and the API's returned run attempt.
  Heads or retry states missed between collections cannot be reconstructed here.
  Attempt and non-success counts describe retained evidence; they are not complete
  execution totals or a defensible failure-rate denominator.
- No positive CI failure, same-run retry, or `CHANGES_REQUESTED` review occurs
  in this pinned source. Tests demonstrate transformation behavior, not real
  coverage of these cases. The non-success definition remains unchanged because
  the raw sample does not support a narrower diagnosis of failures.
- Reviews are snapshots of current review states, not an immutable event ledger.
  #29's five comments and four commits do not establish five correction rounds,
  or that any particular commit fixed a review. Latest counts may miss later
  reviews; rewritten history and API pagination limits also bound commit/file data.
- The sample is small and selected for lifecycle shapes. Cycle time and change
  size describe these PRs; CI success only describes the retained workflow outcomes.
  They cannot rank agents, measure human effort, explain causes of rework, or
  establish first-pass acceptance. Tokens and dollar costs are unmeasured.
- #85 supplies a completed automation implementation lifecycle. Validation of
  #82's live Project writes remains separate. This issue's PR is opened as a
  **draft** with `Closes #42`, then left in draft for human inspection of the live
  workflow. Readiness, retries and merge are not performed by this task.
