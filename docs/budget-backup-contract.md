# Budget backup contract v1

This is the authoritative JSON backup contract for one selected calendar month's
budget, defined by [issue #33](https://github.com/anton415/finance-lab/issues/33).
The [shared fixtures](../fixtures/budget-backup/v1/) and their
[manifest](../fixtures/budget-backup/v1/manifest.json) provide common inputs and
expected classifications for later TypeScript and Python validators. This
delivery defines the format; it does not implement export, validation, or restore.

The [budget export guide](budget-export.md) describes the selected-month CSV and
JSON exporter and its spreadsheet limitations; this v1 contract is unchanged.
The [backup preview guide](budget-backup-preview.md) describes local-file
validation, reader limits, and read-only destination status.

## Document shape

A backup is a JSON object with exactly three required properties:

| Property | JSON type | Rule |
| --- | --- | --- |
| `formatVersion` | number | Only the numeric value `1` is supported. Writers emit `1`. Numeric spellings with the same value, such as `1.0`, are equivalent. Any other numeric version is unsupported. Strings such as `"1"`, booleans, and `null` are invalid types. |
| `month` | string | Exactly `YYYY-MM`: four ASCII year digits representing 0001–9999, a hyphen, and a month from 01 through 12. |
| `rows` | array | Exactly ten row objects, in their original order, including empty rows. |

`month` identifies the **selected budget month**, not the date of export or
import. It is a local-calendar identity, not a UTC timestamp. Past and future
months in the supported year range are valid. Year `0000`, surrounding whitespace,
day components, times, and timezones are invalid.

Reject missing properties, wrong types, and unknown properties at both document
and row levels. Do not silently ignore extra fields. Totals, balance, currency,
timestamps, browser storage keys, row IDs, and other metadata are not v1 fields.
A root array or `null` is not a backup object.

## Rows and text

Each row is an object with exactly these three required string properties:

```ts
type BudgetRow = {
  item: string
  income: string
  spending: string
}
```

`item` may be empty, duplicated across rows, or populated without an amount. An
amount does not require a nonempty item. Preserve item text exactly, including
leading/trailing spaces, Unicode, quotes, commas, and JSON-escaped line breaks.
Do not trim, normalize, sort, deduplicate, or remove empty rows. Preserve the exact
amount strings too, subject to the rules below.

Missing fields and `null` are not substitutes for empty strings. Numbers are not
substitutes for amount strings. A row cannot be an array or `null`.

## Amounts and exclusivity

Each of `income` and `spending` is either the empty string `""` (no amount entered)
or a string matching this **entire-string** grammar whose conversion to a
JavaScript `Number` is finite and nonnegative:

```regex
(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?
```

The match must consume the entire string, not just a substring. Reject all
whitespace in an amount, including a trailing newline. In JavaScript, a `$` regex
anchor alone can also match before a final line terminator; ensure that the match
consumes the full input. Broad numeric parsing alone is insufficient. A temporary
numeric conversion can check finiteness, but the original string is preserved.

Valid examples: `""`, `"0"`, `"0.00"`, `"100"`, `"0010.00"`, `".5"`, `"1.234"`,
`"1e3"`, `"1E-3"`, and `"1e+3"`.

Invalid examples: `"-1"`, `"-0"`, `"+1"`, `"1."`, `"1,25"`, `"1 000"`, `" 1"`,
`"1 "`, `"1\n"`, `" "`, `"abc"`, `"NaN"`, `"Infinity"`, `"0x10"`, and `"1e309"`.
The last value matches the grammar but converts to an infinite JavaScript Number.

There is **no two-decimal-place limit**, conversion to fixed-point integers, or
normalization of decimal strings. Leading zeros, trailing fractional zeros,
exponents, and extra fractional digits remain representable. Display formatting
and the current input's `step="0.01"` do not impose a two-decimal representation
on application state. The contract preserves input representation; it does not
change application arithmetic or promise exact decimal totals.

At most one monetary field in a row may be nonempty:

```text
income === "" || spending === ""
```

Both empty is valid. `"0"` is populated, not empty: `income: "0"` together with
`spending: "0"` is invalid, just like two positive amounts.

## Complete valid example

The following is [valid/mixed.json](../fixtures/budget-backup/v1/valid/mixed.json).
It contains exactly ten rows and only synthetic data:

```json
{
  "formatVersion": 1,
  "month": "2026-09",
  "rows": [
    {"item": "Sample income", "income": "100.00", "spending": ""},
    {"item": "Sample groceries", "income": "", "spending": "25.50"},
    {"item": "  Sample \"quoted\", café  ", "income": "", "spending": "7.25"},
    {"item": "Sample zero", "income": "0", "spending": ""},
    {"item": "Sample note", "income": "", "spending": ""},
    {"item": "", "income": "", "spending": ""},
    {"item": "", "income": "", "spending": ""},
    {"item": "", "income": "", "spending": ""},
    {"item": "", "income": "", "spending": ""},
    {"item": "Sample last row", "income": "", "spending": "2.00"}
  ]
}
```

Derived income is 100.00, spending is 34.75, and balance is 65.25. These are
explanatory expectations, not additional backup properties.

Successful `JSON.parse` only establishes JSON syntax. For example, a bare array,
an unsupported version, a numeric amount, or a row with both amounts populated
can parse successfully while failing this budget contract.

## Preservation and compatibility

See the [restore guide](budget-backup-restore.md) for explicit confirmation,
whole-month replacement, failure handling, reload behavior, and storage limits.

For a supported, valid document, a later export → validate → restore → reload
round trip must preserve the month, all ten rows, their order, and every `item`,
`income`, and `spending` string. Preserve the distinction between `""`, `"0"`,
`"0.00"`, and differently written equal numeric values. Totals remain derived.

“Lossless” means preserving the parsed document's data, not byte-for-byte JSON
indentation, object-property order, or equivalent string escapes. Producers write
ordinary UTF-8 JSON with unique property names. A custom JSON parser is not
required. Parse → serialize → parse checks on fixtures establish data
preservation only; they do not prove that product backup/restore works.

Keep the backup envelope separate from browser persistence. The current
[storage module](../src/budgetStorage.ts) stores bare row arrays under existing
month-specific keys; selected month `2026-09` uses `finance-lab:budget:2026-09`.
Those arrays lack a version and month and are not valid backup documents by
themselves. This contract does not change storage format, fallback behavior, or
migrate stored data.

The backup contract is stricter than the current loader's ten-row and string-type
checks. A stored array can pass those checks while containing invalid amounts,
both monetary fields, or extra properties. Such data must not be described as a
valid v1 backup. Unsupported source values must not be silently repaired,
rounded, padded, dropped, or replaced to manufacture one. Product handling of
that failure belongs to #34/#35.

Consumers must reject unsupported versions rather than guess their meaning.
Changes to fields, row count, or monetary semantics require an explicit
version/compatibility decision. There is no automatic migration or promise of
forward compatibility.

**CSV is inspection output; JSON is the authoritative restoration format.** CSV
escaping and spreadsheet-safety transformations belong to #34. JSON must preserve
original strings and must not inherit a lossy CSV transformation. CSV import is
out of scope.

## Shared fixture classifications

All fixture contents are synthetic. The
[manifest](../fixtures/budget-backup/v1/manifest.json) is a JSON array indexing
every fixture exactly once. Each entry has `file`, `valid`, `reason`, and `path`:

- `file` is a path relative to the manifest, such as `valid/mixed.json`.
- `valid` is a boolean. Valid entries have `reason: null` and `path: null`.
- Invalid entries use the named reason and field location below. `$` means a
  root/parse error; array indices are zero-based. Missing properties point to
  their intended location; exclusivity points to the row.

Expectations belong in the manifest, never as extra properties in backups.

| Valid fixture | Content |
| --- | --- |
| [empty.json](../fixtures/budget-backup/v1/valid/empty.json) | `2026-10`, ten rows with all three fields empty. |
| [mixed.json](../fixtures/budget-backup/v1/valid/mixed.json) | The complete example above, including a populated tenth row. |
| [representation.json](../fixtures/budget-backup/v1/valid/representation.json) | `2027-01`, ten rows covering leading/trailing zeros, `.5`, extra fractional digits, exponent notation, an empty item with an amount, Unicode, and an escaped line break. |

Each file in [invalid/](../fixtures/budget-backup/v1/invalid/) isolates one defect.
Except for document shape, array type, or row count cases, each retains a complete
ten-row envelope. The monetary defects affect first-row income with empty
spending, except for the two exclusivity cases.

| Invalid fixture | Intentional defect | Reason | Path |
| --- | --- | --- | --- |
| `malformed-json.txt` | Truncated JSON; the only unparsable fixture. | `INVALID_JSON` | `$` |
| `root-array.json` | Bare ten-row storage array. | `INVALID_DOCUMENT` | `$` |
| `missing-month.json` | Omitted month. | `MISSING_PROPERTY` | `month` |
| `extra-root-property.json` | Extra `totalIncome`. | `UNEXPECTED_PROPERTY` | `totalIncome` |
| `unsupported-version.json` | Numeric version `2`. | `UNSUPPORTED_VERSION` | `formatVersion` |
| `version-string.json` | String version `"1"`. | `INVALID_VERSION_TYPE` | `formatVersion` |
| `month-format.json` | `"2026-9"`. | `INVALID_MONTH` | `month` |
| `month-range.json` | `"2026-13"`. | `INVALID_MONTH` | `month` |
| `rows-not-array.json` | Rows is an object. | `INVALID_ROWS_TYPE` | `rows` |
| `nine-rows.json` | Nine otherwise valid rows. | `INVALID_ROW_COUNT` | `rows` |
| `eleven-rows.json` | Eleven otherwise valid rows. | `INVALID_ROW_COUNT` | `rows` |
| `row-not-object.json` | First row is `null`. | `INVALID_ROW_TYPE` | `rows[0]` |
| `missing-row-property.json` | First row lacks `spending`. | `MISSING_PROPERTY` | `rows[0].spending` |
| `item-not-string.json` | Numeric item. | `INVALID_FIELD_TYPE` | `rows[0].item` |
| `amount-not-string.json` | Numeric income `1`. | `INVALID_FIELD_TYPE` | `rows[0].income` |
| `extra-row-property.json` | Extra `category`. | `UNEXPECTED_PROPERTY` | `rows[0].category` |
| `negative-amount.json` | `"-1"`. | `INVALID_AMOUNT` | `rows[0].income` |
| `comma-amount.json` | `"1,25"`. | `INVALID_AMOUNT` | `rows[0].income` |
| `whitespace-amount.json` | `" 1"`. | `INVALID_AMOUNT` | `rows[0].income` |
| `nonnumeric-amount.json` | `"abc"`. | `INVALID_AMOUNT` | `rows[0].income` |
| `nonfinite-amount.json` | `"Infinity"`. | `INVALID_AMOUNT` | `rows[0].income` |
| `overflow-amount.json` | `"1e309"`, correct grammar but infinite Number. | `INVALID_AMOUNT` | `rows[0].income` |
| `both-amounts.json` | Income `"1"`, spending `"2"`. | `BOTH_AMOUNTS_SET` | `rows[0]` |
| `both-zero-amounts.json` | Income `"0"`, spending `"0"`. | `BOTH_AMOUNTS_SET` | `rows[0]` |

These expectations do not prescribe UI wording, a public error API, or error
ordering for documents with multiple defects. Later validators must agree on
validity and the intended failure for these single-defect fixtures. Do not use
type coercion, broad numeric parsing alone, or modify fixtures to make a
validator pass. A machine-readable JSON Schema, validation dependency, and
fixture-running framework are not part of this delivery.

## Verification and downstream work

When delivering these files, run the existing checks from the repository root:

```sh
npm test
npm run lint
npm run build
```

Also check manifest coverage, JSON parseability, row counts, intended rejection
reasons/locations, and exact parsed-value preservation for each valid fixture
after parse → serialize → parse. A one-off local check and documented review
are sufficient. Record actual commands, results, and limitations in the PR;
pending or uninspected CI is not a passing check. A browser smoke check is not
required for this documentation/fixture-only change.

Downstream issues consume this contract:

- [#34](https://github.com/anton415/finance-lab/issues/34): selected-month CSV and JSON export.
- [#35](https://github.com/anton415/finance-lab/issues/35): read-only validation and preview, input limits, and user-facing errors.
- [#36](https://github.com/anton415/finance-lab/issues/36): confirmed restoration and end-to-end preservation tests.
- [#37](https://github.com/anton415/finance-lab/issues/37): Python validation using the same fixtures and classifications.

## Learning and maintainer check

- [JSON Schema: Creating your first schema](https://json-schema.org/learn/getting-started-step-by-step): required properties, types, arrays, and constraints. Adding a validation dependency is not required for this learning task.
- [JSON Schema: Object properties](https://json-schema.org/understanding-json-schema/reference/object): naming properties alone does not forbid unknown ones.
- [WHATWG HTML: Floating-point numbers](https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#valid-floating-point-number): decimal and exponent syntax supported by number inputs. The nonnegative/finite rules above remain the project contract.

The maintainer should independently classify one valid and one invalid fixture
and explain the reasons in their own words, including why two `"0"` amounts in a
row are invalid. Explain why JSON parsing, current storage acceptance, contract
validity, and successful agent implementation are different claims. **This human
learning check is pending; agent-authored files and verification do not complete
it on the maintainer's behalf.**

Any publication requires human approval and is not required to close the
engineering issue. Fixture creation alone does not establish measured agent
performance.
