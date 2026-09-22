import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App'
import type { BudgetRow } from './budgetStorage'

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.useRealTimers()
})

const renderBudget = () => {
  const user = userEvent.setup()
  render(<App />)
  return user
}

const total = (label: string) => screen.getByLabelText(label)

const budgetRows = (firstItem: string, firstIncome = '') => [
  { item: firstItem, income: firstIncome, spending: '' },
  ...Array.from({ length: 9 }, () => ({ item: '', income: '', spending: '' })),
]

const expectBudgetRows = (rows: BudgetRow[]) => {
  rows.forEach((row, index) => {
    expect(screen.getByLabelText(`Item, row ${index + 1}`)).toHaveProperty('value', row.item)
    expect(screen.getByLabelText(`Income, row ${index + 1}`)).toHaveProperty('value', row.income)
    expect(screen.getByLabelText(`Spending, row ${index + 1}`)).toHaveProperty('value', row.spending)
  })
}

const filledBudgetRows = (month: string, multiplier: number): BudgetRow[] =>
  Array.from({ length: 10 }, (_, index) => ({
    item: `Sample ${month} item ${index + 1}`,
    income: index % 2 === 0 ? String((index + 1) * multiplier) : '',
    spending: index % 2 === 1 ? String((index + 1) * multiplier) : '',
  }))

const expectTotals = (income: string, spending: string, balance: string) => {
  expect(total('Total income').textContent).toBe(income)
  expect(total('Total spending').textContent).toBe(spending)
  expect(total('Balance').textContent).toBe(balance)
}

const storeBudget = (month: string, rows: BudgetRow[]) => {
  localStorage.setItem(`finance-lab:budget:${month}`, JSON.stringify(rows))
}

const expectStoredBudget = (month: string, rows: BudgetRow[]) => {
  expect(localStorage.getItem(`finance-lab:budget:${month}`)).toBe(JSON.stringify(rows))
}

test('provides ten editable budget rows', () => {
  renderBudget()

  expect(screen.getAllByRole('textbox', { name: /item, row/i })).toHaveLength(10)
  expect(screen.getAllByRole('spinbutton', { name: /income, row/i })).toHaveLength(10)
  expect(screen.getAllByRole('spinbutton', { name: /spending, row/i })).toHaveLength(10)
})

test('adds income to total income and balance', async () => {
  const user = renderBudget()

  await user.type(screen.getByLabelText('Income, row 1'), '100')

  expect(total('Total income').textContent).toBe('100')
  expect(total('Total spending').textContent).toBe('0')
  expect(total('Balance').textContent).toBe('100')
})

test('adds spending to total spending and reduces balance', async () => {
  const user = renderBudget()

  await user.type(screen.getByLabelText('Spending, row 1'), '40')

  expect(total('Total income').textContent).toBe('0')
  expect(total('Total spending').textContent).toBe('40')
  expect(total('Balance').textContent).toBe('-40')
})

test('keeps only the most recently entered amount type in a row', async () => {
  const user = renderBudget()
  const income = screen.getByLabelText('Income, row 1')
  const spending = screen.getByLabelText('Spending, row 1')

  await user.type(income, '100')
  await user.type(spending, '40')

  expect(income).toHaveProperty('value', '')
  expect(spending).toHaveProperty('value', '40')
  expect(total('Total income').textContent).toBe('0')
  expect(total('Total spending').textContent).toBe('40')
})

test('sums income and spending across multiple rows', async () => {
  const user = renderBudget()

  await user.type(screen.getByLabelText('Income, row 1'), '75')
  await user.type(screen.getByLabelText('Income, row 2'), '25')
  await user.type(screen.getByLabelText('Spending, row 3'), '20')
  await user.type(screen.getByLabelText('Spending, row 4'), '5')

  expect(total('Total income').textContent).toBe('100')
  expect(total('Total spending').textContent).toBe('25')
  expect(total('Balance').textContent).toBe('75')
})

test('restores the current month budget after remounting', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 21))
  render(<App />)

  fireEvent.change(screen.getByLabelText('Item, row 1'), {
    target: { value: 'Sample salary' },
  })
  fireEvent.change(screen.getByLabelText('Income, row 1'), {
    target: { value: '100' },
  })

  cleanup()
  render(<App />)

  expect(screen.getByLabelText('Item, row 1')).toHaveProperty('value', 'Sample salary')
  expect(screen.getByLabelText('Income, row 1')).toHaveProperty('value', '100')
  expect(total('Total income').textContent).toBe('100')
})

