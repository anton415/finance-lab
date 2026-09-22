# Synthetic budget export samples

Both files use the same unchanged source:
[`../budget-backup/v1/valid/representation.json`](../budget-backup/v1/valid/representation.json),
a valid #33 fixture for selected month `2027-01`.

- [`finance-lab-budget-2027-01.json`](finance-lab-budget-2027-01.json) preserves the
  source document's parsed data, with two-space indentation, a final LF, and no
  BOM.
- [`finance-lab-budget-2027-01.csv`](finance-lab-budget-2027-01.csv) contains one
  UTF-8 BOM, fully quoted comma-delimited fields, and CRLF record endings,
  including the final terminator. Every nonempty item has one added ASCII
  apostrophe. Empty items and all original amount strings are unchanged. The
  source's embedded LF stays inside its quoted field, so there are ten data
  records despite an additional physical line.

The pair was prepared independently with Python's standard `json` and `csv`
modules, not by the application serializer. It is an expected-output example,
not evidence of a browser download, spreadsheet compatibility, or restoration.
No #33 fixture or manifest classification is changed.

See the [export guide](../../docs/budget-export.md) for spreadsheet limitations,
import settings, and the distinction between CSV inspection and lossless JSON.
