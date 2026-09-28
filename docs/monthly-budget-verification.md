# Issue #47 verification

Verified on 2026-09-28 with synthetic data only. The implementation replaces the
experimental ten-row model with monthly income, the fifteen fixed spending
categories, and separate investments. No migration or compatibility adapter was
added. Historical v1 fixtures and pinned evaluation material remain historical.

## Automated checks

Completed in the implementation checkout:

| Command | Observed result |
| --- | --- |
| `npm test -- --reporter=dot` | 852 tests passed across 9 files. |
| `npm run test:metrics` | 7 tests passed. |
| `npm run lint` | Passed, exit 0. |
| `npm run build` | TypeScript and Vite production build passed. |
| `git -c core.whitespace=cr-at-eol diff --check` | Passed. CRLF is intentional in the CSV fixture. |
| `npm run test:coverage` | 852 tests passed; 100% lines/functions, 99.37% statements, 95.96% branches. |
| `python3.14 -m unittest discover -s tests/python -p 'test_budget_backup.py' -v` | 33 tests passed, including the complete shared v2 fixture manifest. |
| `python3.14 -m unittest discover -s tests/python -p 'test_*.py' -v` | All 73 Python tests passed. |
| `python3.14 scripts/validate_budget_backup.py fixtures/budget-backup/v2/valid/mixed.json` | `VALID`, exit 0. |
| `python3.14 scripts/validate_budget_backup.py fixtures/budget-backup/v2/invalid/negative-amount.json` | `INVALID INVALID_AMOUNT spending.travel`, expected exit 1. |

Python was CPython 3.14.5. The system `python3` was 3.9 and could not import the
existing modern type annotations; verification used the supported interpreter.

## Real browser

Playwright CLI drove a Chromium browser, version **154.0.8037.58**, against local
Vite on macOS. Viewports: **1280×900**, **390×844**, and **320×844**. Screenshots
were visually inspected at the narrowest width; all category names and amount
fields fit, with no horizontal page overflow.

| Required observation | Actual outcome |
| --- | --- |
| New month | One empty income, fifteen empty spending amounts, and empty investments; exactly 17 amount inputs. |
| Fixed categories | All fifteen labels present in the approved order, including empty categories. |
| Persistence | Every source string survived navigation and reload. Tested leading zeros, `.5`, precision beyond cents, exponents, zero strings, and empty amounts. |
| Month isolation | Editing September left October unchanged and vice versa. |
| Spending excludes investments | Income 3000, Groceries 25.50, Investments 20 produced Spending 25.5. |
| Remaining | The same values produced Remaining 2954.5. A populated 15-category example produced Income 3000, Spending 2033.07, Investments 100, Remaining 866.93 after display rounding. |
| JSON v2 round trip | Actual downloaded JSON was selected for preview, confirmed, restored, reloaded, and exported again. Parsed exports were identical across all 17 source strings. Only the destination month changed. |
| Invalid backups | Malformed JSON and a legacy v1 envelope were rejected; preview cleared, Restore disabled, stored keys unchanged. |
| CSV | Parsed actual download: exact header `Type,Category,Amount`, 1 Income + 15 Spending + 1 Investment records, English labels, preserved amount strings, BOM and CRLF. |
| Narrow/keyboard | Tab reached month controls, all 17 amounts, and tools in order. Enter/Space operated month buttons and disclosure. Amount fields fit at 390 and 320 pixels. |

Additional restore safety observations:

- Previewing and canceling left both months' stored bytes unchanged.
- The native dialog focused Cancel. Escape canceled and returned focus. Tab
  reached the final action; Chrome briefly passed focus through browser chrome
  before returning to Cancel, without visiting background form controls. The
  initial smoke assertion expected immediate wrapping; inspection confirmed
  native behavior and the remaining checks continued.
- A deliberate synthetic destination change after opening confirmation was
  rejected by the final recheck without overwriting it. Fresh confirmation then
  restored successfully and focused the budget heading.
- At 390 pixels, the confirmation fit the viewport. Keyboard Cancel preserved an
  absent January destination; a later explicit Restore created only that month.
  Navigation and reload preserved the restored amount spellings.

The browser console showed a missing `favicon.ico` (404); no application runtime
errors were observed. Storage quota/read failures and stale-selection races were
verified by automated tests. The synchronous destination recheck retains its
existing cross-tab limitation; it is not an atomic lock.

GitHub Actions, Codecov, and automated review status are asynchronous and are not
claimed here. The delivery PR is intentionally left as a draft for observing the
workflow transition; readiness and final merge remain human-controlled.
