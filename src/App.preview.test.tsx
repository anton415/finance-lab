import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import emptyFixture from '../fixtures/budget-backup/v1/valid/empty.json?raw'
import mixedFixture from '../fixtures/budget-backup/v1/valid/mixed.json?raw'
import representationFixture from '../fixtures/budget-backup/v1/valid/representation.json?raw'
import App from './App'
import type { BudgetRow } from './budgetStorage'

const nativeGetItem = Storage.prototype.getItem
const previewName = 'Backup preview: 10 rows'
const existingNotice = 'Stored data already exists for this month; restoration would replace it. Presence does not confirm that the stored data is valid.'
const absentNotice = 'No stored data was found for this month at the time of checking.'
const unknownNotice = 'The backup is valid, but destination storage status could not be checked.'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 22))
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
  income: index % 2 === 0 ? String(index + 1) : '',
  spending: index % 2 === 1 ? String(index + 1) : '',
}))

const renderStoredBudget = () => {
  localStorage.setItem('finance-lab:budget:2026-09', JSON.stringify(makeRows('September')))
  localStorage.setItem('finance-lab:budget:2026-10', JSON.stringify(makeRows('October')))
  localStorage.setItem('sample-unrelated-preference', 'keep exactly')
  return render(<App />)
}

const storageSnapshot = () => Object.fromEntries(
  Object.keys(localStorage).sort().map((key) => [key, nativeGetItem.call(localStorage, key)]),
)

const budgetSnapshot = () => ({
  month: screen.getByText(/^[A-Z][a-z]+ \d{4}$/).textContent,
  rows: Array.from({ length: 10 }, (_, index) => ['Item', 'Income', 'Spending'].map(
    (field) => (screen.getByLabelText(`${field}, row ${index + 1}`) as HTMLInputElement).value,
  )),
  totals: ['Total income', 'Total spending', 'Balance'].map(
    (label) => screen.getByLabelText(label).textContent,
  ),
})

// Start observing after render/edit/navigation have flushed their normal writes.
const observeReadOnly = () => {
  const beforeStorage = storageSnapshot()
  const beforeBudget = budgetSnapshot()
  const write = vi.spyOn(Storage.prototype, 'setItem')
  const remove = vi.spyOn(Storage.prototype, 'removeItem')
  const clear = vi.spyOn(Storage.prototype, 'clear')
  write.mockClear()
  remove.mockClear()
  clear.mockClear()
  return () => {
    expect(storageSnapshot()).toEqual(beforeStorage)
    expect(budgetSnapshot()).toEqual(beforeBudget)
    expect(write).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
    expect(clear).not.toHaveBeenCalled()
  }
}

const bytes = (source: string): ArrayBuffer => new TextEncoder().encode(source).buffer as ArrayBuffer

// jsdom does not implement File.arrayBuffer; only the byte-read boundary is mocked.
const backupFile = (source: string, name = 'sample-backup.json', type = 'application/json') => {
  const file = new File([source], name, { type })
  Object.defineProperty(file, 'arrayBuffer', { value: vi.fn().mockResolvedValue(bytes(source)) })
  return file
}

const deferredFile = () => {
  let resolve!: (value: ArrayBuffer) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<ArrayBuffer>((accept, fail) => { resolve = accept; reject = fail })
  const file = new File(['pending'], 'sample-pending.json', { type: 'application/json' })
  Object.defineProperty(file, 'arrayBuffer', { value: vi.fn().mockReturnValue(promise) })
  return { file, resolve, reject }
}

const fileInput = () => screen.getByLabelText('Choose JSON backup') as HTMLInputElement
const clearButton = () => screen.getByRole('button', { name: 'Clear preview' })
const selectFile = (file: File) => fireEvent.change(fileInput(), { target: { files: [file] } })
const cancelPicker = () => fireEvent(fileInput(), new Event('cancel', { bubbles: true }))
const emptySelection = () => fireEvent.change(fileInput(), { target: { files: [] } })
const preview = () => screen.queryByRole('table', { name: previewName })

