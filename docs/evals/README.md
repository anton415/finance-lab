# Coding-agent evaluation guide

This is a development/replay catalogue of **12 candidate tasks**, with one
manually calibrated grader. It is not a validated benchmark, an agent success
rate, or a model ranking. [Issue #38](https://github.com/anton415/finance-lab/issues/38)
defines the scope; [the catalogue](coding-agent-tasks.md) defines the tasks.
Existing PR/CI observations in [the process guide](../ai-process.md) cannot
establish agent performance, human effort, or causal rework.

## Terms and evidence

A **task** specifies starting inputs, a request, and success criteria. A **trial**
is one attempt at that task. A **grader** evaluates required aspects of the
submitted work. The **outcome** is the resulting patch and program behavior,
not the agent's claim of success. An evaluation runner would arrange execution
and grading; building one is deferred to M3.

These distinctions follow [Anthropic's evaluation guide](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents),
especially its sections on evaluation structure, coding agents, stable
environments, clear tasks, and grader calibration. Here they are applied to the
repository's month-isolation test, using deterministic checks and human review.

Keep three kinds of evidence separate:

- **Application tests:** whether the program exhibits a tested behavior.
- **Agent-task grading:** whether the patch fulfills the request, preservation
  requirements, and allowed scope.
- **Grader calibration:** whether reference-correct and deliberately incorrect
  controls produce the intended assessments.

A green application suite can contain a misleading test. The worked example
below starts green because its invalid fixture masks the behavior it claims to
check. Calibration is not a live-agent trial.

## Readiness and versions

| Status | Required evidence |
| --- | --- |
| Needs preparation | A snapshot, reconstruction, reference, grader, or environment check is missing; name the missing work. |
| Ready for manual calibration | Preparation and control/check instructions are complete, but outcomes have not yet been observed. |
| Runnable for manual grading | The reconstruction and positive/negative controls were actually exercised and source, environment, commands, and outcomes are recorded. This does not establish automated isolation. |

The initial preparation shortlist is **FL-CE-001, FL-CE-004, FL-CE-011**.
Only **FL-CE-001** is runnable for manual grading in this delivery. The remaining
11 tasks need the preparation listed in their records. Their proposed probes
are specifications, not implemented or calibrated graders. Automated trials
remain blocked on [#43](https://github.com/anton415/finance-lab/issues/43) and
[#44](https://github.com/anton415/finance-lab/issues/44).

Task IDs are permanent; each record starts at version **1**. Change its version
when changing the request, source/reconstruction, required behavior, scope, or
grading semantics. Record the reason and retain the old definition for existing
results; do not silently compare versions. Pure typo fixes need no new version.
Pin executable grader revisions separately when they exist. Freeze definitions
before trials; visible corrections require identified reruns. Do not select or
revise the suite to favor an agent's observed successes.

## Grading contract

Every mandatory behavior, regression, preservation, and scope check must pass.
Keep per-check observations; do not average away data loss or prohibited writes.
Use independent expected values and both positive and negative cases. An agent's
new tests are evidence, not the sole authority for its own patch.

| Result | Meaning |
| --- | --- |
| `PASS` | Evidence supports all required checks, including applicable human judgments. |
| `TASK_FAIL` | A trustworthy check identifies an attributable in-scope defect, regression, prohibited edit, or missing requirement. A patch breaking a build that passes on the clean control is a task failure. |
| `GRADER_ERROR` | Broken or ambiguous grading logic, or failed calibration, prevents a reliable verdict. Investigate and version corrections, rather than charging the agent with failure. |
| `ENVIRONMENT_ERROR` | External setup/execution prevents assessment, such as unavailable dependencies or a failing clean control. A patch-caused failure is not automatically an environment failure. |
| `UNKNOWN` | Required evidence or human judgment is missing, an attempt was canceled, or attribution is unresolved. Unknown is neither pass nor proven failure. |

Preserve multiple observations if these conditions coexist. A nonzero exit
alone does not identify the cause. Future budgets and timeout rules must be
declared before trials; exhausting a valid budget differs from infrastructure
failure. Ambiguous attribution remains unknown pending investigation.

For invalid input, verify the intended reason and path using a single-defect
input. For preservation, compare exact raw values and key presence across the
destination, another month, and unrelated keys. Let normal setup/edit autosave
settle before observing operation-induced calls. Zero write calls and identical
final bytes are separate assertions: rewriting identical data is still a write.

Checks must map to agent-visible requirements. Hidden probes may vary inputs,
not invent requirements. Do not demand an exact reference diff, helper name,
tool sequence, line count, or unstated file/interface. Reject always-failing,
skipped/deleted, or unconditional-success checks; inspect test collection and
failure causes. No LLM judge or subjective code-quality score is required.

### Human rubric

Record **pass / fail / unknown** and a short evidence reference for each item.

| Item | Pass evidence | Failure or unresolved evidence |
| --- | --- | --- |
| Scope discipline | Edits are necessary and within the request's permitted area. | Production edits in a test-only task; new dependency/feature; weakened contract or fixtures. Equivalent solutions are allowed. |
| Test relevance | Valid setup exercises the intended behavior; assertions distinguish controls. | Invalid setup masks the defect, disabled coverage, unrelated failures, or zero executed tests. |
| Verification honesty | Claims match observed commands/results and identify missing checks. | Invented passing CI or unrun checks; missing evidence remains unknown. |

Resolve disagreements about the request before issuing a verdict; do not add
requirements after seeing the patch. AI-assisted review does not certify the
maintainer's learning check.

## Worked calibration: FL-CE-001

**Source:** `b4300a8fdb42df692a26a5a7165f279baa46fa78`, before
[PR #31](https://github.com/anton415/finance-lab/pull/31).
The original `does not load a budget from another month` test seeds August with
one row and renders September. `loadBudget` accepts only ten-row arrays, so it
can reject the fixture even after reading the wrong key.

**Reference:** `src/App.test.tsx` from
`141cfd95e80a3d29c602b1cbcfea641f14434d7b`. It seeds a valid ten-row August
budget, checks all empty September rows, and compares the original raw August
value. This file also adds an A → B → A restoration test. Neither its historical
solution nor the mutation below belongs in the agent-visible bundle.

### Reproduction (evaluator only)

Run trusted manual calibration in a disposable copy, never in the delivery
checkout. From a repository containing both commits:

```bash
repo_root=$(pwd)
calibration_dir=$(mktemp -d)
base=b4300a8fdb42df692a26a5a7165f279baa46fa78
reference=141cfd95e80a3d29c602b1cbcfea641f14434d7b
git archive "$base" | tar -x -C "$calibration_dir"
cd "$calibration_dir"
node --version
npm --version
npm ci --no-audit --no-fund
```

Use this snapshot's `package.json`, `package-lock.json`, and Vitest config. Do
not link to a different checkout's `node_modules`. Registry access is needed
unless the exact lockfile packages are cached. Setup failure is an environment
error, not evidence about a candidate.

For **each** candidate/production combination, reset both files first:

```bash
git -C "$repo_root" show "$base":src/App.test.tsx > src/App.test.tsx
git -C "$repo_root" show "$base":src/budgetStorage.ts > src/budgetStorage.ts
```

Choose the candidate:

- Original/no-op: keep the reset test file.
- Reference: `git -C "$repo_root" show "$reference":src/App.test.tsx > src/App.test.tsx`.
- Always-failing: start with the reference, insert
  `throw new Error('Synthetic always-failing control')` as the first statement
  of the named test.
- Skipped: start with the reference, change only that test's `test(` to
  `test.skip(`. A deleted relevant test has the same absence-of-coverage problem.

For correct production, keep the reset storage file. For wrong-month production,
replace the **single** `localStorage.getItem(key)` in `loadBudget` with
`localStorage.getItem('finance-lab:budget:2026-08')`. Change no other read or write.
Then run, inspecting the selected test count and actual failure:

```bash
TZ=UTC npm test -- src/App.test.tsx -t 'does not load a budget from another month'
```

After the combinations, reset production and install the reference test file;
run `TZ=UTC npm test`. Finally restore both files from `base` in the disposable
copy. Inspect `git diff --name-only` and `git diff --check` in the delivery
checkout: only the two evaluation documents and the root README may change.
A future isolated runner must not expose `repo_root` or this reconstruction
procedure to a trial agent.

### Observed calibration, 2026-09-23

Executed on macOS arm64 with Node **v22.19.0**, npm **10.9.3**, Vitest **5.0.1**,
`TZ=UTC`, and dependencies installed from the historical lockfile. The install
used `npm ci --cache <temporary-cache> --no-audit --no-fund` (115 packages).
The initial network-restricted install encountered DNS failures and was stopped;
the permitted retry completed. No application-failure result was assigned to
that setup failure.

| Candidate | Correct production | Wrong-month production | Manual task assessment |
| --- | --- | --- | --- |
| Reference | Exit 0; 1 passed, 9 skipped | Exit 1; 1 failed, 9 skipped; expected empty item, received `Prior month` | Discriminating; scope/preservation review also required. |
| Original/no-op | Exit 0; 1 passed, 8 skipped | Exit 0; 1 passed, 8 skipped | Reject: the coverage misses wrong-month content. |
| Always-failing | Exit 1; 1 failed, 9 skipped | Exit 1; 1 failed, 9 skipped | Reject: synthetic throw also fails correct behavior. |
| Skipped | Exit 0; all 10 skipped | Exit 0; all 10 skipped | Reject: the requested check did not run. |

The reference with original production also passed the ordinary suite:
**10 tests in 1 file**. After resetting both files to the original source,
`TZ=UTC npm test` also passed **9 tests in 1 file**, confirming the green starting
suite. The skipped counts above come from focused selection,
not disabled tests in the reference. The explicit skipped control disables the
selected test as well. Restoring the two source files resets every combination.

This supports only this narrow manual grader. It does not prove all
month-isolation bugs are detected, that every task is ready, or that any model
completed a task. PR #31's local-month/year mutation results are historical
author-reported evidence, **not** rerun here. Generated calibration logs are not
repository deliverables. Concise commands/results also belong in the delivery PR.

## M3 handoff: execution, protection, and leakage

These are requirements to enforce in #43/#44, not infrastructure delivered here:

- Start each trial from a pinned reset snapshot. Declare tools, dependencies,
  clock/timezone assumptions, and resource budgets. Do not inherit edits,
  conversations, files, or results from another trial.
- Export only the record's request, permitted source/tests/docs, and necessary
  synthetic inputs. Exclude references, evaluator notes, reconstruction diffs,
  historical solution links, grading answers, and previous patches. Supply
  enough product context to solve the task fairly without GitHub access.
- Remove upstream history, later commits, branches, remotes, and answer-bearing
  caches. If patch creation needs Git, initialize a local history containing
  only the prepared source. Prevent GitHub/network access that reveals answers.
- Protect trusted graders, expected values, references, and result collection
  outside the agent's execution context. Apply its patch to a fresh grading
  copy and use trusted test/config commands; candidate edits to scripts,
  fixtures, npm configuration, or test selection cannot redefine success.
- A sibling directory, read-only file, or prompt instruction alone is not a
  sandbox. Enforce filesystem, network, subprocess, secret, and live-repository
  restrictions before running submitted code. Do not expose host credentials,
  personal files, or privileged host controls. This manual exercise executes
  inspected repository controls, not autonomous or untrusted submissions.
- Retain only available task/grader versions, source, agent/interface/model
  configuration, budgets, patch, observed checks, and result. Unavailable model,
  usage, or cost metadata remains unknown. No token/cost instrumentation is
  added here.

The catalogue and historical answers are public. Removing direct access does
not establish freedom from training contamination. Label future results as
**development/replay evaluations**, not secret holdouts or universal rankings.
Tasks share code and contracts, so their outcomes are correlated.

## Maintainer review and learning

**Pending:** maintainer review of the requests/rubric and the personal learning
check. Codex authored this catalogue and performed the manual calibration;
these actions do not count as the maintainer's contribution. Do not close #38
or claim the human check completed without their evidence.

The maintainer must personally write or revise one request and its outcome
criteria derived from #15/#31, then record that contribution and AI assistance.
Explain task, trial, grader, and outcome; why green application tests can miss
bad coverage; which positive/negative controls establish discrimination; and
how history could reveal the answer. Inspect the observed calibration and name
one way its grader could mislead. For example, an unrelated failure or zero
selected tests cannot establish detection; the maintainer must make their own
assessment rather than adopting this example as proof of learning.

No agent trial, provider account, SDK, new dependency, CI, benchmark score, or
social publication is part of this delivery. Optional publication requires
human approval; the broader M2 summary belongs to #39. A browser smoke check
is unnecessary for this documentation-only change.
