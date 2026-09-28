import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import { emptyBudget } from './budgetModel'
import { downloadFile } from './downloadFile'
vi.mock('./downloadFile', () => ({ downloadFile: vi.fn() }))
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 22))
  vi.mocked(downloadFile).mockReset()
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); vi.useRealTimers() })
const setup = () => { render(<App />); fireEvent.click(screen.getByText('Export and backup')) }
const exportFile = (format = 'JSON') => fireEvent.click(screen.getByRole('button', { name: `Export ${format}` }))
const last = () => vi.mocked(downloadFile).mock.calls.at(-1)![0]

test('exports the selected month and latest edits without storage access or mutation', () => {
  setup()
  for (const month of ['2026-09', '2026-10']) {
    fireEvent.change(screen.getByRole('textbox', { name: 'Monthly income' }), { target: { value: '0010.00' } })
    const read = vi.spyOn(Storage.prototype, 'getItem')
    const write = vi.spyOn(Storage.prototype, 'setItem')
    exportFile()
    expect(last().filename).toBe(`finance-lab-budget-${month}.json`)
    expect(JSON.parse(last().content)).toEqual({ formatVersion: 2, month, ...emptyBudget(), income: '0010.00' })
    exportFile('CSV')
    expect(last().content.split('\r\n')).toHaveLength(19)
    expect(read).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
    vi.restoreAllMocks()
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
  }
})

test('blocks invalid drafts in both formats and clears stale errors after correction', () => {
  setup()
  const income = screen.getByRole('textbox', { name: 'Monthly income' })
  fireEvent.change(income, { target: { value: '1e309' } })
  for (const format of ['JSON', 'CSV']) exportFile(format)
  expect(downloadFile).not.toHaveBeenCalled()
  expect(screen.getAllByRole('alert').some((node) => /finite nonnegative/.test(node.textContent!))).toBe(true)
  fireEvent.change(income, { target: { value: '100' } })
  expect(screen.queryByRole('alert')).toBeNull()
  exportFile()
  expect(JSON.parse(last().content).income).toBe('100')
})

test('exports in-memory data while storage is unavailable and handles download failure safely', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('unavailable') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('unavailable') })
  setup()
  fireEvent.change(screen.getByRole('textbox', { name: 'Investments' }), { target: { value: '.5' } })
  vi.mocked(downloadFile).mockImplementationOnce(() => { throw new Error('Sample private failure') })
  exportFile()
  expect(screen.getByRole('alert').textContent).toBe('Could not prepare the download. Please try exporting again.')
  exportFile()
  expect(JSON.parse(last().content).investments).toBe('.5')
  expect(screen.queryByRole('alert')).toBeNull()
})

test('export buttons support keyboard activation', async () => {
  const user = userEvent.setup()
  setup()
  screen.getByText('Export and backup').focus()
  await user.tab()
  await user.keyboard('{Enter}')
  expect(last().filename).toMatch(/\.csv$/)
  await user.tab()
  await user.keyboard(' ')
  expect(last().filename).toMatch(/\.json$/)
})
