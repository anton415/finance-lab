import { useLayoutEffect, useRef, useState } from 'react'
import { BudgetBackupError, type BudgetBackup } from './budgetBackup'
import { BudgetBackupFileError, readBudgetBackupFile } from './budgetBackupFile'
import { backupMonthKey, getBudgetPresence, type BudgetRow } from './budgetStorage'
import { prepareBudgetRestore } from './budgetRestore'

type Candidate = { selection: number; document: BudgetBackup }
type BudgetContext = { month: Date; rows: BudgetRow[] }
type Confirmation = { candidate: Candidate; context: BudgetContext; rawValue: string | null }

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

function RestoreConfirmation({ confirmation, onCancel, onConfirm }: {
  confirmation: Confirmation
  onCancel: () => void
  onConfirm: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const month = confirmation.candidate.document.month
  const replacing = confirmation.rawValue !== null

  useLayoutEffect(() => {
    const element = dialog.current!
    element.showModal()
    cancel.current?.focus()
    return () => element.close()
  }, [])

  return (
    <dialog ref={dialog} aria-labelledby="restore-title" aria-describedby="restore-scope" onCancel={(event) => {
      event.preventDefault()
      onCancel()
    }}>
      <h2 id="restore-title">Restore backup for {month}</h2>
      <p id="restore-scope">Restore all 10 rows for {month}, including empty rows. Success will display that month.</p>
      {replacing ? (
        <p>All existing stored data for {month} will be replaced. There is no undo. Keep a JSON backup of current data first.</p>
      ) : (
        <p>No stored budget was found for {month}.</p>
      )}
      <div className="restore-actions">
        <button ref={cancel} type="button" onClick={onCancel}>Cancel</button>
        <button type="button" onClick={onConfirm}>{replacing ? 'Replace' : 'Restore'} month {month}</button>
      </div>
    </dialog>
  )
}

export function BudgetBackupPreview({ budgetContext, onRestored, onRestoreActivity }: {
  budgetContext: BudgetContext
  onRestored: (budget: BudgetContext, month: string) => void
  onRestoreActivity: () => void
}) {
  const [state, setState] = useState<PreviewState>({ status: 'idle' })
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const restoreButton = useRef<HTMLButtonElement>(null)
  const request = useRef(0)
  const candidate = useRef<Candidate | null>(null)
  const activeConfirmation = useRef<Confirmation | null>(null)
  const currentContext = useRef(budgetContext)

  // Discard approval if the displayed budget unexpectedly changes. The preview
  // itself remains independent of ordinary editing and month navigation.
  if (confirmation && confirmation.context !== budgetContext) setConfirmation(null)

  useLayoutEffect(() => () => {
    request.current += 1
    candidate.current = null
    activeConfirmation.current = null
  }, [])

  useLayoutEffect(() => {
    currentContext.current = budgetContext
    activeConfirmation.current = null
  }, [budgetContext])

  const invalidateConfirmation = () => {
    activeConfirmation.current = null
    setConfirmation(null)
  }

  const updatePresence = (presence: ReturnType<typeof getBudgetPresence>) => {
    setState((current) => current.status === 'valid' ? { ...current, presence } : current)
  }

  const selectFile = async (file: File | undefined) => {
    // Dismissing the native picker does not discard a preview or an active read.
    if (!file) return

    const selection = ++request.current
    candidate.current = null
    invalidateConfirmation()
    setRestoreError(null)
    onRestoreActivity()
    setState({ status: 'reading' })
    try {
      const document = await readBudgetBackupFile(file)
      if (selection !== request.current) return

      // The parsed document belongs to this selection and cannot change after
      // preview or approval, even if a later selection has the same filename.
      document.rows.forEach(Object.freeze)
      Object.freeze(document.rows)
      Object.freeze(document)
      candidate.current = { selection, document }
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
    candidate.current = null
    invalidateConfirmation()
    setRestoreError(null)
    onRestoreActivity()
    if (input.current) input.current.value = ''
    setState({ status: 'idle' })
  }

  const beginRestore = () => {
    invalidateConfirmation()
    setRestoreError(null)
    onRestoreActivity()
    const selected = candidate.current
    if (!selected || selected.selection !== request.current) return

    try {
      const rawValue = localStorage.getItem(backupMonthKey(selected.document.month))
      updatePresence(rawValue === null ? 'absent' : 'existing')
      const approval = { candidate: selected, context: budgetContext, rawValue }
      activeConfirmation.current = approval
      setConfirmation(approval)
    } catch {
      updatePresence('unknown')
      setRestoreError('Could not check destination storage. Please try Restore backup… again.')
    }
  }

  const cancelRestore = (approval: Confirmation) => {
    if (activeConfirmation.current !== approval) return
    invalidateConfirmation()
    restoreButton.current?.focus()
  }

  const confirmRestore = (approval: Confirmation) => {
    if (
      activeConfirmation.current !== approval || candidate.current !== approval.candidate ||
      request.current !== approval.candidate.selection || currentContext.current !== approval.context
    ) return

    // Consume before any fallible work. Neither a double activation nor a failed
    // attempt can reuse this approval; every retry needs a fresh confirmation.
    invalidateConfirmation()
    restoreButton.current?.focus()
    const document = approval.candidate.document
    let prepared: ReturnType<typeof prepareBudgetRestore>
    try {
      prepared = prepareBudgetRestore(document)
    } catch {
      setRestoreError('Could not prepare this budget for restoration. Please try again with a fresh confirmation.')
      return
    }

    let rawValue: string | null
    try {
      rawValue = localStorage.getItem(prepared.key)
    } catch {
      updatePresence('unknown')
      setRestoreError('Could not recheck destination storage. No restoration was completed. Please review and confirm again.')
      return
    }
    if (rawValue !== approval.rawValue) {
      updatePresence(rawValue === null ? 'absent' : 'existing')
      setRestoreError('Destination data changed. No restoration was completed. Please review and confirm again.')
      return
    }

    // Synchronous read/check/write is a stale-data check, not a cross-tab lock.
    try {
      localStorage.setItem(prepared.key, prepared.serializedRows)
    } catch {
      setRestoreError('Could not restore this budget. No restoration was completed. Please try again.')
      return
    }

    clearPreview()
    onRestored({ month: prepared.month, rows: prepared.rows }, document.month)
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
        Choosing a file is preview only; no budgets will be changed until final restore confirmation.
        {' '}Choose a UTF-8 JSON file, up to 1 MiB (1,048,576 bytes).
      </p>
      <button type="button" disabled={state.status === 'idle'} onClick={clearPreview}>
        Clear preview
      </button>
      <button ref={restoreButton} type="button" disabled={state.status !== 'valid'} onClick={beginRestore}>
        Restore backup…
      </button>
      <p role="status">
        {state.status === 'reading' && 'Reading and validating backup…'}
        {state.status === 'valid' && 'Valid backup, preview only; nothing has been restored.'}
      </p>
      {state.status === 'error' && <p role="alert">{state.message}</p>}
      {restoreError && <p role="alert">{restoreError}</p>}
      {confirmation && (
        <RestoreConfirmation
          confirmation={confirmation}
          onCancel={() => cancelRestore(confirmation)}
          onConfirm={() => confirmRestore(confirmation)}
        />
      )}
      {state.status === 'valid' && (
        <>
          <p>Backup month: {state.document.month}</p>
          <p>Format version: {state.document.formatVersion}</p>
          <p>{presenceMessages[state.presence]}</p>
          <p>This is the last checked storage snapshot, not approval to overwrite data.</p>
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
