import { parseBudgetBackup } from './budgetBackup'

export const MAX_BACKUP_BYTES = 1_048_576

export class BudgetBackupFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BudgetBackupFileError'
  }
}

export async function readBudgetBackupFile(file: File) {
  if (file.size > MAX_BACKUP_BYTES) {
    throw new BudgetBackupFileError('The file is too large. Choose a backup no larger than 1 MiB (1,048,576 bytes).')
  }
  if (file.size === 0) {
    throw new BudgetBackupFileError('The file is empty. Choose a UTF-8 JSON backup.')
  }

  let bytes: ArrayBuffer
  try {
    bytes = await file.arrayBuffer()
  } catch {
    throw new BudgetBackupFileError('The file could not be read. Please choose it again to retry.')
  }
  let text: string
  try {
    // Preserve the BOM here so exactly one leading BOM can be removed explicitly.
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
  } catch {
    throw new BudgetBackupFileError('The file is not valid UTF-8. Choose a UTF-8 JSON backup.')
  }

  return parseBudgetBackup(text.startsWith('\uFEFF') ? text.slice(1) : text)
}
