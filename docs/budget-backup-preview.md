# Preview a JSON budget backup

Open **Export and backup**, then **Choose JSON backup**. Selection validates the
file locally and shows its month, format version, Income, all fifteen named
Spending categories, and Investments. Empty values remain blank; zero strings
remain visible. The preview has no editable values.

## File boundary

- One explicitly selected file, at most **1 MiB (1,048,576 bytes)** inclusive.
- Zero bytes fail before reading. Whitespace-only files fail JSON parsing.
- Decode UTF-8 strictly; invalid bytes are rejected without replacement.
- Tolerate exactly one initial UTF-8 BOM; a second BOM fails parsing.
- Filename, extension, and MIME are hints; only contents determine validity and
  the destination month.
- Validate the complete [v2 contract](budget-backup-contract.md) before any
  destination lookup. v1 and malformed backups are rejected.

The pure parser is shared with export validation. The file reader adds byte,
decoding, and read-error handling. Messages expose no input values, arbitrary
property names, filenames, or raw browser exceptions.

## Destination status

After successful validation, read only the backup month's key:

| Result | Meaning |
| --- | --- |
| Existing | Any stored string exists, even malformed or empty data. |
| Absent | The read succeeded and returned `null`. |
| Unknown | Storage access failed. The valid preview remains available. |

This snapshot does not approve replacement or establish stored-data validity.
The lookup never calls the loader, repairs data, or scans other months.

## Selection behavior

Previewing, clearing, collapsing/reopening the tools, and picker cancellation
never write storage. Editing and month navigation retain ordinary persistence.
A preview remains independent of the displayed month. Collapsing the tools
retains it. Clear discards it and allows selecting the same file again.

A new selection clears stale preview/approval immediately. Only the latest
selection may complete; late reads and completions after unmount are ignored.
Picker cancellation or an empty selection retains the existing preview or read.
Read failures are retryable, including the same filename.

File contents stay local. They are not uploaded, executed, logged, or interpreted
as HTML or instructions. Amounts cannot contain arbitrary text under v2.
Restoration requires the separate [confirmation flow](budget-backup-restore.md).

Automated tests cover file boundaries, exact preview strings, storage presence,
read races, safe errors, and zero mutation. Real-browser observations are in
[issue #47 verification](monthly-budget-verification.md).
