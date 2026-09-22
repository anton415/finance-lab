import { useEffect, useRef, useState } from 'react'
import { BudgetBackupError, type BudgetBackup } from './budgetBackup'
import { BudgetBackupFileError, readBudgetBackupFile } from './budgetBackupFile'
import { getBudgetPresence } from './budgetStorage'

type PreviewState =
  | { status: 'idle' }
  | { status: 'reading' }
  | { status: 'error'; message: string }
  | { status: 'valid'; document: BudgetBackup; presence: ReturnType<typeof getBudgetPresence> }

const presenceMessages = {
  existing: 'Stored data already exists for this month; restoration would replace it. Presence does not confirm that the stored data is valid.',
  absent: 'No stored data was found for this month at the time of checking.',
  unknown: 'The backup is valid, but destination storage status could not be checked.',
}

export function BudgetBackupPreview() {
  const [state, setState] = useState<PreviewState>({ status: 'idle' })
  const input = useRef<HTMLInputElement>(null)
  const request = useRef(0)

  useEffect(() => () => { request.current += 1 }, [])

  const selectFile = async (file: File | undefined) => {
    // Dismissing the native picker does not discard a preview or an active read.
    if (!file) return

    const selection = ++request.current
    setState({ status: 'reading' })
    try {
      const document = await readBudgetBackupFile(file)
      if (selection !== request.current) return

      const presence = getBudgetPresence(document.month)
      setState({ status: 'valid', document, presence })
    } catch (error) {
      if (selection !== request.current) return

      setState({
        status: 'error',
        message: error instanceof BudgetBackupError || error instanceof BudgetBackupFileError
          ? error.message
          : 'Could not preview this backup. Please choose the file again to retry.',
      })
      // A failed file can be chosen again without requiring a different filename.
      if (input.current) input.current.value = ''
    }
  }

  const clearPreview = () => {
    request.current += 1
    if (input.current) input.current.value = ''
    setState({ status: 'idle' })
  }

  return (
    <section className="backup-preview" aria-label="Backup preview">
      <label htmlFor="backup-file">Choose JSON backup</label>
      <input
        id="backup-file"
        ref={input}
        type="file"
        accept=".json,application/json"
        aria-describedby="backup-help"
        onChange={(event) => { void selectFile(event.target.files?.[0]) }}
      />
      <p id="backup-help">
        Preview only; no budgets will be changed. Choose a UTF-8 JSON file, up to 1 MiB (1,048,576 bytes).
      </p>
      <button type="button" disabled={state.status === 'idle'} onClick={clearPreview}>
        Clear preview
      </button>
      <p role="status">
        {state.status === 'reading' && 'Reading and validating backup…'}
        {state.status === 'valid' && 'Valid backup, preview only; nothing has been restored.'}
      </p>
      {state.status === 'error' && <p role="alert">{state.message}</p>}
      {state.status === 'valid' && (
        <>
          <p>Backup month: {state.document.month}</p>
          <p>Format version: {state.document.formatVersion}</p>
          <p>{presenceMessages[state.presence]}</p>
          <p>This is a storage snapshot at validation time, not approval to overwrite data.</p>
          <div className="backup-table-scroll">
            <table className="backup-table">
              <caption>Backup preview: 10 rows</caption>
              <thead>
                <tr>
                  <th scope="col">Row</th>
                  <th scope="col">Item</th>
                  <th scope="col">Income</th>
                  <th scope="col">Spending</th>
                </tr>
              </thead>
              <tbody>
                {state.document.rows.map((row, index) => (
                  <tr key={index}>
                    <th scope="row">{index + 1}</th>
                    <td>{row.item}</td>
                    <td>{row.income}</td>
                    <td>{row.spending}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
