# Restore a JSON budget backup

Choose one local JSON file using **Choose JSON backup**. Selection, validation,
preview, clearing, and picker cancellation are read-only. Check the destination
month and all ten rows before choosing **Restore backup…**. Editing or navigating
while previewing does not retarget the backup.

The [preview reader](budget-backup-preview.md) accepts UTF-8 JSON up to **1 MiB
(1,048,576 bytes)**, inclusive, and tolerates one initial UTF-8 BOM. Its existing
file and [v1 validation](budget-backup-contract.md) policies still apply. Filename,
MIME type, the displayed month, and the clock never determine the destination.
[JSON export](budget-export.md) has no equivalent size cap, so a sufficiently
large export may not fit this reader. CSV cannot be restored.

## Review and confirm

**Restore backup…** checks the backup month's storage again without writing or
navigating to it. The dialog names the exact `YYYY-MM` destination and explains
that success will display it:

- If no stored value exists, the final action is **Restore month YYYY-MM**.
- Any stored string requires **Replace month YYYY-MM**, including empty rows,
  an empty array, malformed JSON, and an empty string. The backup replaces the
  entire destination with all ten rows, including empty ones. There is no merge,
  month remapping, or undo. Keep a JSON backup of current data first.
- If the lookup fails, there is no actionable confirmation. The valid preview
  remains available; recover storage access and try **Restore backup…** again.
  Unknown storage status never means an empty month.

The modal dialog initially focuses **Cancel**, blocks background controls, and
supports Escape. Cancel/Escape returns focus to **Restore backup…** and retains
the preview without changing budgets or storage. Identical data and entirely
empty backups still require explicit confirmation.

Approval belongs to that exact, immutable file selection and the raw destination
value read for the dialog. Replacement selections (even with the same filename),
clearing, unmounting, and unexpected displayed-budget changes invalidate it.
Late file reads cannot revive approval. Canceling the native picker without
choosing another file remains a no-op.

On the final action, the application prepares the local-calendar date, storage
key, and serialized rows, then rereads the destination. Any raw-value change,
including absent versus empty string, cancels the attempt without writing.
A failed reread does the same. Review the refreshed status and explicitly open
a new confirmation; reselecting an unchanged valid file is unnecessary.

## Persistence and success

An unchanged destination permits exactly one restore write attempt. It stores
the complete **bare row array** under the existing monthly key, for example
`2026-09` → `finance-lab:budget:2026-09` and
`0001-01` → `finance-lab:budget:1-01`. The backup and dialog keep four year digits.
There are no temporary, rollback, or history keys, no removals, and no writes to
other months or unrelated keys. Original strings and all ten ordered rows are
preserved without trimming, rounding, normalization, or CSV apostrophe prefixes.
Totals remain derived using existing application arithmetic and formatting.

Only after the storage write succeeds are the displayed month and rows replaced
together. The existing autosave skips this already-persisted transition; the
first subsequent edit saves normally. Success clears the file, preview,
confirmation, and stale export errors, announces **Restored budget for YYYY-MM**,
and focuses the budget heading. Editing or navigation clears this notice.

Reload still starts on the **current calendar month**. Navigate back to the
restored month to load its saved rows and totals. Immediate JSON re-export and
re-export after returning/reloading preserve the approved parsed document,
including amount spellings and text that an HTML input may visually sanitize.
Formatting, JSON indentation, and equivalent escapes are not byte guarantees.

## Failures and limits

Preparation, storage-access/read, and write failures show accessible, retryable
errors without exposing imported data or exception details. A failed write
does not install imported rows, show success, remove data, roll back, or retry
through autosave. The previously displayed month, rows, and totals stay intact.
Normal browser write failures leave the old destination value or its absence
unchanged. Every retry needs a fresh confirmation.

The final read, comparison, and single-key write are synchronous. This is a
bounded stale-data check, **not an atomic compare-and-swap or a cross-tab lock**.
Another writer can still change storage after the final read. Avoid simultaneous
editing in other tabs during restoration. There is no cross-tab synchronization
or conflict resolution.

Success means that browser storage accepted the write, not cloud backup or
guaranteed permanent disk retention. Preservation concerns changes caused by
restoration; it does not recover edits that were already unsaved before restore.
File processing stays local and imported text stays inert. Nothing is uploaded,
executed, or interpreted as HTML or instructions.

## Verification and human learning

Run `npm test`, `npm run lint`, and `npm run build`. Automated tests use real
validation/serialization and shared synthetic fixtures, including full
export → preview → confirm → restore → reload → re-export flows. They check
exact stored strings, totals, ordered rows, absent/existing destinations,
cancellation, obsolete selections/approvals, conflicts, preparation/read/write
failures, one-write behavior, ordinary editing/navigation, and low-year dates.
Storage baselines are taken after normal render/edit/navigation persistence
settles; deliberate external conflict writes are separate from restore writes.

Browser smoke verification must separately exercise two synthetic months:
export A, select B, preview A, cancel and compare both stored documents, then
explicitly replace A, verify focus/totals/navigation, reload and return to A,
and compare a JSON re-export. Also restore into a genuinely absent month without
visiting it first, and exercise keyboard cancellation/confirmation and messaging.
Record the browser/version, actual observations, and any unperformed checks in
the PR. jsdom dialog tests do not establish native modality. Browser fault
injection, if performed, is additional to the required automated failure tests.

The maintainer's learning check remains **pending**: explain why valid input
is not approval, why approval binds exact data and a destination, why the loader
cannot prove absence, and why persistence must precede a UI transition. Personally
demonstrate cancellation preserving two monthly documents and inspect the
write-failure test. Agent implementation/tests do not complete this human check
or establish measured agent success. Social publication needs human approval
and is not required for engineering completion.
