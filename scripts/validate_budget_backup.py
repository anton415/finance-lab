"""Read-only CLI scaffold for the maintainer's v1 budget-validator exercise.

The file/CLI boundaries are supplied; parse_budget_backup is intentionally TODO.
See docs/python-budget-validator.md before using this as a validator.
"""

from pathlib import Path
import sys


MAX_BACKUP_BYTES = 1_048_576
HELP = """usage: validate_budget_backup.py FILE

Validate one explicitly supplied local UTF-8 budget backup (at most 1 MiB).
Relative paths resolve against the current working directory.
Use -h or --help to show this help.

Scaffold: the core parser still needs to be implemented.
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


def parse_budget_backup(text: str) -> dict[str, object]:
    """Return the original parsed document, or raise BudgetBackupError.

    Maintainer TODO: implement JSON parsing and the complete v1 contract here.
    Keep this function pure, preserve strings, and use the contract reason/path
    pairs. The tests are executable requirements, not a source of runtime rules.
    """
    raise NotImplementedError("The maintainer must implement the core parser.")


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
    except NotImplementedError:
        # Remove this temporary branch when the maintainer completes the parser.
        print("ERROR NOT_IMPLEMENTED $: The core parser is still a scaffold.", file=sys.stderr)
        return 2

    print("VALID")
    return 0


if __name__ == "__main__":
    sys.exit(main())
