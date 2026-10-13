# T2 design: budget conflicts and safe retries

Status: agreed design decisions from guided exercises on 13 October 2026.
Implementation and verification are pending. The API contract is the next
design exercise.

## Scope and invariants

An invited user signs in, selects a month, edits and saves a budget, and receives
confirmation. In another browser, the same user signs in and opens the same month
to see the saved budget.

- **User isolation:** users can read and change only their own budgets.
- **Month isolation:** saving one month leaves every other month unchanged.
- **Durability:** a confirmed save survives an application-server restart,
  assuming no subsequent edits.

Preserve the existing budget model and amount-string rules described in the
[budget backup contract](../budget-backup-contract.md). The concurrency version
discussed below identifies a saved budget revision; it is separate from the
backup document's `formatVersion`. All examples here are synthetic.

## Competing edits

### Conflict boundary and atomic save

Detect conflicts across the **whole monthly budget for one authenticated user**.
Even edits to different fields require review if the saved revision changed.
This deliberately accepts extra review in exchange for a simpler T2 design.

Each saved monthly budget has a server-controlled version. A save includes the
version on which its edit is based.

- Accept a new save only if that version matches the current saved version.
- Enforce the version check, budget update and version increment atomically.
- A version conflict changes neither the saved budget nor its version.
- Two valid, different save operations based on the same existing version cannot
  both succeed.

### User review and resolution

On conflict, preserve the unsaved draft and show it alongside the latest saved
budget. Retain the originally loaded budget to distinguish the user's edits from
changes made elsewhere: original, draft and latest form a Git-style three-way
comparison.

The user may discard their draft or explicitly choose edits to retain. Build the
resolved budget from the latest saved budget, applying only those chosen edits.
Do not automatically merge and save competing edits.

| Snapshot | Groceries | Transport |
| --- | ---: | ---: |
| Originally loaded in both browsers | 5,000 | 2,000 |
| Latest saved by browser A | 6,000 | 3,000 |
| Browser B's draft; only groceries was edited | 4,500 | 2,000 |
| Resolved budget after choosing B's groceries edit | 4,500 | 3,000 |

The resolved save uses the version just reviewed and undergoes the same atomic
check. If another change occurs during review, report another conflict and
preserve the draft again. Explicit review does not bypass concurrency checks.

## Idempotency and lost confirmations

A missing confirmation leaves the save's outcome unknown: the save may have
committed while its response was lost.

### Operation identity

- Assign a new idempotency key to each new intentional save.
- Retry an uncertain save using the **same key and identical request contents**,
  including its target month, expected version and budget.
- Scope keys to the authenticated user. Enforce database uniqueness on
  `(user_id, idempotency_key)`; user identity comes from authentication.
- Bind the stored key to the original operation and its request contents.
  Reusing it with changed contents is rejected without changing the budget.
- A new key does not make an outdated budget version acceptable.

### Atomic execution and replay

For a completed operation, verify ownership and request identity, then return the
recorded successful result without applying another write or incrementing the
version. This replay must be recognized before treating its old expected version
as a new-save conflict.

For a new operation, claim its key under the unique constraint and perform the
normal ownership, validation and atomic version checks. Store the budget change,
new version and successful result in **the same database transaction**. Send
success only after commit.

If the transaction rolls back, neither the budget change nor the successful
result remains committed. A retry can claim the key and try again, subject to
all normal checks.

Concurrent identical requests coordinate through the unique constraint:

- If the first commits, the duplicate verifies that its contents match and
  returns the recorded result.
- If the first rolls back, the waiting retry may claim the key and process the
  save through the normal checks.
- Database uniqueness coordinates claims; application logic performs result
  matching and replay.

### A replayed result is a receipt for an earlier operation

Suppose K saves version 7 as version 8, but its response is lost. Another browser
then saves version 9. A retry of K returns K's original success with version 8
and leaves the current version 9 unchanged.

The UI can confirm that K succeeded, then fetch the current budget while
preserving any new unsaved edits. It must not present the replayed version 8 as
proof that it is still the latest state.

## Retention and bounded waiting

| Situation | Decision |
| --- | --- |
| Successful operation | Guarantee replay for **24 hours after the successful server commit**. |
| Retention expiry | The result record becomes eligible for deletion. The budget itself remains stored. |
| Concurrent duplicate | Wait up to **5 seconds** for the original operation's result. This limit is provisional until save latency is measured. |
| No result within the wait limit | Return a retryable “result not available yet” outcome. This does not prove that the original save failed; it may still complete. |
| Retry while recovery remains available | Preserve the original key and request contents. |
| Recovery window expired | Load the latest budget, preserve the draft and require review. An explicitly chosen new save uses a new key and the reviewed version. |

The five-second limit bounds a duplicate's wait for another execution; it does
not establish the original operation's outcome.

After deletion, absence of a key record cannot prove that an earlier save
failed, nor can absence alone distinguish an expired key from a never-seen key.
The API contract must account for that limitation.

## Technology choice

Keep PostgreSQL as the planned persistence technology. Borrow Git's comparison
idea without using Git repositories to store runtime budgets.

Reuse the ShareTrip transaction principle: a business change and its associated
record commit together. Here the associated record supports idempotency replay;
it is not an outbox event. Kafka and an outbox are not required by this budget
save flow.

## Verification scenarios to implement

These are acceptance cases, not completed test results.

| Case | Required outcome |
| --- | --- |
| Different user or month | Ownership and month isolation remain enforced, including result replay. |
| Two different saves based on version 7 | Exactly one succeeds as version 8; the other reports a conflict without mutation. |
| Conflict review | Preserve the draft; chosen edits apply to the latest budget and other fields remain intact. |
| Another save during review | Reject the now-outdated resolved save and preserve the draft again. |
| Successful save, lost response, identical retry | Return the recorded success; no second write or version increment. |
| Same key, changed contents | Reject reuse without mutation. |
| Concurrent identical requests | One committed operation; matching duplicates replay its result when available. |
| Failure before commit | Both budget change and result record roll back; a retry may proceed through normal checks. |
| K succeeded as version 8; current budget is version 9 | Replay version 8's result and leave version 9 untouched. |
| Result retention | Do not delete a successful result before its 24-hour guarantee ends; expired recovery requires review before a new save. |
| Duplicate reaches the five-second wait limit | Return a retryable unknown outcome; a later retry keeps the same key and contents. |

## Next: API contract

Work through resources and operations, HTTP methods and paths, request and
response shapes, authentication context, error outcomes and retry behavior one
step at a time. The exact wire format, request-content comparison, initial
missing-budget behavior and client recovery/expiry handling remain to be
specified. Do not infer endpoint names, status codes or implemented behavior
from this note.
