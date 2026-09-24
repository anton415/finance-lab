import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import emptyFixture from '../fixtures/budget-backup/v1/valid/empty.json?raw'
import mixedFixture from '../fixtures/budget-backup/v1/valid/mixed.json?raw'
import representationFixture from '../fixtures/budget-backup/v1/valid/representation.json?raw'
import App from './App'
import { BudgetBackupPreview } from './BudgetBackupPreview'
import { parseBudgetBackup } from './budgetBackup'
import { loadBudget, type BudgetRow } from './budgetStorage'
import { downloadFile } from './downloadFile'

vi.mock('./downloadFile', () => ({ downloadFile: vi.fn() }))

const nativeGet = Storage.prototype.getItem
const nativeSet = Storage.prototype.setItem
const nativeRemove = Storage.prototype.removeItem
const september = 'finance-lab:budget:2026-09'
const october = 'finance-lab:budget:2026-10'
const january = 'finance-lab:budget:2027-01'
const mixed = parseBudgetBackup(mixedFixture)

// jsdom lacks the native dialog boundary. Focus is managed by the component;
// native modality, keyboard trapping, and Escape are also checked in a browser.
beforeAll(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value() { this.setAttribute('open', '') } },
    close: { configurable: true, value() { this.removeAttribute('open') } },
  })
})

afterAll(() => {
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 22))
  vi.mocked(downloadFile).mockReset()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
  vi.useRealTimers()
})

const makeRows = (label: string): BudgetRow[] => Array.from({ length: 10 }, (_, index) => ({
  item: `Sample ${label} ${index + 1}`,
  income: index === 0 ? '200' : '',
  spending: index === 9 ? '40' : '',
}))

const setup = () => {
  localStorage.setItem(september, JSON.stringify(makeRows('September')))
  localStorage.setItem(october, JSON.stringify(makeRows('October')))
  localStorage.setItem('finance-lab:budget:2028-02', '  [sample untouched data] ')
  localStorage.setItem('sample-preference', 'keep exactly')
  const app = render(<StrictMode><App /></StrictMode>)
  fireEvent.click(screen.getByText('Export and backup'))
  return app
}

const storageSnapshot = () => Object.fromEntries(Object.keys(localStorage).sort().map(
  (key) => [key, nativeGet.call(localStorage, key)],
))
const budgetSnapshot = () => ({
  month: document.querySelector('.month-navigation span')?.textContent,
  inputs: Array.from({ length: 10 }, (_, index) => ['Item', 'Income', 'Spending'].map(
    (label) => (screen.getByLabelText(`${label}, row ${index + 1}`) as HTMLInputElement).value,
  )),
  totals: ['Total income', 'Total spending', 'Balance'].map((label) => screen.getByLabelText(label).textContent),
})
const observe = () => {
  const storage = storageSnapshot()
  const budget = budgetSnapshot()
  const write = vi.spyOn(Storage.prototype, 'setItem').mockClear()
  const remove = vi.spyOn(Storage.prototype, 'removeItem').mockClear()
  const clear = vi.spyOn(Storage.prototype, 'clear').mockClear()
  return {
    storage, budget, write, remove, clear,
    unchanged() {
      expect(storageSnapshot()).toEqual(storage)
      expect(budgetSnapshot()).toEqual(budget)
      expect(write).not.toHaveBeenCalled()
      expect(remove).not.toHaveBeenCalled()
      expect(clear).not.toHaveBeenCalled()
    },
    restored(key: string, rows: BudgetRow[]) {
      const serialized = JSON.stringify(rows)
      expect(write.mock.calls).toEqual([[key, serialized]])
      expect(remove).not.toHaveBeenCalled()
      expect(clear).not.toHaveBeenCalled()
      expect(storageSnapshot()).toEqual({ ...storage, [key]: serialized })
    },
  }
}

