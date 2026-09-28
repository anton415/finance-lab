import { afterEach, expect, test, vi } from 'vitest'
import representation from '../fixtures/budget-backup/v2/valid/representation.json'
import sampleCsv from '../fixtures/budget-export/finance-lab-budget-2027-01.csv?raw'
import sampleJson from '../fixtures/budget-export/finance-lab-budget-2027-01.json?raw'
import { emptyBudget, spendingCategories } from './budgetModel'
import { BudgetExportError, serializeBudget } from './budgetExport'

const source = { income: representation.income, spending: representation.spending, investments: representation.investments }
afterEach(() => vi.restoreAllMocks())

test('matches independently derived v2 JSON and normalized CSV fixtures exactly', () => {
  expect(serializeBudget(representation.month, source, 'json')).toEqual({
    content: sampleJson, mimeType: 'application/json', filename: 'finance-lab-budget-2027-01.json',
  })
  expect(serializeBudget(representation.month, source, 'csv')).toEqual({
    content: sampleCsv, mimeType: 'text/csv;charset=utf-8', filename: 'finance-lab-budget-2027-01.csv',
  })
})

test('empty CSV includes income, every spending category in order, and investments', () => {
  const csv = serializeBudget('2026-09', emptyBudget(), 'csv').content
  expect(csv.split('\r\n')).toEqual([
    '\uFEFF"Type","Category","Amount"', '"Income","Income",""',
    ...spendingCategories.map(({ label }) => `"Spending","${label}",""`),
    '"Investment","Investments",""', '',
  ])
})

test('serialization preserves frozen strings and has no storage or clock access', () => {
  Object.freeze(source.spending)
  Object.freeze(source)
  const read = vi.spyOn(Storage.prototype, 'getItem')
  const write = vi.spyOn(Storage.prototype, 'setItem')
  const clock = vi.spyOn(Date, 'now')
  const before = JSON.stringify(source)
  for (const format of ['json', 'csv'] as const) {
    expect(serializeBudget('2027-01', source, format)).toEqual(serializeBudget('2027-01', source, format))
  }
  expect(JSON.stringify(source)).toBe(before)
  for (const spy of [read, write, clock]) expect(spy).not.toHaveBeenCalled()
})

test.each(['csv', 'json'] as const)('%s validates sources before projecting values', (format) => {
  for (const income of ['=1+1', '+1', '-1', '@SUM(1,2)', '1\n', '1e309', 'Sample,"injected"\r\n']) {
    expect(() => serializeBudget('2026-09', { ...emptyBudget(), income }, format)).toThrow(BudgetExportError)
  }
  expect(() => serializeBudget('2026-9', emptyBudget(), format)).toThrow(/selected month/)
  expect(() => serializeBudget('2026-09', { ...emptyBudget(), total: '0' }, format)).toThrow(BudgetExportError)
  expect(() => serializeBudget('2026-09', { ...emptyBudget(), spending: {} }, format)).toThrow(BudgetExportError)
  const budget = emptyBudget()
  Object.defineProperty(budget, 'income', { get: () => { throw new TypeError('source unavailable') } })
  expect(() => serializeBudget('2026-09', budget, format)).toThrow(TypeError)
})
