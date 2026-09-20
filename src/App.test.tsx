import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test } from 'vitest'
import App from './App'

afterEach(cleanup)

const renderBudget = () => {
  const user = userEvent.setup()
  render(<App />)
  return user
}

const total = (label: string) =>
  screen.getByText(label).parentElement?.querySelector('dd')

test('provides ten editable budget rows', () => {
  renderBudget()

  expect(screen.getAllByRole('textbox', { name: /item, row/i })).toHaveLength(10)
  expect(screen.getAllByRole('spinbutton', { name: /income, row/i })).toHaveLength(10)
  expect(screen.getAllByRole('spinbutton', { name: /spending, row/i })).toHaveLength(10)
})

test('adds income to total income and balance', async () => {
  const user = renderBudget()

  await user.type(screen.getByLabelText('Income, row 1'), '100')

  expect(total('Total income')?.textContent).toBe('100')
  expect(total('Total spending')?.textContent).toBe('0')
  expect(total('Balance')?.textContent).toBe('100')
})

test('adds spending to total spending and reduces balance', async () => {
  const user = renderBudget()

  await user.type(screen.getByLabelText('Spending, row 1'), '40')

  expect(total('Total income')?.textContent).toBe('0')
  expect(total('Total spending')?.textContent).toBe('40')
  expect(total('Balance')?.textContent).toBe('-40')
})

test('keeps only the most recently entered amount type in a row', async () => {
  const user = renderBudget()
  const income = screen.getByLabelText('Income, row 1')
  const spending = screen.getByLabelText('Spending, row 1')

  await user.type(income, '100')
  await user.type(spending, '40')

  expect(income).toHaveProperty('value', '')
  expect(spending).toHaveProperty('value', '40')
  expect(total('Total income')?.textContent).toBe('0')
  expect(total('Total spending')?.textContent).toBe('40')
})

test('sums income and spending across multiple rows', async () => {
  const user = renderBudget()

  await user.type(screen.getByLabelText('Income, row 1'), '75')
  await user.type(screen.getByLabelText('Income, row 2'), '25')
  await user.type(screen.getByLabelText('Spending, row 3'), '20')
  await user.type(screen.getByLabelText('Spending, row 4'), '5')

  expect(total('Total income')?.textContent).toBe('100')
  expect(total('Total spending')?.textContent).toBe('25')
  expect(total('Balance')?.textContent).toBe('75')
})

test('does not accept a negative amount', () => {
  renderBudget()
  const income = screen.getByLabelText('Income, row 1')

  fireEvent.change(income, { target: { value: '-20' } })

  expect(income).toHaveProperty('value', '')
  expect(total('Total income')?.textContent).toBe('0')
})
