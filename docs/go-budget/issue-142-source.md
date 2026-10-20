Planning only. Track under [Go Budget — First authenticated monthly budget slice](https://github.com/anton415/finance-lab/milestone/11). Do not start implementation automatically or modify the existing Spring issues.

## Problem / evidence
[ADR-030](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/architecture/decisions/0030-release1-go-migration-implementation-sequence.md) selects direct Go Budget implementation with Keycloak and a TypeScript BFF. Existing T2 documentation and #124/#125 still describe Spring persistence and sessions. The reviewed Stage 0 audit, boundaries, API, schema, testing and rollout proposals need a durable repository specification before implementation proceeds.

At the pinned snapshot, the Spring backend has request validation, a GET service stub and a valid-PUT HTTP 501 checkpoint. It has no implemented PostgreSQL persistence or authentication. Preserve this distinction between verified source behavior and planned Go guarantees.

## Outcome / value
A maintainer or implementer can understand the migration from repository documents without access to a private chat: what is preserved, what deliberately changes, which component owns each responsibility, what must be tested, and which decisions remain open.

## Behavior
Document the following planning baseline; do not represent it as implemented or as a frozen public API while listed choices remain unresolved.

### Ownership and compatibility
- Go owns Budget validation, exact calculations, owner-scoped persistence, versions, successful replay receipts and domain authorization.
- Keycloak owns identity; the BFF owns browser sessions, CSRF and delegated API access; React owns drafts, conflict review and deliberate retries.
- Preserve the monthly model: one planned income, 15 fixed spending categories and a separate investment allocation.
- Preserve existing Spring source/history and the V2 currency-free backup/browser contract. No silent currency assignment, normalization, upload or import. Existing V2 amount spellings and legacy arithmetic remain unchanged.
- Budget saves are independent of Portfolio, FIRE, Kafka, Analytics and AI. Annual Budget functionality remains later release work.

### Go v1 / BFF contract baseline
- Go GET/PUT /api/v1/budgets/{month}; BFF GET/PUT /api/web/v1/budgets/{month}. Month is exact ASCII YYYY-MM, years 0001–9999 and months 01–12.
- Full monthly replacement, with exactly expectedVersion, currency, income, spending and investments in the PUT body; every spending category is required. Reject missing/unknown fields and duplicate JSON keys at the transport boundary.
- The maintainer selected the initial currency allowlist RUB, USD and EUR. Each budget has one immutable currency, and every populated Money uses it. No conversion.
- Money amount is a canonical nonnegative decimal string, at most 18 integer digits and six fractional digits, no leading zeros except zero, no trailing fractional zeros, exponent notation, signs or whitespace. Null means unplanned; zero is explicit zero. Omission is invalid at the API boundary.
- Exact totals: income, spending, investments and remaining = income - spending - investments. Only remaining may be negative; aggregates can require 20 integer digits. No floating-point arithmetic or rounding.
- Creation uses expectedVersion null; updates use a positive canonical decimal-string revision bounded by signed BIGINT. New records start at version 1. Create returns 201, update 200; conflicting versions return 409 BUDGET_VERSION_CONFLICT with currentBudget. Failed comparisons do not mutate data.
- Logical owner is verified (issuer, subject), never a client-supplied identifier or email. Proposed token profile: audience finance-lab-budget, budget:read for GET, budget:read plus budget:write for PUT, and a trusted principal_type=user claim. Confirm actual Keycloak issuance/downscoping before treating that profile as implemented.
- Preserve whole-budget conflict review and pending-operation separation from newer drafts. No automatic overwrite or automatic PUT retry.
- Use RFC 9457 errors with stable codes. Record the reviewed 400/401/403/404/409/415/500/503 domain cases and BFF mappings: invalid session 401, CSRF 403, required session/exchange outage 503, unexpected upstream authentication or malformed response 502, and forwarded-write timeout 504 with unknown outcome.
- Preserve Money, revisions, idempotency keys and replay markers through the BFF; rewrite creation Location to the BFF route and apply no-store caching.

### Consistency and PostgreSQL baseline
- Idempotency keys are scoped to owner across months. Bind the API major, method, month and validated request, preserving strings/nulls while ignoring JSON object order and whitespace.
- Authenticate and authorize every replay. A matching successful receipt replays its original status/body before stale-version checks; changed contents using a retained key return 409 IDEMPOTENCY_KEY_REUSED.
- Budget mutation, revision and successful receipt commit atomically. A concurrent duplicate waits at most the provisional five-second coordination limit; unresolved outcome returns 409 SAVE_RESULT_UNAVAILABLE. Preserve the same key/body for deliberate retries.
- Successful receipts are retained at least 24 hours after commit. The client's conservative retry deadline is 24 hours after its first send and never resets. Receipt absence after cleanup cannot establish whether a historical operation succeeded.
- Dedicated Budget database/credentials. Proposed tables: budget_owners (unique issuer/subject), monthly_budgets (owner/month key, version, currency, nullable income/investment and 15 nullable spending columns), and budget_save_receipts.
- Proposed source-amount domain uses unconstrained NUMERIC with explicit nonnegative, magnitude and six-place exactness checks, avoiding implicit scale rounding. NULL remains distinct from zero. Derived totals are not stored as authoritative budget fields.
- Receipt lookup uses owner plus a fixed-length digest of the exact key and compares the stored original key; a digest collision must never return another operation's result. Store the complete request binding and historical successful response.
- In one transaction, claim a complete candidate receipt and perform a conditional create/update; any failure rolls both back. No separately committed pending receipt.
- Post-commit retention anchor: initially commit delete_after as NULL, then a subsequent transaction anchors deletion at observation time plus 24 hours. NULL protects the receipt if anchoring is delayed or interrupted; replay does not reset an existing deadline.
- Proposed migrations use pinned Goose SQL and a controlled deployment job, with least-privilege runtime credentials and schema compatibility checks. Do not implement SQL in this documentation issue.

### Recovery and rollout baseline
- Keep local/browser budgets separate; a future explicit import requires selected currency, exact conversion preview and preservation of the original V2 archive. Block unrepresentable values rather than round or clamp.
- Application rollback preserves the database. Historical restore follows ADR-019, including an isolated restored cluster, a consistent recovery point, invalidated restored BFF sessions and isolation of old writers.
- Record the reviewed recovery-generation amendment as a proposed contract addition: GET 200 and authenticated 404 return Budget-Generation; PUT requires it. Go checks it before owner creation, replay or mutation. Missing/malformed/multiple values return 400 INVALID_REQUEST; mismatch returns 409 BUDGET_RECOVERY_REQUIRED.
- Generation is shared by all active instances, configured outside the restored Budget snapshot, stable through ordinary restart/application rollback and changed before reopening a historical restore. It is part of request binding, not receipt-key uniqueness. BFF forwards it unchanged; React requires review and a new key after recovery, never silently replaces an old operation's generation.
- Historical restoration can lose acknowledged writes/receipts. Document that recovery exception to normal replay guarantees without claiming an original save failed.
- Record staged rollout, operator-controlled write suspension, compatible rollback, restore rehearsal and human production approval. ADR-019's one-hour PostgreSQL RPO and 24-hour RTO are unverified targets.

## Scope
In scope: repository documentation of the audit/parity matrix, boundaries, human-readable API/BFF contract, schema/migration design, test matrix, rollout/recovery plan and unresolved decisions.

Out of scope: service implementation, executable SQL migrations, infrastructure, generated clients, deployments, repository transfers, Project/workflow changes, and editing/closing/relabeling existing Spring issues or milestones.

## Contracts / dependencies
- [ADR-030](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/architecture/decisions/0030-release1-go-migration-implementation-sequence.md)
- [T2 API](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/t2/api-contract.md), [T2 consistency](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/t2/design.md), [V2 backup contract](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/budget-backup-contract.md)
- [Money ADR-022](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/architecture/decisions/0022-exact-decimal-money-currency-contract.md), [API ADR-024](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/architecture/decisions/0024-openapi-contract-first-rest-versioning.md)
- [Delegation ADR-014](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/architecture/decisions/0014-keycloak-service-to-service-security.md), [sessions ADR-023](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/architecture/decisions/0023-postgresql-bff-sessions-and-oauth-lifecycle.md), [recovery ADR-019](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/architecture/decisions/0019-backup-recovery-objectives-drills.md)
- #122–#125 are historical evidence and compatibility references, not instructions to complete Spring first.

## Data / security invariants
Use synthetic examples only. Preserve user/month isolation, exact values, atomic mutation/receipt behavior and unknown save outcomes. Never present authentication, persistence, integration tests or recovery as verified merely because they are specified.

## Acceptance / negative cases
- [ ] 1. Repository documents contain a source-linked functionality/parity matrix distinguishing implemented Spring/React behavior, preserved requirements, intentional v1 changes and unknowns.
- [ ] 2. Go, Keycloak, BFF and React ownership and exclusions are explicit.
- [ ] 3. Money, month, identity, errors, revisions, idempotency, BFF mapping and the recovery-generation amendment are documented consistently, with representative valid/invalid examples.
- [ ] 4. Schema/migration design explains exact amount checks, null versus zero, atomic save/receipt behavior and post-commit retention.
- [ ] 5. Test plans include cross-user/month isolation, concurrency, duplicate replay, lost confirmation, restart, retention/cleanup, stale-generation recovery, exact totals and unchanged V2 fixtures.
- [ ] 6. Rollout and restore procedures distinguish application rollback from data recovery, preserve pending drafts and document possible lost acknowledged writes.
- [ ] 7. Unresolved choices are named with owners and needed-by stages. No placeholder URL or untested security profile is represented as finalized.
- [ ] 8. A maintainer can trace one create, version conflict, successful replay and post-restore rejection from the documents.
- [ ] 9. Spring issues, existing contracts/fixtures, executable code and infrastructure are unchanged by this documentation task.

## Verification / evidence
Review source links, document consistency and examples; validate Markdown/diagrams with existing repository checks where applicable. Record actual commands and review outcomes in the eventual documentation PR. Do not run application/database suites merely to imply implementation coverage; verification is documentation-only.

## Learning / human demonstration
Explain preserved behavior versus intentional wire changes, the owner/version/replay boundaries, and why restoring an older database needs more than a version check.

## Design checkpoint
Required: this specification covers service boundaries, identity, storage, retries and recovery. Capture the rationale already developed, one reasonable alternative/tradeoff where material, and the current design revision. Do not introduce new architecture solely to fill the template.

## Questions / risks
- Maintainer: public Problem Details type-URI base remains undecided.
- Maintainer and Go contract owner: finalize revision-exhaustion response and final recovery-generation contract acceptance.
- Maintainer: approve Go repository/module placement and toolchain before bootstrap; this issue does not authorize organization/repository creation or transfer.
- Platform owner: actual PostgreSQL/Keycloak versions, delegated-token configuration, session settings/origins and operational thresholds require later implementation evidence.
- Domain-only Money/month/totals work can be scoped independently of unresolved HTTP or deployment settings.
- No due date or legacy T2 effort estimate is inherited automatically.

## Revision / decisions
- Draft author: Codex (OpenAI), capturing the maintainer's migration planning on 2026-10-20.
- Source snapshot: anton415/finance-lab at a214a664f5409e91c10ec4468a53c2a104936bc5.
- Specification revision: initial planning draft. Immutable artifact capture and SHA-256 are pending before formal baseline acceptance.
- Independent specification-quality verdict: pending; no independent PASS is asserted.
- Human decision: publication of this planning issue is authorized; implementation has not been requested. This is not an implementation dispatch, Project promotion, merge or deployment authorization.
- Follow the [specification contract](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/agentops/specification-contract.md) and repository workflow; do not infer acceptance from an agent's statement.
