import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { currentMonthKey, loadBudget, saveBudget, type BudgetRow } from './budgetStorage'

afterEach(() => {
  localStorage.clear()
})

describe('independent monthly budgets', () => {
  const monthA = 'finance-lab:budget:2026-09'
  const monthB = 'finance-lab:budget:2026-10'
  const monthC = 'finance-lab:budget:2026-11'
  const rowsA: BudgetRow[] = Array.from({ length: 10 }, (_, index) => ({
    item: `Sample A ${index + 1}`,
    income: index % 2 === 0 ? String((index + 1) * 10) : '',
    spending: index % 2 === 1 ? String(index + 1) : '',
  }))
  const rowsB: BudgetRow[] = Array.from({ length: 10 }, (_, index) => ({
    item: `Sample B ${index + 1}`,
    income: index % 2 === 1 ? String((index + 1) * 20) : '',
    spending: index % 2 === 0 ? String((index + 1) * 2) : '',
  }))

  beforeEach(() => {
    saveBudget(rowsA, monthA)
    saveBudget(rowsB, monthB)
  })

  test('restores each saved month with its complete row data', () => {
    expect(loadBudget(monthA)).toEqual(rowsA)
    expect(loadBudget(monthB)).toEqual(rowsB)
  })

  test('saves edits to one month without changing the other document', () => {
    const savedB = localStorage.getItem(monthB)
    const editedA = loadBudget(monthA)
    editedA[9] = { item: 'Updated sample A', income: '125', spending: '' }

    saveBudget(editedA, monthA)

    expect(loadBudget(monthA)).toEqual(editedA)
    expect(localStorage.getItem(monthB)).toBe(savedB)
    expect(loadBudget(monthB)).toEqual(rowsB)
  })

  test('returns ten empty rows for an unsaved month without changing saved budgets', () => {
    const savedA = localStorage.getItem(monthA)
    const savedB = localStorage.getItem(monthB)

    expect(loadBudget(monthC)).toEqual(
      Array.from({ length: 10 }, () => ({ item: '', income: '', spending: '' })),
    )
    expect(localStorage.getItem(monthA)).toBe(savedA)
    expect(localStorage.getItem(monthB)).toBe(savedB)
    expect(localStorage.getItem(monthC)).toBeNull()
  })
})

test('uses the same key throughout a local calendar month', () => {
  const expectedKey = 'finance-lab:budget:2026-09'

  expect(currentMonthKey(new Date(2026, 8, 1, 0, 0, 0))).toBe(expectedKey)
  expect(currentMonthKey(new Date(2026, 8, 15, 12, 0, 0))).toBe(expectedKey)
  expect(currentMonthKey(new Date(2026, 8, 30, 23, 59, 59))).toBe(expectedKey)
})

test('distinguishes December from January across a year boundary', () => {
  expect(currentMonthKey(new Date(2026, 11, 31, 23, 59, 59))).toBe(
    'finance-lab:budget:2026-12',
  )
  expect(currentMonthKey(new Date(2027, 0, 1, 0, 0, 0))).toBe(
    'finance-lab:budget:2027-01',
  )
})

test('distinguishes the same month in different years', () => {
  expect(currentMonthKey(new Date(2026, 8, 21))).toBe('finance-lab:budget:2026-09')
  expect(currentMonthKey(new Date(2027, 8, 21))).toBe('finance-lab:budget:2027-09')
})
