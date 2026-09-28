import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import { budgetTotals, emptyBudget, spendingCategories } from './budgetModel'

const labels = ['Groceries', 'Restaurants', 'Utilities', 'Transport', 'Household', 'Health',
  'Personal care', 'Clothing', 'Subscriptions', 'Education', 'Tech', 'Culture', 'Entertainment', 'Gifts', 'Travel']
const field = (name: string) => screen.getByRole('textbox', { name })
const edit = (name: string, value: string) => fireEvent.change(field(name), { target: { value } })
const navigate = (direction: 'Next' | 'Previous') => fireEvent.click(screen.getByRole('button', { name: `${direction} month` }))
const total = (name: string) => screen.getByRole('status', { name }).textContent
const key = 'finance-lab:budget:2026-09'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 22))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
  vi.useRealTimers()
})

test('starts with exactly one income, all fifteen ordered fixed categories, and investments', () => {
  render(<App />)
  expect(screen.getAllByRole('textbox').map((input) => input.getAttribute('id'))).toEqual([
    'income', 'groceries', 'restaurants', 'utilities', 'transport', 'household', 'health',
    'personal-care', 'clothing', 'subscriptions', 'education', 'tech', 'culture', 'entertainment', 'gifts', 'travel', 'investments',
  ])
  for (const label of ['Monthly income', ...labels, 'Investments']) expect(field(label)).toHaveProperty('value', '')
  for (const label of ['Income', 'Spending', 'Investments', 'Remaining']) expect(total(label)).toBe('0')
  expect(screen.queryByRole('combobox')).toBeNull()
  expect(document.querySelector('details')).toHaveProperty('open', false)
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(emptyBudget())
})

test('derives totals with investments excluded from spending, including a negative remaining amount', () => {
  render(<App />)
  edit('Monthly income', '100')
  labels.forEach((label) => edit(label, '1'))
  edit('Investments', '20')
  expect([total('Income'), total('Spending'), total('Investments'), total('Remaining')]).toEqual(['100', '15', '20', '65'])
  edit('Investments', '120')
  expect(total('Spending')).toBe('15')
  expect(total('Remaining')).toBe('-35')
  edit('Travel', '')
  expect(total('Remaining')).toBe('-34')
  expect(Object.keys(JSON.parse(localStorage.getItem(key)!))).toEqual(['income', 'spending', 'investments'])
})

test('preserves every source string across navigation and remount without altering another month', () => {
  const app = render(<App />)
  const values = ['0010.00', '.5', '1.234', '1e+3', '1E-3', '0', '0.00', '1e-9999', '', '2', '3', '4', '5', '6', '7']
  edit('Monthly income', '003000.00')
  labels.forEach((label, i) => edit(label, values[i]))
  edit('Investments', '1e+2')
  const saved = localStorage.getItem(key)
  navigate('Next')
  for (const input of screen.getAllByRole('textbox')) expect(input).toHaveProperty('value', '')
  edit('Monthly income', '200')
  edit('Travel', '20')
  const nextSaved = localStorage.getItem('finance-lab:budget:2026-10')
  navigate('Previous')
  labels.forEach((label, i) => expect(field(label)).toHaveProperty('value', values[i]))
  expect(localStorage.getItem(key)).toBe(saved)
  expect(localStorage.getItem('finance-lab:budget:2026-10')).toBe(nextSaved)
  app.unmount()
  render(<App />)
  expect(field('Monthly income')).toHaveProperty('value', '003000.00')
  expect(field('Investments')).toHaveProperty('value', '1e+2')
  labels.forEach((label, i) => expect(field(label)).toHaveProperty('value', values[i]))
})

test('resets legacy selected data without scanning or migrating another month', () => {
  const legacy = JSON.stringify(Array.from({ length: 10 }, () => ({ item: 'Sample', income: '10', spending: '' })))
  localStorage.setItem(key, legacy)
  localStorage.setItem('finance-lab:budget:2026-10', legacy)
  render(<App />)
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(emptyBudget())
  expect(localStorage.getItem('finance-lab:budget:2026-10')).toBe(legacy)
})

test('allows incomplete typing, reports invalid drafts, and saves once the complete amount is valid', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.type(field('Monthly income'), '1.25')
  expect(field('Monthly income')).toHaveProperty('value', '1.25')
  const saved = localStorage.getItem(key)
  edit('Monthly income', '1e')
  expect(field('Monthly income').getAttribute('aria-invalid')).toBe('true')
  expect(screen.getByRole('alert').textContent).toMatch(/not saved/)
  expect(localStorage.getItem(key)).toBe(saved)
  edit('Monthly income', '1e+3')
  expect(screen.queryByRole('alert')).toBeNull()
  expect(JSON.parse(localStorage.getItem(key)!).income).toBe('1e+3')
})

test('navigation remains relative to the selected month across a clock and year rollover', () => {
  vi.setSystemTime(new Date(2026, 11, 31, 23, 59))
  render(<App />)
  vi.setSystemTime(new Date(2027, 0, 1))
  edit('Monthly income', '100')
  expect(JSON.parse(localStorage.getItem('finance-lab:budget:2026-12')!).income).toBe('100')
  navigate('Next')
  expect(screen.getByText('January 2027')).toBeTruthy()
  expect(field('Monthly income')).toHaveProperty('value', '')
  navigate('Previous')
  expect(field('Monthly income')).toHaveProperty('value', '100')
})

test('keyboard order reaches navigation and every amount, then the collapsed tools', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.tab()
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Previous month' }))
  await user.keyboard('{Enter}')
  expect(screen.getByText('August 2026')).toBeTruthy()
  await user.tab()
  await user.keyboard(' ')
  expect(screen.getByText('September 2026')).toBeTruthy()
  for (const name of ['Monthly income', ...labels, 'Investments']) {
    await user.tab()
    expect(document.activeElement).toBe(field(name))
  }
  await user.tab()
  expect(document.activeElement).toBe(screen.getByText('Export and backup'))
})

test('metadata has stable order and spending type, and totals tolerate an incomplete UI draft', () => {
  expect(spendingCategories.map(({ label }) => label)).toEqual(labels)
  expect(spendingCategories.map(({ order }) => order)).toEqual(Array.from({ length: 15 }, (_, i) => i))
  expect(spendingCategories.every(({ type }) => type === 'spending')).toBe(true)
  expect(budgetTotals({ ...emptyBudget(), income: 'invalid', investments: '0' })).toEqual({
    income: 0, spending: 0, investments: 0, remaining: 0,
  })
})
