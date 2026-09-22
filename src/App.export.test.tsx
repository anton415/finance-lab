import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import bothZeroFixture from '../fixtures/budget-backup/v1/invalid/both-zero-amounts.json?raw'
import commaFixture from '../fixtures/budget-backup/v1/invalid/comma-amount.json?raw'
import extraPropertyFixture from '../fixtures/budget-backup/v1/invalid/extra-row-property.json?raw'
import whitespaceFixture from '../fixtures/budget-backup/v1/invalid/whitespace-amount.json?raw'
import App from './App'
import type { BudgetRow } from './budgetStorage'
import { downloadFile } from './downloadFile'

vi.mock('./downloadFile', () => ({ downloadFile: vi.fn() }))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 22))
  vi.mocked(downloadFile).mockReset()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
  vi.useRealTimers()
})

const makeRows = (label: string, multiplier = 1): BudgetRow[] =>
  Array.from({ length: 10 }, (_, index) => ({
    item: `Sample ${label} ${index + 1}`,
    income: index % 2 === 0 ? String((index + 1) * multiplier) : '',
    spending: index % 2 === 1 ? String((index + 1) * multiplier) : '',
  }))

const storeRows = (month: string, rows: BudgetRow[]) => {
  localStorage.setItem(`finance-lab:budget:${month}`, JSON.stringify(rows))
}

const exportBudget = (format: 'CSV' | 'JSON') => {
  fireEvent.click(screen.getByRole('button', { name: `Export ${format}` }))
}

const storedValues = () => Object.fromEntries(
  Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)]),
)

const visibleBudget = () => ({
  month: screen.getByText(/^[A-Z][a-z]+ \d{4}$/).textContent,
  fields: [...screen.getAllByRole('textbox'), ...screen.getAllByRole('spinbutton')]
    .map((input) => (input as HTMLInputElement).value),
  totals: ['Total income', 'Total spending', 'Balance']
    .map((label) => screen.getByLabelText(label).textContent),
})

// Rendering, editing, and navigation have flushed their normal persistence effect
// before this helper starts observing the export action.
const expectReadOnlyExport = (action: () => void) => {
  const beforeBudget = visibleBudget()
  const beforeStorage = storedValues()
  const read = vi.spyOn(Storage.prototype, 'getItem')
  const write = vi.spyOn(Storage.prototype, 'setItem')
  const remove = vi.spyOn(Storage.prototype, 'removeItem')
  const clear = vi.spyOn(Storage.prototype, 'clear')

  action()

  expect(visibleBudget()).toEqual(beforeBudget)
  expect(read).not.toHaveBeenCalled()
  expect(write).not.toHaveBeenCalled()
  expect(remove).not.toHaveBeenCalled()
  expect(clear).not.toHaveBeenCalled()
  read.mockRestore()
  write.mockRestore()
  remove.mockRestore()
  clear.mockRestore()
  expect(storedValues()).toEqual(beforeStorage)
}

const lastDownload = () => vi.mocked(downloadFile).mock.calls.at(-1)![0]

const expectJsonDownload = (month: string, rows: BudgetRow[]) => {
  const file = lastDownload()
  expect(file.filename).toBe(`finance-lab-budget-${month}.json`)
  expect(file.mimeType).toBe('application/json')
  expect(JSON.parse(file.content)).toEqual({ formatVersion: 1, month, rows })
}

// These navigation fixtures have no embedded delimiters, quotes, or newlines.
// The serializer tests cover complex CSV records independently.
const expectSimpleCsvDownload = (month: string, rows: BudgetRow[]) => {
  expect(lastDownload()).toEqual({
    filename: `finance-lab-budget-${month}.csv`,
    mimeType: 'text/csv;charset=utf-8',
    content: '\uFEFF"item","income","spending"\r\n'
      + rows.map(({ item, income, spending }) =>
        `"${item === '' ? '' : "'" + item}","${income}","${spending}"\r\n`,
      ).join(''),
  })
}

