# Core monthly-budget review — issue #40

## Before implementation

Reviewed on 2026-09-24 against `main` at `7de487d`, before changing production code.
Used an isolated headed Chromium browser driven through Playwright, at 1280 × 900
and 390 × 844 CSS pixels. All entries were synthetic. This is an implementation
review, not a study with recruited first-time users.

### Journey and observed results

- Startup showed September 2026, the browser's current month, and ten editable
  rows with Item / Income / Spending headers.
- Entered Sample salary / income 3000, Sample rent / spending 1200,
  Sample groceries / spending 250, and Sample transport / spending 100.
  The labeled totals were income 3,000, spending 1,550, balance 1,450.
- Changed groceries to 25 (balance 1,675), cleared it (1,700), then restored 250.
  Entering income 100 on the transport row cleared its spending and produced
  balance 1,650; entering spending 100 again restored balance 1,450.
- October initially had empty rows. Entered Sample next month / income 900,
  returned to September, and found the original entries and totals intact.
  Reload preserved September. Reload while viewing October returned to the
  current month, September; October's separate entry remained saved.
- At 390 px, added Sample supplies / spending 50 (balance 1,400), cleared that
  row, repeated the income/spending correction, changed October income to 950,
  returned, and reloaded. September still showed balance 1,450.
- Month labels, amount columns, and totals were understandable. No horizontal
  page scrolling was needed at either width. No blocking problem was observed.

### Findings

**High friction — backup controls interrupt the core entry sequence.**

Problem → Export and restore controls and their explanatory text appear between
month navigation and the editable budget.
Reproduction → Open the app at either width; after focusing Next month, press Tab.
User impact → A first-time user encounters file handling instructions before
budget entry, and must pass unrelated controls to reach the first row.
Evidence → At the top of the page, the table started approximately 413 px down
on desktop and 488 px on narrow; totals started approximately 965 px down on
narrow, outside the initial viewport. Tab after Next month focused Export CSV;
Export JSON and Choose JSON backup also preceded the first item field.
Candidate improvement → Group the existing export and backup controls below the
budget table and totals in a section users can expand when needed.

**Minor — item descriptions are clipped on the narrow screen.**

Problem → Long item text does not fit in the approximately 99 px item column.
Reproduction → Enter the four example labels at 390 px and leave the fields.
User impact → Reading a full label requires moving within its text field.
Evidence → Sample salary, Sample groceries, and Sample transport were clipped;
the tested rows remained distinguishable and editable, with amounts and column
headers visible, and the entry/correction/navigation journey completed.
Candidate improvement → Separately evaluate item-column space if full-label
reading proves necessary. Deferred; no table or responsive redesign in #40.

### Selected improvement

Users currently encounter backup and export controls before entering their
budget; this change makes the month → rows → totals sequence clearer and easier
to reach without changing the finance model.

There was no blocking finding. The one high-friction finding affects both widths
and keyboard entry, and can be addressed by moving existing markup into a native
disclosure. The minor label limitation is deferred.

## Implementation and after verification

Grouped the existing export block and backup-preview component after the totals
in a native `details` / `summary` section named **Export and backup**, collapsed
by default. Its contents stay mounted, so collapsing preserves a selected preview.
The handlers, ten-row table, calculations, persistence, and backup contracts are
unchanged. Tests cover the disclosure state, entry order, preview retention, and
absence of storage writes when toggling. Existing export/preview/restore tests
now open the section before using its controls. No CSS-value or screenshot
assertion was added.

Repeated the browser smoke check in the same session at both widths:

| Observation at page top | Before | After |
| --- | --- | --- |
| Desktop table top | about 413 px | 138 px |
| Narrow table top | about 488 px | 157 px |
| Narrow totals top | about 965 px | about 634 px |
| Tab after Next month | Export CSV | Item, row 1 |

At both sizes all ten rows and the labeled totals now fit within the reviewed
initial viewport. Only the Export and backup summary is visible below the totals
until expanded. Tab from the last spending field reaches the summary, then skips
the hidden controls when closed. Enter opens the section, Space closes it, and
the open section exposes Export CSV, Export JSON, and Choose JSON backup in order.
Native keyboard activation and collapsed tab order were checked in the real
browser because jsdom does not reproduce those behaviors.

At each width, entered and cleared Sample supplies / spending 50, edited groceries
from 250 to 25 and back, changed transport between income and spending, navigated
to October (its saved income remained 950), returned to September, and reloaded.
The final totals remained 3,000 / 1,550 / 1,450. No horizontal page scrolling was
needed. The narrow item-label clipping remains as recorded above.

The final collapsed version was also checked at both widths: opening/closing
preserved the same selected synthetic preview; both export formats downloaded;
editing a budget and switching months worked with the section collapsed. On the
narrow viewport, restored the synthetic January 2027 fixture and confirmed the
restored income total (2,010.5) and focus returning to the budget heading. Reload
returned to the saved current month with the section collapsed.

### Automated checks

- `npm test -- src/App.test.tsx -t 'keyboard entry follows month navigation'`:
  the new test failed on the original layout (Export CSV received focus instead
  of the first item), then passed after the change (1 passed, 20 skipped).
- `npm test`: final run passed all 425 tests across 9 files, including totals,
  navigation, persistence, export, preview, and restore coverage. The first full
  run identified two tests expecting the previous tab order; those expectations
  were updated as described above, retaining their activation/input checks.
- `npm run lint`: passed.
- `npm run build`: passed TypeScript compilation and Vite production build.
- `git diff --check`: passed.

No broader device matrix or usability study was performed. This review does not
claim results for asynchronous GitHub Actions, Codecov, or PR reviews.