test('does not load a budget from another month', () => {
  vi.useFakeTimers()
  const priorMonth = JSON.stringify(budgetRows('Prior month', '100'))
  localStorage.setItem('finance-lab:budget:2026-08', priorMonth)
  vi.setSystemTime(new Date(2026, 8, 21))

  render(<App />)

  expectBudgetRows(budgetRows(''))
  expect(screen.getAllByRole('textbox', { name: /item, row/i })).toHaveLength(10)
  expect(localStorage.getItem('finance-lab:budget:2026-08')).toBe(priorMonth)
})

test('restores each month when remounting in A, then B, then A again', () => {
  vi.useFakeTimers()
  const rowsA = budgetRows('Sample September income', '100')
  rowsA[9] = { item: 'Sample September expense', income: '', spending: '25' }
  const rowsB = budgetRows('Sample October income', '200')
  rowsB[8] = { item: 'Sample October expense', income: '', spending: '40' }
  const savedA = JSON.stringify(rowsA)
  const savedB = JSON.stringify(rowsB)
  localStorage.setItem('finance-lab:budget:2026-09', savedA)
  localStorage.setItem('finance-lab:budget:2026-10', savedB)

  for (const { date, rows, income, spending, balance } of [
    { date: new Date(2026, 8, 21), rows: rowsA, income: '100', spending: '25', balance: '75' },
    { date: new Date(2026, 9, 21), rows: rowsB, income: '200', spending: '40', balance: '160' },
    { date: new Date(2026, 8, 21), rows: rowsA, income: '100', spending: '25', balance: '75' },
  ]) {
    vi.setSystemTime(date)
    const { unmount } = render(<App />)

    expectBudgetRows(rows)
    expect(total('Total income').textContent).toBe(income)
    expect(total('Total spending').textContent).toBe(spending)
    expect(total('Balance').textContent).toBe(balance)
    expect(localStorage.getItem('finance-lab:budget:2026-09')).toBe(savedA)
    expect(localStorage.getItem('finance-lab:budget:2026-10')).toBe(savedB)
    unmount()
  }
})

test('falls back to empty rows when saved data is malformed', () => {
  localStorage.setItem('finance-lab:budget:2026-09', '{invalid')
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 21))

  render(<App />)

  expect(screen.getByLabelText('Item, row 1')).toHaveProperty('value', '')
  expect(screen.getAllByRole('textbox', { name: /item, row/i })).toHaveLength(10)
})

test('keeps an open budget in its startup month across a rollover', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 30))
  localStorage.setItem(
    'finance-lab:budget:2026-09',
    JSON.stringify(budgetRows('', '9')),
  )
  localStorage.setItem(
    'finance-lab:budget:2026-10',
    JSON.stringify(budgetRows('', '50')),
  )
  render(<App />)

  const income = screen.getByLabelText('Income, row 1')
  fireEvent.focus(income)
  vi.setSystemTime(new Date(2026, 9, 1))
  fireEvent.change(income, { target: { value: '90' } })

  expect(income).toHaveProperty('value', '90')
  expect(JSON.parse(localStorage.getItem('finance-lab:budget:2026-09') ?? '[]')[0]).toEqual({
    item: '',
    income: '90',
    spending: '',
  })

  cleanup()
  render(<App />)

  expect(screen.getByLabelText('Income, row 1')).toHaveProperty('value', '50')
  expect(JSON.parse(localStorage.getItem('finance-lab:budget:2026-10') ?? '[]')[0]).toEqual({
    item: '',
    income: '50',
    spending: '',
  })
})

test('starts in the current month and restores each saved budget when navigating', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 21))
  const september = filledBudgetRows('September', 1)
  const august = filledBudgetRows('August', 2)
  const october = filledBudgetRows('October', 3)
  storeBudget('2026-08', august)
  storeBudget('2026-09', september)
  storeBudget('2026-10', october)

  render(<App />)

  expect(screen.getByRole('button', { name: 'Previous month' }).tagName).toBe('BUTTON')
  expect(screen.getByRole('button', { name: 'Next month' }).tagName).toBe('BUTTON')

  for (const { button, label, rows, income, spending, balance } of [
    { button: null, label: 'September 2026', rows: september, income: '25', spending: '30', balance: '-5' },
    { button: 'Previous month', label: 'August 2026', rows: august, income: '50', spending: '60', balance: '-10' },
    { button: 'Next month', label: 'September 2026', rows: september, income: '25', spending: '30', balance: '-5' },
    { button: 'Next month', label: 'October 2026', rows: october, income: '75', spending: '90', balance: '-15' },
  ]) {
    if (button) {
      fireEvent.click(screen.getByRole('button', { name: button }))
    }

    expect(screen.getByText(label)).toBeTruthy()
    expectBudgetRows(rows)
    expectTotals(income, spending, balance)
    expectStoredBudget('2026-08', august)
    expectStoredBudget('2026-09', september)
    expectStoredBudget('2026-10', october)
  }
})

