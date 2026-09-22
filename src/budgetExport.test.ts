import { describe, expect, test, vi } from 'vitest'
import empty from '../fixtures/budget-backup/v1/valid/empty.json'
import mixed from '../fixtures/budget-backup/v1/valid/mixed.json'
import representation from '../fixtures/budget-backup/v1/valid/representation.json'
import manifest from '../fixtures/budget-backup/v1/manifest.json'
import sampleCsv from '../fixtures/budget-export/finance-lab-budget-2027-01.csv?raw'
import sampleJson from '../fixtures/budget-export/finance-lab-budget-2027-01.json?raw'
import { BudgetExportError, serializeBudget, validateBudgetSource } from './budgetExport'

const emptyRows = () => Array.from({ length: 10 }, () => ({ item: '', income: '', spending: '' }))
const csvHeader = '\uFEFF"item","income","spending"\r\n'
const emptyCsvRow = '"","",""\r\n'

const validFixtures = [
  {
    name: 'empty',
    document: empty,
    csv: csvHeader + emptyCsvRow.repeat(10),
  },
  {
    name: 'mixed',
    document: mixed,
    csv: csvHeader + [
      '"\'Sample income","100.00",""',
      '"\'Sample groceries","","25.50"',
      '"\'  Sample ""quoted"", café  ","","7.25"',
      '"\'Sample zero","0",""',
      '"\'Sample note","",""',
      '"","",""',
      '"","",""',
      '"","",""',
      '"","",""',
      '"\'Sample last row","","2.00"',
      '',
    ].join('\r\n'),
  },
  {
    name: 'representation',
    document: representation,
    csv: csvHeader + [
      '"","0010.00",""',
      '"\'Sample representation","","0.00"',
      '"\'Sample representation",".5",""',
      '"\'Sample precision","","1.234"',
      '"\'Sample exponent","1e3",""',
      '"\'Sample small exponent","","1E-3"',
      '"\'Sample explicit exponent","1e+3",""',
      '"\'Sample café\nSample строка","","100"',
      '"\'Sample zero","0",""',
      '"","",""',
      '',
    ].join('\r\n'),
  },
]

describe.each(validFixtures)('$name shared fixture', ({ document, csv }) => {
  test('exports exactly the versioned JSON document with original strings', () => {
    const result = serializeBudget(document.month, document.rows, 'json')

    expect(JSON.parse(result.content)).toEqual(document)
    expect(result.content).toBe(`${JSON.stringify(document, null, 2)}\n`)
    expect(result.mimeType).toBe('application/json')
    expect(result.filename).toBe(`finance-lab-budget-${document.month}.json`)
    expect(result.content.startsWith('\uFEFF')).toBe(false)
  })

  test('exports the exact ten-record CSV with its specified item transformation', () => {
    const result = serializeBudget(document.month, document.rows, 'csv')

    expect(result).toEqual({
      content: csv,
      mimeType: 'text/csv;charset=utf-8',
      filename: `finance-lab-budget-${document.month}.csv`,
    })
    expect(result.content.match(/\uFEFF/g)).toHaveLength(1)
  })
})

test('matches the independently derived retained CSV and JSON samples exactly', () => {
  expect(serializeBudget(representation.month, representation.rows, 'csv').content).toBe(sampleCsv)
  expect(serializeBudget(representation.month, representation.rows, 'json').content).toBe(sampleJson)
})

test.each([
  ['', '""'],
  ['Sample text', '"\'Sample text"'],
  ['=1+1', '"\'=1+1"'],
  ['+1+1', '"\'+1+1"'],
  ['-1+1', '"\'-1+1"'],
  ['@SUM(1,1)', '"\'@SUM(1,1)"'],
  ['  =1+1', '"\'  =1+1"'],
  ['\t=1+1', '"\'\t=1+1"'],
  ['\r=1+1', '"\'\r=1+1"'],
  ['\n=1+1', '"\'\n=1+1"'],
  ['＝1+1', '"\'＝1+1"'],
  ['＋1+1', '"\'＋1+1"'],
  ['－1+1', '"\'－1+1"'],
  ['＠SUM(1,1)', '"\'＠SUM(1,1)"'],
  ["'Sample text", '"\'\'Sample text"'],
  ['Sample, "quoted"; café', '"\'Sample, ""quoted""; café"'],
  ['Sample\r\nline\rnext\nlast', '"\'Sample\r\nline\rnext\nlast"'],
  ['Sample","1","2"\r\nSample', '"\'Sample"",""1"",""2""\r\nSample"'],
])('prefixes and escapes the original item %j without adding cells or records', (item, cell) => {
  const rows = emptyRows()
  rows[0].item = item

  expect(serializeBudget('2026-09', rows, 'csv').content).toBe(
    csvHeader + `${cell},"",""\r\n` + emptyCsvRow.repeat(9),
  )
  expect(JSON.parse(serializeBudget('2026-09', rows, 'json').content).rows[0].item).toBe(item)
})

test('repeated CSV exports and a later JSON export preserve the original frozen source', () => {
  const rows = representation.rows.map((row) => Object.freeze({ ...row }))
  Object.freeze(rows)
  const before = JSON.stringify(rows)

  const first = serializeBudget(representation.month, rows, 'csv')
  const second = serializeBudget(representation.month, rows, 'csv')
  const json = serializeBudget(representation.month, rows, 'json')

  expect(second).toEqual(first)
  expect(JSON.parse(json.content)).toEqual(representation)
  expect(JSON.stringify(rows)).toBe(before)
})