test('exports all ten selected rows in both formats through month A, B, and A again without mutation', () => {
  const september = makeRows('September', 1)
  const october = makeRows('October', 3)
  storeRows('2026-09', september)
  storeRows('2026-10', october)
  localStorage.setItem('sample-unrelated-preference', 'keep')
  render(<App />)

  for (const { button, month, rows } of [
    { button: null, month: '2026-09', rows: september },
    { button: 'Next month', month: '2026-10', rows: october },
    { button: 'Previous month', month: '2026-09', rows: september },
  ]) {
    if (button) fireEvent.click(screen.getByRole('button', { name: button }))

    expectReadOnlyExport(() => exportBudget('CSV'))
    expectSimpleCsvDownload(month, rows)
    expectReadOnlyExport(() => exportBudget('JSON'))
    expectJsonDownload(month, rows)
    expect(screen.getByLabelText('Item, row 10')).toHaveProperty('value', rows[9].item)
    expect(screen.getByLabelText('Spending, row 10')).toHaveProperty('value', rows[9].spending)
  }

  expect(downloadFile).toHaveBeenCalledTimes(6)
})

test('exports a direct edit from the selected December despite clock rollover, then navigates to January', () => {
  vi.setSystemTime(new Date(2026, 11, 31, 23, 59))
  const december = makeRows('December')
  const january = makeRows('January', 2)
  storeRows('2026-12', december)
  storeRows('2027-01', january)
  render(<App />)
  vi.setSystemTime(new Date(2027, 0, 1, 0, 1))

  const income = screen.getByLabelText('Income, row 1')
  fireEvent.focus(income)
  fireEvent.change(income, { target: { value: '0010.00' } })
  const editedDecember = december.map((row) => ({ ...row }))
  editedDecember[0].income = '0010.00'

  expectReadOnlyExport(() => exportBudget('JSON'))
  expectJsonDownload('2026-12', editedDecember)
  expectReadOnlyExport(() => exportBudget('CSV'))
  expectSimpleCsvDownload('2026-12', editedDecember)
  expect(screen.getByText('December 2026')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
  expectReadOnlyExport(() => exportBudget('JSON'))
  expectJsonDownload('2027-01', january)
  expectReadOnlyExport(() => exportBudget('CSV'))
  expectSimpleCsvDownload('2027-01', january)
})

test('exports an entirely empty selected month in both formats', () => {
  render(<App />)
  const rows = Array.from({ length: 10 }, () => ({ item: '', income: '', spending: '' }))

  expectReadOnlyExport(() => exportBudget('CSV'))
  expectSimpleCsvDownload('2026-09', rows)
  expectReadOnlyExport(() => exportBudget('JSON'))
  expectJsonDownload('2026-09', rows)
})

test('repeated CSV exports never leak their item prefix into JSON, state, or storage', () => {
  const rows = makeRows('preservation')
  rows[0] = { item: '=1+1', income: '0010.00', spending: '' }
  rows[1] = { item: "'Sample existing prefix", income: '', spending: '.5' }
  rows[2] = { item: '  Sample café  ', income: '1e+3', spending: '' }
  storeRows('2026-09', rows)
  storeRows('2026-10', makeRows('unrelated month'))
  render(<App />)

  expectReadOnlyExport(() => exportBudget('CSV'))
  const firstCsv = lastDownload()
  expectSimpleCsvDownload('2026-09', rows)
  expectReadOnlyExport(() => exportBudget('CSV'))
  expect(lastDownload()).toEqual(firstCsv)
  expectReadOnlyExport(() => exportBudget('JSON'))
  expectJsonDownload('2026-09', rows)
})

const invalidSourceFixtures = [
  { name: 'an unexpected row property', source: extraPropertyFixture },
  { name: 'both zero amounts', source: bothZeroFixture },
  { name: 'a comma amount', source: commaFixture },
  { name: 'a whitespace amount', source: whitespaceFixture },
  {
    name: 'a trailing-newline amount',
    source: JSON.stringify({ rows: [
      { item: 'Sample invalid amount', income: '1\n', spending: '' },
      ...makeRows('remaining').slice(1),
    ] }),
  },
]

test.each(invalidSourceFixtures)('rejects $name in both formats with an accessible error and no mutation', ({ source }) => {
  const { rows } = JSON.parse(source) as { rows: BudgetRow[] }
  storeRows('2026-09', rows)
  storeRows('2026-10', makeRows('unrelated month'))
  localStorage.setItem('sample-unrelated-preference', 'keep')
  render(<App />)

  for (const format of ['CSV', 'JSON'] as const) {
    expectReadOnlyExport(() => exportBudget(format))
    expect(downloadFile).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toMatch(/row 1/i)
    expect(screen.getByRole('alert').textContent).toMatch(/income|spending|amount|property|field/i)
    expect(screen.getByRole('alert').textContent).not.toContain(JSON.stringify(rows))
  }
})

test('clears a stale source error after an edit or a month change', () => {
  const rows = makeRows('invalid')
  rows[0] = { item: 'Sample invalid amount', income: '0', spending: '0' }
  storeRows('2026-09', rows)
  storeRows('2026-10', makeRows('valid'))
  render(<App />)

  exportBudget('JSON')
  expect(screen.getByRole('alert')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Item, row 1'), { target: { value: 'Edited sample' } })
  expect(screen.queryByRole('alert')).toBeNull()
  exportBudget('CSV')
  expect(screen.getByRole('alert')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
  expect(screen.queryByRole('alert')).toBeNull()
  exportBudget('JSON')
  expectJsonDownload('2026-10', makeRows('valid'))
})

test('exports valid in-memory edits when storage is unavailable without reading or repairing storage', () => {
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Storage unavailable')
  })
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Storage unavailable')
  })
  const remove = vi.spyOn(Storage.prototype, 'removeItem')
  const clear = vi.spyOn(Storage.prototype, 'clear')
  render(<App />)
  fireEvent.change(screen.getByLabelText('Item, row 1'), { target: { value: 'Sample offline income' } })
  fireEvent.change(screen.getByLabelText('Income, row 1'), { target: { value: '25.50' } })
  read.mockClear()
  write.mockClear()
  const before = visibleBudget()
  const rows = Array.from({ length: 10 }, () => ({ item: '', income: '', spending: '' }))
  rows[0] = { item: 'Sample offline income', income: '25.50', spending: '' }

  exportBudget('CSV')
  expectSimpleCsvDownload('2026-09', rows)
  exportBudget('JSON')
  expectJsonDownload('2026-09', rows)
  expect(visibleBudget()).toEqual(before)
  expect(read).not.toHaveBeenCalled()
  expect(write).not.toHaveBeenCalled()
  expect(remove).not.toHaveBeenCalled()
  expect(clear).not.toHaveBeenCalled()
  expect(screen.queryByRole('alert')).toBeNull()
})

