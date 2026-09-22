import type { BudgetRow } from './budgetStorage'

export type BudgetBackup = {
  formatVersion: 1
  month: string
  rows: BudgetRow[]
}

type BackupErrorReason =
  | 'INVALID_JSON'
  | 'INVALID_DOCUMENT'
  | 'MISSING_PROPERTY'
  | 'UNEXPECTED_PROPERTY'
  | 'INVALID_VERSION_TYPE'
  | 'UNSUPPORTED_VERSION'
  | 'INVALID_MONTH'
  | 'INVALID_ROWS_TYPE'
  | 'INVALID_ROW_COUNT'
  | 'INVALID_ROW_TYPE'
  | 'INVALID_FIELD_TYPE'
  | 'INVALID_AMOUNT'
  | 'BOTH_AMOUNTS_SET'

export class BudgetBackupError extends Error {
  readonly reason: BackupErrorReason
  readonly path: string

  constructor(reason: BackupErrorReason, path: string, message: string) {
    super(message)
    this.name = 'BudgetBackupError'
    this.reason = reason
    this.path = path
  }
}

export const budgetRowFields = ['item', 'income', 'spending'] as const
const documentFields = ['formatVersion', 'month', 'rows'] as const
const amountPattern = /^(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/

const isAmount = (value: string) => {
  if (value === '') return true

  // A dollar anchor can match before a final newline; require the complete match.
  return amountPattern.exec(value)?.[0] === value && Number.isFinite(Number(value))
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function validateFields(
  value: object,
  fields: readonly string[],
  path: string,
  message: string,
) {
  for (const field of fields) {
    if (!Object.hasOwn(value, field)) {
      throw new BudgetBackupError('MISSING_PROPERTY', `${path}${field}`, message)
    }
  }
  for (const field of Reflect.ownKeys(value)) {
    if (typeof field !== 'string' || !fields.includes(field)) {
      throw new BudgetBackupError('UNEXPECTED_PROPERTY', `${path}${String(field)}`, message)
    }
  }
}

// The exporter and backup parser share the exact source rules and preserve strings.
export function validateBudgetData(
  month: unknown,
  rows: unknown,
): { month: string; rows: BudgetRow[] } {
  if (
    typeof month !== 'string' ||
    month.length !== 7 ||
    !/^(?!0000)[0-9]{4}-(?:0[1-9]|1[0-2])$/.test(month)
  ) {
    throw new BudgetBackupError(
      'INVALID_MONTH',
      'month',
      'The selected month must use YYYY-MM with a year from 0001 to 9999.',
    )
  }

  if (!Array.isArray(rows)) {
    throw new BudgetBackupError('INVALID_ROWS_TYPE', 'rows', 'The budget must contain exactly 10 rows.')
  }
  if (rows.length !== 10) {
    throw new BudgetBackupError('INVALID_ROW_COUNT', 'rows', 'The budget must contain exactly 10 rows.')
  }

  for (const [index, value] of rows.entries()) {
    const location = `Row ${index + 1}`
    const path = `rows[${index}]`
    if (!isObject(value)) {
      throw new BudgetBackupError('INVALID_ROW_TYPE', path, `${location} must be an object.`)
    }

    validateFields(
      value,
      budgetRowFields,
      `${path}.`,
      `${location} must contain only item, income, and spending.`,
    )

    for (const field of budgetRowFields) {
      if (typeof value[field] !== 'string') {
        throw new BudgetBackupError(
          'INVALID_FIELD_TYPE', `${path}.${field}`, `${location} ${field} must be a string.`,
        )
      }
      if (field !== 'item' && !isAmount(value[field])) {
        throw new BudgetBackupError(
          'INVALID_AMOUNT',
          `${path}.${field}`,
          `${location} ${field} must be empty or a finite nonnegative amount.`,
        )
      }
    }

    if (value.income !== '' && value.spending !== '') {
      throw new BudgetBackupError(
        'BOTH_AMOUNTS_SET', path, `${location} must not contain both income and spending.`,
      )
    }
  }

  return { month, rows: rows as BudgetRow[] }
}

export function parseBudgetBackup(text: string): BudgetBackup {
  let document: unknown
  try {
    document = JSON.parse(text)
  } catch {
    throw new BudgetBackupError('INVALID_JSON', '$', 'The backup must contain valid JSON.')
  }

  if (!isObject(document)) {
    throw new BudgetBackupError('INVALID_DOCUMENT', '$', 'The backup must be a JSON object.')
  }
  validateFields(
    document,
    documentFields,
    '',
    'The backup must contain only formatVersion, month, and rows.',
  )
  if (typeof document.formatVersion !== 'number') {
    throw new BudgetBackupError(
      'INVALID_VERSION_TYPE', 'formatVersion', 'The backup formatVersion must be the number 1.',
    )
  }
  if (document.formatVersion !== 1) {
    throw new BudgetBackupError(
      'UNSUPPORTED_VERSION', 'formatVersion', 'This backup version is unsupported. Only version 1 is supported.',
    )
  }

  const source = validateBudgetData(document.month, document.rows)
  return { formatVersion: 1, ...source }
}
