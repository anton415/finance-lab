# T2 monthly budget API contract

Status: contract agreed through guided exercises on 13 October 2026.
The HTTP status codes, error names and conservative client retry deadline below
record the proposed wire mapping accepted for this documentation step.
PUT request validation is implemented at the HTTP 501 checkpoint described below.
Authenticated saving and runtime verification of its outcomes remain pending.

This contract covers reading and saving monthly budgets. It builds on the
[conflict and retry design](design.md). Authentication endpoints and database
implementation are separate work. All examples are synthetic.

## Resource and data

The resource is `/api/budgets/{month}`. The server identifies its budget by the
authenticated user and the month in the URL. User identity comes from the
authenticated session, never from a supplied user ID.

The month uses the existing ASCII `YYYY-MM` rules. Income and investments are
amount strings; spending is an object containing exactly the fifteen existing
category IDs, each with an amount string. Preserve the original strings,
including empty strings. Follow the
[budget amount and category rules](../budget-backup-contract.md).

The API concurrency `version` identifies a saved revision. It is separate from
the backup document's `formatVersion`, which does not belong in this API payload.
Clients use the server-returned version for subsequent saves.

## Read

`GET /api/budgets/{month}`

- Require an authenticated session.
- Return `200 OK` with the complete saved budget: `month`, `version`, `income`,
  `spending` and `investments`.
- If no budget exists for that user and month, return `404 Not Found` with:
  `{"code":"BUDGET_NOT_FOUND","month":"2026-11"}` for November 2026.
- The browser treats that missing-budget response as an expected empty starting
  state. Display an editable, unsaved draft without a saved version.
- GET does not create a budget or change persisted data.

## Save

`PUT /api/budgets/{month}`

Send JSON with `Content-Type: application/json` and a required
`Idempotency-Key` header identifying this intentional save operation.

The body contains exactly `expectedVersion`, `income`, `spending` and
`investments`. The month stays in the URL; user identity stays in the session.
All body fields are required. An omitted `expectedVersion` is invalid.

Request validation accepts `expectedVersion` only as explicit JSON `null` or a
JSON number with an integral value in Java `Long` range
(`-9223372036854775808` through `9223372036854775807`). Integral spellings such as
`7`, `7.0` and `7e0` are equivalent. Strings, booleans, fractions and out-of-range
numbers are invalid; validation must not round them into valid versions. Explicit
`null` expresses an expectation of absence; omission supplies no expectation.
Accepting a version's shape does not choose an initial version or bypass the
later atomic comparison below.

PUT uses the same month rules as GET: complete ASCII `YYYY-MM`, year 0001–9999
and month 01–12. Invalid months, malformed JSON, missing or unknown body fields,
wrong JSON types, invalid categories or amount strings, and a missing or
`String.isBlank()` idempotency key return exactly `{"code":"INVALID_REQUEST"}`
with HTTP 400 before any `BudgetService` call. No additional idempotency-key
format or normalization is imposed.

The current validation checkpoint returns HTTP 501 for valid creation and update
requests without invoking `BudgetService`. Authenticated transactional saving and
the successful responses below remain separate work.

| Version expectation | Condition for acceptance |
| --- | --- |
| `null` | No budget exists for the authenticated user and target month. |
| A saved integer version, such as `7` | That budget still exists at exactly that version. |

Enforce the condition and write atomically. Creation assigns a server-controlled
initial version; an update increments the saved version. A mismatch changes
nothing. Two competing first saves cannot both create the same user's month.

Example update to `PUT /api/budgets/2026-11` with `Idempotency-Key: K`:

```json
{
  "expectedVersion": 7,
  "income": "10000",
  "spending": {
    "groceries": "4500",
    "restaurants": "",
    "utilities": "",
    "transport": "3000",
    "household": "",
    "health": "",
    "personal-care": "",
    "clothing": "",
    "subscriptions": "",
    "education": "",
    "tech": "",
    "culture": "",
    "entertainment": "",
    "gifts": "",
    "travel": ""
  },
  "investments": "1000"
}
```

