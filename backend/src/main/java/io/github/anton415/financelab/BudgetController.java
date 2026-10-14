package io.github.anton415.financelab;

import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class BudgetController {

	@GetMapping("/api/budgets/{month}")
	public ResponseEntity<Map<String, String>> getBudget(@PathVariable("month") String month) {
		if (!month.matches("[0-9]{4}-[0-9]{2}") || month.startsWith("0000-")) {
			return ResponseEntity.badRequest().body(Map.of("code", "INVALID_REQUEST"));
		}

		try {
			YearMonth.parse(month);
		} catch (DateTimeParseException exception) {
			return ResponseEntity.badRequest().body(Map.of("code", "INVALID_REQUEST"));
		}

		// Temporary missing-budget response until budget storage is implemented.
		return ResponseEntity.status(HttpStatus.NOT_FOUND)
				.body(Map.of("code", "BUDGET_NOT_FOUND", "month", month));
	}
}