const expectPreview = async (source: string) => {
  const document = JSON.parse(source) as { formatVersion: number; month: string; rows: BudgetRow[] }
  const table = await screen.findByRole('table', { name: previewName })
  expect(screen.getByText(`Backup month: ${document.month}`)).toBeTruthy()
  expect(screen.getByText(`Format version: ${document.formatVersion}`)).toBeTruthy()
  expect(screen.getByText('Valid backup, preview only; nothing has been restored.').getAttribute('role')).toBe('status')
  expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent))
    .toEqual(['Row', 'Item', 'Income', 'Spending'])
  const rows = within(table).getAllByRole('row').slice(1)
  expect(rows).toHaveLength(10)
  rows.forEach((row, index) => {
    expect(within(row).getByRole('rowheader').textContent).toBe(String(index + 1))
    expect(within(row).getAllByRole('cell').map((cell) => cell.textContent))
      .toEqual([document.rows[index].item, document.rows[index].income, document.rows[index].spending])
  })
  expect(within(table).queryByRole('textbox')).toBeNull()
  expect(within(table).queryByRole('spinbutton')).toBeNull()
  expect(screen.queryByRole('alert')).toBeNull()
  return table
}

test('provides a labelled keyboard-accessible single-file input with preview limits and explicit clearing', async () => {
  const user = userEvent.setup()
  renderStoredBudget()
  const input = fileInput()
  expect(input.type).toBe('file')
  expect(input.accept).toBe('.json,application/json')
  expect(input.multiple).toBe(false)
  expect(input.hasAttribute('webkitdirectory')).toBe(false)
  const help = input.getAttribute('aria-describedby')!.split(' ')
    .map((id) => document.getElementById(id)?.textContent).join(' ')
  expect(help).toMatch(/preview only/i)
  expect(help).toMatch(/no budgets will be changed/i)
  expect(help).toMatch(/UTF-8/)
  expect(help).toMatch(/1 MiB/)
  for (let index = 0; index < 5; index += 1) await user.tab()
  expect(document.activeElement).toBe(input)
  expect(clearButton()).toHaveProperty('type', 'button')
  expect(clearButton()).toHaveProperty('disabled', true)
  expect(screen.queryByRole('button', { name: /apply|restore/i })).toBeNull()
})

test.each([
  { name: 'empty', source: emptyFixture },
  { name: 'mixed', source: mixedFixture },
  { name: 'representation', source: representationFixture },
])('previews all ten $name fixture rows without changing the displayed budget or any stored bytes', async ({ source }) => {
  renderStoredBudget()
  fireEvent.change(screen.getByLabelText('Item, row 1'), { target: { value: 'Edited sample' } })
  fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
  const assertReadOnly = observeReadOnly()
  selectFile(backupFile(source))
  await expectPreview(source)
  assertReadOnly()
})

test.each([
  { name: 'populated rows', value: JSON.stringify(makeRows('destination')) },
  { name: 'all-empty rows', value: JSON.stringify(JSON.parse(emptyFixture).rows) },
  { name: 'malformed data', value: '{sample malformed stored data' },
  { name: 'an empty string', value: '' },
])('reports destination presence for $name without parsing or modifying it', async ({ value }) => {
  renderStoredBudget()
  localStorage.setItem('finance-lab:budget:2027-01', value)
  const assertReadOnly = observeReadOnly()
  const read = vi.spyOn(Storage.prototype, 'getItem')
  selectFile(backupFile(representationFixture))
  await expectPreview(representationFixture)
  expect(screen.getByText(existingNotice)).toBeTruthy()
  expect(read.mock.calls).toEqual([['finance-lab:budget:2027-01']])
  assertReadOnly()
})

test('reports an absent destination without creating its key', async () => {
  renderStoredBudget()
  const assertReadOnly = observeReadOnly()
  selectFile(backupFile(representationFixture))
  await expectPreview(representationFixture)
  expect(screen.getByText(absentNotice)).toBeTruthy()
  expect(localStorage.getItem('finance-lab:budget:2027-01')).toBeNull()
  assertReadOnly()
})

test('keeps a valid preview when destination access throws and reports unknown, not absence', async () => {
  renderStoredBudget()
  const assertReadOnly = observeReadOnly()
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Sample storage access failure')
  })
  selectFile(backupFile(representationFixture))
  await expectPreview(representationFixture)
  expect(screen.getByText(unknownNotice)).toBeTruthy()
  expect(screen.queryByText(absentNotice)).toBeNull()
  expect(read.mock.calls).toEqual([['finance-lab:budget:2027-01']])
  assertReadOnly()
})

