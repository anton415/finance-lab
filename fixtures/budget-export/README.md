# Synthetic v2 export pair

These JSON/CSV files are independently derived with Python's standard `json`
and `csv` libraries from
[`../budget-backup/v2/valid/representation.json`](../budget-backup/v2/valid/representation.json).
They contain synthetic data only.

JSON preserves every source amount string. CSV uses quoted `Type,Category,Amount`
columns, English labels, one Income record, fifteen Spending records, and one
Investment record. It has one UTF-8 BOM and CRLF record terminators. Tests compare
both files exactly against the application serializer.

The samples establish serializer expectations. Actual browser observations are
recorded in [issue #47 verification](../../docs/monthly-budget-verification.md).
