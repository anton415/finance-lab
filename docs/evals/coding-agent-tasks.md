# Candidate coding-agent tasks

Use the [guide](README.md) for terminology, result codes, human rubric, version
rules, calibration evidence, and M3 isolation requirements. This file is
**evaluator material**, not a file to mount in a trial agent's workspace.

## Index

All records are **version 1**, initially defined for #38 on 2026-09-23.
“Reconstruction” means a deliberately introduced regression representing a real
requirement; it does not claim that regression occurred in the product.

| ID | Capability | Origin | Preparation shortlist | Readiness |
| --- | --- | --- | --- | --- |
| [FL-CE-001](#fl-ce-001) | Discriminating month-isolation tests | Historical defect | Yes | Runnable for manual grading |
| [FL-CE-002](#fl-ce-002) | Local calendar keys | Controlled reconstruction of #15 | No | Needs preparation |
| [FL-CE-003](#fl-ce-003) | Complete amount validation | Controlled reconstruction of #33/#35 | No | Needs preparation |
| [FL-CE-004](#fl-ce-004) | Populated-zero exclusivity | Controlled reconstruction of #33/#35 | Yes | Needs preparation |
| [FL-CE-005](#fl-ce-005) | Strict document/row shape | Controlled reconstruction of #33/#35 | No | Needs preparation |
| [FL-CE-006](#fl-ce-006) | Selected-state JSON export | Controlled reconstruction of #34 | No | Needs preparation |
| [FL-CE-007](#fl-ce-007) | CSV transformation isolation | Controlled reconstruction of #34 | No | Needs preparation |
| [FL-CE-008](#fl-ce-008) | Read-only preview and presence | Controlled reconstruction of #35 | No | Needs preparation |
| [FL-CE-009](#fl-ce-009) | Asynchronous preview selection | Controlled reconstruction of #35 | No | Needs preparation |
| [FL-CE-010](#fl-ce-010) | Restore approval and destination | Controlled reconstruction of #36 | No | Needs preparation |
| [FL-CE-011](#fl-ce-011) | Failed-write preservation | Controlled reconstruction of #36 | Yes | Needs preparation |
| [FL-CE-012](#fl-ce-012) | Python JSON/version parity | Controlled reconstruction of #37 | No | Needs preparation |

**Runnable manual subset: FL-CE-001 only.** All others have inspected source
anchors and a proposed reconstruction below, but those reconstructed snapshots
and graders have not been run. None is ready for automated agent trials:
M3 #43/#44 must enforce isolation and protected grading first.

## Shared preparation and submission

The evaluator must assemble each record's **Agent-visible** section together
with this common request text (without evaluator notes or historical links):

> Submit a patch against the supplied starting snapshot and a brief factual note
> listing exact verification commands, observed outcomes, and unperformed checks.
> Use synthetic data only. Work within the listed editable files; add focused
> tests there when needed. Do not change product requirements, shared fixtures,
> dependencies, lockfiles, build/test configuration, or unrelated behavior.
> Do not disable or delete required coverage. Preserve raw values where the
> request requires preservation. Run the record's focused command and relevant
> ordinary checks, and report setup errors separately from test failures.
> Any equivalent implementation satisfying the request is acceptable.

**Submission for every record:** that patch and verification/limitation note;
no exceptions. For JavaScript tasks the ordinary checks are `npm test`,
`npm run lint`, and `npm run build`. Python checks are specified in FL-CE-012.
Human rubric items from the guide apply to every record. An agent assertion of
success is never the grade.

**Pinned sources:** FL-CE-001 uses the historical SHA in its record. All other
records explicitly pin the reviewed source
`4d6ce42b3a641f25ec15e5a07af3c797daff26f2`. At that SHA the requirements already
have implementations: use the exact reconstruction, not an unchanged checkout.
Keep its `package.json`, `package-lock.json`, `vite.config.ts`, TypeScript
configs, and test environment. Install with `npm ci`; record actual runtime
versions. A source inspection is not a completed reconstruction rehearsal.

**Visible bundle:** include `src/`, the pinned synthetic `fixtures/` directory
when present (retained tests import these inputs), build inputs/configuration,
sanitized `AGENTS.md`, and only the product documents listed by the record.
Record-specific fixture lists identify the primary inputs, not permission to
break other retained tests by removing their imports. Retain other source tests
except the exact files withheld below. Exclude
`docs/evals/`, root README/history links, `docs/ai-process.md`, `.git`, GitHub
workflow/metrics material, solution PRs, and unrelated scripts/docs. Strip
solution links and historical verification/learning narratives from included
product guides; keep their normative contract text. For FL-CE-012, include its
Python script and remaining Python tests instead of frontend source/configuration.
The runner must enforce this bundle boundary; this document alone does not.

**Withheld tests:** before the agent sees a reconstruction, move the specified
files into evaluator-only storage. They provide existing regression assertions,
but are not sufficient by themselves to calibrate a task. Restore trusted copies
to a separate grading tree after applying a submission; retain candidate tests
separately if they use the same filenames. Candidate code cannot replace these
trusted checks. Any new probe described below remains **proposed/unimplemented**
until separately authored, inspected, and calibrated. No reference patch is
included in an agent bundle.

**Reference and checks:** for reconstructed tasks, reverting only the documented
production mutation to the pinned source is the reference-correct candidate.
Its availability is verified by inspecting that source, not by running each
task's proposed grader. The reconstructed no-op is the incorrect candidate.
Also reject an implementation that always errors: positive controls must pass.
Check unchanged unrelated behavior, protected files, test relevance, and factual
verification using the guide's rubric. Every mandatory numbered check below
maps to the correspondingly numbered agent requirement; scope checks map to
“Allowed changes” and the common request.

**Synthetic setup:** when a record says “empty document,” use numeric version
`1`, month `2026-09`, and ten independent `{ item: '', income: '', spending: '' }`
objects. Create a fresh copy for each single-defect case. Storage keys use
`finance-lab:budget:YYYY-MM` for ordinary years. Snapshot raw key/value pairs and
presence after normal render/edit persistence has settled; observe `setItem`,
`removeItem`, and `clear` calls separately. Deliberate external conflict writes
are excluded from operation-induced counts.

## FL-CE-001

**Identity:** version 1 — Repair misleading month-isolation coverage.
Tags: testing, valid fixtures, regression discrimination, preservation, scope.

### Agent-visible

**Request / expected outcome:**

1. Strengthen `does not load a budget from another month` in `src/App.test.tsx`.
   The loader accepts stored budgets only when they are arrays of exactly ten
   rows with string `item`, `income`, and `spending` fields. Seed a valid,
   recognizable prior-month budget and show that rendering a different, unsaved
   month displays all ten empty rows, without reading prior-month content into
   the visible budget. Use controlled local calendar dates.
2. Verify the prior month's exact raw stored value remains unchanged after the
   render. Preserve existing totals, malformed-storage, and remount coverage.
3. Tests must pass correct behavior and detect a loader reading another month;
   strengthening tests must not change production behavior. Do not skip tests
   or introduce unconditional failures.

**Allowed changes:** `src/App.test.tsx` only, including small test-local helpers.
Production files, storage rules, dependencies/config, and existing unrelated
coverage are protected. Submit the common patch and verification note.

**Verification:** `npm test -- src/App.test.tsx -t 'does not load a budget from another month'`,
then the common ordinary checks. Confirm that the focused test executed.

### Evaluator-only

**Provenance:** historical defect from [#15](https://github.com/anton415/finance-lab/issues/15)
and [PR #31](https://github.com/anton415/finance-lab/pull/31). The one-row setup
was rejected independently of month selection. Relevant files:
[`App.test.tsx`](https://github.com/anton415/finance-lab/blob/b4300a8fdb42df692a26a5a7165f279baa46fa78/src/App.test.tsx)
and [`budgetStorage.ts`](https://github.com/anton415/finance-lab/blob/b4300a8fdb42df692a26a5a7165f279baa46fa78/src/budgetStorage.ts).

**Starting state:** `b4300a8fdb42df692a26a5a7165f279baa46fa78`, unmodified.
Export that tree with its own lockfile; expose `src/` tests and configuration,
without later docs/fixtures/tests. The original focused test starts green;
the missing behavior is useful detection, not a known failing application test.
The original synthetic August one-row seed stays in the starting test for the
agent to repair. Do not include any reference test changes in the bundle.

**Grading / controls:** follow the [worked protocol](README.md#worked-calibration-fl-ce-001).
G1: review valid ten-row setup and all visible fields, then run the candidate
against correct and wrong-August-key production. G2: inspect/run the exact raw
August preservation assertion; run the ordinary application suite with correct
production. G3: require a meaningful selected test, reject always-failing and
skipped/no-op controls, and inspect a test-only diff. Reference: the App test
file at `141cfd95e80a3d29c602b1cbcfea641f14434d7b`, available and exercised.
Accept equivalents; do not require its helper or extra A → B → A test.

**Readiness:** **Runnable for manual grading**, shortlist member. The guide
records the observed four-candidate matrix, runtime, and commands. The reference
passed 10 ordinary tests, and its focused test alone failed on wrong-month
content. Rubric judgment on a future submitted patch still requires review.

**Limitations:** narrow wrong-key mutation; preservation is also checked by
assertion review, not a separately calibrated write mutation. Public historical
solution may leak. No live-agent trial, automated grader, or isolated runner.

## FL-CE-002

**Identity:** version 1 — Preserve local calendar month/year keys.
Tags: dates, independent boundary checks, regression.

### Agent-visible

**Request / expected outcome:**

1. Make `currentMonthKey(date)` use the supplied date's local calendar month and
   year, yielding `finance-lab:budget:<year>-<two-digit-month>`. Its default date
   behavior must remain compatible with the application.
2. Cover an ordinary date and dates where local and UTC months differ, including
   December/January when years also differ. Tests must distinguish an incorrect
   month getter from an incorrect year getter independently of the host timezone.
3. Preserve loading/saving and month isolation; do not change storage formats.

**Allowed changes:** `src/budgetStorage.ts` only within `currentMonthKey`, and
`src/budgetStorage.test.ts` for tests/helpers. Other production code and common
protected files are unchanged. Submit the common patch and note.

**Verification:** `npm test -- src/budgetStorage.test.ts src/App.test.tsx`,
plus ordinary checks. No external date library or timezone configuration change.

### Evaluator-only

**Provenance:** controlled reconstruction of the historical
[#15](https://github.com/anton415/finance-lab/issues/15)/[PR #31](https://github.com/anton415/finance-lab/pull/31)
local-calendar requirement; it is not a newly discovered product bug.

**Starting state:** `4d6ce42b3a641f25ec15e5a07af3c797daff26f2`.
In `src/budgetStorage.ts`, replace `date.getMonth()` with `date.getUTCMonth()`
and `date.getFullYear()` with `date.getUTCFullYear()` **inside currentMonthKey
only**. Withhold `src/budgetStorage.test.ts`. Expose other source/tests, with no
additional product guides required. Retain the pinned JS lockfile. Expected
initially: build and ordinary same-calendar-date behavior work; divergent-date
probes fail. Whether other retained tests expose the regression is unmeasured.

**Grading / controls:** G1: ordinary local September 2026 gives
`finance-lab:budget:2026-09`. G2: construct date instances with scoped local
getters, retaining real UTC getters: `2026-09-01T00:00:00+03:00` with local month
8/year 2026; `2027-01-01T00:00:00+03:00` with local month 0/year 2027. Assert UTC
values differ and expect September 2026 / January 2027 keys. Check local
December 2026 and September 2027 too. Run `TZ=UTC npm test -- src/budgetStorage.test.ts`
with both UTC getters, month-only, and year-only mutations; each must be caught
for its intended field. G3: trusted storage/App tests preserve both raw month
values during load/save. Reference is the pinned local-getter function;
incorrect controls are the three UTC variants. PR #31's reported runs are
historical evidence only, not calibration of this new snapshot.

**Readiness:** **Needs preparation**, not shortlisted. Materialize the mutated
bundle; restore/inspect trusted probes and run all independent controls with the
pinned dependencies. Record actual starting-suite results before promotion.

**Limitations:** simulated getters test calendar selection, not all timezones
or browser date parsing. Overlaps month isolation in 001; public answer leakage.

## FL-CE-003

**Identity:** version 1 — Validate complete amount strings without normalization.
Tags: parsing, negative cases, boundary rows, representation preservation.

### Agent-visible

**Request / expected outcome:**

1. In backup/source validation, each income/spending string is either empty or
   matches the **entire** grammar
   `(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?`
   and converts to a finite nonnegative JavaScript Number. Whitespace, trailing
   line terminators, signs on the mantissa, hex, malformed numbers, and overflow
   are invalid. Check both columns in every row, including row ten.
2. Preserve accepted strings, row order, and item text exactly. Accept `.5`,
   `0010.00`, `1e+3`, `0`, `0.00`, extra fractional digits, and `1e-9999` without
   trimming/rounding/conversion. Underflow is allowed and remains its original
   string. An invalid amount raises `BudgetBackupError`, reason `INVALID_AMOUNT`,
   path `rows[index].income` or `.spending`; indices are zero-based.
3. Keep existing document shape, exclusivity, and pure-parser behavior. Parsing
   supplied text must not access storage, DOM, network, clock, or console.

**Allowed changes:** amount validation in `src/budgetBackup.ts`, focused tests
in `src/budgetBackup.test.ts` and `src/budgetExport.test.ts`. Preserve public
interfaces, fixtures, and all common protected material. Common submission.

**Verification:** `npm test -- src/budgetBackup.test.ts src/budgetExport.test.ts`
and ordinary checks. The bundled v1 contract and synthetic fixtures are inputs.

### Evaluator-only

**Provenance:** controlled reconstruction of
[#33](https://github.com/anton415/finance-lab/issues/33)/[#35](https://github.com/anton415/finance-lab/issues/35),
`src/budgetBackup.ts`; no historical amount bug is claimed.

**Starting state:** `4d6ce42b3a641f25ec15e5a07af3c797daff26f2`.
Replace `isAmount`'s complete body with
`return value === '' || Number.isFinite(Number(value))`; remove the now-unused
`amountPattern` declaration and its full-match comment. Withhold
`src/budgetBackup.test.ts` and `src/budgetExport.test.ts`. Include normative
`docs/budget-backup-contract.md` and `fixtures/budget-backup/v1/`. Same lockfile.
Expected initially: valid serialization works and build works; whitespace,
negative, and hex probes wrongly pass. Other retained tests may detect this.

**Grading / controls:** G1: fresh otherwise-valid documents for each column at
indices 0 and 9; reject ` 1`, `1 `, `1\n`, `1\r`, `1\u2028`, `1\u2029`, `-1`,
`-0`, `+1`, `1.`, `0x10`, `1,25`, `NaN`, `Infinity`, `1e309`, checking reason/path.
These labels denote actual escaped characters in the decoded string. G2: accept
all examples in requirement 2 plus empty and `1.234`; deep-compare parsed fields
and original source. G3: trusted manifest classifications and side-effect
sentinels must still pass. Run the focused command against reference and no-op;
add a regex-with-dollar-only incorrect control to expose trailing-line acceptance.
The pinned `isAmount` is available as reference, not newly calibrated.

**Readiness:** **Needs preparation**, not shortlisted. Build the reconstruction,
author the independent probe matrix, restore trusted tests, and rehearse positive,
no-op, dollar-anchor, and always-reject controls. Starting results unobserved.

**Limitations:** amount representations, not exact decimal arithmetic. Overlaps
004/005 through the validator; known contract/source answers remain public.

## FL-CE-004

**Identity:** version 1 — Reject two populated amounts, including zeros.
Tags: contract semantics, invalid input, representation, scope.

### Agent-visible

**Request / expected outcome:**

1. A row may have at most one **nonempty string** among income and spending.
   Two populated fields must raise `BOTH_AMOUNTS_SET` at `rows[index]`, including
   `"0"` with `"0"`, `"0.00"` with `"0"`, and `"1e-9999"` with `"0"`.
2. Both empty, a single `"0"` in either column, and ordinary single amounts
   remain valid; preserve all original strings and every ordered row. Cover row
   ten as well as the first. Valid amount grammar and all other v1 rules remain.
3. Keep the parser pure; no source repair, storage writes, new dependency, or
   changes to application editing behavior.

**Allowed changes:** exclusivity validation in `src/budgetBackup.ts`, and focused
`src/budgetBackup.test.ts` / `src/budgetExport.test.ts`. Protect shared fixtures,
interfaces, and other production behavior. Common submission.

**Verification:** `npm test -- src/budgetBackup.test.ts src/budgetExport.test.ts`,
plus ordinary checks. Include the normative v1 contract and fixtures.

### Evaluator-only

**Provenance:** controlled reconstruction of
[#33](https://github.com/anton415/finance-lab/issues/33)/[#35](https://github.com/anton415/finance-lab/issues/35)
exclusivity, not a claim that current production uses numeric truthiness.

**Starting state:** `4d6ce42b3a641f25ec15e5a07af3c797daff26f2`.
Change only the exclusivity condition in `validateBudgetData` from
`value.income !== '' && value.spending !== ''` to
`Number(value.income) !== 0 && Number(value.spending) !== 0`. Withhold
`src/budgetBackup.test.ts` and `src/budgetExport.test.ts`; include normative
`docs/budget-backup-contract.md` and `fixtures/budget-backup/v1/`. Same JS lockfile.
Expected initially: build, positive single amounts, and two nonzero rejection
work; two populated zero/underflow cases wrongly pass. No rehearsal claimed.

**Grading / controls:** G1: at indices 0 and 9, inject pairs `1/2`, `0/0`,
`0.00/0`, and `1e-9999/0` in otherwise-valid documents; check exact reason/path.
G2: both empty, `0/empty`, `empty/0`, `0010.00/empty`, `empty/.5` succeed unchanged;
compare all ten rows and original input. G3: trusted manifest and purity checks,
then scope review. Reference is the original nonempty-string condition. No-op
fails zero-pair probes; always-reject fails positive controls; a check on only
row one fails the row-ten probe. Proposed independent probes are not yet run.

**Readiness:** **Needs preparation**, **shortlist member**. Materialize the
snapshot, implement/inspect the probe matrix, and rehearse all controls and the
ordinary suite. Reference source is available; runnable grading is unproven.

**Limitations:** tests contract population, not numeric precision; correlated
with 003/005. Small reconstruction and public solution can make this easy to replay.

## FL-CE-005

**Identity:** version 1 — Reject invalid shape without silent repair.
Tags: strict schemas, reason/path checks, invalid input, preservation.

### Agent-visible

**Request / expected outcome:**

1. Before projecting/coercing/padding data, require a non-null non-array root
   object with exactly `formatVersion`, `month`, `rows`. Version is numeric 1;
   month is ASCII `YYYY-MM`, year 0001–9999/month 01–12. Rows must be an array
   of exactly ten non-null non-array objects, each with exactly string `item`,
   `income`, `spending`. Reject missing and extra properties.
2. Preserve every valid row/field unchanged, including empty rows, duplicates,
   Unicode and unusual amount spellings. Do not silently drop fields or repair
   invalid inputs. Retain amount/exclusivity rules from the bundled v1 contract.
3. For single-defect JSON, expose the contract's `BudgetBackupError.reason` and
   zero-based `path`: non-object root `INVALID_DOCUMENT/$`; wrong rows type
   `INVALID_ROWS_TYPE/rows`; wrong count `INVALID_ROW_COUNT/rows`; non-object row
   `INVALID_ROW_TYPE/rows[n]`; missing/extra property `MISSING_PROPERTY` /
   `UNEXPECTED_PROPERTY` at that property; wrong row field type
   `INVALID_FIELD_TYPE/rows[n].field`. Keep parsing pure.

**Allowed changes:** shape validation in `src/budgetBackup.ts`, tests in
`src/budgetBackup.test.ts` and `src/budgetExport.test.ts`. Protect contract,
fixtures, interfaces, other semantics, and common protected material. Common submission.

**Verification:** `npm test -- src/budgetBackup.test.ts src/budgetExport.test.ts`
and ordinary checks. The bundled contract/manifest supplies remaining unchanged
classifications; no ordering requirement for inputs with multiple defects.

### Evaluator-only

**Provenance:** controlled reconstruction of strict shape requirements in
[#33](https://github.com/anton415/finance-lab/issues/33)/[#35](https://github.com/anton415/finance-lab/issues/35).

**Starting state:** `4d6ce42b3a641f25ec15e5a07af3c797daff26f2`.
In `src/budgetBackup.ts`, replace the body of `validateFields` with
`void value; void fields; void path; void message;` (avoids unused-parameter
build errors), and remove exactly the `if (rows.length !== 10)` throw block.
Leave object, field-type, month/version, and amount checks intact. Withhold
`src/budgetBackup.test.ts`, `src/budgetExport.test.ts`. Include normative
`docs/budget-backup-contract.md` and `fixtures/budget-backup/v1/`. Same lockfile.
Expected initially: positive documents and wrong-type checks work, build works;
extra fields and nine/eleven rows are accepted; some missing fields receive the
wrong reason. This is not an unchanged, already-solved snapshot.

**Grading / controls:** G1/G3: each shared shape fixture separately, plus missing
each root/row field, extra synthetic `extra` at root/row, null/array row at index
9, nonstring item/income/spending at indices 0 and 9, and 9/11 rows. Verify the
exact single-defect reason and path, not any throw. G2: empty, mixed, and
representation fixtures must pass with identical parsed values and no mutation.
Run trusted manifest/export tests. Reference restores only the two removed
checks. No-op fails extra/count cases; a projection/padding “repair” fails their
required rejection; always-reject fails all positive fixtures.

**Readiness:** **Needs preparation**, not shortlisted. Materialize and build the
reconstruction; implement remaining independent shape probes, inspect intended
single-defect setup, and calibrate controls. No observed starting-suite result.

**Limitations:** JSON duplicate-key lexical detection is outside v1; direct
object oddities are not hidden requirements. Strong overlap with 003/004.

## FL-CE-006

**Identity:** version 1 — Export the selected month's latest state as lossless JSON.
Tags: state selection, export, regression, preservation.

### Agent-visible

**Request / expected outcome:**

1. **Export JSON** must serialize the selected local-calendar month and current
   in-memory rows, including the latest edit without a save/blur/reload. The
   current clock, filename, and stale storage must not choose content. Valid
   in-memory state remains exportable when storage reads/writes are unavailable.
2. Emit a parsed v1 document containing only numeric `formatVersion: 1`, selected
   `month`, and ten ordered rows, each with exactly string `item`, `income`,
   `spending`. Preserve empty versus zero, all original strings/rows, and text;
   no CSV prefix. Filename is `finance-lab-budget-YYYY-MM.json`, MIME
   `application/json`; retain existing JSON formatting (two-space indentation,
   final LF, no BOM) and validation/error behavior.
3. Export must not mutate selected month, rows, totals, or any stored key/value,
   including writes of identical data. Existing CSV behavior remains intact.

**Allowed changes:** the `exportBudget` handler in `src/App.tsx` and tests in
`src/App.export.test.tsx`. Existing serialization/download helpers, format
contract, fixtures, and common protected files are unchanged. Common submission.

**Verification:** `npm test -- src/App.export.test.tsx src/budgetExport.test.ts`
and ordinary checks. Bundled export and v1 contract sections define the formats.

### Evaluator-only

**Provenance:** controlled reconstruction of
[#34](https://github.com/anton415/finance-lab/issues/34), not an observed stale
export bug. Relevant files: `src/App.tsx`, `src/budgetExport.ts`.

**Starting state:** `4d6ce42b3a641f25ec15e5a07af3c797daff26f2`.
Inside `exportBudget`, replace
`const { month: selectedMonth, rows: selectedRows } = budget` with
`const selectedMonth = new Date()` followed by
`const selectedRows = loadBudget(currentMonthKey(selectedMonth))`.
Withhold `src/App.export.test.tsx`; retain serializer tests. Include normative
`docs/budget-export.md`, `docs/budget-backup-contract.md`, and both
`fixtures/budget-backup/v1/` and `fixtures/budget-export/`. Same lockfile.
Expected initially: build and pure serializer tests pass; selected-month and
latest-state integration checks fail. Other tests' outcomes are unobserved.

**Grading / controls:** G1: set local clock to September, seed distinct ten-row
August/September documents, navigate August → September → August, and compare
captured JSON to independent expected selected documents. In December, retain
that selection while advancing clock into January, edit an item and export
without blur. Also make storage unavailable after initial state load, edit, then
export: no read/repair and latest state must export. G2: compare all parsed values,
filename/MIME/format, including `0010.00`, `.5`, `0`, `0.00`, empty rows, and inert
text using valid source fixtures (not input controls that sanitize strings).
G3: snapshot UI/storage after edit persistence and assert zero export write/remove
calls; run unchanged CSV and error tests. Reference is the original budget
selection; no-op fails August/rollover, a storage-only fix fails unavailable/stale
storage, and always-block-download fails positive exports.

**Readiness:** **Needs preparation**, not shortlisted. Materialize, inspect
trusted integration checks and additional probes, rehearse controls, and record
starting/ordinary-suite results. No browser trial is claimed.

**Limitations:** captured download arguments do not prove OS disk saving;
jsdom does not certify native downloads. Representation coverage overlaps 007.

## FL-CE-007

**Identity:** version 1 — Confine CSV prefix/escaping to CSV output.
Tags: output policy, representation, repeated operations, preservation.

### Agent-visible

**Request / expected outcome:**

1. CSV adds one ASCII apostrophe before every nonempty **original** item, then
   double-quotes every field and doubles embedded quotes. Empty items, headers,
   and amounts receive no prefix. Preserve original item whitespace/newlines
   and existing apostrophes; amounts stay their exact valid strings.
2. Keep CSV's existing UTF-8 BOM, `item,income,spending` column order, one header
   plus ten logical records, comma delimiters, and CRLF separators/final CRLF.
   Repeated exports of the same budget must produce identical CSV bytes.
3. CSV serialization must not mutate source rows, UI, storage, or later JSON.
   JSON keeps all original strings and ten rows with no CSV prefix. Invalid
   source remains rejected by existing v1 checks. No spreadsheet compatibility
   guarantee is requested or implied by serialization tests.

**Allowed changes:** `serializeBudget` in `src/budgetExport.ts` and tests in
`src/budgetExport.test.ts` / `src/App.export.test.tsx`. Preserve format contracts,
fixtures, validation helpers, and common protected files. Common submission.

**Verification:** `npm test -- src/budgetExport.test.ts src/App.export.test.tsx`
and ordinary checks; bundled export guide/fixtures provide normative examples.

### Evaluator-only

**Provenance:** controlled reconstruction of
[#34](https://github.com/anton415/finance-lab/issues/34)'s output-only policy.
No claim that the shipped serializer mutates data.

**Starting state:** `4d6ce42b3a641f25ec15e5a07af3c797daff26f2`.
In `serializeBudget`, immediately after `const filename = ...`, insert:

```ts
if (format === 'csv') {
  source.rows.forEach((row) => { if (row.item !== '') row.item = `'${row.item}` })
}
```

In the CSV mapping only, replace the following expression with `item`:

```ts
item === '' ? '' : `'${item}`
```

This moves prefixing into source mutation while retaining a plausible first
CSV output. Withhold `src/budgetExport.test.ts`, `src/App.export.test.tsx`.
Include normative export/v1 guides and both fixture directories, same lockfile.
Expected initially: build and first export of mutable input work; frozen-source,
repeat-export, and JSON-preservation probes fail. Not yet exercised.

**Grading / controls:** G1/G2: use ten rows containing empty item, `Sample`,
`=1+1`, an existing leading apostrophe, leading spaces, comma, double quote,
embedded CR/LF, and Unicode. Independently derive expected full CSV; embedded
newlines do not increase logical record count. E.g. `=1+1` becomes `"'=1+1"`,
an item consisting of `'Sample` becomes `"''Sample"`, and empty stays `""`.
G3: deep-freeze source for a pure call; separately serialize mutable source twice
as CSV then JSON, checking equal CSV outputs, unchanged all-row source, and
exact parsed JSON. In App, compare UI and raw storage and zero operation-induced
writes/removals. Run invalid-source controls too. Reference is pinned serializer;
no-op fails mutation/repeat probes, never-prefix fails policy, prefix-in-JSON fails
preservation. Trusted tests plus proposed independent probe review are required.

**Readiness:** **Needs preparation**, not shortlisted. Materialize the source
mutation, calibrate mutable/frozen and UI controls, inspect independent expected
CSV, and run the ordinary suite. Reference exists but new grader is unverified.

**Limitations:** bytes alone do not establish Excel/Sheets formula safety or
save/reopen behavior. Overlaps 006; public retained outputs expose answers.

## FL-CE-008

**Identity:** version 1 — Preview without writes and distinguish presence.
Tags: no side effects, storage uncertainty, invalid input, preservation.

### Agent-visible

**Request / expected outcome:**

1. Selecting, reading, replacing, clearing, or canceling a JSON preview must not
   write/remove any budget or other storage key, even with identical data.
   Selected month, rows, and totals remain unchanged. Validate input before
   looking up any destination; invalid input makes no destination lookup.
2. For a valid backup's month, `getBudgetPresence` reports **existing** for any
   stored string (including empty or malformed), **absent** only for `null`, and
   **unknown** for inaccessible storage. Do not load, repair, or initialize
   data to infer absence. Use existing keys: `2026-09` →
   `finance-lab:budget:2026-09`, `0001-01` → `finance-lab:budget:1-01`.
3. Display valid backup month and all ten original rows even when presence is
   unknown; render imported text inertly. Presence is advisory, never approval
   to restore. Preserve existing file validation/limits and explicit restore.

**Allowed changes:** preview selection/presence handling in
`src/BudgetBackupPreview.tsx`, `getBudgetPresence` in `src/budgetStorage.ts`, and
`src/App.preview.test.tsx` / `src/budgetStorage.test.ts`. No changes to restore,
parser/contract, autosave, or common protected files. Common submission.

**Verification:** `npm test -- src/App.preview.test.tsx src/budgetStorage.test.ts`
and ordinary checks. Include normative preview and v1 contract guides/fixtures.

### Evaluator-only

**Provenance:** controlled reconstruction of
[#35](https://github.com/anton415/finance-lab/issues/35), using
`src/BudgetBackupPreview.tsx` and `src/budgetStorage.ts`.

**Starting state:** `4d6ce42b3a641f25ec15e5a07af3c797daff26f2`.
In `selectFile`, immediately before `const presence = getBudgetPresence(document.month)`,
insert `localStorage.setItem(backupMonthKey(document.month), JSON.stringify(document.rows))`.
In `getBudgetPresence`'s catch only, replace `return 'unknown'` with
`return 'absent'`. Withhold `src/App.preview.test.tsx`, `src/budgetStorage.test.ts`.
Expose normative preview/v1 guides and backup fixtures, same lockfile. Expected
initially: build/parser checks work; valid preview writes, and failed presence
read is misclassified. Restore tests may also expose this deliberate regression.

**Grading / controls:** G1: after render settles, snapshot two months plus an
unrelated synthetic key; exercise valid, invalid, replacement, clear, and empty
picker selection with storage spies. Require zero write/remove/clear calls and
identical UI/raw values; invalid input must not call destination `getItem`.
G2: independently seed absent, empty-string, malformed, empty-ten-row, and valid
stored values; each non-null case is existing. Throw on storage access/read:
expect unknown, not absent. Check low-year key without creating it.
G3: preview exact rows and month with unknown presence and inert markup item;
run existing valid/invalid file and restore regression checks. Reference reverts
the insertion/catch change; no-op fails writes and unknown; always-error fails
valid preview; always-absent fails present and inaccessible cases.

**Readiness:** **Needs preparation**, not shortlisted. Construct the bundle,
calibrate spies after ordinary persistence settles, run the case/control matrix,
and record starting-suite failures. Grader probes are still proposed.

**Limitations:** point-in-time presence, no locking or live cross-tab subscription;
jsdom does not prove native picker UX. Overlaps 009–011 in shared UI code.

## FL-CE-009

**Identity:** version 1 — Ignore late results from obsolete preview reads.
Tags: asynchronous state, deterministic scheduling, regression, preservation.

### Agent-visible

**Request / expected outcome:**

1. Only the active file selection may publish a preview, error, or completed
   status. Selecting a replacement immediately invalidates prior results.
   Earlier success/failure must neither overwrite a newer result nor end its
   pending state, even when filenames match.
2. Clear and unmount invalidate pending reads; late success/error cannot revive
   UI state. Native picker cancellation without a selected file keeps the
   existing preview or pending read. Handle rejected promises without unhandled
   errors, and allow valid retry after failure.
3. These actions preserve selected budget/UI/storage, with zero preview-induced
   writes/removals. Keep validation, destination presence, and restore approval
   behavior. Use controlled deferred promises in tests, not timing sleeps.

**Allowed changes:** asynchronous selection/clear/unmount handling in
`src/BudgetBackupPreview.tsx` and `src/App.preview.test.tsx`. Keep the reader/parser
and restore semantics intact; common protected files unchanged. Common submission.

**Verification:** `npm test -- src/App.preview.test.tsx src/App.restore.test.tsx`
and ordinary checks; normative preview/v1 guides and backup fixtures are bundled.

### Evaluator-only

**Provenance:** controlled reconstruction of
[#35](https://github.com/anton415/finance-lab/issues/35)'s stale-result requirement.
It is not a report of a shipped asynchronous defect.

**Starting state:** `4d6ce42b3a641f25ec15e5a07af3c797daff26f2`.
Remove exactly the two `if (selection !== request.current) return` statements
from `selectFile`'s success and catch paths. Keep generation increments,
clear/unmount logic, and all restore guards. Withhold `src/App.preview.test.tsx`.
Include normative preview/v1 docs and backup fixtures, same lockfile. Expected
initially: build and single-read flows work; controlled obsolete reads can publish.
The retained restore race tests may also fail; do not assume the suite is green.

**Grading / controls:** G1: deferred A then B, distinct valid document months
and rows but the same filename; settle B before A for all success/failure pairs.
Snapshot B's displayed result/error and require unchanged state after A settles.
Also settle A while B remains pending: B must stay pending. G2: start read then
clear/unmount before resolving/rejecting it; require no revived preview/error or
unhandled rejection. Cancel the picker during read/after preview, then retry a
failed file with a fresh controlled result. G3: storage spies and exact UI/raw
snapshots at all steps; run restore regression tests. Reference is the pinned
guarded component. No-op fails stale-success/failure controls; success-only guard
fails late rejection; ignoring every result fails an ordinary valid active read.

**Readiness:** **Needs preparation**, not shortlisted. Build controlled fixtures,
restore/review trusted race tests, rehearse every ordering/control and ordinary
checks. No timing-based or real-browser rehearsal has occurred.

**Limitations:** deterministic scheduling covers specified interleavings, not
all browser scheduling. Shares UI and preservation checks with 008/010.

## FL-CE-010

**Identity:** version 1 — Bind restoration approval to candidate and destination.
Tags: confirmation, stale data, identity, preservation.

### Agent-visible

**Request / expected outcome:**

1. Restore only the exact validated candidate and destination snapshot explicitly
   confirmed by the user. Opening/canceling confirmation performs no write;
   any non-null stored value requires replacement wording. Approval names the
   backup's month and binds the raw stored value, including null versus empty.
2. Reselecting (even same filename), clearing, unmounting, or changing displayed
   budget context invalidates approval. Before writing, reread destination;
   changed raw data or failed access invalidates the attempt without writing.
   No automatic retry: require a fresh confirmation and allow cancel throughout.
3. Unchanged, freshly approved data restores all ten exact rows in one destination
   write, displays that month only after success, and preserves all other keys.
   Keep validation and failed-write preservation. This check/write sequence is
   a bounded stale-data check, not atomic compare-and-swap or a cross-tab lock.

**Allowed changes:** confirmation handling in `src/BudgetBackupPreview.tsx` and
`src/App.restore.test.tsx`. No synchronization, new storage protocol, parser
changes, dependencies, or common protected edits. Common submission.

**Verification:** `npm test -- src/App.restore.test.tsx src/App.preview.test.tsx`
and ordinary checks. Normative restore/preview/v1 docs and fixtures are bundled.

### Evaluator-only

**Provenance:** controlled reconstruction of
[#36](https://github.com/anton415/finance-lab/issues/36). Candidate identity is an
existing invariant to preserve, not necessarily broken by this reconstruction.

**Starting state:** `4d6ce42b3a641f25ec15e5a07af3c797daff26f2`.
In `confirmRestore`, remove exactly the complete
`if (rawValue !== approval.rawValue)` block (presence update, conflict error,
and return). In its place insert `void rawValue` so the deliberately ignored
read result does not introduce an unused-variable error. Keep the final
reread/catch and all candidate/context guards. Withhold `src/App.restore.test.tsx`.
Include normative restore, preview and v1 docs/backup fixtures; same lockfile.
Expected initially: TypeScript build and ordinary confirmed success work,
changed destinations are overwritten. No build, lint, or reconstruction run
is claimed for this prepared variant.

**Grading / controls:** G1: begin then Cancel/Escape; compare two raw monthly
values, unrelated key, presence, UI, and zero writes. Test present malformed/empty
strings as replacements. G2: after begin, change raw destination externally
(present→different, absent→empty, present→absent); final action makes no restore
write, shows retryable conflict, and consumes approval. Test reread throw and
obsolete final callbacks after replacement/clear/context change. G3: fresh
approval of an unchanged source succeeds once, retaining exact all-row strings
and other keys; duplicate activation cannot reuse approval. Reference restores
the comparison. No-op fails conflict checks; content-only/same-filename approval
fails candidate identity; always-block-restore fails successful fresh approval.

**Readiness:** **Needs preparation**, not shortlisted. Materialize/build the exact
prepared variant, restore trusted checks, and rehearse conflict/candidate/positive
controls. The pinned reference is available; no runnable snapshot or new grader
claim.

**Limitations:** no lock between final read and write; native dialog modality
is not proven by jsdom. Closely correlated with 009/011; public solution leakage.

## FL-CE-011

**Identity:** version 1 — Preserve displayed and stored data when a restore write fails.
Tags: write failures, data preservation, retry discipline, positive control.

### Agent-visible

**Request / expected outcome:**

1. If the confirmed restore's storage write throws, show an accessible retryable
   error, with no success notice and no installation of imported rows/month.
   Preserve the previously displayed month, all rows, totals, and all raw stored
   keys/values or absence. Do not remove/roll back data or write another month.
2. Consume the failed approval. Do not retry through autosave, another render,
   or a repeated final action. Recovery requires opening a fresh confirmation;
   opening/canceling it alone writes nothing. Normal later editing still works.
3. With working storage and fresh approval, restore the correct ten-row document
   once, install the month/rows after persistence, and preserve other keys. Keep
   exact original strings, all v1 validation, and destination/candidate checks.

**Allowed changes:** failed-write control flow in `src/BudgetBackupPreview.tsx`,
restore state/autosave handling in `src/App.tsx` only if necessary, and
`src/App.restore.test.tsx`. Existing interfaces/fixtures, validation, and common
protected files stay unchanged. Common submission.

**Verification:** `npm test -- src/App.restore.test.tsx src/App.test.tsx`
and ordinary checks. Include normative restore/preview/v1 guides and fixtures.

### Evaluator-only

**Provenance:** controlled reconstruction of
[#36](https://github.com/anton415/finance-lab/issues/36)'s failure-preservation
requirement. It does not assert an observed production data-loss incident.

**Starting state:** `4d6ce42b3a641f25ec15e5a07af3c797daff26f2`.
In `confirmRestore`'s catch immediately after
`localStorage.setItem(prepared.key, prepared.serializedRows)`, remove only the
`return` following the `Could not restore this budget...` error. Keep the error
setter and all other catches/returns. Withhold `src/App.restore.test.tsx`.
Expose normative restore/preview/v1 docs and backup fixtures, same lockfile.
Expected initially: build and successful restores work; a throwing write falls
through to success/UI installation. Other starting-suite results unobserved.

**Grading / controls:** G1: display synthetic month B, preview valid A, begin
confirmation, then make only the final setItem throw before modifying storage.
Run with A existing and genuinely absent. Snapshot after ordinary persistence;
assert one attempted destination write, unchanged exact raw storage/presence,
unchanged displayed month/all rows/totals, zero removals/clear/other-key writes,
no success, and a retryable error without raw exception contents.
G2: restore normal storage behavior, flush React effects/rerender without edits,
re-activate the old final action: no write or delayed success. Begin a fresh
confirmation and cancel: still no write. G3: begin again and confirm: exactly
one correct bare-row-array write, exact restored UI/JSON representation, other
keys unchanged; the first ordinary edit persists normally. Run ordinary App
coverage. Reference retains the return after failure; no-op fails G1; an
implementation that always errors passes preservation but fails G3. Observe
real checks, not just a success/error label or totals.

**Readiness:** **Needs preparation**, **shortlist member**. Materialize the
one-line reconstruction, inspect fault injection (must throw before mutation),
restore/review trusted tests and fresh-retry probes, then calibrate no-op,
reference, and always-error controls. No rehearsal claimed for this record.

**Limitations:** assumes normal browser atomic failure of a single setItem;
does not recover pre-existing unsaved edits or concurrent external writes.
jsdom fault injection does not prove every browser quota failure. Overlaps 010.

## FL-CE-012

**Identity:** version 1 — Preserve Python version and JSON-token parity.
Tags: language semantics, strict JSON, type validation, pure parsing.

### Agent-visible

**Request / expected outcome:**

1. The independent standard-library `parse_budget_backup(text)` accepts numeric
   version `1`, including JSON spellings `1.0` and `1e0`. Booleans (especially
   `true`), strings, and null are invalid version types: `INVALID_VERSION_TYPE`
   at `formatVersion`. Other numeric versions are `UNSUPPORTED_VERSION` there.
2. Reject bare JSON-invalid `NaN`, `Infinity`, and `-Infinity` tokens anywhere
   during decoding with `INVALID_JSON` at `$`, even in a wrongly typed or unknown
   field. Quoted `"Infinity"` item text remains valid; a quoted amount of that
   spelling is an `INVALID_AMOUNT` at its field. Numeric JSON `1e309` at version
   is unsupported version, not an invalid-JSON constant.
3. Preserve ten ordered rows and every accepted string, other v1 classifications,
   bounded reader/CLI behavior, and parser purity. No TypeScript invocation,
   external runtime, network/storage/clock access, or fixture-manifest lookup
   at parser runtime. Manifests may be used by tests, not the implementation.

**Allowed changes:** decoding and version checks in
`scripts/validate_budget_backup.py`, tests in `tests/python/test_budget_backup.py`.
Keep all other validator/CLI rules, shared fixtures, and common protected files.
Use CPython 3.12+ standard library only. Common patch and verification note.

**Verification:** with a supported interpreter/venv, run
`python -m unittest discover -s tests/python -p 'test_*.py' -v`, then
`python scripts/validate_budget_backup.py fixtures/budget-backup/v1/valid/empty.json`
(expected `VALID`, exit 0) and the same command with
`fixtures/budget-backup/v1/invalid/version-string.json` (expected
`INVALID_VERSION_TYPE`, exit 1). Also `git diff --check`; no frontend check is
required for this isolated Python task.

### Evaluator-only

**Provenance:** controlled reconstruction of
[#37](https://github.com/anton415/finance-lab/issues/37),
`scripts/validate_budget_backup.py`; Python's bool/number relationship and
permissive constant decoding are requirement risks, not invented bug history.

**Starting state:** `4d6ce42b3a641f25ec15e5a07af3c797daff26f2`.
Remove the `_reject_constant` function and `parse_constant=_reject_constant,`
argument from `json.loads`. Replace
`if isinstance(version, bool) or not isinstance(version, (int, float)):` with
`if not isinstance(version, (int, float)):`. Leave binary64 numeric decoding,
shape, amount, and file/CLI checks intact. Withhold
`tests/python/test_budget_backup.py` (the only Python test file at the pin).
Include the script, normative Python setup/v1 docs, and backup fixtures; no JS
source is needed. No Python dependency lockfile exists or is needed; standard
library only. The repository JS lockfile is protected but unused by this task.
Expected initially: valid v1 parsing works; `true` wrongly succeeds, `false`
has the wrong reason, and bare constants get later contract errors instead of
`INVALID_JSON`. Compilation/import is expected to work, not yet observed here.

**Grading / controls:** G1: independent raw texts with `1`, `1.0`, `1e0` succeed;
`true`, `false`, `"1"`, null yield invalid-type; `0`, `2`, `1.5`, `1e309` yield
unsupported-version. G2: inject each bare constant into root, version, item,
amount, and a synthetic extra field; expect `INVALID_JSON/$` before shape
checking. Quoted item text succeeds unchanged; quoted amount fails its own
reason/path. G3: run the trusted Python suite/shared fixtures; intercept external
access during pure parser calls and compare all returned strings. Reference is
the pinned decoding/version logic. No-op fails true/constants; bool-only fix
still fails constants; rejecting all documents fails numeric-version controls.
Check CLI statuses without exposing file contents or actual filesystem paths.

**Readiness:** **Needs preparation**, not shortlisted. Select/record a supported
interpreter using #37's documented setup; materialize reconstruction, restore
trusted tests, implement any missing independent probes, and run positive and
negative controls plus CLI checks. No Python execution was performed for #38;
#37's historical runs do not calibrate this task or certify personal learning.

**Limitations:** binary64 semantics intentionally mirror the v1 JavaScript
contract; no arbitrary-precision requirement. Shared fixtures correlate with
003–005, while bool and bare constants exercise Python-specific semantics.
Public source/answers and human scope judgments remain limitations.
