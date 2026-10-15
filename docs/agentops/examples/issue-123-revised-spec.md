A1.1 Pilot — Revised Specification: T2.1 Budget PUT Validation

Target: finance-lab #127, synthetic copy of #123
Status: Proposed author revision — not accepted
Date: 15 October 2026
Author: ChatGPT (planning/specification role)
Independent review: Pending
Human acceptance: Pending
Implementation: Not requested

This specification is a documentation-only pilot. It does not modify the live #123 issue or authorize implementation or workflow promotion.

1. Problem / evidence

The existing PUT /api/budgets/{month} endpoint is at a request-binding checkpoint, not a fully validated saving endpoint.

At repository baseline 450ead382535597574a73c0005415f59ab5b644f:

* BudgetController validates GET months and rejects blank PUT idempotency keys.
* BudgetExceptionHandler maps malformed JSON and missing required headers to 400 INVALID_REQUEST.
* SaveBudgetRequest binds the four proposed request fields.
* Existing controller and request tests demonstrate selected binding and rejection behavior.
* A readable, otherwise valid PUT still returns HTTP 501 without saving.

The remaining gap is complete PUT boundary validation before any BudgetService interaction, as requested by #123.

The agreed T2 API contract defines the request structure. The existing budget backup contract defines the month, category and amount-string rules. Those constraints must be applied without introducing persistence or changing GET behavior.

Supporting evidence:

* Captured #123 specification
* BudgetController at baseline
* BudgetExceptionHandler at baseline
* Existing controller tests
* Existing request-binding tests

These are inspected source facts. They are not evidence that the expanded validation tests have run or passed.

2. Outcome / value

Complete validation of incoming PUT requests at the API boundary.

For invalid requests, callers consistently receive:

* HTTP 400 Bad Request.
* A JSON body containing exactly {"code":"INVALID_REQUEST"}.
* No BudgetService interactions or budget mutations.

For valid request bodies, the existing HTTP 501 checkpoint remains.

Value: Invalid requests are rejected predictably before budget operations. This establishes a testable validation boundary for later authenticated transactional saving, without implementing that saving now.

The maintainer also gains practical experience with strict JSON validation, request-boundary tests and diagnosing rejected requests.

3. Behavior

3.1 Endpoint and request

PUT /api/budgets/{month}

The request uses Content-Type: application/json and the existing required Idempotency-Key header.

The JSON body contains exactly four required properties:

* expectedVersion
* income
* spending
* investments

The month remains in the URL. The request does not supply user identity.

3.2 Month

Apply the same month rules as the existing GET endpoint:

* Complete ASCII YYYY-MM format.
* Year from 0001 through 9999.
* Month from 01 through 12.
* No normalization of invalid input.

3.3 Version

expectedVersion must be present.

Accepted JSON values are:

* Explicit null, representing an intended creation request.
* An integral JSON value representable by Java Long, representing an intended update request.

Reject omission, string and boolean coercion, fractional values, and integers outside the Long range.

This validation does not select the initial server version, check whether a saved version matches, or implement conflict handling.

3.4 Amounts and categories

The spending object must contain exactly these fifteen existing IDs:

groceries, restaurants, utilities, transport, household, health, personal-care, clothing, subscriptions, education, tech, culture, entertainment, gifts, travel.

The income, investments, and all fifteen spending values must be strings satisfying the existing amount rules:

* Empty string is valid.
* Nonempty values must satisfy the complete ASCII amount pattern and represent finite, nonnegative binary64 values.
* Preserve the original valid strings, including spellings such as 0010.00, .5, 1e3, and empty strings.
* No trimming, rounding, numeric-to-string conversion, or normalization.

Do not introduce additional category IDs or change their identities.

3.5 Header and JSON handling

Retain the existing behavior for malformed JSON, missing Idempotency-Key, and keys rejected by Java String.isBlank().

Do not introduce a UUID requirement, a new key format, or automatic key normalization.

