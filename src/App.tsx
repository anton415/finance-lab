import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { currentMonthKey, loadBudget, saveBudget, type BudgetRow } from './budgetStorage'
import { BudgetExportError, serializeBudget, type BudgetExportFormat } from './budgetExport'
import { downloadFile } from './downloadFile'
import { BudgetBackupPreview } from './BudgetBackupPreview'
import { localBudgetMonth } from './budgetRestore'

const amount = (value: string) => {
  const parsedValue = Number(value)
  return value === '' || !Number.isFinite(parsedValue) || parsedValue < 0
    ? 0
    : parsedValue
}

const formatAmount = (value: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: 2 })

function App() {
  const [budget, setBudget] = useState(() => {
    const month = new Date()
    return { month, rows: loadBudget(currentMonthKey(month)) }
  })
  const { month, rows } = budget
  const monthKey = currentMonthKey(month)
  const [exportError, setExportError] = useState<string | null>(null)
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null)
  const restoredBudget = useRef<typeof budget | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    // Restoration has already persisted this exact state. Ordinary edits create
    // a new budget object and must still save, including the first restored edit.
    if (budget === restoredBudget.current) return
    saveBudget(rows, monthKey)
  }, [budget, monthKey, rows])

  useLayoutEffect(() => {
    if (restoreNotice) heading.current?.focus()
  }, [restoreNotice, budget])

  const showRestoredBudget = (nextBudget: typeof budget, backupMonth: string) => {
    restoredBudget.current = nextBudget
    setBudget(nextBudget)
    setExportError(null)
    setRestoreNotice(`Restored budget for ${backupMonth}`)
  }
  const totalIncome = rows.reduce((total, row) => total + amount(row.income), 0)
  const totalSpending = rows.reduce(
    (total, row) => total + amount(row.spending),
    0,
  )

  const changeMonth = (offset: number) => {
    const nextMonth = localBudgetMonth(month.getFullYear(), month.getMonth() + offset)
    setBudget({ month: nextMonth, rows: loadBudget(currentMonthKey(nextMonth)) })
    setExportError(null)
    setRestoreNotice(null)
  }

  const exportBudget = (format: BudgetExportFormat) => {
    try {
      const { month: selectedMonth, rows: selectedRows } = budget
      const year = String(selectedMonth.getFullYear()).padStart(4, '0')
      const monthNumber = String(selectedMonth.getMonth() + 1).padStart(2, '0')
      downloadFile(serializeBudget(`${year}-${monthNumber}`, selectedRows, format))
      setExportError(null)
    } catch (error) {
      setExportError(error instanceof BudgetExportError
        ? error.message
        : 'Could not prepare the download. Please try exporting again.')
    }
  }

  const updateRow = (index: number, field: keyof BudgetRow, value: string) => {
    if ((field === 'income' || field === 'spending') && value.startsWith('-')) {
      return
    }

    setExportError(null)
    setRestoreNotice(null)

    setBudget((currentBudget) => ({
      ...currentBudget,
      rows: currentBudget.rows.map((row, rowIndex) => {
        if (rowIndex !== index) {
          return row
        }

        if (field === 'income') {
          return { ...row, income: value, spending: value === '' ? row.spending : '' }
        }

        if (field === 'spending') {
          return { ...row, spending: value, income: value === '' ? row.income : '' }
        }

        return { ...row, item: value }
      }),
    }))
  }

  return (
    <main className="budget">
      <h1 ref={heading} tabIndex={-1}>Monthly budget</h1>
      {restoreNotice && <p role="status">{restoreNotice}</p>}

      <div className="month-navigation">
        <button type="button" onClick={() => changeMonth(-1)}>Previous month</button>
        <span aria-live="polite">
          {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button type="button" onClick={() => changeMonth(1)}>Next month</button>
      </div>

      <table>
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Income</th>
            <th scope="col">Spending</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td>
                <input
                  aria-label={`Item, row ${index + 1}`}
                  onChange={(event) => updateRow(index, 'item', event.target.value)}
                  value={row.item}
                />
              </td>
              <td>
                <input
                  aria-label={`Income, row ${index + 1}`}
                  inputMode="decimal"
                  min="0"
                  onChange={(event) => updateRow(index, 'income', event.target.value)}
                  step="0.01"
                  type="number"
                  value={row.income}
                />
              </td>
              <td>
                <input
                  aria-label={`Spending, row ${index + 1}`}
                  inputMode="decimal"
                  min="0"
                  onChange={(event) => updateRow(index, 'spending', event.target.value)}
                  step="0.01"
                  type="number"
                  value={row.spending}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="totals">
        <div>
          <dt>Total income</dt>
          <dd>
            <output aria-label="Total income">{formatAmount(totalIncome)}</output>
          </dd>
        </div>
        <div>
          <dt>Total spending</dt>
          <dd>
            <output aria-label="Total spending">{formatAmount(totalSpending)}</output>
          </dd>
        </div>
        <div>
          <dt>Balance</dt>
          <dd>
            <output aria-label="Balance">{formatAmount(totalIncome - totalSpending)}</output>
          </dd>
        </div>
      </dl>

      <details className="budget-tools">
        <summary>Export and backup</summary>
        <div className="budget-export">
          <div className="export-actions">
            <button type="button" aria-describedby="export-help" onClick={() => exportBudget('csv')}>
              Export CSV
            </button>
            <button type="button" aria-describedby="export-help" onClick={() => exportBudget('json')}>
              Export JSON
            </button>
          </div>
          <p id="export-help">
            CSV is for inspection; nonempty item text gets an apostrophe prefix for spreadsheet handling.
            {' '}JSON is a lossless backup.
          </p>
          {exportError && <p role="alert">{exportError}</p>}
        </div>

        <BudgetBackupPreview
          budgetContext={budget}
          onRestored={showRestoredBudget}
          onRestoreActivity={() => setRestoreNotice(null)}
        />
      </details>
    </main>
  )
}

export default App
