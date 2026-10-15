# Independent review of the ChatGPT revised T2.1 specification

Date: 15 October 2026. Related to
[#127](https://github.com/anton415/finance-lab/issues/127).
Reviewer: Codex in this session. Author: ChatGPT in the planning/specification role,
as identified in the revision supplied by the maintainer. Codex captured that text
without revising its requirements. This is a documentation-only review of a
synthetic #123 copy; it does not authorize implementation or edit the live issue.

## Exact reviewed candidate

- Repository / target: `anton415/finance-lab`, pilot #127, behavioral source #123.
- Artifact: `docs/agentops/examples/issue-123-revised-spec.md` at
  `a13ed95bff07950783bd9119accf0421a80c2685`:
  [immutable author revision](https://github.com/anton415/finance-lab/blob/a13ed95bff07950783bd9119accf0421a80c2685/docs/agentops/examples/issue-123-revised-spec.md).
- SHA-256 of the candidate's complete bytes:
  `287ad5d27187568c83b89e35d29ed80d5a7e4f9dc081f929757365cb78d4ad7b`.
- Capture convention: supplied text saved as UTF-8, LF line endings, one final LF;
  original wording, blank lines and tab-separated records retained. No Markdown
  headings, links or review conclusions were inserted into the author text.
- The candidate's capture/review fields say Pending because that was its state
  when supplied. This separate record supplies the actual capture identity and
  review result without changing the reviewed bytes. It records no human acceptance.

## Bound source set and proposed author link correction

All sources below are in `anton415/finance-lab`. These are the files inspected for
this verdict, resolved from the candidate's document names and commit IDs. The
URLs also provide the concrete correction for B2: the author can use them for the
six entries in section 5, with evidence links in section 1 and the existing-design
link in section 10. This reviewer-supplied mapping does not insert the required
links into the unchanged candidate or convert it into an accepted author revision.

| Candidate reference | File at full immutable revision |
| --- | --- |
| Specification contract v1 | [`docs/agentops/specification-contract.md`](https://github.com/anton415/finance-lab/blob/d487af299c5b4d48095681add24e5cfa91921df9/docs/agentops/specification-contract.md) |
| Captured original #123 | [`docs/agentops/examples/issue-123-source.md`](https://github.com/anton415/finance-lab/blob/d487af299c5b4d48095681add24e5cfa91921df9/docs/agentops/examples/issue-123-source.md) |
| Earlier Codex findings / adaptation | [`docs/agentops/specification-review-example.md`](https://github.com/anton415/finance-lab/blob/d487af299c5b4d48095681add24e5cfa91921df9/docs/agentops/specification-review-example.md) |
| T2 API contract | [`docs/t2/api-contract.md`](https://github.com/anton415/finance-lab/blob/450ead382535597574a73c0005415f59ab5b644f/docs/t2/api-contract.md) |
| Budget backup contract v2 | [`docs/budget-backup-contract.md`](https://github.com/anton415/finance-lab/blob/450ead382535597574a73c0005415f59ab5b644f/docs/budget-backup-contract.md) |
| Existing T2 design | [`docs/t2/design.md`](https://github.com/anton415/finance-lab/blob/450ead382535597574a73c0005415f59ab5b644f/docs/t2/design.md) |

The captured original body has SHA-256
`f40ce70dc7976ca8a07c56b2586ed4db6a8dea1139fc65bc66a6c5463d52946f`;
the specification contract at the bound revision has SHA-256
`d0ed64adb4b900e3a71111d3b766621e958cc727813d88067cd9ce2da5f87e7f`.
Separate new design: **N/A**, for the author's section 10 rationale. Existing
design context is the exact `docs/t2/design.md` revision linked above.

Inspected implementation evidence, all at
`450ead382535597574a73c0005415f59ab5b644f`:

- [BudgetController](https://github.com/anton415/finance-lab/blob/450ead382535597574a73c0005415f59ab5b644f/backend/src/main/java/io/github/anton415/financelab/BudgetController.java): GET validates month; PUT rejects blank keys and otherwise returns 501 without calling the service.
- [BudgetExceptionHandler](https://github.com/anton415/finance-lab/blob/450ead382535597574a73c0005415f59ab5b644f/backend/src/main/java/io/github/anton415/financelab/BudgetExceptionHandler.java): unreadable JSON and missing required header map to 400 with only `code: INVALID_REQUEST`.
- [SaveBudgetRequest](https://github.com/anton415/finance-lab/blob/450ead382535597574a73c0005415f59ab5b644f/backend/src/main/java/io/github/anton415/financelab/SaveBudgetRequest.java): the four request fields are bound, with required `expectedVersion`.
- [BudgetControllerTest](https://github.com/anton415/finance-lab/blob/450ead382535597574a73c0005415f59ab5b644f/backend/src/test/java/io/github/anton415/financelab/BudgetControllerTest.java): existing GET, malformed JSON, omitted version, missing/blank header and readable 501 cases.
- [SaveBudgetRequestTest](https://github.com/anton415/finance-lab/blob/450ead382535597574a73c0005415f59ab5b644f/backend/src/test/java/io/github/anton415/financelab/SaveBudgetRequestTest.java): null versus omission, numeric version and original amount-string assertions.

These are source inspections, not executed backend-test results.

## Independent verdict and rubric

**CHANGES_REQUESTED**, bound only to the candidate digest and complete source/design
set above. One documentation-completeness blocker remains (B2). No additional
behavior, scope, preservation or test-plan defects were found.

| Check | Observed result |
| --- | --- |
| R1 Completeness / verification | All twelve section answers now exist. AC1–AC5 give observable errors, no-service assertions and a named test path. However, sections 1 and 5 list source names rather than the required immutable file links (B2). |
| R2 Contradictions / ambiguity | Explicit null differs from omission; wrong types are rejected; valid creation/update shapes remain 501. No conflicting behavior found. The captured #123 and pinned contracts govern this synthetic review; the live issue remains unchanged. |
| R3 Error cases | Invalid month, root fields/types, version coercion/range, categories, amount values, malformed JSON and missing/blank keys all have exact 400 and zero-service expectations. |
| R4 Compatibility / isolation | The fifteen IDs, ASCII month/amount rules, finite nonnegative binary64 check and exact string preservation follow the bound contracts. GET remains unchanged. Future ownership/persistence capabilities are not claimed. |
| R5 Scope / complexity | Validation and its tests stay within captured #123. No new key format, normalization, successful saving, schema, authentication or infrastructure is introduced. |
| R6 Revision / design / authority | Author provenance, the justified no-new-design decision and revision/decision record are now explicit. Capture identity is recorded above; acceptance remains pending. Section 10 still lacks the required existing-design link, and section 5 lacks exact file links (B2). Prior verdicts and human decisions are not reused. |

| ID / class | Spec criterion + contract reference | Concrete consequence and resolution owner |
| --- | --- | --- |
| B2 / blocking | Candidate sections 1, 5 and 10; bound contract's Short issue template (Problem / evidence, Contracts / dependencies, Design checkpoint), R1/R6 | Document titles plus commit IDs omit the required source-of-truth and existing-design links. A reader must reconstruct which files the author binds, including the external amount pattern. The author must add the immutable file links supplied above to the relevant sections, preserving behavior and the same source revisions, then submit the new digest for review. No new product decision or design document is needed. |

The earlier B1 missing-answer defect is addressed in this new candidate: the author
now supplies problem/evidence, explicit questions/risks, a justified design decision
and revision/decision history. B2 concerns the remaining link requirement. B1's
CHANGES_REQUESTED verdict for the original captured digest remains historical;
neither it nor the superseded PASS is a verdict on this candidate. Q1 provenance
remains resolved by the recorded maintainer attestation. O1 is adopted correctly:
string preservation is observed in DTO-binding assertions, not inferred from 501.
No material product question or optional finding was added.

## Verification and next decision

Codex manually checked all R1–R6 rows against this exact candidate and the bound
source set. Digest checks, immutable file existence, relative links and whitespace
checks are recorded with exact commands and observed results in the documentation
PR. Backend tests were not run: neither production code nor tests changed, and the
expanded test plan remains future work under #123.

Next action: the specification author incorporates the B2 links into a new author
revision. Capture and independently review its new digest before requesting human
baseline acceptance. Do not silently repair this candidate and reuse its review.

Human acceptance of this candidate: **pending**. Phone-capable authorization and
stale-revision refusal evidence: **pending under
[#131](https://github.com/anton415/finance-lab/issues/131)**. Workflow promotion:
**not authorized**. The earlier learning exercise about `2026-13` and invalidated
approval is already recorded; the maintainer need not repeat it for this review.
The implementation-specific learning demonstration in candidate section 9 remains
future work. The existing contract baseline also still needs current human
acceptance. This documentation PR does not complete or close #127.
