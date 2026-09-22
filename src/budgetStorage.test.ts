import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  currentMonthKey,
  getBudgetPresence,
  loadBudget,
  saveBudget,
  type BudgetRow,
} from './budgetStorage'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('backup destination presence', () => {
  const key = 'finance-lab:budget:2026-09'

  test.each([
    [
      'all-empty rows',
      JSON.stringify(Array.from({ length: 10 }, () => ({ item: '', income: '', spending: '' }))),
    ],
    [
      'populated rows',
      JSON.stringify(
        Array.from({ length: 10 }, () => ({ item: 'Sample', income: '1', spending: '' })),
      ),
    ],
    ['malformed data', '{invalid'],
    ['an empty stored string', ''],
  ])('reports existing for %s using a single read and no writes', (_name, value) => {
    localStorage.setItem(key, value)
    const read = vi.spyOn(Storage.prototype, 'getItem')
    const write = vi.spyOn(Storage.prototype, 'setItem')
    const remove = vi.spyOn(Storage.prototype, 'removeItem')
    const clear = vi.spyOn(Storage.prototype, 'clear')

    expect(getBudgetPresence('2026-09')).toBe('existing')
    expect(read).toHaveBeenCalledExactlyOnceWith(key)
    expect(write).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
    expect(clear).not.toHaveBeenCalled()
  })

  test('reports absent only for a missing destination key', () => {
    localStorage.setItem('finance-lab:budget:2026-10', 'Other sample budget')
    const read = vi.spyOn(Storage.prototype, 'getItem')

    expect(getBudgetPresence('2026-09')).toBe('absent')
    expect(read).toHaveBeenCalledExactlyOnceWith(key)
  })

  test('reports unknown when the read throws', () => {
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage unavailable')
    })

    expect(getBudgetPresence('2026-09')).toBe('unknown')
    expect(read).toHaveBeenCalledExactlyOnceWith(key)
  })

  test('reports unknown when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined)

    expect(getBudgetPresence('2026-09')).toBe('unknown')
  })

  test('reports unknown when accessing localStorage itself throws', () => {
    vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('Storage access denied')
    })

    expect(getBudgetPresence('2026-09')).toBe('unknown')
  })

  test.each(['0001', '0099'])('uses the existing numeric-year storage key for %s', (year) => {
    const lowYearKey = `finance-lab:budget:${Number(year)}-09`
    localStorage.setItem(lowYearKey, 'Sample stored data')
    const read = vi.spyOn(Storage.prototype, 'getItem')

    expect(getBudgetPresence(`${year}-09`)).toBe('existing')
    expect(read).toHaveBeenCalledExactlyOnceWith(lowYearKey)
  })
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
  // Model local midnight at UTC+03:00 independently of the host timezone.
  const monthStart = Object.assign(new Date('2026-09-01T00:00:00+03:00'), {
    getMonth: () => 8,
    getFullYear: () => 2026,
  })

  expect(monthStart.getUTCMonth()).toBe(7)
  expect(currentMonthKey(monthStart)).toBe(expectedKey)
  expect(currentMonthKey(new Date(2026, 8, 15, 12, 0, 0))).toBe(expectedKey)
  expect(currentMonthKey(new Date(2026, 8, 30, 23, 59, 59))).toBe(expectedKey)
})

test('distinguishes December from January across a year boundary', () => {
  // This local January date is still December of the previous year in UTC.
  const yearStart = Object.assign(new Date('2027-01-01T00:00:00+03:00'), {
    getMonth: () => 0,
    getFullYear: () => 2027,
  })

  expect(yearStart.getUTCMonth()).toBe(11)
  expect(yearStart.getUTCFullYear()).toBe(2026)
  expect(currentMonthKey(new Date(2026, 11, 31, 23, 59, 59))).toBe(
    'finance-lab:budget:2026-12',
  )
  expect(currentMonthKey(yearStart)).toBe('finance-lab:budget:2027-01')
})

test('distinguishes the same month in different years', () => {
  expect(currentMonthKey(new Date(2026, 8, 21))).toBe('finance-lab:budget:2026-09')
  expect(currentMonthKey(new Date(2027, 8, 21))).toBe('finance-lab:budget:2027-09')
})
