import { spendingCategories } from './budgetModel'
import { BudgetBackupError, validateBudgetData } from './budgetBackup'

export type BudgetExportFormat = 'csv' | 'json'

export class BudgetExportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BudgetExportError'
  }
}

export function validateBudgetSource(month: unknown, budget: unknown) {
  try {
    return validateBudgetData(month, budget)
  } catch (error) {
    if (error instanceof BudgetBackupError) throw new BudgetExportError(error.message)
    throw error
  }
}

const quoteCsvField = (value: string) => `"${value.replaceAll('"', '""')}"`

export function serializeBudget(month: string, data: unknown, format: BudgetExportFormat) {
  const { month: selectedMonth, budget } = validateBudgetSource(month, data)
  const filename = `finance-lab-budget-${selectedMonth}.${format}`
  const spending = Object.fromEntries(spendingCategories.map(({ id }) => [id, budget.spending[id]]))

  if (format === 'json') {
    const document = {
      formatVersion: 2, month: selectedMonth,
      income: budget.income, spending, investments: budget.investments,
    }
    return { content: `${JSON.stringify(document, null, 2)}\n`, mimeType: 'application/json', filename }
  }

  // Labels/types are fixed trusted text; amounts pass the complete numeric rule.
  // There is no free-form text that could become a spreadsheet formula.
  const records = [
    ['Type', 'Category', 'Amount'],
    ['Income', 'Income', budget.income],
    ...spendingCategories.map(({ id, label }) => ['Spending', label, budget.spending[id]]),
    ['Investment', 'Investments', budget.investments],
  ].map((record) => record.map(quoteCsvField).join(','))
  return {
    content: `\uFEFF${records.join('\r\n')}\r\n`,
    mimeType: 'text/csv;charset=utf-8', filename,
  }
}
