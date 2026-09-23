# Python budget validator

The [module](../scripts/validate_budget_backup.py) validates one explicitly
supplied local budget-backup file against the v1 contract. It contains the pure
`parse_budget_backup(text)` function, a bounded file reader, a CLI, and the
`__main__` guard. Importing it does not read files, inspect arguments, or print.
The [tests](../tests/python/test_budget_backup.py) verify the shared contract and
Python-specific behavior without third-party dependencies.

The technical implementation for [issue #37](https://github.com/anton415/finance-lab/issues/37)
is delivered by [PR #78](https://github.com/anton415/finance-lab/pull/78).
**Scope decision, 2026-09-23:** the maintainer will complete the personal Python
learning separately, outside both PR #78 and issue #37. It is not a merge or
issue-closure requirement. The learning remains pending; passing tests, merging
code, and closing the technical issue do not establish a completed learning outcome.

## Setup

Target CPython **3.12 or newer**, with the standard library only. From the
repository root on macOS/Linux:

```bash
python3 --version
python3 -m venv .venv
source .venv/bin/activate
python --version
```

Check the first version before creating the environment. If `python3` is older
than 3.12, select a supported interpreter on your PATH first (or invoke its
versioned executable for `-m venv`). No `pip install` or requirements file is
needed. Activation is optional: `.venv/bin/python` invokes the environment
directly. `.venv/` and Python bytecode are ignored by Git.

The recorded implementation verification used **CPython 3.14.5 on macOS**, in a
virtual environment with no third-party packages installed. Other Python
versions and operating systems have not been verified; the Linux setup above is
provided but was not exercised. Windows setup is not covered here.

## Validation flow

The [authoritative v1 contract](budget-backup-contract.md) and its
[manifest](../fixtures/budget-backup/v1/manifest.json) define the validation rules
and fixture expectations. The contract is unchanged from the issue's reviewed
commit, `9eba924`.
`parse_budget_backup` follows these steps:

1. Parse the supplied text using `json.loads`. Reject bare `NaN`, `Infinity`, and
   `-Infinity` with a rejecting `parse_constant` callback. Use ordinary binary64
   numeric decoding (`parse_int=float`, `parse_float=float`); amount strings stay
   strings. Map malformed JSON to `INVALID_JSON` at `$`, and input-induced
   `RecursionError`/`MemoryError` during decoding to `INPUT_LIMIT` at `$`. Keep
   exception handling close to decoding; do not hide unrelated programming bugs.
2. Validate the envelope: a dictionary with exactly `formatVersion`, `month`, and
   `rows`. Use the contract's missing/unknown-property reasons and paths.
   Require numeric version 1, explicitly excluding booleans. A syntactically
   valid numeric overflow such as `1e309` is `UNSUPPORTED_VERSION`, whereas a
   bare `Infinity` token is `INVALID_JSON`.
3. Validate the entire ASCII month string, years 0001–9999 and months 01–12.
   Require exactly ten rows, each a dictionary with exactly the three required
   string fields. Do not consult the clock or use defaults for missing fields.
4. For each monetary field, accept the empty string or a full match of the
   contract's amount grammar followed by a finite binary64 conversion. Use
   `re.fullmatch` with `[0-9]`; broad `float()` parsing alone accepts too much.
   Check exclusivity by string emptiness, so two zero strings are rejected.
   Return the parsed document without trimming, rounding, repairing, sorting,
   calculating totals, or replacing its values.

The parser must not read files, consult fixture expectations at runtime, call
Node/TypeScript, access storage/network/clock, print, or execute input text.
Preserve item strings, duplicates, all ten rows and exact amount representations,
including `""`, `"0"`, `"0.00"`, `"0010.00"`, and `"1e-9999"`. Underflow to finite
zero is accepted without replacing the original string. There is no two-decimal
rule or exact-decimal arithmetic guarantee.

## Errors and privacy

Raise `BudgetBackupError(reason, path, message)` using the contract's exact
reason/path pairs and fixed, safe message text. Do not include amounts, item
text, filenames, parser exceptions, OS exceptions, or arbitrary input in messages.
Message wording can differ from the TypeScript UI.

For `UNEXPECTED_PROPERTY`, keep the unknown name in the internal `path` for
fixture agreement, but pass **`container_path="$"`** for an envelope property or
**`container_path=f"rows[{index}]"`** for a row property. The CLI prints that
containing location instead of the untrusted name. Do not derive the container
by splitting an unknown name: a root key can itself contain dots or `rows[0]`.
All other paths are constructed only from known fields and numeric row indices.

The supplied file reader reads only the explicitly requested regular file,
closes it, and never writes to it. It reads at most **1,048,577 bytes**, rejects
anything over **1,048,576 bytes including a BOM**, decodes strict UTF-8, and
removes at most one leading BOM before parsing. No field text is stripped.
Exactly the byte limit still needs JSON and contract validation.

The CLI does not scan directories, read stdin, fetch URLs, expand globs, create
reports, or write telemetry/logs. A leading-dash filename can be given with a
relative `./` prefix. File extensions do not determine validity.

## Commands and exit statuses

Run from the repository root:

```bash
python scripts/validate_budget_backup.py fixtures/budget-backup/v1/valid/mixed.json
python scripts/validate_budget_backup.py fixtures/budget-backup/v1/invalid/both-zero-amounts.json
python scripts/validate_budget_backup.py --help
```

Run `echo $?` immediately after an invocation to inspect its exit status in a
shell. Relative paths resolve against the caller's working directory.

| Behavior | Exit | stdout | stderr |
| --- | --- | --- | --- |
| Valid backup | 0 | `VALID` and a newline | Empty |
| `-h` / `--help` | 0 | Static help | Empty |
| Encoding, size, parsing, resource limit, or contract rejection | 1 | Empty | One `INVALID reason location: message` line |
| Invalid arguments or missing/unreadable/non-file input | 2 | Empty | One `ERROR reason $: message` line |

The invalid example returns `1` with `BOTH_AMOUNTS_SET rows[0]`.
That is a successful negative check. Boundary reasons are `INVALID_ENCODING`,
`FILE_TOO_LARGE`, `INPUT_LIMIT`, `UNREADABLE_FILE`, and `USAGE_ERROR`, all at `$`.
Only the first error is required; error ordering for multiple defects is not
promised.

## Verification

The single Python suite command is:

```bash
python -m unittest discover -s tests/python -p 'test_*.py' -v
```

For a smaller learning step, append e.g. `-k test_json_syntax` or
`-k test_shared_fixtures` to that command. Failure output includes synthetic test
values; use synthetic data only in fixtures and published evidence.

The suite reads every actual shared fixture and checks validity and exact error
reason/path. A separate check verifies uniqueness, file existence, and complete
manifest coverage without hard-coding the fixture count. Additional table-driven
cases cover Python number/boolean behavior, full-string matching, both monetary
fields and row 10, preservation, inert text, reader limits, safe CLI streams, and
side-effect-free import. Permission and parser-resource failures are simulated
with `unittest.mock`; large byte-limit inputs exist only in temporary files.

Observed results on CPython 3.14.5:

- All **37 test methods pass**, including their table-driven subtests; no tests
  are skipped or marked as expected failures.
- All 27 shared inputs agree with the manifest: 3 valid fixtures preserve parsed
  values and 24 invalid fixtures match both reason and path. Manifest coverage,
  uniqueness, and referenced file existence also pass.
- The valid CLI example exits `0`, prints `VALID` and a newline on stdout, and
  leaves stderr empty. The invalid example exits `1`, leaves stdout empty, and
  prints `INVALID BOTH_AMOUNTS_SET rows[0]: A row cannot contain both income and spending.`
  on stderr. `--help` exits `0` with static stdout and empty stderr.

Existing application verification was also run:

```bash
npm test
npm run lint
npm run build
```

Observed: **423 tests in 9 files passed**, including the TypeScript shared-fixture
checks; lint and build exited `0`. These local checks used Node **22.19.0**, npm
**10.9.3**, and the existing installed dependencies. Repository CI uses Node 24
and `npm ci`; a clean Node 24 install was not tested in this local run.
The Python suite is a local command and has not been added to CI or npm scripts.
PR-triggered checks must be read from GitHub; these local results do not predict
their status.

Passing the shared manifest in both implementations demonstrates agreement
on those examples, not equivalence for every JSON input or parser resource limit.
Unique object names are a producer assumption; do not introduce a Python-only
duplicate-key rule or a custom parser. The byte limit is not a hostile-input
sandbox. If you find a mismatch, preserve a minimal synthetic example and resolve
the authoritative contract question instead of changing fixtures to hide it.

## Focused resources and separate personal learning

- [Python tutorial](https://docs.python.org/3/tutorial/): functions, dictionaries,
  lists, modules, exceptions, and file I/O.
- [Virtual environments](https://docs.python.org/3/tutorial/venv.html): interpreter
  isolation, activation, and why this component needs no third-party install.
- [JSON decoder hooks and interoperability](https://docs.python.org/3/library/json.html):
  numeric decoding, non-standard constants, and parse errors.
- [Boolean type](https://docs.python.org/3/library/stdtypes.html#boolean-type-bool),
  [full-string matching](https://docs.python.org/3/library/re.html#re.fullmatch),
  and [finiteness](https://docs.python.org/3/library/math.html#math.isfinite): the
  three checks behind the version and amount edge cases.
- [unittest](https://docs.python.org/3/library/unittest.html): discovery, assertions,
  and subtests. [argparse](https://docs.python.org/3/library/argparse.html) is useful
  background; this small shell uses explicit argument handling to avoid echoing
  rejected argument values.

For the separate personal learning, personally implement or substantially debug
the validator and explain `arguments → bounded file read → UTF-8/BOM → JSON →
contract checks → safe diagnostic/exit`. Classify one valid and one invalid
fixture, explain why `true` is not version `1`, why two zero strings are populated,
and why underflow retains `"1e-9999"`.

Independently make and test one small change (for example, a safe message and its
assertion, or a missing edge-case test). Do not change the contract merely to
create an exercise. Keep any learning evidence separately from PR #78 and issue
#37; it is not required for their completion.

Contribution record: the maintainer wrote the initial JSON decoding with
`parse_int=float` / `parse_float=float` and the `JSONDecodeError` translation.
Codex prepared the original tests and file/CLI shell, reviewed that edit, and
completed constant rejection, resource-limit handling, contract validation,
return-value handling, documentation, and verification at the maintainer's request.
**The personal learning remains pending outside PR #78 and issue #37.** This
includes substantial hands-on implementation/debugging, the control-flow
explanation, and an independent tested change. No completed human learning
outcome is claimed.