test('saves edits before navigation without blur and keeps edits isolated by month', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 21))
  const september = filledBudgetRows('September', 1)
  const october = filledBudgetRows('October', 3)
  storeBudget('2026-09', september)
  storeBudget('2026-10', october)
  render(<App />)

  fireEvent.change(screen.getByLabelText('Item, row 1'), { target: { value: 'Edited sample September' } })
  fireEvent.change(screen.getByLabelText('Income, row 1'), { target: { value: '90' } })
  fireEvent.change(screen.getByLabelText('Spending, row 10'), { target: { value: '95' } })
  const editedSeptember = september.map((row) => ({ ...row }))
  editedSeptember[0] = { item: 'Edited sample September', income: '90', spending: '' }
  editedSeptember[9].spending = '95'
  expectTotals('114', '115', '-1')

  fireEvent.click(screen.getByRole('button', { name: 'Next month' }))

  expect(screen.getByText('October 2026')).toBeTruthy()
  expectBudgetRows(october)
  expectTotals('75', '90', '-15')
  expectStoredBudget('2026-09', editedSeptember)
  expectStoredBudget('2026-10', october)

  fireEvent.change(screen.getByLabelText('Income, row 1'), { target: { value: '45' } })
  const editedOctober = october.map((row) => ({ ...row }))
  editedOctober[0].income = '45'
  fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))

  expect(screen.getByText('September 2026')).toBeTruthy()
  expectBudgetRows(editedSeptember)
  expectTotals('114', '115', '-1')
  expectStoredBudget('2026-09', editedSeptember)
  expectStoredBudget('2026-10', editedOctober)

  fireEvent.click(screen.getByRole('button', { name: 'Next month' }))

  expectBudgetRows(editedOctober)
  expectTotals('117', '90', '27')
  expectStoredBudget('2026-09', editedSeptember)
  expectStoredBudget('2026-10', editedOctober)
})

test('creates an empty third month and restores its edits without changing existing budgets', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 21))
  const september = filledBudgetRows('September', 1)
  const october = filledBudgetRows('October', 3)
  storeBudget('2026-09', september)
  storeBudget('2026-10', october)
  render(<App />)

  fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
  fireEvent.click(screen.getByRole('button', { name: 'Next month' }))

  expect(screen.getByText('November 2026')).toBeTruthy()
  expectBudgetRows(budgetRows(''))
  expectTotals('0', '0', '0')
  expectStoredBudget('2026-09', september)
  expectStoredBudget('2026-10', october)

  fireEvent.change(screen.getByLabelText('Item, row 1'), { target: { value: 'Sample November income' } })
  fireEvent.change(screen.getByLabelText('Income, row 1'), { target: { value: '80' } })
  const november = budgetRows('Sample November income', '80')

  for (const { button, label, rows, income, spending, balance } of [
    { button: 'Previous month', label: 'October 2026', rows: october, income: '75', spending: '90', balance: '-15' },
    { button: 'Previous month', label: 'September 2026', rows: september, income: '25', spending: '30', balance: '-5' },
    { button: 'Next month', label: 'October 2026', rows: october, income: '75', spending: '90', balance: '-15' },
    { button: 'Next month', label: 'November 2026', rows: november, income: '80', spending: '0', balance: '80' },
  ]) {
    fireEvent.click(screen.getByRole('button', { name: button }))
    expect(screen.getByText(label)).toBeTruthy()
    expectBudgetRows(rows)
    expectTotals(income, spending, balance)
    expectStoredBudget('2026-09', september)
    expectStoredBudget('2026-10', october)
    expectStoredBudget('2026-11', november)
  }
})

