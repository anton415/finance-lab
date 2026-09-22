import { describe, expect, test, vi } from 'vitest'
import emptyText from '../fixtures/budget-backup/v1/valid/empty.json?raw'
import representationText from '../fixtures/budget-backup/v1/valid/representation.json?raw'
import { BudgetBackupError } from './budgetBackup'
import { BudgetBackupFileError, MAX_BACKUP_BYTES, readBudgetBackupFile } from './budgetBackupFile'

const encoder = new TextEncoder()
const fileFromBytes = (bytes: Uint8Array<ArrayBuffer>, name = 'sample.json', type = 'application/json') => {
  const file = new File([bytes], name, { type })
  // jsdom lacks Blob.arrayBuffer; only this native read boundary is substituted.
  const read = vi.fn().mockResolvedValue(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
  Object.defineProperty(file, 'arrayBuffer', { value: read })
  return { file, read }
}
const fileFromText = (text: string, name?: string, type?: string) =>
  fileFromBytes(encoder.encode(text), name, type)

test('rejects zero-byte input before reading', async () => {
  const { file, read } = fileFromText('')
  await expect(readBudgetBackupFile(file)).rejects.toThrow(BudgetBackupFileError)
  await expect(readBudgetBackupFile(file)).rejects.toThrow(/empty/)
  expect(read).not.toHaveBeenCalled()
})

test('rejects whitespace-only text as JSON syntax rather than an empty file', async () => {
  const { file } = fileFromText(' \t\r\n')
  await expect(readBudgetBackupFile(file)).rejects.toThrow(
    expect.objectContaining({ name: 'BudgetBackupError', reason: 'INVALID_JSON', path: '$' }),
  )
})

test('reads and preserves a valid multibyte document exactly at the inclusive byte cap', async () => {
  const document = JSON.parse(emptyText)
  document.rows[0].item = 'Sample café 東京🙂'
  const prefix = JSON.stringify(document)
  const text = prefix + ' '.repeat(MAX_BACKUP_BYTES - encoder.encode(prefix).byteLength)
  const { file, read } = fileFromText(text)

  expect(file.size).toBe(1_048_576)
  expect(text.length).toBeLessThan(MAX_BACKUP_BYTES)
  await expect(readBudgetBackupFile(file)).resolves.toEqual(document)
  expect(read).toHaveBeenCalledOnce()
})

test('rejects cap + 1 bytes before reading even when text length is below the cap', async () => {
  const document = JSON.parse(emptyText)
  document.rows[0].item = 'Sample café 東京🙂'
  const prefix = JSON.stringify(document)
  const text = prefix + ' '.repeat(MAX_BACKUP_BYTES + 1 - encoder.encode(prefix).byteLength)
  const { file, read } = fileFromText(text)

  expect(file.size).toBe(MAX_BACKUP_BYTES + 1)
  expect(text.length).toBeLessThan(MAX_BACKUP_BYTES)
  await expect(readBudgetBackupFile(file)).rejects.toThrow(/too large.*1 MiB/)
  expect(read).not.toHaveBeenCalled()
})

test('decodes ordinary UTF-8 with no normalization or replacement', async () => {
  const { file } = fileFromText(representationText)
  await expect(readBudgetBackupFile(file)).resolves.toEqual(JSON.parse(representationText))
})

test('tolerates exactly one initial BOM and preserves BOM characters inside item strings', async () => {
  const document = JSON.parse(emptyText)
  document.rows[0].item = '\uFEFFSample\uFEFFtext\uFEFF'
  const text = JSON.stringify(document)
  const { file } = fileFromText(`\uFEFF${text}`)

  expect(file.size).toBe(encoder.encode(text).byteLength + 3)
  await expect(readBudgetBackupFile(file)).resolves.toEqual(document)
  await expect(readBudgetBackupFile(fileFromText(`\uFEFF\uFEFF${text}`).file)).rejects.toThrow(BudgetBackupError)
  await expect(readBudgetBackupFile(fileFromText(` \uFEFF${text}`).file)).rejects.toThrow(BudgetBackupError)
})

test.each([
  [0xff],
  [0xc3, 0x28],
  [0xe2, 0x82],
  [0xed, 0xa0, 0x80],
  [0xc0, 0xaf],
])('rejects malformed UTF-8 bytes %j without replacement', async (...invalidBytes) => {
  const prefix = encoder.encode('{"item":"')
  const suffix = encoder.encode('"}')
  const bytes = new Uint8Array([...prefix, ...invalidBytes, ...suffix])
  const { file } = fileFromBytes(bytes)
  await expect(readBudgetBackupFile(file)).rejects.toThrow(
    expect.objectContaining({
      name: 'BudgetBackupFileError', message: 'The file is not valid UTF-8. Choose a UTF-8 JSON backup.',
    }),
  )
})

describe.each([
  ['sample.bin', 'application/octet-stream'],
  ['finance-lab-budget-0001-01.txt', ''],
  ['sample.json', 'text/csv'],
])('content validation for name %s and MIME %s', (name, type) => {
  test('accepts the complete document and keeps the month from its contents', async () => {
    const { file } = fileFromText(representationText, name, type)
    const result = await readBudgetBackupFile(file)
    expect(result).toEqual(JSON.parse(representationText))
    expect(result.month).toBe('2027-01')
  })
})

test('a JSON filename and MIME cannot make invalid content valid', async () => {
  const { file } = fileFromText('Sample invalid input', 'sample.json', 'application/json')
  await expect(readBudgetBackupFile(file)).rejects.toThrow(BudgetBackupError)
})

test('read rejection has a retryable error distinct from decoding and parsing', async () => {
  const { file, read } = fileFromText(emptyText)
  read.mockRejectedValueOnce(new Error('Sample raw browser error'))

  await expect(readBudgetBackupFile(file)).rejects.toThrow(
    expect.objectContaining({
      name: 'BudgetBackupFileError', message: 'The file could not be read. Please choose it again to retry.',
    }),
  )
  await expect(readBudgetBackupFile(file)).resolves.toEqual(JSON.parse(emptyText))
})

test('a synchronous read failure also produces the safe file-read error', async () => {
  const { file, read } = fileFromText(emptyText)
  read.mockImplementation(() => { throw new Error('Sample raw browser error') })
  await expect(readBudgetBackupFile(file)).rejects.toThrow(/could not be read.*retry/)
})
