import { expect, test } from 'vitest'
import { totalCalculation } from './budgetTotals'

test('keeps investments separate from spending', () => {
    const income = 300000;
    const spending = 120000;
    const investments = 80000;
    
    const result = totalCalculation(income, spending, investments);

    expect(result.spending).toBe(spending);
    expect(result.investments).toBe(investments);
    expect(result.remaining).toBe(100000);
})