test.each([
  { date: new Date(2026, 11, 31), start: '2026-12', startLabel: 'December 2026', next: '2027-01', nextLabel: 'January 2027' },
  { date: new Date(2027, 0, 31), start: '2027-01', startLabel: 'January 2027', next: '2027-02', nextLabel: 'February 2027' },
])('navigates from $startLabel to $nextLabel and back without skipping months', ({ date, start, startLabel, next, nextLabel }) => {
  vi.useFakeTimers()
  vi.setSystemTime(date)
  const startRows = filledBudgetRows('start month', 1)
  const nextRows = filledBudgetRows('next month', 2)
  storeBudget(start, startRows)
  storeBudget(next, nextRows)
  render(<App />)

  expect(screen.getByText(startLabel)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Next month' }))

  expect(screen.getByText(nextLabel)).toBeTruthy()
  expectBudgetRows(nextRows)
  expectTotals('50', '60', '-10')
  expectStoredBudget(start, startRows)
  expectStoredBudget(next, nextRows)

  fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))

  expect(screen.getByText(startLabel)).toBeTruthy()
  expectBudgetRows(startRows)
  expectTotals('25', '30', '-5')
  expectStoredBudget(start, startRows)
  expectStoredBudget(next, nextRows)
})

test('remounts in the current month and retains edits made in another month', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 21))
  const september = filledBudgetRows('September', 1)
  const august = filledBudgetRows('August', 2)
  storeBudget('2026-09', september)
  storeBudget('2026-08', august)
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
  fireEvent.change(screen.getByLabelText('Income, row 1'), { target: { value: '40' } })
  const editedAugust = august.map((row) => ({ ...row }))
  editedAugust[0].income = '40'

  cleanup()
  render(<App />)

  expect(screen.getByText('September 2026')).toBeTruthy()
  expectBudgetRows(september)
  expectTotals('25', '30', '-5')
  expectStoredBudget('2026-09', september)
  expectStoredBudget('2026-08', editedAugust)

  fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))

  expect(screen.getByText('August 2026')).toBeTruthy()
  expectBudgetRows(editedAugust)
  expectTotals('88', '60', '28')
})

test('keeps edits and navigation relative to the selected month after the clock rolls over', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 30, 23, 59))
  const august = filledBudgetRows('August', 2)
  const september = filledBudgetRows('September', 1)
  const october = filledBudgetRows('October', 3)
  storeBudget('2026-08', august)
  storeBudget('2026-09', september)
  storeBudget('2026-10', october)
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))

  vi.setSystemTime(new Date(2026, 9, 1))

  expect(screen.getByText('August 2026')).toBeTruthy()
  expectBudgetRows(august)
  fireEvent.change(screen.getByLabelText('Income, row 1'), { target: { value: '70' } })
  const editedAugust = august.map((row) => ({ ...row }))
  editedAugust[0].income = '70'
  expect(screen.getByText('August 2026')).toBeTruthy()
  expectBudgetRows(editedAugust)
  expectTotals('118', '60', '58')
  expectStoredBudget('2026-08', editedAugust)
  expectStoredBudget('2026-09', september)
  expectStoredBudget('2026-10', october)

  fireEvent.click(screen.getByRole('button', { name: 'Next month' }))

  expect(screen.getByText('September 2026')).toBeTruthy()
  expectBudgetRows(september)
  expectTotals('25', '30', '-5')

  fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))

  expect(screen.getByText('August 2026')).toBeTruthy()
  expectBudgetRows(editedAugust)
  expectTotals('118', '60', '58')
  expectStoredBudget('2026-08', editedAugust)
  expectStoredBudget('2026-09', september)
  expectStoredBudget('2026-10', october)
})

test.each(['{invalid', JSON.stringify([{ item: 'Invalid short budget', income: '10', spending: '' }])])(
  'opens malformed destination data as an empty budget without changing valid months: %s',
  (malformedBudget) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 21))
    const september = filledBudgetRows('September', 1)
    storeBudget('2026-09', september)
    localStorage.setItem('finance-lab:budget:2026-08', malformedBudget)
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))

    expect(screen.getByText('August 2026')).toBeTruthy()
    expectBudgetRows(budgetRows(''))
    expectTotals('0', '0', '0')
    expectStoredBudget('2026-09', september)

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))

    expect(screen.getByText('September 2026')).toBeTruthy()
    expectBudgetRows(september)
    expectTotals('25', '30', '-5')
    expectStoredBudget('2026-09', september)
  },
)

test('reaches and activates both named month buttons using the keyboard', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 21))
  const user = userEvent.setup()
  render(<App />)

  await user.tab()
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Previous month' }))
  await user.keyboard('{Enter}')
  expect(screen.getByText('August 2026')).toBeTruthy()

  await user.tab()
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next month' }))
  await user.keyboard(' ')
  expect(screen.getByText('September 2026')).toBeTruthy()
})
