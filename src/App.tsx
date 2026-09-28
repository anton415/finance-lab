import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { currentMonthKey, loadBudget, saveBudget } from './budgetStorage'
import { BudgetExportError, serializeBudget, type BudgetExportFormat } from './budgetExport'
import { downloadFile } from './downloadFile'
import { BudgetBackupPreview } from './BudgetBackupPreview'
import { localBudgetMonth } from './budgetRestore'
import { budgetTotals, isAmount, spendingCategories, type SpendingCategoryId } from './budgetModel'

const formatAmount = (value: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: 2 })

function App() {
  const [budget, setBudget] = useState(() => {
    const month = new Date()
    return { month, data: loadBudget(currentMonthKey(month)) }
  })
  const { month, data } = budget
  const monthKey = currentMonthKey(month)
  const [exportError, setExportError] = useState<string | null>(null)
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null)
  const restoredBudget = useRef<typeof budget | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    // Restoration has already persisted this exact state. Ordinary edits create
    // a new budget object and must still save, including the first restored edit.
    if (budget === restoredBudget.current) return
    saveBudget(data, monthKey)
  }, [budget, monthKey, data])

  useLayoutEffect(() => {
    if (restoreNotice) heading.current?.focus()
  }, [restoreNotice, budget])

  const showRestoredBudget = (nextBudget: typeof budget, backupMonth: string) => {
    restoredBudget.current = nextBudget
    setBudget(nextBudget)
    setExportError(null)
    setRestoreNotice(`Restored budget for ${backupMonth}`)
  }
  const totals = budgetTotals(data)

  const changeMonth = (offset: number) => {
    const nextMonth = localBudgetMonth(month.getFullYear(), month.getMonth() + offset)
    setBudget({ month: nextMonth, data: loadBudget(currentMonthKey(nextMonth)) })
    setExportError(null)
    setRestoreNotice(null)
  }

  const exportBudget = (format: BudgetExportFormat) => {
    try {
      const { month: selectedMonth, data: selectedData } = budget
      const year = String(selectedMonth.getFullYear()).padStart(4, '0')
      const monthNumber = String(selectedMonth.getMonth() + 1).padStart(2, '0')
      downloadFile(serializeBudget(`${year}-${monthNumber}`, selectedData, format))
      setExportError(null)
    } catch (error) {
      setExportError(error instanceof BudgetExportError
        ? error.message
        : 'Could not prepare the download. Please try exporting again.')
    }
  }

  const updateAmount = (field: 'income' | 'investments' | SpendingCategoryId, value: string) => {
    setExportError(null)
    setRestoreNotice(null)
    setBudget((current) => ({
      ...current,
      data: field === 'income' || field === 'investments'
        ? { ...current.data, [field]: value }
        : { ...current.data, spending: { ...current.data.spending, [field]: value } },
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

      <section className="budget-section" aria-labelledby="income-heading">
        <h2 id="income-heading">Monthly income</h2>
        <AmountInput id="income" label="Monthly income" value={data.income} onChange={(value) => updateAmount('income', value)} />
      </section>

      <section className="budget-section" aria-labelledby="spending-heading">
        <h2 id="spending-heading">Spending</h2>
        {spendingCategories.map(({ id, label }) => (
          <AmountInput key={id} id={id} label={label} value={data.spending[id]} onChange={(value) => updateAmount(id, value)} />
        ))}
      </section>

      <section className="budget-section" aria-labelledby="investments-heading">
        <h2 id="investments-heading">Investments</h2>
        <AmountInput id="investments" label="Investments" value={data.investments} onChange={(value) => updateAmount('investments', value)} />
      </section>

      <section aria-labelledby="summary-heading">
        <h2 id="summary-heading">Summary</h2>
        <dl className="totals">
          {(['income', 'spending', 'investments', 'remaining'] as const).map((field) => {
            const label = field[0].toUpperCase() + field.slice(1)
            return <div key={field}>
              <dt>{label}</dt>
              <dd><output aria-label={label}>{formatAmount(totals[field])}</output></dd>
            </div>
          })}
        </dl>
      </section>

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
            CSV is for inspection. JSON v2 is a lossless backup.
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

function AmountInput({ id, label, value, onChange }: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const invalid = !isAmount(value)
  return (
    <div className="amount-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} inputMode="decimal" value={value}
        aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)} />
      {invalid && <p id={`${id}-error`} className="amount-error" role="alert">
        Enter a nonnegative number or leave empty. This edit is not saved yet.
      </p>}
    </div>
  )
}

export default App
