package io.github.anton415.financelab;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.YearMonth;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.json.JsonCompareMode;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(BudgetController.class)
class BudgetControllerTest {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private BudgetService budgetService;

	@Test
	void getBudgetReturnsCompleteBudgetWhenFound() throws Exception {
		YearMonth month = YearMonth.of(2026, 12);
		Map<String, String> spending = Map.ofEntries(
				Map.entry("groceries", "4500"),
				Map.entry("restaurants", "250.50"),
				Map.entry("utilities", "1200"),
				Map.entry("transport", "3000"),
				Map.entry("household", "0010.00"),
				Map.entry("health", "0"),
				Map.entry("personal-care", ".5"),
				Map.entry("clothing", ""),
				Map.entry("subscriptions", "15.99"),
				Map.entry("education", "1e2"),
				Map.entry("tech", "0.00"),
				Map.entry("culture", "25"),
				Map.entry("entertainment", "75"),
				Map.entry("gifts", "50"),
				Map.entry("travel", "200"));
		Budget budget = new Budget("2026-12", 7L, "10000.00", spending, "1e3");
		when(budgetService.findByMonth(month)).thenReturn(Optional.of(budget));

		mockMvc.perform(get("/api/budgets/2026-12"))
				.andExpect(status().isOk())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
				.andExpect(content().json("""
						{
						  "month": "2026-12",
						  "version": 7,
						  "income": "10000.00",
						  "spending": {
						    "groceries": "4500",
						    "restaurants": "250.50",
						    "utilities": "1200",
						    "transport": "3000",
						    "household": "0010.00",
						    "health": "0",
						    "personal-care": ".5",
						    "clothing": "",
						    "subscriptions": "15.99",
						    "education": "1e2",
						    "tech": "0.00",
						    "culture": "25",
						    "entertainment": "75",
						    "gifts": "50",
						    "travel": "200"
						  },
						  "investments": "1e3"
						}
						""", JsonCompareMode.STRICT));

		verify(budgetService).findByMonth(month);
	}
}
