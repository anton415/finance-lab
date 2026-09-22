export type BudgetRow = {
  item: string
  income: string
  spending: string
}

const emptyRows = (): BudgetRow[] =>
  Array.from({ length: 10 }, () => ({ item: '', income: '', spending: '' }))

export const currentMonthKey = (date = new Date()) => {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `finance-lab:budget:${date.getFullYear()}-${month}`
}

// The caller supplies a validated YYYY-MM backup month.
export const getBudgetPresence = (month: string): 'existing' | 'absent' | 'unknown' => {
  const key = `finance-lab:budget:${Number(month.slice(0, 4))}-${month.slice(5)}`
  try {
    return localStorage.getItem(key) === null ? 'absent' : 'existing'
  } catch {
    return 'unknown'
  }
}

const isBudgetRow = (value: unknown): value is BudgetRow => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const row = value as Record<string, unknown>
  return (
    typeof row.item === 'string' &&
    typeof row.income === 'string' &&
    typeof row.spending === 'string'
  )
}

export const loadBudget = (key = currentMonthKey()): BudgetRow[] => {
  try {
    const savedBudget = localStorage.getItem(key)
    if (savedBudget === null) {
      return emptyRows()
    }

    const rows: unknown = JSON.parse(savedBudget)
    return Array.isArray(rows) && rows.length === 10 && rows.every(isBudgetRow)
      ? rows
      : emptyRows()
  } catch {
    return emptyRows()
  }
}

export const saveBudget = (rows: BudgetRow[], key = currentMonthKey()) => {
  try {
    localStorage.setItem(key, JSON.stringify(rows))
  } catch {
    // The budget remains usable when browser storage is unavailable.
  }
}
