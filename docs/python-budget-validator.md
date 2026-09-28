# Python budget validator

`scripts/validate_budget_backup.py` is a read-only, standard-library validator
for the current [v2 backup contract](budget-backup-contract.md). Use **CPython
3.12 or newer**. No dependency installation is required.

From the repository root, with a supported interpreter named `python`:

```bash
python --version
python -m unittest discover -s tests/python -p 'test_budget_backup.py' -v
python scripts/validate_budget_backup.py fixtures/budget-backup/v2/valid/mixed.json
python scripts/validate_budget_backup.py fixtures/budget-backup/v2/invalid/negative-amount.json
python scripts/validate_budget_backup.py --help
```

The valid example prints `VALID` and exits 0. The invalid example prints
`INVALID INVALID_AMOUNT spending.travel: ...` to stderr and exits 1. Usage or
unreadable-file errors exit 2. The CLI takes exactly one explicit local path;
relative paths resolve from the working directory. Filenames and extensions do
not establish validity. Nothing is written, uploaded, migrated, or restored.

## Parser and reader

`parse_budget_backup(text)` validates only its argument and returns the parsed
values unchanged. It shares the v2 fixture manifest's validity/reason/path
expectations with TypeScript. Numeric JSON parsing uses binary64 semantics;
booleans cannot stand in for numeric version 2. Bare `NaN` and `Infinity` tokens
are invalid JSON. Amounts use ASCII full-string matching and finite conversion.
Income, all fifteen spending amounts, and investments are independent fields.

`read_budget_backup(path)` reads one regular file, at most 1 MiB plus one byte
to detect overflow. It rejects oversized data before decoding, decodes UTF-8
strictly, removes at most one leading BOM, and calls the pure parser. File handles
close even on failure. Parser memory/recursion failures become `INPUT_LIMIT`.

Errors carry `reason` and `path`. Unknown-property paths may contain untrusted
names internally; the CLI prints their separately recorded container (`$` or
`spending`) instead. All displayed messages are fixed text and never expose file
paths, input values, exception details, or terminal control characters.

## Verification

The suite checks every [v2 manifest entry](../fixtures/budget-backup/v2/manifest.json),
manifest completeness, every amount field, month/version boundaries, preserved
strings, reader limits, CLI exit codes, safe diagnostics, and import/parser side
effects. Historical v1 fixtures are no longer accepted by current code.

Actual results and the interpreter used are recorded in
[issue #47 verification](monthly-budget-verification.md). The budget validator
suite remains a local command; the CI workflow has not been expanded by #47.
