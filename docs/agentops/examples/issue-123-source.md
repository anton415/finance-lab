## Outcome
PUT /api/budgets/{month} rejects invalid input with 400 and exactly {"code":"INVALID_REQUEST"} before any BudgetService call, following the [API contract](https://github.com/anton415/finance-lab/blob/main/docs/t2/api-contract.md) and [amount/category rules](https://github.com/anton415/finance-lab/blob/main/docs/budget-backup-contract.md).

## Acceptance criteria
- [ ] Validate PUT months with the same ASCII YYYY-MM, year 0001–9999 and month 01–12 rules as GET; retain GET behavior.
- [ ] Require exactly expectedVersion, income, spending and investments. Reject missing/unknown fields and wrong JSON types. expectedVersion accepts explicit null or an integral value representable by Long; reject omitted values and type coercion from strings, booleans or fractions. This does not choose the server's initial version or bypass the later version comparison.
- [ ] Require exactly the fifteen existing spending IDs. Income, investments and every spending value must satisfy the existing amount-string rules; preserve valid strings, including empty strings, without trimming, rounding or numeric conversion.
- [ ] Retain malformed-JSON, missing-header and isBlank() rejection. Do not impose a new key format or automatic normalization.
- [ ] Negative MVC tests assert the exact 400 body and verifyNoInteractions(budgetService); table-driven cases cover each rule, including missing/extra categories and invalid amount/type examples. Valid creation/update bodies reach the existing 501 checkpoint and retain their strings. GET tests still pass.

## Evidence and demonstration
Put tests in backend/src/test and any contract clarification in docs/t2/api-contract.md. Reuse existing synthetic budget fixtures where relevant. Record the exact targeted test command and observed results in the PR; do not claim pending CI passed.

Guided checkpoints: PUT month validation → exact body/type validation → amount/category validation → regression review. The maintainer explains why explicit null differs from omission and diagnoses one rejected request/test failure. Keep these checkpoints within this issue and one cohesive PR.

## Boundary
No persistence, authentication, successful save, version-conflict algorithm, idempotency execution or UI changes. Valid PUT remains 501 until later authenticated transactional saving is implemented. This completes validation only; it is not a production-ready endpoint.
