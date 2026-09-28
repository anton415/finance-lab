// Array order is the display/export order; IDs are persisted, labels are not.
export const spendingCategories = ([
  ['groceries', 'Groceries'],
  ['restaurants', 'Restaurants'],
  ['utilities', 'Utilities'],
  ['transport', 'Transport'],
  ['household', 'Household'],
  ['health', 'Health'],
  ['personal-care', 'Personal care'],
  ['clothing', 'Clothing'],
  ['subscriptions', 'Subscriptions'],
  ['education', 'Education'],
  ['tech', 'Tech'],
  ['culture', 'Culture'],
  ['entertainment', 'Entertainment'],
  ['gifts', 'Gifts'],
  ['travel', 'Travel'],
] as const).map(([id, label], order) => ({ id, label, order, type: 'spending' as const }))

export type SpendingCategoryId = typeof spendingCategories[number]['id']
export type MonthlyBudget = {
  income: string
  spending: Record<SpendingCategoryId, string>
  investments: string
}

export const emptyBudget = (): MonthlyBudget => ({
  income: '',
  spending: Object.fromEntries(spendingCategories.map(({ id }) => [id, ''])) as MonthlyBudget['spending'],
  investments: '',
})

const amountPattern = /^(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/
export const isAmount = (value: string) => value === '' || (
  amountPattern.exec(value)?.[0] === value && Number.isFinite(Number(value))
)

export const budgetTotals = (budget: MonthlyBudget) => {
  const amount = (value: string) => isAmount(value) ? Number(value) : 0
  const income = amount(budget.income)
  const spending = spendingCategories.reduce((sum, { id }) => sum + amount(budget.spending[id]), 0)
  const investments = amount(budget.investments)
  return { income, spending, investments, remaining: income - spending - investments }
}
