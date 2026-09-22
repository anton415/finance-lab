# Budget backup preview

Use **Choose JSON backup** beside the export controls to select one local file.
Validation starts automatically. A valid preview shows the backup's exact month,
format version, and all ten rows in order, including empty rows. Item whitespace
and line breaks remain visible, and income/spending values retain their original
text, such as `0010.00`, `.5`, `1.234`, and `1e+3`. Empty values remain distinct
from zero. Long contents wrap or scroll without being truncated.

**Choosing a file is preview only. Nothing is restored or changed.** The displayed budget
can remain on another month. Editing or navigating the budget does not apply or
retarget the preview. **Restore backup…** opens a fresh, read-only confirmation;
only its final month-specific action changes data. See the
[restore guide](budget-backup-restore.md) for replacement, cancellation, failures,
and storage limitations.

## Files and limits

| Input | Policy |
| --- | --- |
| File count | One file per attempt; no multiple-file or directory import. |
| Size | At most **1 MiB (1,048,576 bytes)**, inclusive. Larger files are rejected before reading or parsing. This is a byte limit, not a JavaScript string-length limit. |
| Empty input | Zero bytes produce an empty-file error. Whitespace-only contents are invalid JSON. |
| Encoding | UTF-8 with strict decoding. Malformed UTF-8 is rejected separately from a file-read failure; legacy encodings are not guessed. |
| BOM | One initial UTF-8 BOM is tolerated. Repeated BOMs are not stripped, and `U+FEFF` inside strings is preserved. Normal JSON exports have no BOM. |
| Filename and MIME | The `.json,application/json` picker filter is a hint. Content determines validity and the destination month, regardless of filename, extension, or MIME metadata. |
| Read failure | An accessible, retryable error replaces the loading state; no partial preview is shown. |

These are reader limits, not new properties or semantic restrictions in the
[v1 backup contract](budget-backup-contract.md). There are no additional field
length limits, truncation, or silent repairs. A structurally valid backup larger
than 1 MiB is unsupported by this preview UI. The
[JSON exporter](budget-export.md) currently has **no equivalent export-size
cap**, so not every possible export fits this reader.

## Validation and errors

The reader first checks the file size, reads bytes, and decodes UTF-8. A pure
parser/validator then checks the complete v1 document before any destination
lookup. It does not use storage, the network, the DOM, or the current date.

Valid JSON syntax alone is insufficient. The root must contain exactly
`formatVersion`, `month`, and `rows`; version must be the number `1`; month must
be ASCII `YYYY-MM` with year 0001–9999 and month 01–12. There must be exactly ten
row objects, each with exactly the string properties `item`, `income`, and
`spending`. Missing or extra properties are rejected.

Amounts follow the contract's entire-string nonnegative-number grammar and
must convert to finite JavaScript Numbers. There is no two-decimal restriction.
Only one amount in a row may be nonempty: two `"0"` strings are invalid because
both are populated. Original strings, row order, duplicates, text-only rows,
and empty items with amounts are preserved. The reader does not trim, round,
normalize, sort, deduplicate, or add the CSV apostrophe prefix.

Parsing uses native `JSON.parse`, then validates the parsed value. It is not a
raw-text audit for duplicate property names; a custom duplicate-key detector is
not part of v1. Supported numeric spellings such as `1.0` parse as version `1`.
Unknown numeric versions are unsupported; strings, booleans, and null are not
coerced into a version.

One useful failure is reported per attempt. Deterministic tests can inspect
the contract failure's reason and zero-based path, matching the
[shared fixture manifest](../fixtures/budget-backup/v1/manifest.json).
User-facing errors use understandable one-based row references and keep
file-read, decoding, and contract failures distinct. They do not disclose raw
parser exceptions, file contents, imported values, or arbitrary unknown field
names. Invalid input does not trigger a destination-storage lookup.

## Destination status