3.6 Unchanged behavior

* Invalid PUT requests return the exact 400 error described above.
* Valid creation and update request bodies reach the existing HTTP 501 checkpoint.
* No successful save response is introduced.
* No PUT request invokes BudgetService.
* Existing GET behavior is unchanged.

4. Scope

In scope

* PUT month validation using existing GET rules.
* Exact JSON body structure and strict value-type validation.
* Explicit-null versus omitted-version validation.
* Spending category completeness and exact membership.
* Amount-string validation and preservation.
* Regression coverage for malformed JSON and idempotency header checks.
* Table-driven negative MVC tests, DTO-binding tests and GET regression tests.
* Contract clarification only if necessary to document existing agreed behavior.

Out of scope

* Database persistence or schema changes.
* Authentication, authorization or session handling.
* Successful creation or update.
* Server-generated initial versions or version-conflict algorithms.
* Idempotency execution, replay, storage or retry coordination.
* UI changes.
* New key formats, amount normalization or additional categories.
* New architectural abstractions or services.

Boundary: This issue completes request validation only. HTTP 501 remains the valid PUT outcome, not a production-ready save operation.

5. Contracts / dependencies

Immutable source references

Pilot and review sources, pinned at repository commit d487af299c5b4d48095681add24e5cfa91921df9:

* Specification contract v1
* Captured original #123 specification
* Codex review findings and proposed adaptation

Product contracts, pinned at repository baseline 450ead382535597574a73c0005415f59ab5b644f:

* T2 monthly budget API contract
* Budget backup contract v2
* T2 existing system design

Dependency status

The existing request-binding and error-handling checkpoints are present in the pinned baseline. Full PUT validation remains planned under #123.

The later authenticated saving implementation is neither a prerequisite for completing this validation slice nor part of it.

The live #123 issue remains the behavioral scope reference. This pilot does not replace it.

Mutable issue and branch links are useful for navigation but do not replace the immutable source references above.

6. Data / security invariants

1. Exact string preservation: Valid amounts retain their original string values, including empty strings, leading zeros and exponent spellings.
2. Complete category identity: All fifteen established spending IDs are required, with no additions or omissions.
3. No invalid-request side effects: Rejected PUT requests never invoke BudgetService.
4. No valid-request persistence: Valid PUT requests remain at 501 and do not write data.
5. GET regression safety: Existing GET validation and responses remain unchanged.
6. No new security boundary: This issue introduces no authentication, ownership or database access path. User/month isolation remains an invariant of the later T2 saving design, not a capability implemented by this issue.
7. Synthetic data: Test fixtures and examples must not contain real personal financial information.

7. Acceptance / negative cases

All negative cases below use otherwise valid requests, so each test isolates the specified rule.

For every negative PUT MVC case, assert:

* HTTP status exactly 400.
* JSON response body exactly {"code":"INVALID_REQUEST"}, with no additional response properties.
* verifyNoInteractions(budgetService).

AC1 — Month validation

Accept only complete ASCII YYYY-MM months within the established year/month bounds.

Negative examples include:

* 0000-01 — invalid year.
* 2026-00 — invalid month.
* 2026-13 — invalid month.
* 2026-1 — invalid formatting.
* Non-ASCII digits — invalid format.

Every case produces the exact 400 response and no service interaction. Existing GET cases retain their behavior.

AC2 — Exact body and version validation

Require all four specified root properties and reject unknown properties or wrong JSON types.

* Missing expectedVersion is rejected; explicit JSON null is accepted.
* An integral value representable by Long, such as 7, is accepted as a version input.
* Strings, booleans, fractions and integers outside Long range are rejected as versions.
* Missing or extra root properties are rejected.
* Invalid JSON types for income, spending or investments are rejected.
* A non-object spending value is rejected.

No successful-save or version-comparison behavior is introduced.

AC3 — Amount and spending category validation

Require exactly the fifteen contracted spending category IDs, each mapped to a valid amount string.

