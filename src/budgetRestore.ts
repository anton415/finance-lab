import { validateBudgetData, type BudgetBackup } from './budgetBackup'
import { currentMonthKey } from './budgetStorage'

// The multi-argument Date constructor remaps years 0–99 to 1900–1999.
export function localBudgetMonth(year: number, monthIndex: number) {
  const month = new Date(0)
  month.setFullYear(year, monthIndex, 1)
  month.setHours(0, 0, 0, 0)
  return month
}

// Complete every fallible preparation step before the final read/write boundary.
export function prepareBudgetRestore(document: BudgetBackup) {
  const source = validateBudgetData(document.month, {
    income: document.income, spending: document.spending, investments: document.investments,
  })
  const month = localBudgetMonth(Number(source.month.slice(0, 4)), Number(source.month.slice(5)) - 1)
  return {
    month,
    data: source.budget,
    key: currentMonthKey(month),
    serializedBudget: JSON.stringify(source.budget),
  }
}
