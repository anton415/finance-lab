export function totalCalculation(income: number, spending: number, investments: number) {
    return {
        spending: spending,
        investments: investments,
        remaining: income - spending - investments
    };
}