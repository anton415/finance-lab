# Specification review example: T2 PUT validation

Date: 15 October 2026. Related to
[#127](https://github.com/anton415/finance-lab/issues/127), using
[contract v1](specification-contract.md). This is a documentation-only exercise;
it does not edit or start [#123](https://github.com/anton415/finance-lab/issues/123).

## Captured input and facts

- Input: [captured #123 body](examples/issue-123-source.md), read with
  `updated_at: 2026-10-14T18:12:44Z`. Capture preserves the returned body and adds
  one final LF; UTF-8 SHA-256:
  `f40ce70dc7976ca8a07c56b2586ed4db6a8dea1139fc65bc66a6c5463d52946f`.
- GitHub posting identity: `anton415`. The maintainer explicitly confirmed in the
  implementation chat on 15 October 2026 that the current #123 specification was
  authored by ChatGPT. This human attestation resolves drafting provenance; the
  GitHub posting identity alone was not treated as proof.
- Repository baseline: `450ead382535597574a73c0005415f59ab5b644f`.
  [API contract](https://github.com/anton415/finance-lab/blob/450ead382535597574a73c0005415f59ab5b644f/docs/t2/api-contract.md),
  [amount/category contract](https://github.com/anton415/finance-lab/blob/450ead382535597574a73c0005415f59ab5b644f/docs/budget-backup-contract.md),
  [existing design](https://github.com/anton415/finance-lab/blob/450ead382535597574a73c0005415f59ab5b644f/docs/t2/design.md).
- [BudgetController](https://github.com/anton415/finance-lab/blob/450ead382535597574a73c0005415f59ab5b644f/backend/src/main/java/io/github/anton415/financelab/BudgetController.java)
  validates GET months and rejects blank PUT keys. Readable PUT remains 501.
  [BudgetExceptionHandler](https://github.com/anton415/finance-lab/blob/450ead382535597574a73c0005415f59ab5b644f/backend/src/main/java/io/github/anton415/financelab/BudgetExceptionHandler.java)
  handles malformed JSON and missing headers with `INVALID_REQUEST`.
- [Controller tests](https://github.com/anton415/finance-lab/blob/450ead382535597574a73c0005415f59ab5b644f/backend/src/test/java/io/github/anton415/financelab/BudgetControllerTest.java)
  cover those checkpoints;
  [request tests](https://github.com/anton415/finance-lab/blob/450ead382535597574a73c0005415f59ab5b644f/backend/src/test/java/io/github/anton415/financelab/SaveBudgetRequestTest.java)
  cover explicit null versus missing version and amount-string preservation.
  These are inspected source facts, not claims that backend tests ran in this PR.

## Codex review of the captured input

Reviewer: Codex in this implementation session, reviewing the pre-existing issue
body above, not treating the worked adaptation below as independently authored.
Reviewed spec digest:
`f40ce70dc7976ca8a07c56b2586ed4db6a8dea1139fc65bc66a6c5463d52946f`.
Design context: pinned existing T2 design above; no new design is required for
this local validation slice.

**Current quality verdict: PASS** for the captured source digest above. The
content review found no blocking behavior defects or material product questions.
The initial review was BLOCKED on author provenance (Q1); the maintainer's
confirmation resolved Q1 without changing the source bytes. R1–R6 were rechecked
against that same input. This PASS supplies no human baseline acceptance.

| Check | Observed result |
| --- | --- |
| R1 | Outcome, boundary, test location, exact error/no-service assertions and human demonstration are present. The capture supplies immutable source context. |
| R2 | Explicit null and omission differ; valid requests remain 501. No contradictory acceptance criteria found. |
| R3 | Invalid months, fields/types, categories/amounts, malformed JSON and missing/blank keys are covered with 400 and no service call. |
| R4 | Amount strings and fifteen IDs follow the existing contract; GET is retained. Persistence/authentication and future successful saves are explicitly excluded. |
| R5 | No new key format, normalization, storage or infrastructure is requested. |
| R6 | Exact source digest and repository revision recorded; ChatGPT authorship confirmed by the maintainer. Human acceptance remains a separate pending gate. |

| ID / class | Reference | Finding / resolution owner |
| --- | --- | --- |
| Q1 / question, resolved | Contract v1 Roles and R6; #127 independent-review acceptance | The posting account did not establish ChatGPT authorship. The maintainer confirmed it in this implementation chat; the source digest is unchanged. |
| O1 / optional | #123 acceptance criterion 5; existing request/controller tests | A 501 status alone cannot observe preserved strings. Reuse the DTO assertions alongside MVC tests in the test plan; do not add a save call or response payload just to observe them. Author may adopt this clarification. |

No issue text, labels, Project state or product behavior was changed. Further
edits require a fresh verdict against their digest; do not inherit this PASS or
treat an editor's proposal as approval.

## Worked template adaptation (Codex proposal, not accepted)

This synthetic planning copy demonstrates the fields without rewriting #123.
It was prepared by Codex after the source review and has **no independent PASS**.
It proposes no new product decisions. The original captured issue remains the
source of scope; a human must accept any future replacement explicitly.

**Problem / evidence:** the pinned PUT controller is a binding checkpoint, while
#123 requires complete validation before service use. The API and backup contracts
define the expected body and amount rules.

**Outcome / value:** callers receive predictable invalid-request errors without
entering budget operations; the maintainer learns request-boundary validation.

**Behavior:** invalid PUT input returns exactly `400 {"code":"INVALID_REQUEST"}`.
Valid creation/update request bodies still return 501; GET behavior is unchanged.

**Scope:** PUT month/body/type/amount/category validation and regression tests.
No persistence, authentication, successful save, version comparison, idempotency
execution, new key format, normalization or UI work.

**Contracts / dependencies:** the pinned API, backup and design links above and
captured #123 define scope. The binding/header checkpoints exist in the baseline;
the full validation slice is planned. No claim is made that later T2 persistence
or authentication has been implemented.

**Data / security invariants:** exact original amount strings, including empty
strings, are preserved. Invalid PUT has no `BudgetService` interactions. No new
storage or ownership path is introduced; user/month isolation remains a constraint
on future saving, not a completed capability. All examples and fixtures are synthetic.

**Acceptance / negative cases:**

1. PUT month accepts only complete ASCII `YYYY-MM`, year 0001–9999 and month
   01–12, matching GET. Examples `0000-01`, `2026-00`, `2026-13`, `2026-1` and
   non-ASCII digits return the exact 400 error with no service interaction.
2. Require exactly `expectedVersion`, `income`, `spending`, `investments`.
   Missing/extra fields and wrong JSON types return that same error and no service
   call. Version permits explicit null or an integral value representable by Long;
   omission, strings, booleans and fractional values are invalid. This is no choice
   of initial server version and no implementation of version comparison.
3. Require exactly the fifteen existing spending IDs and contract-valid amount
   strings everywhere. Test missing/extra categories, wrong types and invalid
   amounts such as `"-1"`, `" "`, `"1e309"` and numeric JSON values; assert the
   exact error and no service interaction.
4. Retain malformed-JSON, missing-header and `isBlank()` rejection. Do not add a
   UUID/key format rule or trim/normalize keys or amounts.
5. Valid null-version and saved-version bodies reach 501. Request-binding tests
   preserve `""`, `"0010.00"`, `".5"` and `"1e3"` exactly. GET regressions pass.

**Verification / evidence:** planned targeted command from repository root:

```bash
cd backend && ./mvnw -Dtest=BudgetControllerTest,SaveBudgetRequestTest test
```

Expected after #123 implementation: all selected tests pass, including added
table-driven negative cases. Put exact command, observed counts and results in
that implementation PR. This docs exercise does not run or assert those future tests.

**Learning / human demonstration:** checkpoints are month validation, body/types,
amount/categories and regression review. The maintainer explains explicit null
versus omission and diagnoses one rejected request/test failure.

**Design checkpoint:** no separate design; this is local validation under the
linked existing design, with no change to persistence, identity or API boundaries.

**Questions / risks:** no new product decisions proposed; Q1 provenance is
resolved. Avoid treating design promises as shipped behavior or expanding the
binding checkpoint into an authenticated saving endpoint.

**Revision / decisions:** author of this adaptation: Codex; input digest and
source commit are above. Quality review of this adaptation and human acceptance
are pending. Its eventual acceptance must pin its complete artifact revision,
not reuse the source body's digest or verdict.

## Manual negative calibration

Procedure: take the worked adaptation unchanged as the control. Apply **one**
mutation below at a time, leaving everything else intact. Run R1–R6, cite the
violated clause, and require the stated rejection; then discard the mutation.
This is the manual rubric option in #127, not a keyword validator or live gate.

Executed by Codex on 15 October 2026. The control's behavior/contract checks had
no blocking defects; its independent review/human decisions remain pending.

| Case / exact mutation | Required finding and source | Observed result |
| --- | --- | --- |
| N1 Missing criterion: replace acceptance item 1 with “Handle invalid months correctly.” | `blocking`, R1/R2: no exact month boundary or observable error/no-call assertion in that criterion. Restore the source #123 month rule and error assertions. | CHANGES_REQUESTED; ambiguous criterion rejected. |
| N2 Invented requirement: append “Reject every Idempotency-Key that is not a UUID.” | `blocking`, R5/R2: conflicts with item 4 and source #123's prohibition on a new key format. | CHANGES_REQUESTED; unauthorized requirement rejected. |
| N3 Conflicting contract: replace item 3's amount-string rule with “Parse and round every amount to two decimals before validation.” | `blocking`, R4/R2: backup contract Amount strings explicitly prohibits rounding/normalization; behavior would lose `0010.00`, `.5` and exponent spellings. | CHANGES_REQUESTED; contract conflict rejected. |

The correction for N1 is acceptance item 1 above. The human demonstration must
explain that “correctly” did not identify inputs or expected results, then identify
the **accepted artifact's full commit/path and digest**. No human demonstration
or acceptance is claimed here.

## Phone handoff and remaining acceptance

- **What / why:** proposed contract and review evidence make scope, independent
  quality review and human authority inspectable without changing T2 work.
- **Tests:** the three manual negative cases above were rejected; source/relative
  links and digests are checked separately in the PR verification record.
- **Decisions needed:** accept/reject the contract baseline and any
  proposed spec/design revision from the actual maintainer account on iPhone.
- **Risks:** no specification approval controller exists. An agent posting through
  the owner's account is not distinguishable by sender alone. Promotion stays
  disabled; a model verdict or comment cannot set `needs:implementation`.
- **Direct links:** [source snapshot](examples/issue-123-source.md),
  [review](#codex-review-of-the-captured-input), [contract](specification-contract.md),
  [#127 decision surface](https://github.com/anton415/finance-lab/issues/127),
  [#131 device/gate work](https://github.com/anton415/finance-lab/issues/131).
  The draft PR supplies immutable artifact links, diff and check links.

Still required before #127 can close: human acceptance of product decisions and
baseline, the human explanation above,
and actual iPhone acceptance/rejection plus stale-revision refusal evidence.
#131 must establish and test the phone-capable trusted path; this document does
not implement it, claim device results or require a desktop to make a decision.