const bytes = (source: string) => new TextEncoder().encode(source).buffer as ArrayBuffer
const backupFile = (source: string) => {
  // Deliberately contradict the content's destination and reuse the same name.
  const file = new File([source], 'finance-lab-budget-1999-12.json', { type: 'application/json' })
  Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.resolve(bytes(source)) })
  return file
}
const fileInput = () => screen.getByLabelText('Choose JSON backup')
const selectFile = (file: File) => fireEvent.change(fileInput(), { target: { files: [file] } })
const choose = async (source = mixedFixture) => {
  selectFile(backupFile(source))
  await screen.findByRole('table', { name: 'Backup preview: 10 rows' })
}
const startButton = () => screen.getByRole('button', { name: 'Restore backup…' })
const begin = () => fireEvent.click(startButton())
const finalButton = () => within(screen.getByRole('dialog')).getByRole('button', { name: /^(Replace|Restore) month / })
const confirm = () => fireEvent.click(finalButton())
const navigate = (offset: number) => {
  for (let index = 0; index < Math.abs(offset); index += 1) {
    fireEvent.click(screen.getByRole('button', { name: offset > 0 ? 'Next month' : 'Previous month' }))
  }
}
const exported = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }))
  return parseBudgetBackup(vi.mocked(downloadFile).mock.calls.at(-1)![0].content)
}
const expectSuccess = (month: string) => {
  expect(screen.getByText(`Restored budget for ${month}`).getAttribute('role')).toBe('status')
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Monthly budget' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.queryByRole('table', { name: 'Backup preview: 10 rows' })).toBeNull()
  expect(fileInput()).toHaveProperty('value', '')
  expect(startButton()).toHaveProperty('disabled', true)
}

test.each([
  { name: 'empty', source: emptyFixture, offset: 1, totals: [0, 0, 0] },
  { name: 'mixed', source: mixedFixture, offset: 0, totals: [100, 34.75, 65.25] },
  { name: 'representation', source: representationFixture, offset: 4, totals: [2010.5, 101.235, 1909.265] },
])('round-trips the $name fixture through export, preview, restore, reload, and re-export', async ({ source, offset, totals }) => {
  const approved = parseBudgetBackup(source)
  const key = `finance-lab:budget:${approved.month}`
  localStorage.setItem(key, JSON.stringify(approved.rows))
  localStorage.setItem('sample-preference', 'keep exactly')
  const app = render(<StrictMode><App /></StrictMode>)
  fireEvent.click(screen.getByText('Export and backup'))
  navigate(offset)
  expect(exported()).toEqual(approved)
  const download = vi.mocked(downloadFile).mock.calls.at(-1)![0]
  navigate(1)
  // Replace a populated destination, including when the approved backup is empty.
  nativeSet.call(localStorage, key, JSON.stringify(makeRows('old destination')))
  const observed = observe()
  await choose(download.content)
  begin()
  expect(finalButton().textContent).toBe(`Replace month ${approved.month}`)
  observed.unchanged()
  confirm()
  observed.restored(key, approved.rows)
  expectSuccess(approved.month)
  expect(exported()).toEqual(approved)
  expect(loadBudget(key)).toEqual(approved.rows)
  expect(budgetSnapshot().totals).toEqual(totals.map((value) => value.toLocaleString(undefined, { maximumFractionDigits: 2 })))
  expect(JSON.parse(nativeGet.call(localStorage, key)!)[9]).toEqual(approved.rows[9])

  app.unmount()
  render(<App />)
  fireEvent.click(screen.getByText('Export and backup'))
  expect(screen.getByText('September 2026')).toBeTruthy()
  navigate(offset)
  expect(exported()).toEqual(approved)
})

test.each([false, true])('restores September while a different month is displayed: %s, then saves the first edit normally', async (differentMonth) => {
  setup()
  if (differentMonth) navigate(1)
  const observed = observe()
  await choose()
  begin()
  confirm()
  observed.restored(september, mixed.rows)
  expectSuccess('2026-09')
  expect(screen.getByText('September 2026')).toBeTruthy()
  expect(exported()).toEqual(mixed)
  observed.write.mockClear()
  fireEvent.change(screen.getByLabelText('Item, row 1'), { target: { value: 'Sample first edit' } })
  expect(observed.write).toHaveBeenCalledTimes(1)
  expect(loadBudget(september)[0].item).toBe('Sample first edit')
  expect(screen.queryByText('Restored budget for 2026-09')).toBeNull()
  navigate(1)
  expect(exported().rows).toEqual(makeRows('October'))
  navigate(-1)
  expect(exported().rows[0].item).toBe('Sample first edit')
  expect(nativeGet.call(localStorage, october)).toBe(observed.storage[october])
})

