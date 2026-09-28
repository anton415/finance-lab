import { isAmount, spendingCategories, type MonthlyBudget } from './budgetModel'

export type BudgetBackup = MonthlyBudget & { formatVersion: 2; month: string }

type BackupErrorReason =
  | 'INVALID_JSON' | 'INVALID_DOCUMENT' | 'MISSING_PROPERTY' | 'UNEXPECTED_PROPERTY'
  | 'INVALID_VERSION_TYPE' | 'UNSUPPORTED_VERSION' | 'INVALID_MONTH'
  | 'INVALID_SPENDING_TYPE' | 'INVALID_FIELD_TYPE' | 'INVALID_AMOUNT'

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

const sourceFields = ['income', 'spending', 'investments'] as const
const documentFields = ['formatVersion', 'month', ...sourceFields] as const
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function validateFields(value: object, fields: readonly string[], path: string, message: string) {
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

function validateAmount(value: unknown, path: string) {
  if (typeof value !== 'string') {
    throw new BudgetBackupError('INVALID_FIELD_TYPE', path, `${path} must be a string.`)
  }
  if (!isAmount(value)) {
    throw new BudgetBackupError('INVALID_AMOUNT', path, `${path} must be empty or a finite nonnegative amount.`)
  }
}

export function validateMonthlyBudget(value: unknown): MonthlyBudget {
  if (!isObject(value)) {
    throw new BudgetBackupError('INVALID_DOCUMENT', '$', 'The budget must be an object.')
  }
  validateFields(value, sourceFields, '', 'The budget must contain only income, spending, and investments.')
  validateAmount(value.income, 'income')
  if (!isObject(value.spending)) {
    throw new BudgetBackupError('INVALID_SPENDING_TYPE', 'spending', 'Spending must be an object.')
  }
  validateFields(value.spending, spendingCategories.map(({ id }) => id), 'spending.',
    'Spending must contain exactly the fifteen supported category IDs.')
  for (const { id } of spendingCategories) validateAmount(value.spending[id], `spending.${id}`)
  validateAmount(value.investments, 'investments')
  return value as MonthlyBudget
}

export function validateBudgetData(month: unknown, budget: unknown) {
  if (typeof month !== 'string' || month.length !== 7 ||
      !/^(?!0000)[0-9]{4}-(?:0[1-9]|1[0-2])$/.test(month)) {
    throw new BudgetBackupError('INVALID_MONTH', 'month',
      'The selected month must use YYYY-MM with a year from 0001 to 9999.')
  }
  return { month, budget: validateMonthlyBudget(budget) }
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
  validateFields(document, documentFields, '',
    'The backup must contain only formatVersion, month, income, spending, and investments.')
  if (typeof document.formatVersion !== 'number') {
    throw new BudgetBackupError('INVALID_VERSION_TYPE', 'formatVersion', 'The backup formatVersion must be the number 2.')
  }
  if (document.formatVersion !== 2) {
    throw new BudgetBackupError('UNSUPPORTED_VERSION', 'formatVersion',
      'This backup version is unsupported. Only version 2 is supported.')
  }
  const { month, budget } = validateBudgetData(document.month, {
    income: document.income, spending: document.spending, investments: document.investments,
  })
  return { formatVersion: 2, month, ...budget }
}