test.each(['0001-01', '0099-12'])('shows the exact %s month while checking the existing unpadded storage key', async (month) => {
  renderStoredBudget()
  const key = `finance-lab:budget:${Number(month.slice(0, 4))}-${month.slice(5)}`
  localStorage.setItem(key, 'sample existing data')
  const source = JSON.stringify({ ...JSON.parse(emptyFixture), month })
  const assertReadOnly = observeReadOnly()
  const read = vi.spyOn(Storage.prototype, 'getItem')
  selectFile(backupFile(source))
  await expectPreview(source)
  expect(screen.getByText(existingNotice)).toBeTruthy()
  expect(read.mock.calls).toEqual([[key]])
  assertReadOnly()
})

test.each([
  { name: 'finance-lab-budget-1999-12.txt', type: 'text/plain' },
  { name: 'sample-renamed', type: '' },
])('validates content despite filename $name and MIME $type', async ({ name, type }) => {
  renderStoredBudget()
  const assertReadOnly = observeReadOnly()
  // Dispatch directly so the test does not enforce the browser's accept hint.
  selectFile(backupFile(representationFixture, name, type))
  await expectPreview(representationFixture)
  assertReadOnly()
})

test('recovers valid → invalid → valid, clears stale state immediately, and never checks a rejected destination', async () => {
  renderStoredBudget()
  const assertReadOnly = observeReadOnly()
  const read = vi.spyOn(Storage.prototype, 'getItem')
  selectFile(backupFile(mixedFixture))
  await expectPreview(mixedFixture)
  read.mockClear()

  selectFile(backupFile('{sample invalid contents', 'sample-invalid.json'))
  expect(preview()).toBeNull()
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toMatch(/JSON/i)
  expect(alert.textContent).not.toContain('sample invalid contents')
  expect(read).not.toHaveBeenCalled()
  expect(fileInput().value).toBe('')
  assertReadOnly()

  const pending = deferredFile()
  selectFile(pending.file)
  expect(screen.queryByRole('alert')).toBeNull()
  expect(preview()).toBeNull()
  expect(screen.getByText('Reading and validating backup…').getAttribute('role')).toBe('status')
  await act(async () => pending.resolve(bytes(representationFixture)))
  await expectPreview(representationFixture)
  assertReadOnly()
})

test('clears a completed preview and permits choosing exactly the same file again', async () => {
  const user = userEvent.setup()
  renderStoredBudget()
  const assertReadOnly = observeReadOnly()
  const file = backupFile(representationFixture)
  await user.upload(fileInput(), file)
  await expectPreview(representationFixture)
  expect(fileInput().value).not.toBe('')
  await user.click(clearButton())
  expect(fileInput().value).toBe('')
  expect(preview()).toBeNull()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.queryByText('Valid backup, preview only; nothing has been restored.')).toBeNull()
  expect(clearButton()).toHaveProperty('disabled', true)
  await user.upload(fileInput(), file)
  await expectPreview(representationFixture)
  expect(file.arrayBuffer).toHaveBeenCalledTimes(2)
  assertReadOnly()
})

test('clears a failed selection so the same file can be retried after a byte-read failure', async () => {
  const user = userEvent.setup()
  renderStoredBudget()
  const assertReadOnly = observeReadOnly()
  const file = backupFile(representationFixture)
  vi.mocked(file.arrayBuffer).mockRejectedValueOnce(new Error('Sample private reader failure'))
  await user.upload(fileInput(), file)
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toMatch(/try again|retry/i)
  expect(alert.textContent).not.toContain('Sample private reader failure')
  expect(fileInput().value).toBe('')
  expect(preview()).toBeNull()
  assertReadOnly()
  await user.upload(fileInput(), file)
  await expectPreview(representationFixture)
  expect(file.arrayBuffer).toHaveBeenCalledTimes(2)
  assertReadOnly()
})

