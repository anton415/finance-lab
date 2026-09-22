import type { BudgetRow } from './budgetStorage'
import { BudgetBackupError, budgetRowFields, validateBudgetData } from './budgetBackup'

export type BudgetExportFormat = 'csv' | 'json'

export class BudgetExportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BudgetExportError'
  }
}

export function validateBudgetSource(
  month: unknown,
  rows: unknown,
): { month: string; rows: BudgetRow[] } {
  try {
    return validateBudgetData(month, rows)
  } catch (error) {
    if (error instanceof BudgetBackupError) throw new BudgetExportError(error.message)
    throw error
  }
}

const quoteCsvField = (value: string) => `"${value.replaceAll('"', '""')}"`

export function serializeBudget(month: string, rows: unknown, format: BudgetExportFormat) {
  const source = validateBudgetSource(month, rows)
  const filename = `finance-lab-budget-${source.month}.${format}`

  if (format === 'json') {
    const document = {
      formatVersion: 1,
      month: source.month,
      rows: source.rows.map(({ item, income, spending }) => ({ item, income, spending })),
    }
    return {
      content: `${JSON.stringify(document, null, 2)}\n`,
      mimeType: 'application/json',
      filename,
    }
  }

  const records = [
    budgetRowFields.map(quoteCsvField).join(','),
    ...source.rows.map(({ item, income, spending }) =>
      [item === '' ? '' : `'${item}`, income, spending].map(quoteCsvField).join(','),
    ),
  ]

  return {
    content: `\uFEFF${records.join('\r\n')}\r\n`,
    mimeType: 'text/csv;charset=utf-8',
    filename,
  }
}