test('serialization and source validation do not access storage or the clock', () => {
  const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Storage unavailable')
  })
  const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Storage unavailable')
  })
  const removeItem = vi.spyOn(Storage.prototype, 'removeItem')
  const dateNow = vi.spyOn(Date, 'now').mockImplementation(() => {
    throw new Error('Clock unavailable')
  })

  try {
    expect(validateBudgetSource(mixed.month, mixed.rows)).toEqual({
      month: mixed.month,
      rows: mixed.rows,
    })
    for (const format of ['csv', 'json'] as const) {
      expect(serializeBudget(mixed.month, mixed.rows, format).content).not.toBe('')
    }
    expect(getItem).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
    expect(removeItem).not.toHaveBeenCalled()
    expect(dateNow).not.toHaveBeenCalled()
  } finally {
    vi.restoreAllMocks()
  }
})

const invalidFixtures = import.meta.glob<{ month: string; rows: unknown }>(
  '../fixtures/budget-backup/v1/invalid/*.json',
  { eager: true, import: 'default' },
)
const invalidSourceCases = manifest.filter(
  ({ valid, path }) => !valid && (path === 'month' || path?.startsWith('rows')),
)

describe.each(['csv', 'json'] as const)('%s source guard', (format) => {
  test('propagates unexpected source-access failures without reporting a contract error', () => {
    const failure = new TypeError('Sample source access failure')
    const rows = emptyRows()
    Object.defineProperty(rows[0], 'item', { get: () => { throw failure } })
    let caught: unknown

    try {
      serializeBudget('2026-09', rows, format)
    } catch (error) {
      caught = error
    }

    expect(caught).toBe(failure)
    expect(caught).not.toBeInstanceOf(BudgetExportError)
  })

  test.each(invalidSourceCases)('rejects shared fixture $file without altering it', ({ file, path }) => {
    const document = invalidFixtures[`../fixtures/budget-backup/v1/${file}`]
    const before = JSON.stringify(document)

    expect(() => serializeBudget(document.month, document.rows, format)).toThrow(BudgetExportError)
    expect(() => serializeBudget(document.month, document.rows, format)).toThrow(
      path?.startsWith('rows[0]') ? /Row 1/ : path === 'month' ? /month/ : /10 rows/,
    )
    expect(JSON.stringify(document)).toBe(before)
  })

  test.each([
    '0000-01', '2026-00', '2026-13', '2026-9', '10000-01', '-001-01',
    '2026-09\n', '2026-09\r', ' 2026-09', '2026-09 ', '2026-09-01',
    '2026-09T00:00:00Z', '２０２６-０９',
  ])('rejects invalid selected month %j', (month) => {
    expect(() => serializeBudget(month, emptyRows(), format)).toThrow(/selected month/)
  })

  test.each(['0001-01', '0099-12', '2026-12', '2027-01', '9999-12'])(
    'accepts supported local-calendar month %s',
    (month) => {
      expect(serializeBudget(month, emptyRows(), format).filename).toBe(
        `finance-lab-budget-${month}.${format}`,
      )
    },
  )

  test.each([
    '-1', '-0', '+1', '1.', '1,25', '1 000', ' 1', '1 ', '1\n', '1\r',
    '1\r\n', '1\t', '1\u2028', '1\u2029', ' ', 'abc', 'NaN', 'Infinity',
    '0x10', '1e309',
  ])('rejects unsupported amount %j without repairing it', (amount) => {
    const rows = emptyRows()
    rows[0].income = amount
    const before = JSON.stringify(rows)

    expect(() => serializeBudget('2026-09', rows, format)).toThrow(/Row 1 income/)
    expect(JSON.stringify(rows)).toBe(before)
  })

  test('validates spending amounts and populated zero exclusivity too', () => {
    const rows = emptyRows()
    rows[9].spending = '1\n'
    expect(() => serializeBudget('2026-09', rows, format)).toThrow(/Row 10 spending/)

    rows[9] = { item: '', income: '0.00', spending: '0' }
    expect(() => serializeBudget('2026-09', rows, format)).toThrow(/Row 10.*both/)
  })

  test('rejects sparse rows and array-valued rows', () => {
    const rows = emptyRows()
    delete rows[0]
    expect(() => serializeBudget('2026-09', rows, format)).toThrow(/Row 1.*object/)

    const arrayRow = Object.assign([], { item: '', income: '', spending: '' })
    expect(() => serializeBudget('2026-09', [arrayRow, ...emptyRows().slice(1)], format)).toThrow(
      /Row 1.*object/,
    )
  })

  test('requires exact own row fields before projecting any values', () => {
    const inheritedRow = Object.assign(Object.create({ item: 'Sample' }), {
      income: '', spending: '', extra: '',
    })
    const hiddenExtra = Object.defineProperty({ ...mixed.rows[0] }, 'extra', { value: 'Sample' })
    const symbolExtra = { ...mixed.rows[0], [Symbol('extra')]: 'Sample' }

    for (const row of [inheritedRow, hiddenExtra, symbolExtra]) {
      const rows = [row, ...emptyRows().slice(1)]
      const properties = Reflect.ownKeys(row)
      expect(() => serializeBudget('2026-09', rows, format)).toThrow(/Row 1.*only/)
      expect(Reflect.ownKeys(row)).toEqual(properties)
    }
  })
})