## Responses

Successful responses contain the complete saved budget in the same shape as a
successful GET. Confirm success only after the budget and successful idempotency
result commit together.

| Outcome | HTTP status | Body |
| --- | --- | --- |
| Budget read | `200 OK` | Complete saved budget. |
| Budget absent on GET | `404 Not Found` | `code: BUDGET_NOT_FOUND` and `month`. |
| Budget created | `201 Created` | Complete saved budget with its assigned version. |
| Budget updated | `200 OK` | Complete saved budget with its new version. |
| Version or expected absence no longer matches | `409 Conflict` | `code: BUDGET_VERSION_CONFLICT` and `currentBudget`: the complete saved budget with its version, or `null` if absent. |
| Retained key reused with different request contents | `409 Conflict` | `code: IDEMPOTENCY_KEY_REUSED`; no mutation. |
| Duplicate waits five seconds without a result | `409 Conflict` | `code: SAVE_RESULT_UNAVAILABLE`; the save's outcome remains unknown. |
| Invalid request | `400 Bad Request` | `code: INVALID_REQUEST`. |
| No valid authenticated session | `401 Unauthorized` | `code: AUTHENTICATION_REQUIRED`; no budget data. |

The error bodies are JSON objects. The browser distinguishes the three `409`
outcomes by their `code`; only `BUDGET_VERSION_CONFLICT` starts conflict review.
It must not treat `SAVE_RESULT_UNAVAILABLE` as proof of save failure.

The creation and update statuses follow
[HTTP PUT semantics](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.4).
The application error names and mappings above are part of this T2 contract.

## Conflict review

Return the current budget in the conflict response so the browser can show it
alongside the locally preserved draft without another GET. That returned budget
is a snapshot, not a lock on future changes.

The user explicitly chooses edits to keep. Apply them to the reviewed budget,
preserving other fields. The resolved save uses the reviewed version and a new
idempotency key. Another intervening change causes another conflict.

## Retry identity and replay

- Assign a new key to each new intentional save; scope keys to the authenticated
  user, with uniqueness on `(user_id, idempotency_key)`.
- Retry the same method, target month, key and unchanged body.
- Match the method, target month and parsed body values against the retained
  operation record. JSON whitespace and object property order do not matter;
  amount-string contents remain significant.
- Authenticate and enforce ownership for every request, including replay.
- A completed matching retry returns its recorded successful status and body,
  before applying new-save version checks. It causes no second write or version
  increment.
- A receipt for version `8` may be replayed while the current budget is at version
  `9`. Confirm the earlier save, then refresh the current budget while preserving
  any newer draft.
- A rolled-back operation leaves neither its budget change nor a successful
  result. A retry may claim the key and proceed through all normal checks.

The successful result and request binding commit in the same database
transaction as the budget change. Concurrent duplicates coordinate through the
unique key as described in the design note.

## Manual recovery and retention

Wait at most five seconds for a concurrent operation's result. If it remains
unavailable, show an outcome-unknown message and a **Retry** button. T2 uses
manual retries. Keep the original pending request separate from any subsequently
edited draft so Retry cannot silently change its contents.

The server retains the key, request binding and successful result for at least
**24 hours after the successful commit**. Replay and rejection of changed-content
reuse apply while that record is retained.

For a lost confirmation, use **24 hours after the first send** as a conservative
client retry deadline. This may end client recovery earlier than server
retention. Do not reset that deadline on retry.

After the client deadline, preserve the draft, load the latest budget and require
review. A new intentional save uses a new key and the just-reviewed version
(or `null` if no budget exists).

Once the server deletes a record, absence alone cannot distinguish an expired
key from a never-seen key. Such a request is treated as a new operation with
normal ownership, validation and version checks. The API cannot promise an
expired-key error, replay or detection of old changed-content reuse after
deletion.

## Verification boundary

The scenarios above specify required behavior, not completed runtime tests.
Implement and verify them incrementally in the Spring Boot exercises, preserving
the user, month and durability invariants from the design note.