test.each([
  { name: 'absent', raw: null, action: 'Restore' },
  { name: 'populated', raw: JSON.stringify(makeRows('destination')), action: 'Replace' },
  { name: 'empty rows', raw: JSON.stringify(JSON.parse(emptyFixture).rows), action: 'Replace' },
  { name: 'empty array', raw: '[]', action: 'Replace' },
  { name: 'malformed', raw: '{sample malformed', action: 'Replace' },
  { name: 'empty string', raw: '', action: 'Replace' },
])('requires fresh $action confirmation for an $name destination', async ({ raw, action }) => {
  setup()
  if (raw !== null) localStorage.setItem(january, raw)
  const observed = observe()
  await choose(representationFixture)
  begin()
  const dialog = screen.getByRole('dialog', { name: 'Restore backup for 2027-01' })
  expect(dialog.textContent).toMatch(/all 10 rows.*2027-01.*including empty rows/i)
  expect(dialog.textContent).toContain('Success will display that month')
  expect(finalButton().textContent).toBe(`${action} month 2027-01`)
  if (raw === null) expect(dialog.textContent).toContain('No stored budget was found')
  else expect(dialog.textContent).toMatch(/All existing stored data.*no undo.*JSON backup/)
  observed.unchanged()
  confirm()
  observed.restored(january, parseBudgetBackup(representationFixture).rows)
})

test.each(['Cancel', 'Escape'])('%s keeps the candidate and two budgets unchanged, returns focus, and requires a new approval', async (action) => {
  const user = userEvent.setup()
  setup()
  await choose()
  const observed = observe()
  await user.click(startButton())
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }))
  expect(finalButton()).toHaveProperty('type', 'button')
  const oldButton = finalButton()
  if (action === 'Cancel') await user.keyboard('{Enter}')
  else fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
  expect(document.activeElement).toBe(startButton())
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('table', { name: 'Backup preview: 10 rows' })).toBeTruthy()
  observed.unchanged()
  begin()
  fireEvent.click(oldButton)
  observed.unchanged()
  confirm()
  observed.restored(september, mixed.rows)
})

test.each([
  { before: null, after: '' },
  { before: '[]', after: '[sample different existing data]' },
  { before: '', after: null },
])('rejects a destination change from $before to $after and permits a freshly confirmed retry', async ({ before, after }) => {
  setup()
  if (before !== null) localStorage.setItem(january, before)
  await choose(representationFixture)
  begin()
  if (after === null) nativeRemove.call(localStorage, january)
  else nativeSet.call(localStorage, january, after)
  const observed = observe()
  confirm()
  observed.unchanged()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('alert').textContent).toMatch(/data changed.*review and confirm again/)
  expect(screen.queryByText(/Restored budget for/)).toBeNull()
  begin()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(finalButton().textContent).toBe(`${after === null ? 'Restore' : 'Replace'} month 2027-01`)
  confirm()
  observed.restored(january, parseBudgetBackup(representationFixture).rows)
})

test('refreshes presence between preview and confirmation without using the loader', async () => {
  setup()
  await choose(representationFixture)
  nativeSet.call(localStorage, january, '{sample new data')
  const observed = observe()
  begin()
  expect(finalButton().textContent).toBe('Replace month 2027-01')
  observed.unchanged()
})

test.each(['getItem', 'storage access'] as const)('an unknown presence and failed %s lookup keep the valid preview retryable', async (boundary) => {
  setup()
  const observed = observe()
  const fail = () => { throw new Error('Sample private storage detail') }
  const read = boundary === 'getItem'
    ? vi.spyOn(Storage.prototype, 'getItem').mockImplementation(fail)
    : vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(fail)
  await choose(representationFixture)
  expect(startButton()).toHaveProperty('disabled', false)
  begin()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('alert').textContent).toMatch(/Could not check.*try/)
  expect(screen.getByRole('alert').textContent).not.toContain('private')
  read.mockRestore()
  observed.unchanged()
  begin()
  expect(finalButton().textContent).toBe('Restore month 2027-01')
  confirm()
  observed.restored(january, parseBudgetBackup(representationFixture).rows)
})

