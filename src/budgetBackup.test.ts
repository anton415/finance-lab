import { afterEach, describe, expect, test, vi } from 'vitest'
import manifest from '../fixtures/budget-backup/v2/manifest.json'
import sampleJson from '../fixtures/budget-export/finance-lab-budget-2027-01.json?raw'
import { BudgetBackupError, parseBudgetBackup, validateBudgetData } from './budgetBackup'
import { emptyBudget, spendingCategories } from './budgetModel'
import { serializeBudget } from './budgetExport'

const fixtures = import.meta.glob<string>('../fixtures/budget-backup/v2/{valid,invalid}/*', {
  eager: true,
  query: '?raw',
  import: 'default',
})
const fixtureText = (file: string) => fixtures[`../fixtures/budget-backup/v2/${file}`]
const emptyDocument = () => JSON.parse(fixtureText('valid/empty.json'))

afterEach(() => vi.restoreAllMocks())

test('the raw fixture inputs cover every manifest entry exactly once', () => {
  expect(Object.keys(fixtures).sort()).toEqual(
    manifest.map(({ file }) => `../fixtures/budget-backup/v2/${file}`).sort(),
  )
})

describe.each(manifest)('$file', ({ file, valid, reason, path }) => {
  test('matches the shared classification without storage, DOM, network, clock, or log access', () => {
    const input = fixtureText(file)
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem')
    const clear = vi.spyOn(Storage.prototype, 'clear')
    const createElement = vi.spyOn(document, 'createElement')
    const now = vi.spyOn(Date, 'now')
    const fetch = vi.spyOn(globalThis, 'fetch')
    const log = vi.spyOn(console, 'log')
    const errorLog = vi.spyOn(console, 'error')

    if (valid) {
      expect(parseBudgetBackup(input)).toEqual(JSON.parse(input))
      expect(Object.keys(parseBudgetBackup(input).spending)).toHaveLength(15)
    } else {
      expect(() => parseBudgetBackup(input)).toThrow(BudgetBackupError)
      expect(() => parseBudgetBackup(input)).toThrow(expect.objectContaining({ reason, path }))
    }

    for (const spy of [getItem, setItem, removeItem, clear, createElement, now, fetch, log, errorLog]) {
      expect(spy).not.toHaveBeenCalled()
    }
    expect(fixtureText(file)).toBe(input)
  })
})

test.each(manifest.filter(({ valid }) => valid))(
  'preserves fresh JSON export of $file through validation',
  ({ file }) => {
    const document = JSON.parse(fixtureText(file))
    const exported = serializeBudget(document.month, { income: document.income, spending: document.spending, investments: document.investments }, 'json')
    expect(parseBudgetBackup(exported.content)).toEqual(document)
  },
)

test('accepts the retained synthetic JSON export with all original parsed values', () => {
  expect(parseBudgetBackup(sampleJson)).toEqual(JSON.parse(sampleJson))
})

test('accepts numeric version spellings with value 2', () => {
  for (const version of ['2.0', '2e0', '2.00']) {
    const input = JSON.stringify(emptyDocument()).replace('"formatVersion":2', `"formatVersion":${version}`)
    expect(parseBudgetBackup(input).formatVersion).toBe(2)
  }
})

test.each(['1', true, false, null, {}, []])('rejects version of the wrong type: %j', (formatVersion) => {
  expect(() => parseBudgetBackup(JSON.stringify({ ...emptyDocument(), formatVersion }))).toThrow(
    expect.objectContaining({ reason: 'INVALID_VERSION_TYPE', path: 'formatVersion' }),
  )
})

test.each([0, 1, 3, -1, 2.5])('rejects unsupported numeric version %s', (formatVersion) => {
  expect(() => parseBudgetBackup(JSON.stringify({ ...emptyDocument(), formatVersion }))).toThrow(
    expect.objectContaining({ reason: 'UNSUPPORTED_VERSION', path: 'formatVersion' }),
  )
})

test.each(['null', '[]', 'true', '1', '"Sample"'])('rejects non-object root %s', (input) => {
  expect(() => parseBudgetBackup(input)).toThrow(
    expect.objectContaining({ reason: 'INVALID_DOCUMENT', path: '$' }),
  )
})

test.each(['0001-01', '0099-12', '2026-12', '2027-01', '9999-12'])(
  'preserves supported month boundary %s', (month) => {
    expect(parseBudgetBackup(JSON.stringify({ ...emptyDocument(), month })).month).toBe(month)
  },
)

