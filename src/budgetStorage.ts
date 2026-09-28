import { emptyBudget, type MonthlyBudget } from './budgetModel'
import { validateMonthlyBudget } from './budgetBackup'

export const currentMonthKey = (date = new Date()) => {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `finance-lab:budget:${date.getFullYear()}-${month}`
}

// The caller supplies a validated YYYY-MM backup month.
export const backupMonthKey = (month: string) =>
  `finance-lab:budget:${Number(month.slice(0, 4))}-${month.slice(5)}`

export const getBudgetPresence = (month: string): 'existing' | 'absent' | 'unknown' => {
  try {
    return localStorage.getItem(backupMonthKey(month)) === null ? 'absent' : 'existing'
  } catch {
    return 'unknown'
  }
}

export const loadBudget = (key = currentMonthKey()): MonthlyBudget => {
  try {
    const saved = localStorage.getItem(key)
    return saved === null ? emptyBudget() : validateMonthlyBudget(JSON.parse(saved))
  } catch {
    return emptyBudget()
  }
}

export const saveBudget = (budget: MonthlyBudget, key = currentMonthKey()) => {
  try {
    // Incomplete amount edits stay in the UI; only valid source data is saved.
    validateMonthlyBudget(budget)
    localStorage.setItem(key, JSON.stringify(budget))
  } catch {
    // The budget remains usable when browser storage is unavailable.
  }
}
