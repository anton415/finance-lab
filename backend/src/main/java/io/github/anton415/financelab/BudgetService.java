package io.github.anton415.financelab;

import java.time.YearMonth;
import java.util.Optional;

import org.springframework.stereotype.Service;

@Service
public class BudgetService {

	public Optional<Budget> findByMonth(YearMonth month) {
		// Stub until authenticated, user-scoped budget storage is implemented.
		return Optional.empty();
	}
}