test('a failed final reread invalidates approval with no write or UI change, then recovers', async () => {
  setup()
  await choose()
  begin()
  const observed = observe()
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Sample private failure') })
  confirm()
  observed.unchanged()
  expect(screen.getByRole('alert').textContent).toMatch(/Could not recheck.*confirm again/)
  expect(screen.queryByRole('dialog')).toBeNull()
  read.mockRestore()
  begin()
  confirm()
  observed.restored(september, mixed.rows)
})

test.each([false, true])('a quota write failure preserves an absent destination: %s and never retries automatically', async (absent) => {
  setup()
  const source = absent ? representationFixture : mixedFixture
  const approved = parseBudgetBackup(source)
  const key = absent ? january : september
  await choose(source)
  begin()
  const observed = observe()
  observed.write.mockImplementation(() => { throw new DOMException('Sample quota detail', 'QuotaExceededError') })
  const button = finalButton()
  act(() => { button.click(); button.click() })
  expect(observed.write.mock.calls).toEqual([[key, JSON.stringify(approved.rows)]])
  expect(storageSnapshot()).toEqual(observed.storage)
  expect(budgetSnapshot()).toEqual(observed.budget)
  expect(observed.remove).not.toHaveBeenCalled()
  expect(observed.clear).not.toHaveBeenCalled()
  expect(screen.getByRole('alert').textContent).toBe('Could not restore this budget. No restoration was completed. Please try again.')
  expect(screen.queryByText(/Restored budget for/)).toBeNull()
  expect(screen.queryByRole('dialog')).toBeNull()
  observed.write.mockImplementation(nativeSet).mockClear()
  begin()
  observed.unchanged()
  confirm()
  observed.restored(key, approved.rows)
})

test('serialization failure occurs before any final storage read/write and requires fresh approval', async () => {
  setup()
  await choose()
  begin()
  const observed = observe()
  const read = vi.spyOn(Storage.prototype, 'getItem')
  const stringify = vi.spyOn(JSON, 'stringify').mockImplementation(() => { throw new Error('Sample private serialization detail') })
  confirm()
  stringify.mockRestore()
  expect(read).not.toHaveBeenCalled()
  observed.unchanged()
  expect(screen.getByRole('alert').textContent).toMatch(/Could not prepare.*fresh confirmation/)
  expect(screen.queryByRole('dialog')).toBeNull()
  begin()
  confirm()
  observed.restored(september, mixed.rows)
})

test('double activation consumes approval once and clears stale export errors', async () => {
  const badRows = makeRows('invalid')
  badRows[0].spending = '1'
  localStorage.setItem(september, JSON.stringify(badRows))
  render(<StrictMode><App /></StrictMode>)
  fireEvent.click(screen.getByText('Export and backup'))
  fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }))
  expect(screen.getByRole('alert')).toBeTruthy()
  await choose()
  begin()
  const observed = observe()
  const button = finalButton()
  act(() => { button.click(); button.click() })
  observed.restored(september, mixed.rows)
  expectSuccess('2026-09')
  expect(screen.queryByRole('alert')).toBeNull()
  navigate(1)
  expect(screen.queryByText('Restored budget for 2026-09')).toBeNull()
})

test.each(['clear', 'invalid', 'replacement'] as const)('%s invalidates an open confirmation and its stale final action', async (action) => {
  setup()
  await choose()
  begin()
  const stale = finalButton()
  const observed = observe()
  // Programmatic events simulate unexpected changes; native modality blocks
  // ordinary background interaction in the real browser.
  if (action === 'clear') fireEvent.click(screen.getByRole('button', { name: 'Clear preview' }))
  else {
    selectFile(backupFile(action === 'invalid' ? '{sample invalid' : representationFixture))
    expect(startButton()).toHaveProperty('disabled', true)
    fireEvent.click(startButton())
    if (action === 'invalid') await screen.findByRole('alert')
    else await screen.findByRole('table', { name: 'Backup preview: 10 rows' })
  }
  fireEvent.click(stale)
  expect(screen.queryByRole('dialog')).toBeNull()
  observed.unchanged()
  if (action === 'replacement') {
    begin()
    expect(finalButton().textContent).toBe('Restore month 2027-01')
    confirm()
    observed.restored(january, parseBudgetBackup(representationFixture).rows)
  } else expect(startButton()).toHaveProperty('disabled', true)
})

