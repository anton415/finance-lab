# Budget export

Use **Export CSV** or **Export JSON** beside the month controls to download the
selected month's current budget. The buttons work with a keyboard and include
the latest edit without an additional save or reload. Both formats include all
ten rows, in order, including empty rows. Filenames use the selected local
calendar month: `finance-lab-budget-YYYY-MM.csv` or
`finance-lab-budget-YYYY-MM.json`.

Export creates a local browser download request; it does not upload data or
confirm that a file was saved to disk. It does not change the selected month,
rows, totals, or stored budgets. Valid in-memory data can be exported even when
browser storage is unavailable.

## JSON backup

JSON is the authoritative lossless format, following the
[budget backup contract v1](budget-backup-contract.md). The document contains
only `formatVersion: 1`, the selected `month`, and the ten `rows`, each with
`item`, `income`, and `spending` strings. It preserves spaces, Unicode, quotes,
line breaks, empty strings, and amount spellings such as `0010.00`, `.5`,
`1.234`, and `1e+3`. Totals remain derived and are not exported.

The file is UTF-8 without a BOM, with MIME type `application/json`, two-space
indentation, and a final LF. Lossless means preserving the parsed data, not the
original JSON whitespace or escape spelling. CSV's item prefix is never added
to JSON.

**Restoration is not implemented by this export feature.** Uploaded-file
validation and preview belong to
[#35](https://github.com/anton415/finance-lab/issues/35); confirmed restoration
and reload verification belong to
[#36](https://github.com/anton415/finance-lab/issues/36). Export tests establish
data preservation, not a completed restore/reload flow.

## CSV inspection

CSV is for inspection. Its exact format is:

| Part | Format |
| --- | --- |
| Encoding | UTF-8 with exactly one leading BOM, which is not part of the first header. |
| MIME type | `text/csv;charset=utf-8` |
| Columns | `item`, `income`, `spending`, in that order. |
| Records | One header and ten data records, with CRLF between records and after the final record. |
| Fields | Comma-delimited; every field, including headers and empty cells, is double-quoted. Embedded double quotes are doubled. |
| Embedded newlines | Original CR/LF characters stay inside the quoted field; they do not create extra logical records. |
| Amounts | Original validated strings, with no numeric conversion, localization, rounding, or prefix. |

There is no `sep=` preamble, month column, total, or metadata record. The quoting
and record conventions follow
[RFC 4180, section 2](https://www.rfc-editor.org/rfc/rfc4180.html#section-2).

Every nonempty `item` receives **one ASCII apostrophe (`'`) before CSV escaping**.
Empty items, headers, and amounts receive no prefix. The remaining item text is
unchanged, including existing apostrophes and leading whitespace. For example:

| Original item | Serialized CSV field |
| --- | --- |
| `Sample income` | `"'Sample income"` |
| `=1+1` | `"'=1+1"` |
| `'Sample note` | `"''Sample note"` |
| Empty string | `""` |

Each export starts from the original data. Repeated CSV exports do not
accumulate prefixes or modify a subsequent JSON backup.

### Spreadsheet limitations

This prefix is a deliberate inspection-output policy, **not a universal
spreadsheet-safety guarantee**. CSV quoting protects the file's structure; it
does not by itself prevent a spreadsheet from evaluating a formula. A generic
CSV reader sees the added apostrophe, and a spreadsheet may also display it.
See [OWASP — CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection).

For first open/import, choose **UTF-8**, a **comma delimiter**, and import the
`item` column as **text** where supported. Do not assume that double-clicking a
file chooses these settings. Spreadsheet applications and import settings can
behave differently. They may convert amount strings to numbers, losing leading
or trailing zeros or changing exponent notation even though the CSV bytes
preserve them. Importing amount columns as text may help inspection; keep JSON
for exact data preservation.

Saving and reopening a spreadsheet can remove protective characters or change
interpretation. There is **no save/reopen guarantee**. A successful first import
does not establish later safety, and automated serialization tests do not
establish spreadsheet compatibility. Any compatibility report must name the
application, version, and import settings actually checked.

## Export errors

Both actions check the original source against v1 before formatting it. This
includes the selected month, ten-row count, exact row properties, string field
types, amount syntax and finiteness, and at most one populated monetary field
per row. Two `"0"` amounts are invalid because both fields are populated.

Invalid source blocks the download and shows an accessible error identifying
the affected row/field or document rule. No unsupported data is trimmed,
coerced, rounded, dropped, or repaired. Correct the indicated data and retry;
editing the budget or changing month clears a stale export error. Synchronous
serialization or download-setup failures also show a retryable error. A failure
does not change budget data or storage.

## Samples and verification

The [synthetic output pair](../fixtures/budget-export/README.md) comes from the
unchanged #33 representation fixture and demonstrates the CSV transformation
alongside lossless JSON. The #33 manifest continues to classify only the backup
fixtures; export samples are not added to it.

Repository verification uses `npm test`, `npm run lint`, and `npm run build`.
Tests compare exported data against independent synthetic expectations and
check browser download setup separately. A real-browser smoke check must also
inspect downloaded filenames and content, repeated downloads, and unchanged UI
and stored budgets. Record the browser/version and observed result in the PR.
Record any supplementary spreadsheet check separately with its application,
version, and import settings; explicitly mark spreadsheet behavior unverified
when no such check was performed.

The maintainer's learning check remains a human task: inspect a generated sample
and its test, explain why quoting `=1+1` does not ensure inert text, why only CSV
adds the prefix, and which evidence proves data preservation versus spreadsheet
behavior. Agent tests or implementation claims do not complete that check or
measure an agent success rate.

Browser resource background:
[MDN createObjectURL](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static)
and [MDN revokeObjectURL](https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static).
