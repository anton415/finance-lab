import { useEffect, useState } from 'react'
import { currentMonthKey, loadBudget, saveBudget, type BudgetRow } from './budgetStorage'

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

  useEffect(() => {
    saveBudget(rows, monthKey)
  }, [monthKey, rows])
  const totalIncome = rows.reduce((total, row) => total + amount(row.income), 0)
  const totalSpending = rows.reduce(
    (total, row) => total + amount(row.spending),
    0,
  )

  const changeMonth = (offset: number) => {
    const nextMonth = new Date(month.getFullYear(), month.getMonth() + offset, 1)
    setBudget({ month: nextMonth, rows: loadBudget(currentMonthKey(nextMonth)) })
  }

  const updateRow = (index: number, field: keyof BudgetRow, value: string) => {
    if ((field === 'income' || field === 'spending') && value.startsWith('-')) {
      return
    }

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
      <h1>Monthly budget</h1>

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
    </main>
  )
}

export default App
