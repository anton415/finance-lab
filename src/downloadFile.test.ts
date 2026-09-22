import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { downloadFile } from './downloadFile'

const createObjectURL = vi.fn<(blob: Blob) => string>()
const revokeObjectURL = vi.fn<(url: string) => void>()

beforeEach(() => {
  vi.useFakeTimers()
  createObjectURL.mockReset().mockReturnValue('blob:synthetic-budget')
  revokeObjectURL.mockReset()
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
})

afterEach(() => {
  vi.runAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test.each([
  { content: '\ufeff"item","income","spending"\r\n', mimeType: 'text/csv;charset=utf-8', filename: 'finance-lab-budget-2026-09.csv' },
  { content: '{"formatVersion":1}\n', mimeType: 'application/json', filename: 'finance-lab-budget-2026-09.json' },
])('requests $filename with its exact content and MIME, then releases resources', async (file) => {
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.isConnected).toBe(true)
    expect(this.getAttribute('href')).toBe('blob:synthetic-budget')
    expect(this.download).toBe(file.filename)
    expect(revokeObjectURL).not.toHaveBeenCalled()
  })

  downloadFile(file)

  expect(click).toHaveBeenCalledOnce()
  expect((click.mock.contexts[0] as HTMLAnchorElement).isConnected).toBe(false)
  const blob = createObjectURL.mock.calls[0][0]
  expect(blob.type).toBe(file.mimeType)
  expect(Array.from(new Uint8Array(await blob.arrayBuffer())))
    .toEqual(Array.from(new TextEncoder().encode(file.content)))
  expect(revokeObjectURL).not.toHaveBeenCalled()
  vi.advanceTimersByTime(1000)
  expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:synthetic-budget')
})

test('repeated exports remove every link and release every object URL', () => {
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  const linksBefore = document.querySelectorAll('a').length
  for (let index = 0; index < 5; index += 1) {
    createObjectURL.mockReturnValueOnce(`blob:sample-${index}`)
    downloadFile({ content: 'sample', mimeType: 'application/json', filename: 'sample.json' })
  }

  expect(document.querySelectorAll('a')).toHaveLength(linksBefore)
  vi.advanceTimersByTime(1000)
  expect(revokeObjectURL.mock.calls).toEqual(
    Array.from({ length: 5 }, (_, index) => [`blob:sample-${index}`]),
  )
  expect(vi.getTimerCount()).toBe(0)
})

test.each(['create', 'append', 'click'] as const)('cleans up if link %s fails and propagates the failure', (stage) => {
  const failure = new Error('Synthetic setup failure')
  const linksBefore = document.querySelectorAll('a').length
  if (stage === 'create') {
    vi.spyOn(document, 'createElement').mockImplementation(() => { throw failure })
  } else if (stage === 'append') {
    vi.spyOn(document.body, 'append').mockImplementation(() => { throw failure })
  } else {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { throw failure })
  }

  expect(() => downloadFile({ content: 'sample', mimeType: 'application/json', filename: 'sample.json' }))
    .toThrow(failure)
  expect(document.querySelectorAll('a')).toHaveLength(linksBefore)
  expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:synthetic-budget')
  expect(vi.getTimerCount()).toBe(0)
})

test('propagates object URL setup failure without retaining links or timers', () => {
  createObjectURL.mockImplementation(() => { throw new Error('Synthetic URL failure') })
  const linksBefore = document.querySelectorAll('a').length

  expect(() => downloadFile({ content: 'sample', mimeType: 'application/json', filename: 'sample.json' }))
    .toThrow('Synthetic URL failure')
  expect(document.querySelectorAll('a')).toHaveLength(linksBefore)
  expect(revokeObjectURL).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})
