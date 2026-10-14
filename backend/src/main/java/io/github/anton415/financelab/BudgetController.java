package io.github.anton415.financelab;

import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.Map;
import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class BudgetController {

	private final BudgetService budgetService;

	public BudgetController(BudgetService budgetService) {
		this.budgetService = budgetService;
	}

	@GetMapping("/api/budgets/{month}")
	public ResponseEntity<Object> getBudget(@PathVariable("month") String month) {
		if (!month.matches("[0-9]{4}-[0-9]{2}") || month.startsWith("0000-")) {
			return ResponseEntity.badRequest().body(Map.of("code", "INVALID_REQUEST"));
		}

		YearMonth selectedMonth;
		try {
			selectedMonth = YearMonth.parse(month);
		} catch (DateTimeParseException exception) {
			return ResponseEntity.badRequest().body(Map.of("code", "INVALID_REQUEST"));
		}

		Optional<Budget> budget = budgetService.findByMonth(selectedMonth);
		if (budget.isEmpty()) {
			return ResponseEntity.status(HttpStatus.NOT_FOUND)
					.body(Map.of("code", "BUDGET_NOT_FOUND", "month", month));
		}

		return ResponseEntity.ok(budget.get());
	}

	@PutMapping("/api/budgets/{month}")
	public ResponseEntity<Object> saveBudget(
			@PathVariable("month") String month,
			@RequestBody SaveBudgetRequest request,
			@RequestHeader("Idempotency-Key") String idempotencyKey) {
		// Binding-only checkpoint; authenticated, user-scoped saving is not implemented yet.
		return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
	}
}