test.each([
  '0000-01', '0001-00', '9999-13', '10000-01', '1-01', '-001-01', '2026-1',
  '2026-01\n', '2026-01\r', '2026-01\u2028', ' 2026-01', '2026-01 ',
  '2026-01-01', '2026-01T00:00:00Z', '２０２６-０１', '', null, 202601,
])('rejects unsupported month %j', (month) => {
  expect(() => parseBudgetBackup(JSON.stringify({ ...emptyDocument(), month }))).toThrow(
    expect.objectContaining({ reason: 'INVALID_MONTH', path: 'month' }),
  )
})

test.each(['formatVersion', 'month', 'income', 'spending', 'investments'])('rejects missing root property %s', (field) => {
  const document = emptyDocument()
  delete document[field]
  expect(() => parseBudgetBackup(JSON.stringify(document))).toThrow(
    expect.objectContaining({ reason: 'MISSING_PROPERTY', path: field }),
  )
})


const amountPaths = ['income', 'investments', ...spendingCategories.map(({ id }) => `spending.${id}`)]
const setAmount = (document: ReturnType<typeof emptyDocument>, path: string, value: unknown) => {
  if (path.startsWith('spending.')) document.spending[path.slice(9)] = value
  else document[path] = value
}

describe.each(amountPaths)('%s', (path) => {
  test.each(['', '0', '0.00', '0010.00', '.5', '1.234', '1e+3', '1E-3', '1e-9999'])(
    'preserves accepted string %j', (amount) => {
      const document = emptyDocument()
      setAmount(document, path, amount)
      expect(parseBudgetBackup(JSON.stringify(document))).toEqual(document)
    },
  )
  test.each(['-1', '-0', '+1', '1.', '1,25', '1 000', ' 1', '1 ', '1\n', '1\r',
    '1\t', '1\u2028', ' ', 'abc', 'NaN', 'Infinity', '0x10', '1e309', '\uFEFF1', '１', '=1+1', '@SUM(1,2)'])(
    'rejects invalid string %j', (amount) => {
      const document = emptyDocument()
      setAmount(document, path, amount)
      expect(() => parseBudgetBackup(JSON.stringify(document))).toThrow(
        expect.objectContaining({ reason: 'INVALID_AMOUNT', path }),
      )
    },
  )
  test.each([null, 0, true, [], {}])('rejects non-string %j', (value) => {
    const document = emptyDocument()
    setAmount(document, path, value)
    expect(() => parseBudgetBackup(JSON.stringify(document))).toThrow(
      expect.objectContaining({ reason: 'INVALID_FIELD_TYPE', path }),
    )
  })
})

test.each(spendingCategories)('requires category $id', ({ id }) => {
  const document = emptyDocument()
  delete document.spending[id]
  expect(() => parseBudgetBackup(JSON.stringify(document))).toThrow(
    expect.objectContaining({ reason: 'MISSING_PROPERTY', path: `spending.${id}` }),
  )
})

test('source validation requires exact own fields without mutating input', () => {
  for (const extra of ['extra', Symbol('extra')]) {
    const budget = emptyBudget()
    Object.defineProperty(budget.spending, extra, { value: '' })
    expect(() => validateBudgetData('2026-09', budget)).toThrow(BudgetBackupError)
  }
  const budget = emptyBudget()
  const inherited = Object.assign(Object.create({ income: '' }), { spending: budget.spending, investments: '' })
  expect(() => validateBudgetData('2026-09', inherited)).toThrow(/only income/)
  Object.freeze(budget.spending)
  Object.freeze(budget)
  expect(validateBudgetData('2026-09', budget)).toEqual({ month: '2026-09', budget })
})

test('diagnostics never include untrusted property names or source text in messages', () => {
  const document = emptyDocument()
  document.spending['Sample private field'] = 'Sample private value'
  expect(() => parseBudgetBackup(JSON.stringify(document))).toThrow(
    expect.objectContaining({ reason: 'UNEXPECTED_PROPERTY', path: 'spending.Sample private field',
      message: 'Spending must contain exactly the fifteen supported category IDs.' }),
  )
  expect(() => parseBudgetBackup('{"Sample private value":')).toThrow(
    expect.objectContaining({ reason: 'INVALID_JSON', path: '$', message: 'The backup must contain valid JSON.' }),
  )
})
