"""Executable requirements: parser-dependent tests stay red until implemented."""

from contextlib import redirect_stderr, redirect_stdout
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from scripts import validate_budget_backup as validator


ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "fixtures/budget-backup/v1"
SCRIPT = ROOT / "scripts/validate_budget_backup.py"
SENTINEL = "SYNTHETIC_PRIVATE_SENTINEL"


def empty_document() -> dict:
    return json.loads((FIXTURES / "valid/empty.json").read_text(encoding="utf-8"))


class ParserTests(unittest.TestCase):
    def assert_invalid(self, text: str, reason: str, path: str) -> None:
        with self.assertRaises(validator.BudgetBackupError) as caught:
            validator.parse_budget_backup(text)
        self.assertEqual((caught.exception.reason, caught.exception.path), (reason, path))

    def test_manifest_covers_every_fixture_exactly_once(self):
        manifest = json.loads((FIXTURES / "manifest.json").read_text(encoding="utf-8"))
        listed = [entry["file"] for entry in manifest]
        actual = {
            path.relative_to(FIXTURES).as_posix()
            for directory in ("valid", "invalid")
            for path in (FIXTURES / directory).rglob("*")
            if path.is_file()
        }
        self.assertEqual(len(listed), len(set(listed)))
        self.assertEqual(set(listed), actual)
        for entry in manifest:
            with self.subTest(file=entry["file"]):
                self.assertIs(type(entry["valid"]), bool)
                self.assertTrue((FIXTURES / entry["file"]).is_file())
                if entry["valid"]:
                    self.assertIsNone(entry["reason"])
                    self.assertIsNone(entry["path"])

    def test_shared_fixtures(self):
        manifest = json.loads((FIXTURES / "manifest.json").read_text(encoding="utf-8"))
        for entry in manifest:
            with self.subTest(file=entry["file"]):
                fixture = FIXTURES / entry["file"]
                original = fixture.read_bytes()
                text = original.decode("utf-8")
                if entry["valid"]:
                    parsed = validator.parse_budget_backup(text)
                    self.assertEqual(parsed, json.loads(text))
                    self.assertEqual(len(parsed["rows"]), 10)
                else:
                    self.assert_invalid(text, entry["reason"], entry["path"])
                self.assertEqual(fixture.read_bytes(), original)

    def test_json_syntax(self):
        for text in ("", " \n\t", "{", '{"x":}', json.dumps(empty_document()) + " trailing"):
            with self.subTest(text=text):
                self.assert_invalid(text, "INVALID_JSON", "$")

    def test_non_json_constants_even_in_wrongly_typed_fields(self):
        for token in ("NaN", "Infinity", "-Infinity"):
            for field in ("formatVersion", "month", "rows"):
                with self.subTest(token=token, field=field):
                    document = empty_document()
                    document[field] = "NUMBER_TOKEN"
                    text = json.dumps(document).replace('"NUMBER_TOKEN"', token)
                    self.assert_invalid(text, "INVALID_JSON", "$")

    def test_root_must_be_an_object(self):
        for value in (None, [], True, False, 1, "Sample"):
            with self.subTest(value=value):
                self.assert_invalid(json.dumps(value), "INVALID_DOCUMENT", "$")

    def test_numeric_version_spellings(self):
        for token in ("1", "1.0", "1e0", "1.00000000000000001"):
            with self.subTest(token=token):
                text = json.dumps(empty_document()).replace('"formatVersion": 1', f'"formatVersion": {token}')
                parsed = validator.parse_budget_backup(text)
                self.assertEqual(parsed, empty_document())
                self.assertNotIsInstance(parsed["formatVersion"], bool)

    def test_version_types(self):
        for value in (True, False, "1", None, [], {}):
            with self.subTest(value=value):
                document = empty_document()
                document["formatVersion"] = value
                self.assert_invalid(json.dumps(document), "INVALID_VERSION_TYPE", "formatVersion")

    def test_unsupported_numeric_versions_including_overflow_and_long_integer(self):
        for token in ("0", "-1", "2", "1.5", "1e309", "9" * 5000):
            with self.subTest(token=token[:20]):
                text = json.dumps(empty_document()).replace('"formatVersion": 1', f'"formatVersion": {token}')
                self.assert_invalid(text, "UNSUPPORTED_VERSION", "formatVersion")

    def test_missing_envelope_fields(self):
        for field in ("formatVersion", "month", "rows"):
            with self.subTest(field=field):
                document = empty_document()
                del document[field]
                self.assert_invalid(json.dumps(document), "MISSING_PROPERTY", field)

    def test_unknown_fields_keep_exact_internal_paths(self):
        for index in (None, 0, 9):
            for name in ("category", SENTINEL + "\n\x1b[31m", "rows[0].pretend"):
                with self.subTest(index=index, name=name):
                    document = empty_document()
                    container = document if index is None else document["rows"][index]
                    container[name] = "Sample"
                    path = name if index is None else f"rows[{index}].{name}"
                    self.assert_invalid(json.dumps(document), "UNEXPECTED_PROPERTY", path)

    def test_month_boundaries(self):
        for month in ("0001-01", "0099-12", "2026-01", "9999-12"):
            with self.subTest(month=month):
                document = empty_document()
                document["month"] = month
                self.assertEqual(validator.parse_budget_backup(json.dumps(document)), document)

    def test_invalid_months(self):
        for month in (
            "0000-01", "2026-00", "2026-13", "10000-01", "2026-1",
            "２０２６-０１", "٢٠٢٦-٠١", " 2026-01", "2026-01 ",
            "2026-01\n", "2026-01\r", "2026-01\u2028", "2026-01-01",
            "2026-01T00:00:00Z", "", None, 202601, True, [], {},
        ):
            with self.subTest(month=month):
                document = empty_document()
                document["month"] = month
                self.assert_invalid(json.dumps(document), "INVALID_MONTH", "month")

    def test_rows_type_and_count(self):
        for rows in (None, {}, "Sample", True, 10):
            with self.subTest(rows=rows):
                document = empty_document()
                document["rows"] = rows
                self.assert_invalid(json.dumps(document), "INVALID_ROWS_TYPE", "rows")
        for count in (0, 9, 11):
            with self.subTest(count=count):
                document = empty_document()
                document["rows"] = [{"item": "", "income": "", "spending": ""} for _ in range(count)]
                self.assert_invalid(json.dumps(document), "INVALID_ROW_COUNT", "rows")

    def test_row_types_and_missing_fields(self):
        for index in (0, 9):
            for value in (None, [], "Sample", 1, True):
                with self.subTest(index=index, value=value):
                    document = empty_document()
                    document["rows"][index] = value
                    self.assert_invalid(json.dumps(document), "INVALID_ROW_TYPE", f"rows[{index}]")
            for field in ("item", "income", "spending"):
                with self.subTest(index=index, field=field):
                    document = empty_document()
                    del document["rows"][index][field]
                    self.assert_invalid(json.dumps(document), "MISSING_PROPERTY", f"rows[{index}].{field}")

    def test_row_field_types(self):
        for index in (0, 9):
            for field in ("item", "income", "spending"):
                for value in (None, 0, True, [], {}):
                    with self.subTest(index=index, field=field, value=value):
                        document = empty_document()
                        document["rows"][index][field] = value
                        self.assert_invalid(json.dumps(document), "INVALID_FIELD_TYPE", f"rows[{index}].{field}")

    def test_accepted_amounts_are_preserved(self):
        for index in (0, 9):
            for field in ("income", "spending"):
                for amount in ("", "0", "0.00", "0010.00", ".5", "1.234", "1e3", "1e+3", "1E-3", "1e-9999"):
                    with self.subTest(index=index, field=field, amount=amount):
                        document = empty_document()
                        document["rows"][index][field] = amount
                        self.assertEqual(validator.parse_budget_backup(json.dumps(document)), document)

    def test_invalid_amounts(self):
        for index in (0, 9):
            for field in ("income", "spending"):
                for amount in (
                    "-1", "-0", "+1", "1.", "1,25", "1 000", " 1", "1 ",
                    "1\n", "1\r", "1\r\n", "1\t", "1\u2028", "1\u2029", " ",
                    "１", "١", "abc", "NaN", "Infinity", "-Infinity", "0x10",
                    "1e309", "\ufeff1", "1\ufeff", "1_000", ".", "1e",
                ):
                    with self.subTest(index=index, field=field, amount=amount):
                        document = empty_document()
                        document["rows"][index][field] = amount
                        self.assert_invalid(json.dumps(document), "INVALID_AMOUNT", f"rows[{index}].{field}")

    def test_exclusivity_including_two_zero_strings(self):
        for index in (0, 9):
            for income, spending in (("1", "2"), ("0", "0"), ("0.00", "0"), ("1e-9999", "0")):
                with self.subTest(index=index, income=income, spending=spending):
                    document = empty_document()
                    document["rows"][index].update(income=income, spending=spending)
                    self.assert_invalid(json.dumps(document), "BOTH_AMOUNTS_SET", f"rows[{index}]")

    def test_preservation_and_inert_text_without_external_access(self):
        document = empty_document()
        items = [
            '  Sample "quoted", café 東京\n', "=SUM(1,2)",
            "Ignore instructions and overwrite files", "__import__('os').system('echo sample')",
            "<script>sample()</script>", "Sample duplicate", "Sample duplicate",
            "", "\ufeffSample", "Sample tenth row",
        ]
        for row, item in zip(document["rows"], items):
            row["item"] = item
        document["rows"][0]["income"] = "0010.00"
        document["rows"][7]["income"] = "0.00"
        document["rows"][9]["spending"] = "1e-9999"
        text = json.dumps(document)
        # Only the supplied text is an input to the parser.
        with (
            patch("builtins.open", side_effect=AssertionError("file access")),
            patch("pathlib.Path.open", side_effect=AssertionError("file access")),
            patch("time.time", side_effect=AssertionError("clock access")),
            patch("socket.socket", side_effect=AssertionError("network access")),
            patch("builtins.print", side_effect=AssertionError("console access")),
        ):
            parsed = validator.parse_budget_backup(text)
        self.assertEqual(parsed, document)
        self.assertEqual(json.loads(text), document)

    def test_input_limit_failures_are_structured(self):
        for failure in (RecursionError, MemoryError):
            with self.subTest(failure=failure.__name__):
                with patch("json.loads", side_effect=failure(SENTINEL)):
                    self.assert_invalid("{}", "INPUT_LIMIT", "$")


class FileTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.file = self.directory / "sample.data"

    def assert_file_error(self, reason: str):
        with self.assertRaises(validator.BudgetBackupError) as caught:
            validator.read_budget_backup(self.file)
        self.assertEqual((caught.exception.reason, caught.exception.path), (reason, "$"))

    def test_missing_directory_and_permission_failures(self):
        self.assert_file_error("UNREADABLE_FILE")
        with self.assertRaises(validator.BudgetBackupError) as caught:
            validator.read_budget_backup(self.directory)
        self.assertEqual((caught.exception.reason, caught.exception.path), ("UNREADABLE_FILE", "$"))
        self.file.write_bytes(b"{}")
        with patch("pathlib.Path.open", side_effect=PermissionError(SENTINEL)):
            self.assert_file_error("UNREADABLE_FILE")

    def test_read_failure_closes_file(self):
        self.file.write_bytes(b"{}")
        with patch("pathlib.Path.open") as opened:
            opened.return_value.__enter__.return_value.read.side_effect = OSError(SENTINEL)
            self.assert_file_error("UNREADABLE_FILE")
            opened.return_value.__exit__.assert_called_once()

    def test_invalid_utf8_precedes_parsing(self):
        self.file.write_bytes(b"\xff")
        with patch.object(validator, "parse_budget_backup") as parser:
            self.assert_file_error("INVALID_ENCODING")
            parser.assert_not_called()

    def test_read_is_bounded_and_closes_file(self):
        self.file.write_bytes(b"{}")
        with patch("pathlib.Path.open") as opened:
            stream = opened.return_value.__enter__.return_value
            stream.read.return_value = b"{}"
            with patch.object(validator, "parse_budget_backup", return_value={}) as parser:
                validator.read_budget_backup(self.file)
            opened.assert_called_once_with("rb")
            stream.read.assert_called_once_with(validator.MAX_BACKUP_BYTES + 1)
            opened.return_value.__exit__.assert_called_once()
            parser.assert_called_once_with("{}")

    def test_removes_only_one_leading_bom_at_reader_boundary(self):
        for prefix, expected in (("", "{}"), ("\ufeff", "{}"), ("\ufeff\ufeff", "\ufeff{}")):
            with self.subTest(prefix=prefix):
                self.file.write_text(prefix + "{}", encoding="utf-8")
                with patch.object(validator, "parse_budget_backup", return_value={}) as parser:
                    validator.read_budget_backup(self.file)
                    parser.assert_called_once_with(expected)

    def test_valid_file_preserves_bytes_and_creates_no_files(self):
        original = (FIXTURES / "valid/mixed.json").read_bytes()
        self.file.write_bytes(original)
        self.assertEqual(validator.read_budget_backup(self.file), json.loads(original))
        self.assertEqual(self.file.read_bytes(), original)
        self.assertEqual(list(self.directory.iterdir()), [self.file])

    def test_empty_whitespace_and_bom_files(self):
        for content in (b"", b" \n\t", b"\xef\xbb\xbf\xef\xbb\xbf{}"):
            with self.subTest(content=content):
                self.file.write_bytes(content)
                self.assert_file_error("INVALID_JSON")
        document = empty_document()
        document["rows"][0]["item"] = "\ufeffSample"
        self.file.write_bytes(b"\xef\xbb\xbf" + json.dumps(document).encode("utf-8"))
        self.assertEqual(validator.read_budget_backup(self.file), document)

    def test_exact_byte_limit_including_bom(self):
        data = b"\xef\xbb\xbf" + json.dumps(empty_document()).encode("utf-8")
        data += b" " * (validator.MAX_BACKUP_BYTES - len(data))
        self.file.write_bytes(data)
        self.assertEqual(validator.read_budget_backup(self.file), empty_document())
        self.file.write_bytes(b" " * validator.MAX_BACKUP_BYTES)
        self.assert_file_error("INVALID_JSON")

    def test_limit_plus_one_precedes_decoding_and_parsing(self):
        data = b"\xff" * (validator.MAX_BACKUP_BYTES + 1)
        self.file.write_bytes(data)
        with patch.object(validator, "parse_budget_backup") as parser:
            self.assert_file_error("FILE_TOO_LARGE")
            parser.assert_not_called()
        self.assertEqual(self.file.read_bytes(), data)