After successful validation, the preview reads only the existing storage key for
the **backup's month**. The status is an advisory snapshot at the time of that
read:

| Status | Meaning |
| --- | --- |
| Existing | Any stored string is present. Restoration would replace it, even if it is an all-empty budget, an empty string, or malformed JSON. Presence does not establish validity. |
| Absent | `getItem` returned `null`: no stored data was found for that month at the time of checking. No key is created. |
| Unknown | Storage access failed. The backup remains valid, but its destination could not be checked. This is not evidence of an empty destination. |

The lookup does not call the budget loader, parse stored contents, repair or
initialize data, or write anything. It preserves the existing key convention:
`2026-09` maps to `finance-lab:budget:2026-09`, and `0001-01` maps to
`finance-lab:budget:1-01`. The backup and preview keep all four year digits.
The lookup does not construct dates or apply a timezone conversion.

This snapshot is not a reservation, overwrite permission, or a live cross-tab
subscription. Subsequent storage changes can make it stale. Restoration checks
the destination again when opening confirmation and immediately before writing;
the preview status also updates after these checks or a read failure.

## Clearing, cancellation, and retries

The native file input and **Clear preview** button are keyboard accessible.
Loading/status messages and errors are announced accessibly. Only the active
file attempt can display a result:

- Selecting a replacement immediately removes the previous preview or error.
- **Clear preview** is available during reading and after an error or preview.
  It clears the selection, candidate, status, and error, and invalidates any
  pending result. The same file can then be selected again.
- Canceling the native picker without choosing a replacement leaves the current
  preview or active read unchanged. It is not an invalid-file error. Use
  **Clear preview** to discard a candidate explicitly.
- A failed attempt can be retried with the same file. Late success or failure
  from an earlier attempt cannot replace a newer result or revive a cleared
  preview. Unmounting discards pending results as well.

Selecting, replacing, clearing, canceling, and completing or failing a read do
not change the selected budget month, its rows or totals, or any stored keys
and values. Preview actions never call the save helper or storage write/removal
methods, including writes of identical values. Normal user edits and month
navigation retain their existing persistence behavior.

## Privacy and rendering

File processing stays local in the browser. The application does not upload
the backup, send its contents to an AI model, or create network requests from
imported text. It retains only the active candidate, not a raw-content history,
and creates no file-preview object URLs. It does not log budget/file contents.

Imported names and items are rendered as text, never interpreted as HTML,
Markdown, code, configuration, or instructions. Formula-like, markup-like,
and instruction-like items remain legitimate data; they are not blocked by
keywords. For example, `<strong>Sample</strong>` and `=1+1` remain literal text.

## Verification and learning

Run `npm test`, `npm run lint`, and `npm run build` from the repository root.
Coverage includes every raw manifest fixture and its reason/path, boundary
values and byte/encoding policies, fresh JSON export → validate preservation,
preview fidelity, destination statuses, asynchronous races, and inert rendering.
No-mutation assertions compare exact stored strings across at least two months
and an unrelated key, verify an absent destination remains absent, and check
for zero preview-induced writes or removals.

A real-browser smoke check must use synthetic budgets in two months: export A,
display B, preview A, and inspect the existing-destination notice while checking
that B and both stored budgets remain unchanged. Also exercise invalid → valid,
clear, native picker cancellation, same-file reselection, and an absent
destination. Record the actual browser/version, outcomes, and any unperformed
step in the PR. Mocked DOM tests do not prove native picker behavior; an
unavailable smoke step remains pending. Export → validate tests do not establish
restoration or restore → reload preservation.

The maintainer's learning check is **pending**: explain why valid JSON need not
be a valid budget, why valid input does not authorize a write, and why
inaccessible storage does not prove absence. Personally add or debug an
invalid-input test and inspect a two-month no-mutation assertion. Agent-authored
implementation and tests do not complete this human check or establish a
measured agent success rate. Publication requires human approval and is not
required for engineering completion.
