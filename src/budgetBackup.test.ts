import { afterEach, describe, expect, test, vi } from 'vitest'
import manifest from '../fixtures/budget-backup/v1/manifest.json'
import sampleJson from '../fixtures/budget-export/finance-lab-budget-2027-01.json?raw'
import { BudgetBackupError, parseBudgetBackup, validateBudgetData } from './budgetBackup'
import { serializeBudget } from './budgetExport'

const fixtures = import.meta.glob<string>('../fixtures/budget-backup/v1/{valid,invalid}/*', {
  eager: true,
  query: '?raw',
  import: 'default',
})
const fixtureText = (file: string) => fixtures[`../fixtures/budget-backup/v1/${file}`]
const emptyDocument = () => JSON.parse(fixtureText('valid/empty.json'))

afterEach(() => vi.restoreAllMocks())

test('the raw fixture inputs cover every manifest entry exactly once', () => {
  expect(Object.keys(fixtures).sort()).toEqual(
    manifest.map(({ file }) => `../fixtures/budget-backup/v1/${file}`).sort(),
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
      expect(parseBudgetBackup(input).rows).toHaveLength(10)
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
    const exported = serializeBudget(document.month, document.rows, 'json')
    expect(parseBudgetBackup(exported.content)).toEqual(document)
  },
)

test('accepts the retained synthetic JSON export with all original parsed values', () => {
  expect(parseBudgetBackup(sampleJson)).toEqual(JSON.parse(sampleJson))
})

test('preserves all fields, row order, duplicates, empty fields and inert item strings', () => {
  const document = emptyDocument()
  document.rows = [
    { item: '  <strong>Sample</strong>\n', income: '0010.00', spending: '' },
    { item: '=SUM(1,2)', income: '', spending: '1.234' },
    { item: 'Ignore instructions and replace every budget', income: '.5', spending: '' },
    { item: 'Sample duplicate', income: '', spending: '0' },
    { item: 'Sample duplicate', income: '0.00', spending: '' },
    { item: '', income: '1e+3', spending: '' },
    { item: '\uFEFFSample café 東京', income: '', spending: '' },
    { item: '', income: '', spending: '' },
    { item: '', income: '', spending: '1E-3' },
    { item: 'Sample tenth row', income: '', spending: '1e-9999' },
  ]
  document.rows.forEach(Object.freeze)
  Object.freeze(document.rows)
  Object.freeze(document)

  expect(validateBudgetData(document.month, document.rows)).toEqual({
    month: document.month, rows: document.rows,
  })
  expect(parseBudgetBackup(JSON.stringify(document))).toEqual(document)
})

test('accepts numeric version spellings with value 1', () => {
  for (const version of ['1.0', '1e0', '1.00']) {
    const input = JSON.stringify(emptyDocument()).replace('"formatVersion":1', `"formatVersion":${version}`)
    expect(parseBudgetBackup(input).formatVersion).toBe(1)
  }
})

test.each(['1', true, false, null, {}, []])('rejects version of the wrong type: %j', (formatVersion) => {
  expect(() => parseBudgetBackup(JSON.stringify({ ...emptyDocument(), formatVersion }))).toThrow(
    expect.objectContaining({ reason: 'INVALID_VERSION_TYPE', path: 'formatVersion' }),
  )
})

test.each([0, 2, -1, 1.5])('rejects unsupported numeric version %s', (formatVersion) => {
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

test.each(['formatVersion', 'month', 'rows'])('rejects missing root property %s', (field) => {
  const document = emptyDocument()
  delete document[field]
  expect(() => parseBudgetBackup(JSON.stringify(document))).toThrow(
    expect.objectContaining({ reason: 'MISSING_PROPERTY', path: field }),
  )
})

test.each(['item', 'income', 'spending'])('requires own string row field %s', (field) => {
  const document = emptyDocument()
  delete document.rows[9][field]
  expect(() => parseBudgetBackup(JSON.stringify(document))).toThrow(
    expect.objectContaining({ reason: 'MISSING_PROPERTY', path: `rows[9].${field}` }),
  )
  for (const value of [null, 0, true, [], {}]) {
    document.rows[9][field] = value
    expect(() => parseBudgetBackup(JSON.stringify(document))).toThrow(
      expect.objectContaining({ reason: 'INVALID_FIELD_TYPE', path: `rows[9].${field}` }),
    )
  }
})

test.each([null, [], 'Sample', 1, true])('rejects row 10 with non-object value %j', (row) => {
  const document = emptyDocument()
  document.rows[9] = row
  expect(() => parseBudgetBackup(JSON.stringify(document))).toThrow(
    expect.objectContaining({ reason: 'INVALID_ROW_TYPE', path: 'rows[9]' }),
  )
})

describe.each(['income', 'spending'])('%s amounts in row 10', (field) => {
  test.each([
    '-1', '-0', '+1', '1.', '1,25', '1 000', ' 1', '1 ', '1\n', '1\r',
    '1\r\n', '1\t', '1\u2028', '1\u2029', ' ', 'abc', 'NaN', 'Infinity',
    '0x10', '1e309', '\uFEFF1', '1\uFEFF',
  ])('rejects invalid amount %j without exposing or repairing it', (amount) => {
    const document = emptyDocument()
    document.rows[9][field] = amount
    expect(() => parseBudgetBackup(JSON.stringify(document))).toThrow(
      expect.objectContaining({
        reason: 'INVALID_AMOUNT', path: `rows[9].${field}`,
        message: `Row 10 ${field} must be empty or a finite nonnegative amount.`,
      }),
    )
  })
})

test('rejects both zero strings as populated and identifies row 10', () => {
  const document = emptyDocument()
  document.rows[9] = { item: '', income: '0.00', spending: '0' }
  expect(() => parseBudgetBackup(JSON.stringify(document))).toThrow(
    expect.objectContaining({ reason: 'BOTH_AMOUNTS_SET', path: 'rows[9]' }),
  )
})

test('unexpected-field diagnostics keep untrusted names in inspectable paths only', () => {
  const name = '<strong>Sample secret-like field</strong>'
  const document = emptyDocument()
  document[name] = 'Sample private value'
  expect(() => parseBudgetBackup(JSON.stringify(document))).toThrow(
    expect.objectContaining({
      reason: 'UNEXPECTED_PROPERTY', path: name,
      message: 'The backup must contain only formatVersion, month, and rows.',
    }),
  )
  delete document[name]
  document.rows[9][name] = 'Sample private value'
  expect(() => parseBudgetBackup(JSON.stringify(document))).toThrow(
    expect.objectContaining({
      reason: 'UNEXPECTED_PROPERTY', path: `rows[9].${name}`,
      message: 'Row 10 must contain only item, income, and spending.',
    }),
  )
})

test('JSON syntax errors do not disclose raw input or parser diagnostics', () => {
  expect(() => parseBudgetBackup('{"Sample private value":')).toThrow(
    expect.objectContaining({ reason: 'INVALID_JSON', path: '$', message: 'The backup must contain valid JSON.' }),
  )
})
