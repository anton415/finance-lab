# Budget backup contract v2

The current product exports, previews, and restores **v2 only**. Issue #47 replaces
v1's experimental ten-row model. There is no conversion or migration. The
[v1 fixtures](../fixtures/budget-backup/v1/) remain historical material; the
[v2 fixtures and manifest](../fixtures/budget-backup/v2/manifest.json) are shared
by the TypeScript and Python validators.

## Exact document shape

The root is an object with exactly these required properties:

| Property | Rule |
| --- | --- |
| `formatVersion` | Numeric value `2`; equivalent JSON spellings such as `2.0` and `2e0` are accepted. Strings and booleans are invalid. |
| `month` | ASCII `YYYY-MM`, year 0001–9999, month 01–12, with no surrounding characters. |
| `income` | Amount string for one generic planned monthly income. |
| `spending` | Object with exactly the fifteen IDs below, each holding an amount string. |
| `investments` | Separate investment allocation amount string. |

Spending IDs and display order are:

| ID | English label |
| --- | --- |
| `groceries` | Groceries |
| `restaurants` | Restaurants |
| `utilities` | Utilities |
| `transport` | Transport |
| `household` | Household |
| `health` | Health |
| `personal-care` | Personal care |
| `clothing` | Clothing |
| `subscriptions` | Subscriptions |
| `education` | Education |
| `tech` | Tech |
| `culture` | Culture |
| `entertainment` | Entertainment |
| `gifts` | Gifts |
| `travel` | Travel |

Missing or unknown properties at either level are invalid. Arrays and `null`
cannot substitute for objects. Labels are presentation metadata, never stored
identity. Input property order does not affect validity; export uses catalog
order. No totals, labels, timestamps, currencies, or storage keys belong in JSON.

See the complete [synthetic example](../fixtures/budget-backup/v2/valid/mixed.json).

## Amount strings

An empty string means no planned amount. Every other amount must match the
**complete** ASCII pattern below and convert to a finite nonnegative binary64
number:

```text
(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?
```

Accepted examples: `0`, `0.00`, `0010.00`, `.5`, `1.234`, `1e3`, `1e+3`, `1E-3`,
and `1e-9999` (underflows to zero for arithmetic). Preserve the original strings.
No trimming, rounding, numeric-to-string conversion, or normalization is allowed.

Rejected examples: `-1`, `-0`, `+1`, `1.`, `1,25`, `1 000`, whitespace, trailing
newlines, non-ASCII digits, `NaN`, `Infinity`, `1e309`, and numeric JSON values.
Income, spending amounts, and investments may all be populated simultaneously.

JSON producers must use unique object keys. Duplicate-key detection is not part
of this contract; both parsers retain normal last-key behavior. Python uses
binary64 numeric parsing and rejects bare `NaN`/`Infinity` tokens to match JSON
and TypeScript behavior. Parsed values, not JSON whitespace or escape spelling,
are the round-trip guarantee.

## Source model and derived totals

Browser storage contains only `{ income, spending, investments }`, with the same
strict amount and category rules, under the existing month-specific key.
Incompatible local data starts an empty current budget; no other keys are scanned
or migrated. The app persists the fresh budget for the selected month normally.

```text
Income      = planned monthly income
Spending    = sum of the fifteen spending amounts
Investments = separate investment allocation
Remaining   = Income - Spending - Investments
```

Totals are derived and never persisted. Empty amounts count as zero. Display uses
the existing number arithmetic and rounding to at most two fraction digits.

## Validation and diagnostics

The parser has no storage, DOM, network, or clock access. TypeScript exposes
`BudgetBackupError.reason` and `.path`; Python exposes matching fields. Reasons
are `INVALID_JSON`, `INVALID_DOCUMENT`, `MISSING_PROPERTY`,
`UNEXPECTED_PROPERTY`, `INVALID_VERSION_TYPE`, `UNSUPPORTED_VERSION`,
`INVALID_MONTH`, `INVALID_SPENDING_TYPE`, `INVALID_FIELD_TYPE`, and
`INVALID_AMOUNT`. Validation checks root fields, version, month, income,
spending structure and amounts, then investments. Historical v1 envelopes can
fail the root-shape check before the version check; neither path accepts v1.

Messages use known schema names and fixed text. Unknown property names occur
only in inspectable error paths, never UI messages or CLI diagnostics. File
reader errors and byte limits are documented in the
[preview guide](budget-backup-preview.md) and
[Python guide](python-budget-validator.md).
