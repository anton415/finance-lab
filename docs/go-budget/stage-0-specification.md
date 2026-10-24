# Go Budget — Stage 0 specification

> **Historical Go migration specification — 2026-10-24.** [ADR-031](https://github.com/finance-lab-project/platform/blob/a783e14d3ee872245d717eb413f108b811d0209f/docs/architecture/decisions/0031-java-spring-budget-incremental-releases.md) supersedes the Go production migration for Release 1. Preserve this specification and its pinned revision evidence for later optional Go learning/reference; it is not a prerequisite for the Java/Spring Budget backend or the frontend release. Existing Spring/V2 contracts remain unchanged.

**Status: planning draft, revision 1, 2026-10-20.** This records
[#142](https://github.com/anton415/finance-lab/issues/142), under
[Go Budget — First authenticated monthly budget slice](https://github.com/anton415/finance-lab/milestone/11).
Author: Codex (OpenAI), recording the maintainer's planning baseline.
Source snapshot: `anton415/finance-lab` at
`a214a664f5409e91c10ec4468a53c2a104936bc5`.

This is a human-readable specification and design checkpoint, not implemented
Go behavior or a frozen public API. Independent specification review and human
baseline acceptance are pending. The accompanying `revision-1.md` record binds the
captured [issue body](issue-142-source.md), this document/design and their hashes.
Publication of this documentation does not authorize implementation or promotion.

## Purpose and scope

[ADR-030][adr030] selects direct Go Budget implementation. The existing Spring
checkpoint and T2 documents do not yet provide authenticated persistence. A
maintainer needs a repository baseline explaining reusable behavior, deliberate
wire changes, ownership, failure handling, verification and unresolved choices.

This document covers the monthly read/create/update slice, its schema design,
BFF boundary, test plan and rollout/recovery plan. The outcome is a traceable
specification that can be reviewed without the original planning conversation.
Annual Budget remains later release work.

Service implementation, executable SQL migrations, OpenAPI/client generation,
infrastructure, deployment, repository transfers and Project/workflow changes
are excluded. Spring source/history, contracts, fixtures and issues remain intact.
Budget saves require no Portfolio, FIRE, Kafka, Analytics or AI operation.
No release date or legacy T2 effort estimate is inherited by this issue.

## Source audit and parity matrix

The observations below come from inspection of the pinned source, not a fresh
test run or deployment. All source links resolve to that full commit. Historical
issues [#122](https://github.com/anton415/finance-lab/issues/122) and
[#123](https://github.com/anton415/finance-lab/issues/123) are closed;
[#124](https://github.com/anton415/finance-lab/issues/124) and
[#125](https://github.com/anton415/finance-lab/issues/125) were open when inspected
on 2026-10-20. Their live issue pages are context, not immutable contracts or an
instruction to finish Spring first.

| Capability / evidence | Implemented at the source snapshot | Preserved requirement / deliberate Go v1 change |
| --- | --- | --- |
| Monthly model: [model][model], [React][app] | One income, fifteen fixed spending categories, separate investments; totals use JavaScript numbers. | Preserve fields and category identities. New v1 totals use exact decimal Money; legacy arithmetic stays unchanged. |
| Local persistence: [storage][storage], [restore][restore] | Month-specific browser storage and explicit local backup restore. No authenticated server save flow in React. | Preserve local data. Cloud budgets are a separate flow; no automatic upload or import. |
| V2: [contract][v2], [parser][backup], [fixture manifest][fixtures] | Currency-free strings, including empty and noncanonical spellings; original parsed strings preserved. Duplicate keys have normal last-key parser behavior. | V2 is unchanged. Go v1 deliberately introduces currency, canonical Money/null and duplicate-key rejection. |
| GET: [controller][controller], [service][service], [controller tests][controller-tests] | Validates month; service returns `Optional.empty()`. Tests include a mocked 200 and a 404. No persisted authenticated GET exists. | Preserve exact month validation and own-month 404. Implement owner-scoped Go reads later; mocked responses are not persistence evidence. |
| PUT: [deserializer][deserializer], [controller][controller], [request tests][request-tests] | Rejects malformed/invalid fields, amounts, categories and missing/blank key; valid request ends at HTTP 501 without a service call. | Preserve strict required fields and no mutation on invalid input. New v1 adds currency, canonical string revisions and strict duplicate detection at every object level. |
| Version: [T2 API][t2-api], [request tests][request-tests] | Shape validation accepts null or an integral JSON number in signed Java `Long` range, including `7.0`/`7e0`. No atomic compare/write. | Go creation expects null, starts at `"1"`; updates expect positive canonical string revisions bounded by signed BIGINT. This is an intentional wire change. |
| Conflict/replay: [T2 design][t2-design], [T2 API][t2-api] | Documented, not implemented in Spring or React. | Carry forward whole-budget comparison, explicit review, atomic mutation/receipt, manual retry and 24-hour retention. |
| PostgreSQL: [service][service], [dependencies][pom], historical #124 | No implemented database adapter, schema or PostgreSQL dependency. #124 proposes Spring/Flyway, UUID owners and preserved text/JSONB amounts. | New Go design uses verified issuer/subject owners, exact NUMERIC values and proposed Goose migrations. Do not rewrite #124 or imply its work is done. |
| Authentication: [dependencies][pom], [controller][controller], historical #125 | No Spring Security/session implementation. #125 proposes local invited accounts and sessions. | Keycloak owns identity, BFF owns browser sessions, Go authorizes its own records. Actual token issuance is unverified. |
| Errors: [handler][handler], [T2 API][t2-api], [ADR-024][adr024] | Spring uses its existing small JSON error objects. | Go/BFF use RFC 9457; do not retrofit those bodies into Spring. |
| Recovery: [ADR-019][adr019], [ADR-023][adr023] | Recovery and session revocation are architecture targets, not executed evidence. | Preserve restore isolation and revoked sessions; add the proposed Budget generation fence below. |

## Responsibilities and design rationale

| Component | Owns | Boundary |
| --- | --- | --- |
| Go Budget | Input/domain validation, exact totals, owner-scoped storage, versions, successful receipts and domain authorization. | Does not trust browser IDs, BFF calculations or possession of an arbitrary service token. |
| Keycloak | Identity and delegated token issuance. | Does not decide ownership of a Budget row. |
| TypeScript BFF | Opaque browser sessions, OAuth lifecycle, CSRF, delegated API calls and browser contract. | Preserves Money and operation identity; no authoritative money arithmetic. Session failures fail closed. |
| React | Editing drafts, original/draft/latest comparison, visible save outcomes and deliberate retries. | Does not automatically overwrite conflicts or retry PUT. Pending operations remain separate from newer edits. |
| PostgreSQL | Budget-owned durable rows, uniqueness, exact amount constraints and atomic transactions. | Dedicated Budget database/credentials; no cross-service table access. |

Design checkpoint: **required**, because identity, storage, retries, service
boundaries and recovery change. Design revision 1 is included in this document's
digest; the decisions below are proposed detail within [ADR-030][adr030].

| Choice and rationale | Reasonable alternative / tradeoff |
| --- | --- |
| Implement Go directly while retaining Spring history. | Finish Spring persistence/security first: exercises the older stack but duplicates work before the chosen production architecture. |
| Whole monthly replacement with one version. | Field-level merge/versioning reduces conflicts but adds policy and coordination. Deliberate whole-budget review preserves the existing T2 decision. |
| One row with fifteen nullable spending columns. | JSONB matches the UI map but weakens simple per-value database checks. Fixed columns suit this fixed catalog; a category change needs a reviewed migration. |
| Successful receipt and budget mutation in one transaction. | A separately committed pending record needs recovery of abandoned claims. The proposed transaction leaves no durable pending state on rollback. |
| Unconstrained NUMERIC plus checks. | A fixed NUMERIC scale can round before validation. Reject unrepresentable source amounts rather than silently alter them. |
| Generation outside a restored snapshot. | A version alone can repeat after recovery and cannot identify the lost history. A generation adds a restore/review boundary at the cost of an operator-controlled setting. |

## Go v1 and browser contract

### Routes and representations

| Operation | Go | BFF |
| --- | --- | --- |
| Read | `GET /api/v1/budgets/{month}` | `GET /api/web/v1/budgets/{month}` |
| Full replacement | `PUT /api/v1/budgets/{month}` | `PUT /api/web/v1/budgets/{month}` |

Month is the complete ASCII `YYYY-MM`, years 0001–9999, months 01–12.
`0001-01`, `2026-11`, `9999-12` are valid; `0000-01`, `2026-1`, `2026-13`,
`２０２６-11`, surrounding whitespace or trailing characters are invalid.
Month is a calendar identifier, without timezone conversion.

PUT requires `Content-Type: application/json`, one `Idempotency-Key`, and the
proposed `Budget-Generation` header below. The JSON root contains exactly
`expectedVersion`, `currency`, `income`, `spending`, `investments`.
All are required; no owner, month, totals or backup `formatVersion` belongs
in the body. Reject duplicate decoded JSON keys at every object level before
ordinary object parsing can discard them, including at the BFF boundary.
Reject missing/unknown fields, wrong types, malformed JSON and trailing JSON.

`spending` contains exactly these required IDs, in the existing display order:
`groceries`, `restaurants`, `utilities`, `transport`, `household`, `health`,
`personal-care`, `clothing`, `subscriptions`, `education`, `tech`, `culture`,
`entertainment`, `gifts`, `travel`. Labels are presentation metadata.

The maintainer selected **RUB, USD, EUR** as the initial currency allowlist.
Each budget has one immutable currency. Every populated value is an object with
exactly `amount` and `currency`, matching that budget currency. Income,
investments and each spending entry are either Money or explicit JSON null.
Null means unplanned; `{"amount":"0","currency":"RUB"}` means planned zero.
Omission is invalid. Currency conversion is excluded.

### Exact amounts, totals and revisions

Following [ADR-022][adr022], source Money uses a canonical nonnegative decimal string:

- Integer part: `0`, or 1–18 ASCII digits starting with 1–9.
- Optional fraction: 1–6 ASCII digits, with its last digit nonzero.
- No signs, exponent, whitespace, leading integer zeros or trailing fractional
  zeros. The full string must match; never trim or normalize invalid input.
- No floating-point arithmetic, intermediate rounding or source-value clamping.

| Input | Go v1 outcome |
| --- | --- |
| `"0"`, `"0.000001"`, `"12.34"`, `"999999999999999999.999999"` | Valid source amounts in a matching Money object. |
| `"0.00"`, `"0010"`, `".5"`, `"1e3"`, `""`, `" 1"`, `"-0"`, `"+1"` | 400 `INVALID_REQUEST`; some are valid legacy V2 spellings, which remain valid there. |
| `"0.0000001"`, `"1000000000000000000"`, numeric JSON `12.34` | 400: excess scale, excess magnitude, wrong type respectively. |
| Null entry / missing entry | Null accepted; omission rejected with 400. |
| Budget RUB with a populated USD entry, or unsupported `"GBP"` | 400; no conversion or write. |

Go derives `totals.income`, `totals.spending`, `totals.investments` and
`totals.remaining`, each as Money in the budget currency. Null contributes exact
zero; totals themselves are never null. Remaining is income − spending −
investments. Only remaining may be negative, with a leading minus and no negative
zero. Aggregate amounts may require **20 integer digits**, still at most six
fractional digits and canonically serialized. Do not apply the source
18-digit limit to totals. For example, `0.1 + 0.2 = 0.3` exactly.

Creation sends `expectedVersion: null`; updates send a string matching
`[1-9][0-9]*` and at most `9223372036854775807`. `"1"` and `"7"` are valid;
`1`, `"01"`, `"0"`, `"-1"`, `"7.0"`, `"7e0"`, omission and
`"9223372036854775808"` are invalid. New budgets start at version `"1"`;
each accepted update increments once. Never wrap on revision exhaustion;
the final exhaustion error is decision D2 below. Revisions, backup
`formatVersion`, API major versions and migration numbers are independent.

GET 200 and successful PUT return the complete Budget representation:
`month`, `version`, `currency`, `income`, `spending`, `investments`, `totals`.
Version is a string; fields keep their Money/null distinctions. GET for an
absent own budget returns 404 `BUDGET_NOT_FOUND` and creates nothing, including
no owner row. React may show an unsaved draft with no version.

Creation returns 201 with `Location: /api/v1/budgets/{month}`; update returns 200.
The BFF rewrites creation Location to `/api/web/v1/budgets/{month}`.
All Budget and problem responses use `Cache-Control: no-store`.
The draft replay marker is `Idempotency-Replayed: true` on successful replays;
the BFF preserves it, status, response body and generation. Header spelling
belongs to the contract freeze (D3), not an implemented Spring contract.

### Identity and browser boundary

Logical owner is **verified `(issuer, subject)`**, never email, supplied user ID,
query parameter or arbitrary header. Treat both values as exact identities:
no subject lowercasing, email matching or guessed cross-issuer linking.
Go verifies trusted issuer, signature, token lifetime, intended audience and
permissions before accessing private data, including every receipt replay.

The proposed profile is audience `finance-lab-budget`, scope `budget:read` for
GET, both `budget:read` and `budget:write` for PUT, and trusted
`principal_type=user`. A machine/client-credentials token cannot impersonate a
budget owner. The claim must come from trusted Keycloak issuance, not user-editable
attributes. Actual exchange, claim mapping and privilege downscoping must be
tested before this profile is accepted as usable ([ADR-014][adr014], D4).

The BFF validates its server-side session and CSRF before forwarding PUT, then
obtains the appropriate user-delegated token. Follow [ADR-023][adr023] for
PostgreSQL sessions, protected OAuth tokens, coordinated refresh, expiry/logout
and restoration revocation. No private request proceeds when required session
or exchange state cannot be validated. React receives no downstream bearer token.

The BFF preserves amount/revision strings, nulls, the exact idempotency key and
generation. Object property order/JSON whitespace may change without changing
request identity. It validates Go responses without converting money/revisions
to JavaScript numbers. It never retries a forwarded PUT automatically.

### Errors and side effects

Use RFC 9457 `application/problem+json` with safe `type`, `title`, matching
numeric `status`, stable `code`, and only the documented extensions. Optional
detail/instance must not expose secrets, internal topology or another owner's
budget. `currentBudget` is deliberately the authenticated owner's snapshot.
The public type-URI base is **undecided**; no placeholder URL is a final type.
The table records draft codes; names not supplied by #142/T2 require D1 catalog
review before freezing OpenAPI.

| Go status / code | Condition / response and mutation outcome |
| --- | --- |
| 400 `INVALID_REQUEST` | Invalid month/body/Money/revision/key/generation; no mutation or successful receipt. Draft mapping also uses this for an attempted currency change at a matching version. |
| 401 `AUTHENTICATION_REQUIRED` | Missing/invalid/expired token, wrong issuer/audience; no private data or mutation. |
| 403 `FORBIDDEN` | Verified identity lacks required permission or user principal type; no private data or mutation. |
| 404 `BUDGET_NOT_FOUND` | Authenticated GET finds no own month. Include `month` and current generation; no write. Another owner's month is still absent to this owner. |
| 409 `BUDGET_VERSION_CONFLICT` | Expected absence/version differs. Include `currentBudget` (complete Budget or null); comparison failure changes neither budget nor receipt. |
| 409 `IDEMPOTENCY_KEY_REUSED` | Retained exact key has a different binding, including month; no mutation. |
| 409 `SAVE_RESULT_UNAVAILABLE` | Concurrent duplicate cannot resolve within the provisional five seconds. This request does not apply a second write; the original may still commit. |
| 409 `BUDGET_RECOVERY_REQUIRED` | Well-formed generation differs; reject before owner creation, receipt lookup or mutation. Preserve the pending operation for review. |
| 415 `UNSUPPORTED_MEDIA_TYPE` | Unsupported request media type; no mutation or successful receipt. |
| 500 `INTERNAL_ERROR` | Unexpected internal failure; no invented successful acknowledgment. Roll back an uncommitted transaction; a lost commit acknowledgment may still leave an unknown outcome. |
| 503 `SERVICE_UNAVAILABLE` | Required dependency unavailable or operator write suspension. Pre-execution refusal makes no mutation; a failure after execution starts must not be presented as proof of rollback. |

For a valid authenticated PUT, generation validation precedes receipt lookup.
A matching receipt precedes fresh version/currency-change checks. For a new
operation, compare expectedVersion atomically before accepting replacement.
If the version matches, reject a currency change without a receipt or increment.
No precedence for unrelated simultaneous malformed inputs is frozen here.

| BFF condition | Browser result |
| --- | --- |
| Missing/expired/invalid browser session | 401 `AUTHENTICATION_REQUIRED`; no forwarding. |
| Failed CSRF/origin check | 403 `CSRF_REJECTED`; no forwarding. |
| Required session store or token exchange unavailable | 503 `SERVICE_UNAVAILABLE`; fail closed. |
| Unexpected upstream 401/403 after BFF delegation | 502 `UPSTREAM_ERROR`; no automatic retry or false claim that browser login is invalid. |
| Malformed upstream body/headers | 502 `UPSTREAM_ERROR`; if a write was forwarded, its outcome may be unknown. |
| Timeout after forwarding PUT | 504 `SAVE_OUTCOME_UNKNOWN`; keep key/body/generation and first-send time. |
| Valid domain response | Forward documented success/problems, including 404 and each distinct 409; preserve exact data, replay marker and generation, with the Location rewrite above. |

The UI enters conflict review only for `BUDGET_VERSION_CONFLICT`.
`SAVE_RESULT_UNAVAILABLE`, a forwarded-write timeout, lost connection or ambiguous
5xx leaves an unknown outcome. Neither BFF nor React may report such a save as
definitely failed or automatically issue another PUT.

## Atomic save, replay and client recovery

1. Authenticate/authorize, validate transport and the current generation, then
   resolve the owner. A PUT may create its owner mapping within the save
   transaction; a refused generation cannot create it.
2. Scope keys to the owner **across months**. Bind API major, method, URL month,
   generation and the complete validated request, including expectedVersion.
   Ignore JSON object order/whitespace, preserving parsed string values and nulls.
   No amount, key or identity normalization.
3. Look for a retained receipt. Match the original key as well as the complete
   binding; a match returns its historical successful status/body before stale
   version checks. Changed binding returns `IDEMPOTENCY_KEY_REUSED`.
4. If absent, atomically claim the candidate receipt and conditionally create
   when absent, or update at the expected version. Persist budget, new version
   and complete successful receipt in the same transaction; send success only
   after commit. Any failed comparison or write rolls back the whole candidate.
5. Concurrent duplicates coordinate through database uniqueness. If the first
   commits, replay; if it rolls back, a waiter may claim and perform normal checks.
   Bound coordination wait at the provisional five seconds. An unresolved wait
   returns `SAVE_RESULT_UNAVAILABLE`, not a failure verdict on the first request.

The required key is opaque and nonblank, preserved without trimming. Final
transport length/character limits and duplicate-header handling must be frozen
with the Go/BFF HTTP contract (D3); this does not impose new Spring key rules.

React keeps original loaded Budget, editable draft and latest conflict snapshot.
The user chooses which edits to keep against the latest snapshot; preserve other
fields. The resolved intentional save uses the reviewed version and a new key.
Another intervening write causes another conflict, never automatic overwrite.

Keep an immutable pending operation (key, method/month, generation, exact body,
first-send time and identity context) separate from subsequent draft edits.
A deliberate retry uses that operation, within **24 hours of its first send**;
retry does not reset the deadline or silently substitute a different signed-in
owner. After expiry, preserve the draft, GET current state and require review
before a new operation/key. Do not claim the original save failed.

A successful receipt remains replayable for **at least 24 hours after commit**.
Replay can return version `"8"` while the current budget is `"9"`: confirm the
earlier operation, then refresh current state without discarding newer edits.
After cleanup, receipt absence cannot distinguish expired history from a
never-seen key. Normal new-operation checks apply; no guaranteed expired-key
error or detection of past changed-content reuse exists after deletion.

## Proposed PostgreSQL and migration design

This section describes schema semantics, not executable SQL. The service has a
dedicated logical Budget database and non-interchangeable credentials.

| Table | Proposed fields and constraints |
| --- | --- |
| `budget_owners` | Internal owner key; required issuer and subject with a unique exact `(issuer, subject)` pair. External identities are not forced into UUID syntax. |
| `monthly_budgets` | Owner foreign key and validated ASCII month as the unique/primary owner-month key; positive BIGINT version; allowlisted currency; nullable income, investment and fifteen fixed spending amount columns. Map `personal-care` explicitly to its SQL column. |
| `budget_save_receipts` | Owner foreign key; fixed-length digest of exact key plus stored original key; unique `(owner, key_digest)`; complete request binding; original successful status, Budget body and relevant response metadata; nullable deletion deadline. Generation belongs to binding, not key uniqueness. |

All source-amount columns use an **unconstrained NUMERIC domain**. For non-null
values, enforce finite value, nonnegative value, value less than `10^18`, and
exactly representable at six decimal places (value × `10^6` is an integer).
Explicitly reject NaN/infinities; do not rely on comparisons alone for them.
Do not use a scale-typmod cast that rounds before checks. Go validates canonical
wire spelling before conversion; NUMERIC checks enforce value constraints, not
original JSON spelling. Null remains SQL NULL, distinct from numeric zero.
The service serializes stored values canonically without rounding.

The single row's currency applies to every populated amount. Currency cannot
change via the update statement. Derived totals are calculated, never stored as
authoritative budget fields. Conditional update checks owner, month and version
together; create uniqueness prevents two first saves from succeeding.
Version increment must not overflow BIGINT; D2 fixes the public exhaustion result.

Digest lookup avoids indexing an unbounded raw key. Hash is an index aid, not
proof of identity: always compare the stored exact original key and binding.
A different key with the same digest must never replay another operation.
Draft collision handling fails closed with 500 and no mutation; the digest
algorithm/limits require D3/D5. No successful receipt may be inferred from a
digest alone.

Within one transaction, construct a **complete candidate successful receipt**
from the validated request, proposed version and exact totals, claim it under
the owner/digest uniqueness constraint, and perform the conditional mutation.
If the conditional mutation fails, roll back the candidate. There is no
separately committed pending receipt; other transactions cannot observe a
successful result until its budget mutation is committed too.
Store the historical response, not merely a pointer to the latest budget.

**Post-commit retention anchor:** commit each receipt with `delete_after = NULL`.
After observing that committed receipt, a subsequent transaction sets a previously
null deadline to observation time plus 24 hours. A delayed/interrupted anchor
therefore extends retention; NULL protects the receipt from cleanup. Replay must
not reset an existing deadline. Cleanup deletes only non-null expired deadlines,
never budgets; coordinate cleanup with receipt lookup so a raced request either
uses an available receipt or follows normal absent-receipt checks safely.
Do not start retention at transaction start, which could expire too early.

Propose pinned **Goose SQL migrations**, executed by a controlled deployment job.
Choose PostgreSQL/Goose versions before implementation (D5). Migration credentials
have schema-change rights; runtime credentials have only needed Budget access.
Application startup/deployment checks schema compatibility; no automatic
destructive downgrade on application rollback. Test migration from empty and
supported prior schema, compatibility of the rollback release, and failure
before enabling traffic. No SQL, dependency or deployment configuration is
introduced by this documentation.

## Recovery-generation amendment (proposed, acceptance pending)

Budget versions and receipts alone cannot distinguish a restored older database
from its later history. A restore might remove both an acknowledged save and
its receipt, making an old creation retry appear new.

- GET 200 and authenticated own-budget 404 return `Budget-Generation`.
  PUT requires that exact generation. Successful PUT/replay also returns it.
- Go checks generation **before owner creation, replay or mutation**.
  Missing, malformed or multiple values produce 400 `INVALID_REQUEST`;
  a well-formed mismatch produces 409 `BUDGET_RECOVERY_REQUIRED`.
- Draft form: a single nonempty opaque ASCII token, no whitespace or comma-list;
  examples below use `generation-a` and `generation-b`. Final grammar/size and
  complete header schema need D2/D3 acceptance; these are synthetic values.
- All active instances share one value configured **outside the restored Budget
  snapshot**. It is stable through ordinary restarts and application rollback.
  Rotate it before reopening a historical restore and isolate old writers;
  instances with divergent generations must not serve traffic together.
- Generation is in request binding, not `(owner, key_digest)` uniqueness.
  A fresh generation does not permit silent reuse of a retained old key.
- BFF forwards it unchanged. On recovery rejection, React preserves pending
  operation/drafts, loads the new generation and current budget, and requires
  explicit review and a **new key**. It never rewrites the old operation's
  generation and retries it automatically.

Historical restore is an explicit exception to ordinary successful replay and
durability guarantees: acknowledged writes/receipts after the recovery point
may be lost. Rejection does **not** establish that the original save failed.
Invalidate restored BFF sessions as well; session revocation alone is not a
Budget-generation fence, and generation alone does not revoke sessions.

## Four end-to-end traces

All identities, amounts, keys and generation values here are synthetic. Each
flow assumes a valid session/delegated user token and the required CSRF protection.

### Create

1. React GETs `/api/web/v1/budgets/2026-11`. Go finds no own budget and returns
   404 `BUDGET_NOT_FOUND`, `Budget-Generation: generation-a`, no mutation.
2. The user selects RUB and saves this full body with new key `example-create-1`
   and generation `generation-a`; BFF forwards to the Go v1 route:

```json
{
  "expectedVersion": null,
  "currency": "RUB",
  "income": {"amount": "1000", "currency": "RUB"},
  "spending": {
    "groceries": {"amount": "0.1", "currency": "RUB"},
    "restaurants": {"amount": "0.2", "currency": "RUB"},
    "utilities": null,
    "transport": null,
    "household": null,
    "health": null,
    "personal-care": null,
    "clothing": null,
    "subscriptions": null,
    "education": null,
    "tech": null,
    "culture": null,
    "entertainment": null,
    "gifts": null,
    "travel": null
  },
  "investments": {"amount": "100", "currency": "RUB"}
}
```

3. Go commits the owner/month version `"1"` and complete receipt atomically.
   Return 201; the complete response contains those currency/income/spending/
   investments values plus `month: "2026-11"`, `version: "1"` and totals:
   income `"1000"`, spending `"0.3"`, investments `"100"`, remaining `"899.7"`,
   each wrapped in Money with currency RUB. `expectedVersion` is not returned.
4. BFF preserves data/generation/no-store and rewrites Location to
   `/api/web/v1/budgets/2026-11`. React confirms only this operation; any newer
   edits remain a draft.

### Version conflict

Two browsers loaded version `"1"`. A saves with key `example-update-a` and
expectedVersion `"1"`, producing `"2"`. B sends its different draft with key
`example-update-b` and expectedVersion `"1"`. Go returns 409 with
`code: BUDGET_VERSION_CONFLICT` and the complete version `"2"` in `currentBudget`.
B's operation changes no budget and commits no receipt.

These fields sit in a Problem Details envelope. For illustration,
`type: "about:blank"`, `title: "Conflict"`, `status: 409` is a valid envelope;
it is not the selected permanent domain type URI. Preserve the complete
`currentBudget` extension. React compares original/draft/latest. The user chooses
edits against `"2"`, then saves with expectedVersion `"2"` and a new key.
Another intervening edit yields another conflict.

### Successful replay after lost confirmation

Operation K expected `"7"` and committed `"8"` with its receipt, but confirmation
was lost. Another save produced `"9"`. Before the first-send deadline, the user
deliberately retries K's same key, body, month and generation. Go reauthorizes,
checks generation, matches the receipt **before** expectedVersion comparison,
and returns K's original 200/Budget `"8"` with `Idempotency-Replayed: true`.
The stored current budget remains `"9"`. React confirms K, refreshes current
state and preserves any newer draft. Reusing K with another month/body instead
returns 409 `IDEMPOTENCY_KEY_REUSED`.

### Rejection after historical restore

A save with `generation-a` was acknowledged. Recovery restores a point before
that budget/receipt existed. Operators isolate old writers, invalidate restored
sessions and set `generation-b` outside the snapshot. After sign-in again, a
retry of the old operation with `generation-a` gets 409
`BUDGET_RECOVERY_REQUIRED` before owner creation or replay lookup, even if its
expectedVersion would now match. React retains the old request and draft,
GETs the current state/generation and asks the user to review before a new save.
The service does not report the earlier acknowledgment as a failed save.

## Planned test matrix

These tests are **not run or implemented by #142**. Future implementation PRs
must name their actual commands, tool/database versions and observed outcomes.
No uncreated Go test command is presented as runnable.

| Layer / case | Required observation |
| --- | --- |
| Go domain: month/Money/null/currency/revision | Boundary valid inputs round-trip; each invalid example rejects unchanged; null differs from zero; changed currency refuses mutation. Exhaustion never wraps (final error D2). |
| Go domain: totals | `0.1 + 0.2` gives `0.3`; negative remaining is permitted; all-null totals are zero Money; fifteen maximum spending values and maximum investments produce exact totals up to 20 integer digits without rounding. |
| Go/BFF transport | Strict root/nested shapes, duplicate decoded keys, missing/null/type distinctions, wrong content type, header validation and all documented errors; no dropped unknown/duplicate fields. |
| Real PostgreSQL: isolation | Two users × two months: changing one leaves the other three unchanged. Same subject under different issuers is distinct. A missing own month is 404 even when another owner has it; reads create nothing. |
| Real PostgreSQL: constraints | Reject duplicate owner/month, invalid month, negative/nonfinite/overlimit/overprecise source amounts; preserve null/zero; no scale-induced rounding; runtime credentials cannot migrate or read another service database. |
| Real PostgreSQL: concurrency | Two creates: one 201, one version conflict. Two different keys at the same revision: one update, one conflict. Failed comparison leaves no receipt or increment. |
| Real PostgreSQL: duplicates | Same-key identical concurrent requests commit once; waiter replays or reports unavailable after bounded coordination. First rollback allows normal retry. Changed body/month with retained key rejects. |
| Receipt integrity | Forced digest collision never leaks/replays another key's result. Persist full binding and historical response; key reuse across owners remains isolated. |
| Lost confirmation / restart | Drop response after commit, restart application against the same retained database, retry same operation: original success, one increment. Later version `"9"` survives replay of `"8"`. Test failure/connection loss at commit without falsely declaring rollback. |
| Retention / cleanup | Transaction delay cannot shorten 24 hours after commit; null deadline survives anchoring interruption; later anchoring extends protection; replay cannot extend set deadline; cleanup never deletes budgets. After cleanup normal checks apply, with no historical-failure inference. |
| Keycloak / Go | Validate actual issued audience, subject, trusted user claim and scopes; reject expired/wrong audience tokens and machine impersonation; exchange never broadens privileges. Repeat authorization on replay. |
| BFF sessions | Login/rotation, expiry/logout, concurrent refresh, CSRF/origin rejection, session-store/exchange outage, malformed upstream/auth errors and forwarded-write timeout map as specified. No unintended PUT retries. |
| BFF contract | Preserve exact long amounts/revisions/nulls/key/generation/replay marker; rewrite creation Location; enforce no-store for successes/errors; no internal addresses or secrets in problems. |
| React | Original/draft/latest review preserves unchosen latest fields; intervening edit conflicts again. Pending request remains unchanged after newer edits, timeout, identity change or reload in the selected draft-recovery design. First-send deadline never resets. |
| Recovery rehearsal | Restore older data into isolated cluster: old generation rejects before owner/receipt/write even if version matches; missing/malformed/multiple generation rejects; new generation requires review/new key; restored sessions remain invalid and old writers stay isolated. |
| Rollback / migrations | Empty/prior-schema migrations and interrupted migration behavior; compatible prior application reads retained database and receipts without restoring history or changing generation. |
| Legacy regression | Existing [V2 manifest][fixtures], TypeScript/Python validators and Spring checkpoint tests remain unchanged. Preserve valid original spellings, invalid cases and legacy arithmetic; no implicit import/currency assignment. |

## Rollout, rollback and restoration

1. **Stage 0:** review this exact revision and settle needed contract decisions.
   Human baseline acceptance is separate from documentation merge. No automatic
   implementation dispatch, Project promotion or Spring issue edits.
2. **Stage 1A — domain and contract:** approve placement/toolchain, implement
   separately scoped Money/month/totals and service-owned v1 contract/persistence
   work. Pure domain work can be scoped independently of unresolved HTTP/deployment
   choices. Freeze HTTP choices before handlers/generated clients rely on them.
3. **Stage 1B — platform in parallel:** verify actual Keycloak delegation and
   BFF/session behavior, database ownership/migrations, backup capabilities,
   common external generation and operational thresholds. This is a future work
   sequence, not infrastructure authorization from #142.
4. **Isolated synthetic vertical slice:** demonstrate own-month read/save from
   two browsers, cross-user isolation, concurrency, replay, restart, write
   suspension, compatible application rollback and historical restore rehearsal.
   Record actual outcomes; no production readiness inferred from unit tests.
5. **Controlled release:** operator-controlled write suspension must refuse new
   writes safely and account for in-flight operations as potentially committed.
   Preserve pending drafts/operation records throughout cutover. Human production
   approval follows reviewed evidence and unresolved-risk decisions.

Keep browser/local budgets separate throughout rollout. A future **separately
approved import** must retain the original V2 archive, ask for currency, and show
an exact conversion preview. For example, historical `"0010.00"` and `"1e3"`
need explicit conversion to `"10"` and `"1000"`; `"1e-9999"` cannot become zero
silently, and `"0.0000001"` cannot be rounded to fit. Block unrepresentable
values rather than round, clamp or discard them. No import is implemented here.

**Application rollback** changes application binaries/configuration while keeping
the current database, compatible schema and generation. It does not erase
acknowledged writes/receipts or apply destructive down migrations. If no previous
release can read the current schema/receipts, suspend writes and resolve
compatibility instead of calling a historical restore a rollback.

**Historical data recovery** follows [ADR-019][adr019]: suspend/isolate writers,
restore into an isolated new cluster at a consistent recovery point, verify
Budget/Keycloak/BFF database and credential consistency, invalidate all restored
BFF sessions, rotate the external Budget generation, validate data and replay
rejection, then seek human approval to reopen traffic. Fence the old cluster
and old-generation instances. Report the actual recovery point and potentially
lost acknowledged writes/receipts; preserve drafts for explicit reconciliation.

The one-hour PostgreSQL RPO and 24-hour RTO are **unverified targets**.
Measure provider restore capability and elapsed recovery in rehearsal, including
session invalidation and generation control. A missed target is a recorded gap,
not evidence of compliance.

## Unresolved decisions and acceptance evidence

| ID | Decision / risk | Owner | Needed by |
| --- | --- | --- | --- |
| D1 | Public Problem Details type-URI base and final code/type catalog, including the draft Go/BFF mapping names above. No public URL is selected here. | Maintainer + Go/BFF contract owners | Stage 1A HTTP/OpenAPI freeze |
| D2 | Final recovery-generation amendment acceptance and revision-exhaustion status/code; neither may permit mutation under an unsafe expectation. | Maintainer + Go contract owner | Before transactional HTTP save contract is frozen; generation also required before recovery rollout |
| D3 | Precise generation/key header grammar/limits, duplicate-header policy, replay marker and request-binding encoding/digest choice. Preserve exact identity and no normalization. | Go/BFF contract owners | Stage 1A HTTP/receipt implementation |
| D4 | Actual Keycloak version, token exchange/downscoping, trusted user claim and issued audiences/scopes. Proposed profile is not verification. | Platform owner + Go/BFF security owners | Stage 1B authenticated integration |
| D5 | Go repository/module placement/toolchain, exact decimal type, PostgreSQL/Goose versions and migration/schema compatibility details. | Maintainer (placement/toolchain); Go + platform owners (storage) | Before respective bootstrap/domain/persistence work |
| D6 | Session idle/absolute limits, cookie/origin/CSRF settings, protected token storage, refresh coordination and restore revocation mechanism under ADR-023. | BFF + platform owners | Stage 1B browser authentication |
| D7 | Measured duplicate-wait/dependency timeouts, retention anchoring/cleanup operations, external generation distribution, write suspension and restore runbook. | Go/BFF + platform operators | Synthetic vertical slice; evidence before production approval |
| D8 | Concrete React preservation of pending operations/newer drafts across reload/sign-in/cutover; explicit V2 import design remains a separate scope. | React owner + maintainer | Browser integration; import only before a separately approved import |

Documentation acceptance maps to #142 as follows:

| #142 criterion | Evidence in this revision |
| --- | --- |
| 1 | Source audit/parity matrix distinguishes code, historical plans and v1 changes. |
| 2 | Responsibilities, rationale and scope state ownership and excluded services. |
| 3 | Go/BFF contract, examples, errors, atomic save and proposed generation amendment. |
| 4 | Proposed PostgreSQL checks, transaction and post-commit retention anchor. |
| 5 | Planned test matrix includes isolation, concurrency, lost confirmation, restart, cleanup, generation, totals and unchanged V2. |
| 6 | Rollout distinguishes application rollback and historical recovery, preserving drafts and acknowledging possible loss. |
| 7 | Decision table names owners/stages; draft status and pending security evidence are explicit. |
| 8 | Four traces cover create, version conflict, historical replay and post-restore rejection. |
| 9 | Documentation PR diff must contain only this documentation and its index/capture/revision record. |

**Documentation verification:** review each criterion against the captured issue;
check Markdown structure, links against the pinned Git tree, JSON examples,
decimal examples, artifact hashes and the docs-only diff. The existing
[CI workflow][ci] has application checks but no dedicated Markdown/diagram check;
this document adds no diagrams or tooling. Actual commands/results belong in
the PR and revision record. Do not run application/database suites to imply
the future contracts are implemented.

**Human demonstration, pending:** explain preserved V2 behavior versus new Money
and revision wire shapes; trace owner/version/replay boundaries using the four
examples; explain why an older database can reuse versions and therefore needs
a generation change. This author review is not an independent PASS or human
acceptance under the [specification contract][spec-contract].

[adr030]: https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/architecture/decisions/0030-release1-go-migration-implementation-sequence.md
[adr022]: https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/architecture/decisions/0022-exact-decimal-money-currency-contract.md
[adr024]: https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/architecture/decisions/0024-openapi-contract-first-rest-versioning.md
[adr014]: https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/architecture/decisions/0014-keycloak-service-to-service-security.md
[adr023]: https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/architecture/decisions/0023-postgresql-bff-sessions-and-oauth-lifecycle.md
[adr019]: https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/architecture/decisions/0019-backup-recovery-objectives-drills.md
[spec-contract]: https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/agentops/specification-contract.md
[t2-api]: https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/t2/api-contract.md
[t2-design]: https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/t2/design.md
[v2]: https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/budget-backup-contract.md
[model]: https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/src/budgetModel.ts
[app]: https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/src/App.tsx
[storage]: https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/src/budgetStorage.ts
[restore]: https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/src/budgetRestore.ts
[backup]: https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/src/budgetBackup.ts
[fixtures]: https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/fixtures/budget-backup/v2/manifest.json
[controller]: https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/backend/src/main/java/io/github/anton415/financelab/BudgetController.java
[service]: https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/backend/src/main/java/io/github/anton415/financelab/BudgetService.java
[deserializer]: https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/backend/src/main/java/io/github/anton415/financelab/SaveBudgetRequestDeserializer.java
[handler]: https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/backend/src/main/java/io/github/anton415/financelab/BudgetExceptionHandler.java
[controller-tests]: https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/backend/src/test/java/io/github/anton415/financelab/BudgetControllerTest.java
[request-tests]: https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/backend/src/test/java/io/github/anton415/financelab/SaveBudgetRequestTest.java
[pom]: https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/backend/pom.xml
[ci]: https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/.github/workflows/ci.yml
