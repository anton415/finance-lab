# Export a monthly budget

Open **Export and backup** after the Summary. **Export JSON** and **Export CSV**
use the selected month and its current valid source values. They create local
downloads named `finance-lab-budget-YYYY-MM.json` or `.csv`. Export does not
change storage, the displayed budget, or the selected month, and works with
valid in-memory data even when storage is unavailable.

## JSON v2

JSON is the authoritative lossless backup. It contains exactly the
[v2 contract](budget-backup-contract.md): `formatVersion: 2`, `month`, `income`,
`spending`, and `investments`. All fifteen spending IDs are included, including
empty values. Exact amount strings are preserved; totals and labels are omitted.
The output uses UTF-8, two-space indentation, a final LF, and no BOM.

Current preview and restore accept v2 only. There is no v1 conversion or CSV
import. [Preview](budget-backup-preview.md) before
[confirming restoration](budget-backup-restore.md).

## Inspection-only CSV

| Property | Value |
| --- | --- |
| Columns | `Type`, `Category`, `Amount` |
| Records | One header, one Income record, fifteen Spending records, one Investment record |
| Category | English display label, in catalog order |
| Empty values | Retained for every category |
| Encoding | UTF-8 with one initial BOM |
| Escaping | Every cell double-quoted; embedded quotes doubled |
| Record endings | CRLF, including the final record |

For example:

```csv
"Type","Category","Amount"
"Income","Income","100.00"
"Spending","Groceries","25.50"
```

Types and labels are fixed trusted text. Every user-controlled amount passes the
complete nonnegative numeric-string rule before CSV serialization. Formula,
delimiter, and newline payloads are rejected. The obsolete free-form item field
and its apostrophe prefix are removed; no user-controlled text labels remain.
Spreadsheet applications may interpret amounts, round values, strip leading
zeros, or apply locale-specific display. Use JSON when preserving source strings
matters. Quoting alone is not a formula defense.

Both exports validate the complete source before formatting. Invalid drafts
show an accessible error and produce no download. A failed download setup shows
a retryable message without raw exception details. JSON export has no file-size
cap; the preview reader accepts at most 1 MiB.

## Verification

The [synthetic export pair](../fixtures/budget-export/) is independently derived
from the v2 representation fixture. Automated tests compare exact output bytes,
check all 17 records and invalid input, and test export without storage writes.
Browser downloads and the full restore journey are recorded in
[issue #47 verification](monthly-budget-verification.md).
