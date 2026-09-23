"""Read-only, standard-library validator for the v1 budget-backup contract."""

import json
import math
from pathlib import Path
import re
import sys


MAX_BACKUP_BYTES = 1_048_576
DOCUMENT_FIELDS = ("formatVersion", "month", "rows")
ROW_FIELDS = ("item", "income", "spending")
AMOUNT_PATTERN = re.compile(r"(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?")
HELP = """usage: validate_budget_backup.py FILE

Validate one explicitly supplied local UTF-8 budget backup (at most 1 MiB).
Relative paths resolve against the current working directory.
Use -h or --help to show this help.
"""


class BudgetBackupError(Exception):
    """A contract/file failure with a fixed message and an inspectable path.

    For UNEXPECTED_PROPERTY, path includes the untrusted property name; supply
    container_path as '$' or 'rows[n]' so the CLI can omit that name entirely.
    Other paths must contain only known contract fields and numeric indices.
    """

    def __init__(
        self,
        reason: str,
        path: str,
        message: str,
        *,
        container_path: str = "$",
    ) -> None:
        super().__init__(message)
        self.reason = reason
        self.path = path
        self.container_path = container_path


def _reject_constant(_value: str) -> None:
    raise BudgetBackupError(
        "INVALID_JSON", "$", "The input must contain valid JSON."
    )


def _validate_fields(
    value: dict[str, object], fields: tuple[str, ...], container_path: str
) -> None:
    prefix = "" if container_path == "$" else f"{container_path}."
    for field in fields:
        if field not in value:
            raise BudgetBackupError(
                "MISSING_PROPERTY", f"{prefix}{field}", "A required property is missing."
            )
    for field in value:
        if field not in fields:
            raise BudgetBackupError(
                "UNEXPECTED_PROPERTY",
                f"{prefix}{field}",
                "The object contains an unexpected property.",
                container_path=container_path,
            )


def parse_budget_backup(text: str) -> dict[str, object]:
    """Validate only the supplied text, returning its parsed values unchanged."""
    try:
        document = json.loads(
            text,
            parse_int=float,
            parse_float=float,
            parse_constant=_reject_constant,
        )
    except json.JSONDecodeError:
        raise BudgetBackupError(
            "INVALID_JSON",
            "$",
            "The input must contain valid JSON.",
        ) from None
    except (RecursionError, MemoryError):
        raise BudgetBackupError(
            "INPUT_LIMIT", "$", "A parser resource limit prevented validation."
        ) from None

    if not isinstance(document, dict):
        raise BudgetBackupError(
            "INVALID_DOCUMENT", "$", "The backup must be a JSON object."
        )
    _validate_fields(document, DOCUMENT_FIELDS, "$")

    version = document["formatVersion"]
    if isinstance(version, bool) or not isinstance(version, (int, float)):
        raise BudgetBackupError(
            "INVALID_VERSION_TYPE", "formatVersion", "The version must be numeric."
        )
    if version != 1:
        raise BudgetBackupError(
            "UNSUPPORTED_VERSION", "formatVersion", "Only version 1 is supported."
        )

    month = document["month"]
    if not isinstance(month, str) or re.fullmatch(
        r"(?!0000)[0-9]{4}-(?:0[1-9]|1[0-2])", month
    ) is None:
        raise BudgetBackupError(
            "INVALID_MONTH", "month", "Use YYYY-MM with a year from 0001 to 9999."
        )

    rows = document["rows"]
    if not isinstance(rows, list):
        raise BudgetBackupError("INVALID_ROWS_TYPE", "rows", "Rows must be an array.")
    if len(rows) != 10:
        raise BudgetBackupError(
            "INVALID_ROW_COUNT", "rows", "The budget must contain exactly ten rows."
        )

    for index, row in enumerate(rows):
        path = f"rows[{index}]"
        if not isinstance(row, dict):
            raise BudgetBackupError("INVALID_ROW_TYPE", path, "Each row must be an object.")
        _validate_fields(row, ROW_FIELDS, path)
        for field in ROW_FIELDS:
            value = row[field]
            if not isinstance(value, str):
                raise BudgetBackupError(
                    "INVALID_FIELD_TYPE", f"{path}.{field}", "Each row field must be a string."
                )
            if field != "item" and value != "" and (
                AMOUNT_PATTERN.fullmatch(value) is None or not math.isfinite(float(value))
            ):
                raise BudgetBackupError(
                    "INVALID_AMOUNT",
                    f"{path}.{field}",
                    "An amount must be empty or a finite nonnegative number string.",
                )
        if row["income"] != "" and row["spending"] != "":
            raise BudgetBackupError(
                "BOTH_AMOUNTS_SET", path, "A row cannot contain both income and spending."
            )

    return document


def read_budget_backup(path: str | Path) -> dict[str, object]:
    """Read only the requested regular file, then delegate to the pure parser."""
    try:
        source = Path(path)
        if not source.is_file():
            raise BudgetBackupError(
                "UNREADABLE_FILE", "$", "Could not read the input file."
            )
        with source.open("rb") as stream:
            data = stream.read(MAX_BACKUP_BYTES + 1)
    except OSError:
        raise BudgetBackupError(
            "UNREADABLE_FILE", "$", "Could not read the input file."
        ) from None

    if len(data) > MAX_BACKUP_BYTES:
        raise BudgetBackupError(
            "FILE_TOO_LARGE", "$", "The input exceeds the 1 MiB limit."
        )
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        raise BudgetBackupError(
            "INVALID_ENCODING", "$", "The input must be UTF-8."
        ) from None

    return parse_budget_backup(text.removeprefix("\ufeff"))


def main(argv: list[str] | None = None) -> int:
    """Return a CLI exit status; never print input paths or argument values."""
    args = sys.argv[1:] if argv is None else argv
    if args in (["-h"], ["--help"]):
        print(HELP, end="")
        return 0
    if len(args) != 1 or args[0].startswith("-"):
        print("ERROR USAGE_ERROR $: Supply exactly one local file path.", file=sys.stderr)
        return 2

    try:
        read_budget_backup(args[0])
    except BudgetBackupError as error:
        status = "ERROR" if error.reason == "UNREADABLE_FILE" else "INVALID"
        path = error.container_path if error.reason == "UNEXPECTED_PROPERTY" else error.path
        print(f"{status} {error.reason} {path}: {error}", file=sys.stderr)
        return 2 if status == "ERROR" else 1
    print("VALID")
    return 0


if __name__ == "__main__":
    sys.exit(main())