Negative cases include:

* A missing category.
* An unknown additional category.
* Numeric or null JSON values in place of amount strings.
* Invalid strings such as -1, whitespace, and 1e309.
* Wrong types or invalid values in income and investments.

Valid examples include "", 0010.00, .5, and 1e3, whose original strings must remain unchanged.

Each invalid MVC case receives the exact 400 response and no service interaction.

AC4 — Existing error handling

Retain regression coverage for:

* Malformed JSON.
* Missing Idempotency-Key.
* Empty and whitespace-only idempotency keys under isBlank().

Each returns the exact 400 response and no service interaction.

No new idempotency-key format or normalization rule is accepted.

AC5 — Valid requests and regressions

* A valid creation-shaped body with explicit expectedVersion: null reaches HTTP 501.
* A valid update-shaped body with integral expectedVersion reaches HTTP 501.
* Neither case invokes BudgetService or persists data.
* DTO-binding tests confirm exact preservation of representative amount strings, including "", 0010.00, .5 and 1e3.
* Existing GET tests continue to pass.

Because the valid PUT response remains 501 and does not expose a saved budget, string preservation must be observed through request-binding assertions rather than inferred from the HTTP status alone.

8. Verification / evidence

Status: Planned. No implementation tests or CI results are claimed by this specification.

Use the existing test structure under backend/src/test.

Targeted test command, from the repository root:

cd backend && ./mvnw -Dtest=BudgetControllerTest,SaveBudgetRequestTest test

Verification plan:

* Expand BudgetControllerTest with table-driven negative MVC scenarios covering AC1–AC4.
* Expand SaveBudgetRequestTest where needed for strict type handling, explicit null versus omission, and exact string preservation.
* Assert exact error responses and zero service interactions for all negative MVC cases.
* Retain positive tests for both valid 501 request shapes.
* Retain and run GET regression tests.
* Reuse existing synthetic budget fixtures where applicable.
* Record any necessary contract clarification in docs/t2/api-contract.md without changing the agreed behavior.

Evidence to record in the later implementation PR:

* Exact executed command.
* Observed test counts and results.
* Relevant test/CI links.
* Any failures and their resolution.
* Confirmation of the maintained 501 boundary.

Passing tests, CI, deployment and runtime behavior must not be reported until actually observed.

9. Learning / human demonstration

Use the original four guided checkpoints, within one cohesive implementation issue and PR:

1. PUT month validation.
2. Exact body and type validation.
3. Amount and category validation.
4. Regression review.

The maintainer must explain:

* Why explicit JSON null is a valid version input while an omitted expectedVersion is invalid.
* How one invalid request produces the exact 400 response without entering BudgetService.
* How one rejected request or failing test was diagnosed.

This demonstration is planned, not claimed complete for this revised specification.

10. Design checkpoint

Decision: No separate system-design document is required for this validation slice.

Justification:

The change is confined to validation at an existing HTTP request boundary. It does not change persistent storage, data ownership, authentication, authorization, service boundaries, integrations, concurrency/retry execution, or cloud/release architecture.

The existing T2 design and API contract already provide the required context.

Validation behavior and tests are sufficient for this issue. A separate design note would add documentation without introducing a substantive design decision.

New design artifact: N/A — justified by the existing design and unchanged architectural boundaries.

11. Questions / risks

Unresolved product questions

None. This revision proposes no new product behavior or scope decisions beyond the captured #123 requirements and pinned contracts.

Risks and pending process decisions

* Strict type coercion: Framework binding might accept values prohibited by the specification. Owner: implementation author. Mitigation: explicit negative MVC and binding tests before accepting implementation. No new product decision is required.
* Unreviewed specification revision: This author revision has not received an independent Codex verdict. Owner: independent reviewer. Consequence: it is not eligible for baseline acceptance or workflow promotion.
* Missing immutable candidate artifact/digest: This response is not yet a committed, version-pinned repository artifact. Owner: specification author/maintainer. Consequence: the exact candidate must be captured and hashed before review and acceptance can be bound to it.
* Human acceptance and phone approval gate: Human baseline acceptance and the verified iPhone-capable authorization path remain pending. Owner: human maintainer and #131. Consequence: no trusted promotion is authorized.