test.each(['success', 'failure'] as const)('a late read %s cannot replace an approved newer candidate', async (outcome) => {
  const app = setup()
  let resolve!: (value: ArrayBuffer) => void
  let reject!: (reason: Error) => void
  const pending = new Promise<ArrayBuffer>((accept, fail) => { resolve = accept; reject = fail })
  const file = new File(['pending'], 'sample.json')
  Object.defineProperty(file, 'arrayBuffer', { value: () => pending })
  selectFile(file)
  expect(startButton()).toHaveProperty('disabled', true)
  await choose()
  begin()
  const observed = observe()
  await act(async () => {
    if (outcome === 'success') resolve(bytes(representationFixture))
    else reject(new Error('Sample obsolete failure'))
  })
  expect(finalButton().textContent).toBe('Replace month 2026-09')
  observed.unchanged()
  const stale = finalButton()
  app.unmount()
  fireEvent.click(stale)
  expect(storageSnapshot()).toEqual(observed.storage)
  expect(observed.write).not.toHaveBeenCalled()
})

test('an unexpected displayed budget context change invalidates confirmation, retaining the candidate', async () => {
  const context = { month: new Date(2026, 8, 1), rows: makeRows('displayed') }
  const onRestored = vi.fn()
  const onRestoreActivity = vi.fn()
  const app = render(<BudgetBackupPreview budgetContext={context} onRestored={onRestored} onRestoreActivity={onRestoreActivity} />)
  await choose()
  begin()
  const stale = finalButton()
  const write = vi.spyOn(Storage.prototype, 'setItem')
  app.rerender(<BudgetBackupPreview budgetContext={{ ...context, rows: makeRows('changed') }} onRestored={onRestored} onRestoreActivity={onRestoreActivity} />)
  fireEvent.click(stale)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(write).not.toHaveBeenCalled()
  expect(onRestored).not.toHaveBeenCalled()
  expect(startButton()).toHaveProperty('disabled', false)
})

test.each([
  { month: '2026-12', next: '2027-01', offset: 1, display: 'December 2026' },
  { month: '2027-01', next: '2026-12', offset: -1, display: 'January 2027' },
  { month: '0001-01', next: '0001-02', offset: 1, display: 'January 1' },
  { month: '0099-12', next: '0100-01', offset: 1, display: 'December 99' },
  { month: '9999-12', next: '9999-11', offset: -1, display: 'December 9999' },
])('restores $month with its exact key and local year, then navigates to $next and back', async ({ month, next, offset, display }) => {
  setup()
  const key = `finance-lab:budget:${Number(month.slice(0, 4))}-${month.slice(5)}`
  localStorage.setItem(key, '[]')
  const approved = { ...mixed, month }
  await choose(JSON.stringify(approved))
  // Clock and filename cannot retarget the destination or approved rows.
  vi.setSystemTime(new Date(2028, 0, 1))
  begin()
  const observed = observe()
  expect(finalButton().textContent).toBe(`Replace month ${month}`)
  confirm()
  observed.restored(key, mixed.rows)
  expectSuccess(month)
  expect(screen.getByText(display)).toBeTruthy()
  expect(exported()).toEqual(approved)
  navigate(offset)
  expect(exported().month).toBe(next)
  navigate(-offset)
  expect(exported()).toEqual(approved)
})

test('clears stale restore feedback on selection, clear, and a new attempt', async () => {
  setup()
  await choose()
  begin()
  nativeSet.call(localStorage, september, 'sample conflict')
  confirm()
  expect(screen.getByRole('alert')).toBeTruthy()
  await choose()
  expect(screen.queryByRole('alert')).toBeNull()
  begin()
  nativeSet.call(localStorage, september, 'sample second conflict')
  confirm()
  expect(screen.getByRole('alert')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Clear preview' }))
  expect(screen.queryByRole('alert')).toBeNull()
  await choose()
  begin()
  confirm()
  expectSuccess('2026-09')
  await choose()
  expect(screen.queryByText('Restored budget for 2026-09')).toBeNull()
})