test('shows a retryable download-setup error without mutation and clears it on success', () => {
  const rows = makeRows('download retry')
  storeRows('2026-09', rows)
  storeRows('2026-10', makeRows('unrelated month'))
  render(<App />)
  vi.mocked(downloadFile).mockImplementationOnce(() => {
    throw new Error('Synthetic download failure')
  })

  expectReadOnlyExport(() => exportBudget('CSV'))
  expect(screen.getByRole('alert').textContent).toMatch(/try.*again|retry/i)
  expect(screen.getByRole('alert').textContent).not.toContain('Synthetic download failure')
  expectReadOnlyExport(() => exportBudget('JSON'))
  expectJsonDownload('2026-09', rows)
  expect(screen.queryByRole('alert')).toBeNull()
})

test('offers native named export buttons with keyboard activation', async () => {
  const user = userEvent.setup()
  render(<App />)
  const csv = screen.getByRole('button', { name: 'Export CSV' })
  const json = screen.getByRole('button', { name: 'Export JSON' })
  expect(csv.tagName).toBe('BUTTON')
  expect(csv.getAttribute('type')).toBe('button')
  expect(json.tagName).toBe('BUTTON')
  expect(json.getAttribute('type')).toBe('button')

  await user.tab()
  await user.tab()
  await user.tab()
  expect(document.activeElement).toBe(csv)
  await user.keyboard('{Enter}')
  expect(lastDownload().filename).toBe('finance-lab-budget-2026-09.csv')
  await user.tab()
  expect(document.activeElement).toBe(json)
  await user.keyboard(' ')
  expect(lastDownload().filename).toBe('finance-lab-budget-2026-09.json')
  expect(downloadFile).toHaveBeenCalledTimes(2)
})
