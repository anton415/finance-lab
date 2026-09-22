import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App'

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
  vi.setSystemTime(new Date(2026, 7, 21))
  localStorage.setItem(
    'finance-lab:budget:2026-08',
    JSON.stringify([{ item: 'Prior month', income: '100', spending: '' }]),
  )
  vi.setSystemTime(new Date(2026, 8, 21))

  render(<App />)

  expect(screen.getByLabelText('Item, row 1')).toHaveProperty('value', '')
  expect(screen.getAllByRole('textbox', { name: /item, row/i })).toHaveLength(10)
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
