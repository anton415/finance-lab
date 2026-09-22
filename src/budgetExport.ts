import type { BudgetRow } from './budgetStorage'

export type BudgetExportFormat = 'csv' | 'json'

export class BudgetExportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BudgetExportError'
  }
}

const rowFields = ['item', 'income', 'spending'] as const
const amountPattern = /^(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/

const isAmount = (value: string) => {
  if (value === '') return true

  // A dollar anchor can match before a final newline; require the complete match.
  return amountPattern.exec(value)?.[0] === value && Number.isFinite(Number(value))
}

export function validateBudgetSource(
  month: unknown,
  rows: unknown,
): { month: string; rows: BudgetRow[] } {
  if (
    typeof month !== 'string' ||
    month.length !== 7 ||
    !/^(?!0000)[0-9]{4}-(?:0[1-9]|1[0-2])$/.test(month)
  ) {
    throw new BudgetExportError(
      'The selected month must use YYYY-MM with a year from 0001 to 9999.',
    )
  }

  if (!Array.isArray(rows) || rows.length !== 10) {
    throw new BudgetExportError('The budget must contain exactly 10 rows.')
  }

  for (const [index, value] of rows.entries()) {
    const location = `Row ${index + 1}`
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new BudgetExportError(`${location} must be an object.`)
    }

    if (
      Reflect.ownKeys(value).length !== rowFields.length ||
      !rowFields.every((field) => Object.hasOwn(value, field))
    ) {
      throw new BudgetExportError(`${location} must contain only item, income, and spending.`)
    }

    for (const field of rowFields) {
      if (typeof value[field] !== 'string') {
        throw new BudgetExportError(`${location} ${field} must be a string.`)
      }
      if (field !== 'item' && !isAmount(value[field])) {
        throw new BudgetExportError(
          `${location} ${field} must be empty or a finite nonnegative amount.`,
        )
      }
    }

    if (value.income !== '' && value.spending !== '') {
      throw new BudgetExportError(`${location} must not contain both income and spending.`)
    }
  }

  return { month, rows: rows as BudgetRow[] }
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
    rowFields.map(quoteCsvField).join(','),
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