Q1 from the original review, concerning authorship provenance, is recorded as resolved by the maintainer’s earlier attestation. It is not a new unresolved product question.

12. Revision / decisions

Provenance

Current revision author: ChatGPT, in the planning/specification-author role, 15 October 2026.

Original #123 authorship: ChatGPT, according to the maintainer’s explicit attestation documented in the existing Codex review record. The GitHub posting account anton415 is not independently proof of drafting authorship.

Inputs: Captured #123 body, specification contract v1, existing product contracts and code baseline, and Codex’s review findings/proposed adaptation.

The Codex adaptation was used as review input. It is not independent approval of this ChatGPT-authored revision.

Source and revision identity

Item	Recorded identity/status
Pilot target	anton415/finance-lab#127
Behavioral source	anton415/finance-lab#123, captured artifact
Source capture revision	d487af299c5b4d48095681add24e5cfa91921df9
Original #123 body SHA-256	f40ce70dc7976ca8a07c56b2586ed4db6a8dea1139fc65bc66a6c5463d52946f — as recorded in the existing review, for the captured UTF-8 body with one final LF
Contract/review source revision	d487af299c5b4d48095681add24e5cfa91921df9
Product contract/code baseline	450ead382535597574a73c0005415f59ab5b644f
Proposed revised spec artifact	Pending creation and commit; this draft is not yet a pinned repository artifact
Revised spec SHA-256	Pending calculation over the exact saved UTF-8 artifact bytes
Separate design revision	N/A; existing T2 design pinned above
Independent Codex verdict	Pending for this new revision
Independent review record/link	Pending
Human acceptance/rejection	Pending
Phone-capable acceptance evidence	Pending under #131
Workflow promotion	Not authorized

The original CHANGES_REQUESTED verdict applies to the captured source body’s digest, not to this new draft. The superseded PASS and the review of Codex’s worked adaptation must not be reused as an independent PASS for this revision.

Revision and decision record

Date	Proposed resolution / record	Authority/status
2026-10-15	B1: Add the missing author-owned fields, including problem/evidence, questions/risks, design checkpoint and revision/decision record	Addressed in this draft; independent confirmation pending
2026-10-15	Preserve #123’s exact validation scope and 501 checkpoint	Carried forward from captured source; no new product decision
2026-10-15	No separate design; reuse pinned T2 design	Author’s checkpoint conclusion; review pending
2026-10-15	Adopt O1’s test clarification: verify preserved strings at the DTO boundary rather than inferring preservation from 501	Author clarification; no new API behavior
Pending	Codex independently reviews the exact revised artifact and cited contract set under R1–R6	No verdict yet
Pending	Human accepts, rejects or requests changes for the same immutable revision	No decision yet
Pending	Trusted controller validates authority, current revisions and eligible state before any promotion	Disabled/unverified

Revision validity rule

Before any acceptance:

1. Save the exact proposed spec as an immutable, committed artifact and calculate its SHA-256 using a documented byte/newline convention.
2. Record the artifact’s full commit SHA, path and digest together with the complete source-contract revision set and existing design reference.
3. Obtain independent review of that exact tuple.
4. Obtain separate human acceptance of the same tuple through an authorized, verified decision path.

Any modification to the specification or change in its bound source-contract/design revision invalidates prior review and acceptance eligibility and requires renewed decisions.

A model quality PASS cannot authorize product changes, implementation, merge, or workflow promotion. No current acceptance is inferred from earlier comments or labels.

Pilot completion state: Revised author draft supplied; independent review, human acceptance and phone-gate verification remain pending. The live #123 issue, its labels, and its implementation state remain outside this documentation-only action.