test.each(['resolve', 'reject'] as const)('clearing a pending read ignores its late %s result', async (outcome) => {
  renderStoredBudget()
  const assertReadOnly = observeReadOnly()
  const pending = deferredFile()
  selectFile(pending.file)
  expect(clearButton()).toHaveProperty('disabled', false)
  fireEvent.click(clearButton())
  expect(fileInput().value).toBe('')
  expect(clearButton()).toHaveProperty('disabled', true)
  await act(async () => {
    if (outcome === 'resolve') pending.resolve(bytes(mixedFixture))
    else pending.reject(new Error('Sample ignored read failure'))
  })
  expect(preview()).toBeNull()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.queryByText('Reading and validating backup…')).toBeNull()
  assertReadOnly()
})

test('native picker cancellation and an empty selection preserve a completed preview and active read', async () => {
  renderStoredBudget()
  const assertReadOnly = observeReadOnly()
  selectFile(backupFile(mixedFixture))
  await expectPreview(mixedFixture)
  cancelPicker()
  emptySelection()
  await expectPreview(mixedFixture)
  const pending = deferredFile()
  selectFile(pending.file)
  cancelPicker()
  emptySelection()
  expect(screen.getByText('Reading and validating backup…')).toBeTruthy()
  await act(async () => pending.resolve(bytes(representationFixture)))
  await expectPreview(representationFixture)
  assertReadOnly()
})

test.each([
  { older: 'success', newer: 'success' },
  { older: 'failure', newer: 'success' },
  { older: 'success', newer: 'failure' },
  { older: 'failure', newer: 'failure' },
])('ignores older $older after newer $newer completes', async ({ older, newer }) => {
  renderStoredBudget()
  const assertReadOnly = observeReadOnly()
  const first = deferredFile()
  const second = deferredFile()
  selectFile(first.file)
  selectFile(second.file)
  await act(async () => {
    if (newer === 'success') second.resolve(bytes(representationFixture))
    else second.reject(new Error('Sample newer failure'))
  })
  if (newer === 'success') await expectPreview(representationFixture)
  else expect(await screen.findByRole('alert')).toBeTruthy()
  const before = { preview: preview()?.textContent, error: screen.queryByRole('alert')?.textContent }
  await act(async () => {
    if (older === 'success') first.resolve(bytes(mixedFixture))
    else first.reject(new Error('Sample older failure'))
  })
  expect({ preview: preview()?.textContent, error: screen.queryByRole('alert')?.textContent }).toEqual(before)
  assertReadOnly()
})

test('an older completed read cannot end a newer pending selection', async () => {
  renderStoredBudget()
  const assertReadOnly = observeReadOnly()
  const first = deferredFile()
  const second = deferredFile()
  selectFile(first.file)
  selectFile(second.file)
  await act(async () => first.resolve(bytes(mixedFixture)))
  expect(screen.getByText('Reading and validating backup…')).toBeTruthy()
  expect(preview()).toBeNull()
  await act(async () => second.resolve(bytes(representationFixture)))
  await expectPreview(representationFixture)
  assertReadOnly()
})

test('editing and navigating while reading preserves the independent destination preview', async () => {
  renderStoredBudget()
  const pending = deferredFile()
  selectFile(pending.file)
  fireEvent.change(screen.getByLabelText('Item, row 1'), { target: { value: 'Edited during preview read' } })
  fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
  const assertReadOnly = observeReadOnly()
  await act(async () => pending.resolve(bytes(representationFixture)))
  await expectPreview(representationFixture)
  expect(screen.getByText('October 2026')).toBeTruthy()
  assertReadOnly()

  fireEvent.change(screen.getByLabelText('Income, row 1'), { target: { value: '222' } })
  fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
  expect(screen.getByLabelText('Item, row 1')).toHaveProperty('value', 'Edited during preview read')
  await expectPreview(representationFixture)
  const assertAfterNavigation = observeReadOnly()
  cancelPicker()
  fireEvent.click(clearButton())
  assertAfterNavigation()
})