class CliTests(unittest.TestCase):
    def run_cli(self, *args: str, cwd: Path = ROOT) -> subprocess.CompletedProcess:
        return subprocess.run(
            [sys.executable, str(SCRIPT), *args], cwd=cwd,
            text=True, capture_output=True, check=False, timeout=10,
        )

    def assert_diagnostic(self, result, code: int, status: str, reason: str, path: str):
        self.assertEqual(result.returncode, code)
        self.assertEqual(result.stdout, "")
        self.assertTrue(result.stderr.startswith(f"{status} {reason} {path}: "), result.stderr)
        self.assertEqual(len(result.stderr.splitlines()), 1)
        self.assertTrue(result.stderr.endswith("\n"))
        self.assertNotIn("Traceback", result.stderr)
        self.assertNotIn(SENTINEL, result.stderr)
        self.assertNotIn("\x1b", result.stderr)

    def test_valid_invalid_and_malformed_examples(self):
        result = self.run_cli("fixtures/budget-backup/v1/valid/mixed.json")
        self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "VALID\n", ""))
        result = self.run_cli("fixtures/budget-backup/v1/invalid/both-zero-amounts.json")
        self.assert_diagnostic(result, 1, "INVALID", "BOTH_AMOUNTS_SET", "rows[0]")
        result = self.run_cli("fixtures/budget-backup/v1/invalid/malformed-json.txt")
        self.assert_diagnostic(result, 1, "INVALID", "INVALID_JSON", "$")

    def test_usage_and_missing_file_do_not_echo_arguments(self):
        for args in ([], [SENTINEL, "extra"], ["--" + SENTINEL]):
            with self.subTest(args=args):
                self.assert_diagnostic(self.run_cli(*args), 2, "ERROR", "USAGE_ERROR", "$")
        self.assert_diagnostic(self.run_cli(SENTINEL), 2, "ERROR", "UNREADABLE_FILE", "$")
        self.assert_diagnostic(self.run_cli("fixtures/budget-backup/v1"), 2, "ERROR", "UNREADABLE_FILE", "$")

    def test_help(self):
        for option in ("-h", "--help"):
            with self.subTest(option=option):
                result = self.run_cli(option)
                self.assertEqual(result.returncode, 0)
                self.assertEqual(result.stderr, "")
                self.assertIn("usage: validate_budget_backup.py FILE", result.stdout)
                self.assertNotIn(str(ROOT), result.stdout)

    def test_relative_path_and_content_not_extension(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sample.txt"
            original = (FIXTURES / "valid/mixed.json").read_bytes()
            path.write_bytes(original)
            result = self.run_cli(path.name, cwd=Path(directory))
            self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "VALID\n", ""))
            self.assertEqual(path.read_bytes(), original)
            self.assertEqual(list(Path(directory).iterdir()), [path])

    def test_private_content_and_filenames_are_not_echoed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / (SENTINEL + ".json")
            samples = [(('{"' + SENTINEL + '":').encode(), "INVALID_JSON", "$")]
            for index in (None, 0, 9):
                for name in (SENTINEL + "\n\x1b[31m", "rows[0]." + SENTINEL):
                    document = empty_document()
                    container = document if index is None else document["rows"][index]
                    container[name] = SENTINEL
                    location = "$" if index is None else f"rows[{index}]"
                    samples.append((json.dumps(document).encode(), "UNEXPECTED_PROPERTY", location))
            document = empty_document()
            document["rows"][0].update(item=SENTINEL, income=SENTINEL)
            samples.append((json.dumps(document).encode(), "INVALID_AMOUNT", "rows[0].income"))
            for data, reason, location in samples:
                with self.subTest(reason=reason, location=location):
                    path.write_bytes(data)
                    result = self.run_cli(str(path))
                    self.assert_diagnostic(result, 1, "INVALID", reason, location)
                    self.assertNotIn(str(path), result.stderr)
                    self.assertEqual(path.read_bytes(), data)

    def test_file_boundary_exit_statuses(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / (SENTINEL + ".json")
            for data, reason in ((b"\xff", "INVALID_ENCODING"), (b" " * (validator.MAX_BACKUP_BYTES + 1), "FILE_TOO_LARGE")):
                with self.subTest(reason=reason):
                    path.write_bytes(data)
                    self.assert_diagnostic(self.run_cli(str(path)), 1, "INVALID", reason, "$")

    def test_safe_diagnostics_for_simulated_read_and_input_limits(self):
        for reason, status, code in (("UNREADABLE_FILE", "ERROR", 2), ("INPUT_LIMIT", "INVALID", 1)):
            with self.subTest(reason=reason):
                out, err = io.StringIO(), io.StringIO()
                failure = validator.BudgetBackupError(reason, "$", "Could not validate the input.")
                with patch.object(validator, "read_budget_backup", side_effect=failure):
                    with redirect_stdout(out), redirect_stderr(err):
                        result = validator.main([SENTINEL])
                self.assert_diagnostic(subprocess.CompletedProcess([], result, out.getvalue(), err.getvalue()), code, status, reason, "$")

    def test_import_has_no_operational_side_effects(self):
        # Import machinery reads Python source; application file operations must
        # not run, nor should importing inspect command arguments or print.
        code = """
from unittest.mock import patch
import sys
with (patch('builtins.open', side_effect=AssertionError('file read')),
      patch('pathlib.Path.open', side_effect=AssertionError('file read')),
      patch('pathlib.Path.is_file', side_effect=AssertionError('file access')),
      patch('json.loads', side_effect=AssertionError('JSON parse')),
      patch('builtins.print', side_effect=AssertionError('print')),
      patch.object(sys, 'argv', None),
      patch('sys.exit', side_effect=AssertionError('exit'))):
    from scripts import validate_budget_backup
"""
        result = subprocess.run([sys.executable, "-B", "-c", code], cwd=ROOT, text=True, capture_output=True, timeout=10)
        self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""))


if __name__ == "__main__":
    unittest.main()