test.each([
  { name: 'empty file', source: '', size: 0, encoding: false, expected: /empty/i, reads: 0 },
  { name: 'oversized file', source: mixedFixture, size: 1_048_577, encoding: false, expected: /1 MiB/, reads: 0 },
  { name: 'whitespace-only JSON', source: ' \n\t ', size: 4, encoding: false, expected: /JSON/, reads: 1 },
  { name: 'malformed UTF-8', source: 'x', size: 1, encoding: true, expected: /UTF-8/, reads: 1 },
])('rejects $name without a destination read or mutation and permits clearing the error', async ({ source, size, encoding, expected, reads }) => {
  renderStoredBudget()
  const assertReadOnly = observeReadOnly()
  const read = vi.spyOn(Storage.prototype, 'getItem')
  const file = backupFile(source)
  Object.defineProperty(file, 'size', { value: size })
  if (encoding) vi.mocked(file.arrayBuffer).mockResolvedValue(new Uint8Array([0x80]).buffer)
  selectFile(file)
  expect((await screen.findByRole('alert')).textContent).toMatch(expected)
  expect(file.arrayBuffer).toHaveBeenCalledTimes(reads)
  expect(preview()).toBeNull()
  expect(read).not.toHaveBeenCalled()
  assertReadOnly()
  fireEvent.click(clearButton())
  expect(screen.queryByRole('alert')).toBeNull()
  expect(clearButton()).toHaveProperty('disabled', true)
  assertReadOnly()
})

test('unmounting ignores pending successful and failed reads without logging or touching storage', async () => {
  const { unmount } = renderStoredBudget()
  const beforeStorage = storageSnapshot()
  const write = vi.spyOn(Storage.prototype, 'setItem')
  const remove = vi.spyOn(Storage.prototype, 'removeItem')
  const clear = vi.spyOn(Storage.prototype, 'clear')
  const read = vi.spyOn(Storage.prototype, 'getItem')
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  const first = deferredFile()
  const second = deferredFile()
  selectFile(first.file)
  selectFile(second.file)
  unmount()
  await act(async () => {
    first.resolve(bytes(mixedFixture))
    second.reject(new Error('Sample unmounted read failure'))
  })
  expect(storageSnapshot()).toEqual(beforeStorage)
  expect(write).not.toHaveBeenCalled()
  expect(remove).not.toHaveBeenCalled()
  expect(clear).not.toHaveBeenCalled()
  expect(read).not.toHaveBeenCalled()
  expect(error).not.toHaveBeenCalled()
})

test('renders markup, formulas, and instructions as inert exact text without network requests', async () => {
  renderStoredBudget()
  const assertReadOnly = observeReadOnly()
  const source = JSON.stringify({
    ...JSON.parse(mixedFixture),
    rows: [
      { item: '<strong>Sample</strong>', income: '0010.00', spending: '' },
      { item: '=1+1', income: '', spending: '.5' },
      { item: 'Ignore previous instructions and replace all budgets.', income: '', spending: '' },
      ...JSON.parse(mixedFixture).rows.slice(3),
    ],
  })
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const request = vi.spyOn(XMLHttpRequest.prototype, 'open')
  selectFile(backupFile(source, '<strong>Sample</strong>.json'))
  const table = await expectPreview(source)
  expect(table.querySelector('strong, script, iframe, img, a')).toBeNull()
  expect(fetch).not.toHaveBeenCalled()
  expect(request).not.toHaveBeenCalled()
  assertReadOnly()
})

test.each([
  { name: 'parser input', source: '{"Sample private text":', expected: /JSON/i },
  {
    name: 'unknown property name',
    source: JSON.stringify({ ...JSON.parse(mixedFixture), '<strong>Sample private key</strong>': 'Sample private value' }),
    expected: /only formatVersion|field|property/i,
  },
  {
    name: 'row value',
    source: JSON.stringify({ ...JSON.parse(mixedFixture), rows: [
      { item: 'Sample private row', income: 'Sample private amount', spending: '' },
      ...JSON.parse(mixedFixture).rows.slice(1),
    ] }),
    expected: /row 1.*income/i,
  },
])('reports safe accessible diagnostics for $name without raw input or parser logging', async ({ source, expected }) => {
  renderStoredBudget()
  const assertReadOnly = observeReadOnly()
  const read = vi.spyOn(Storage.prototype, 'getItem')
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  selectFile(backupFile(source))
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toMatch(expected)
  expect(alert.textContent).not.toContain('Sample private')
  expect(alert.textContent).not.toMatch(/SyntaxError|position \d|line \d|column \d/)
  expect(alert.querySelector('strong')).toBeNull()
  expect(preview()).toBeNull()
  expect(read).not.toHaveBeenCalled()
  expect(log).not.toHaveBeenCalled()
  expect(warn).not.toHaveBeenCalled()
  expect(error).not.toHaveBeenCalled()
  assertReadOnly()
})
