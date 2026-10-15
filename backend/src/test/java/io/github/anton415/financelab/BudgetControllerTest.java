package io.github.anton415.financelab;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.json.JsonCompareMode;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

@WebMvcTest(BudgetController.class)
class BudgetControllerTest {

	private static final String SAVE_REQUEST_JSON = """
			{
			  "expectedVersion": null,
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
			""";

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

	@Test
	void getBudgetReturnsNotFoundWhenMissing() throws Exception {
		YearMonth month = YearMonth.of(2026, 12);
		when(budgetService.findByMonth(month)).thenReturn(Optional.empty());

		mockMvc.perform(get("/api/budgets/2026-12"))
				.andExpect(status().isNotFound())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
				.andExpect(content().json("""
						{
						  "code": "BUDGET_NOT_FOUND",
						  "month": "2026-12"
						}
						""", JsonCompareMode.STRICT));

		verify(budgetService).findByMonth(month);
	}

	@ParameterizedTest
	@MethodSource("invalidMonths")
	void getBudgetReturnsBadRequestForInvalidMonth(String month) throws Exception {
		mockMvc.perform(get("/api/budgets/" + month))
				.andExpect(status().isBadRequest())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
				.andExpect(content().json("""
						{
						  "code": "INVALID_REQUEST"
						}
						""", JsonCompareMode.STRICT));

		verifyNoInteractions(budgetService);
	}

	@Test
	void putBudgetReturnsBadRequestWhenExpectedVersionIsMissing() throws Exception {
		String json = SAVE_REQUEST_JSON.replace("\"expectedVersion\": null,", "");

		mockMvc.perform(put("/api/budgets/2026-12")
				.header("Idempotency-Key", "save-test-key")
				.contentType(MediaType.APPLICATION_JSON)
				.content(json))
				.andExpect(status().isBadRequest())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
				.andExpect(content().json("""
						{
						  "code": "INVALID_REQUEST"
						}
						""", JsonCompareMode.STRICT));

		verifyNoInteractions(budgetService);
	}

	@Test
	void putBudgetReturnsBadRequestForMalformedJson() throws Exception {
		String json = SAVE_REQUEST_JSON.substring(0, SAVE_REQUEST_JSON.lastIndexOf('}'));

		mockMvc.perform(put("/api/budgets/2026-12")
				.header("Idempotency-Key", "save-test-key")
				.contentType(MediaType.APPLICATION_JSON)
				.content(json))
				.andExpect(status().isBadRequest())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
				.andExpect(content().json("""
						{
						  "code": "INVALID_REQUEST"
						}
						""", JsonCompareMode.STRICT));

		verifyNoInteractions(budgetService);
	}

	@Test
	void putBudgetReturnsBadRequestWhenIdempotencyKeyIsMissing() throws Exception {
		mockMvc.perform(put("/api/budgets/2026-12")
				.contentType(MediaType.APPLICATION_JSON)
				.content(SAVE_REQUEST_JSON))
				.andExpect(status().isBadRequest())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
				.andExpect(content().json("""
						{
						  "code": "INVALID_REQUEST"
						}
						""", JsonCompareMode.STRICT));

		verifyNoInteractions(budgetService);
	}

	@ParameterizedTest
	@ValueSource(strings = {"", "   ", "\t", "\u2003"})
	void putBudgetReturnsBadRequestForBlankIdempotencyKey(String key) throws Exception {
		mockMvc.perform(put("/api/budgets/2026-12")
				.header("Idempotency-Key", key)
				.contentType(MediaType.APPLICATION_JSON)
				.content(SAVE_REQUEST_JSON))
				.andExpect(status().isBadRequest())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
				.andExpect(content().json("""
						{
						  "code": "INVALID_REQUEST"
						}
						""", JsonCompareMode.STRICT));

		verifyNoInteractions(budgetService);
	}

	@ParameterizedTest
	@ValueSource(strings = {"null", "7", "0", "-1", "7.0", "7e0", "9223372036854775807", "-9223372036854775808",
			"9223372036854775807.0", "-9223372036854775808.0"})
	void putBudgetReturnsNotImplementedForValidVersion(String version) throws Exception {
		mockMvc.perform(put("/api/budgets/2026-12")
				.header("Idempotency-Key", "save-test-key")
				.contentType(MediaType.APPLICATION_JSON)
				.content(SAVE_REQUEST_JSON.replace("\"expectedVersion\": null", "\"expectedVersion\": " + version)))
				.andExpect(status().isNotImplemented());

		verifyNoInteractions(budgetService);
	}

	@ParameterizedTest
	@MethodSource("invalidMonths")
	void putBudgetReturnsBadRequestForInvalidMonth(String month) throws Exception {
		assertInvalidRequest(put("/api/budgets/{month}", month)
				.header("Idempotency-Key", "save-test-key")
				.contentType(MediaType.APPLICATION_JSON)
				.content(SAVE_REQUEST_JSON));
	}

	static Stream<String> invalidMonths() {
		return Stream.of("2026-13", "2026-00", "2026-1", "0000-01", "10000-01", "026-01",
				"２０２６-01", "2026-٠١", " 2026-01", "2026-01 ", "2026-01\n", "2026-01x");
	}

	@ParameterizedTest
	@ValueSource(strings = {"0001-01", "9999-12"})
	void getBudgetAcceptsBoundaryMonths(String month) throws Exception {
		YearMonth selectedMonth = YearMonth.parse(month);
		when(budgetService.findByMonth(selectedMonth)).thenReturn(Optional.empty());

		mockMvc.perform(get("/api/budgets/{month}", month))
				.andExpect(status().isNotFound());

		verify(budgetService).findByMonth(selectedMonth);
	}

	@ParameterizedTest
	@ValueSource(strings = {"0001-01", "9999-12"})
	void putBudgetAcceptsBoundaryMonths(String month) throws Exception {
		mockMvc.perform(put("/api/budgets/{month}", month)
				.header("Idempotency-Key", "save-test-key")
				.contentType(MediaType.APPLICATION_JSON)
				.content(SAVE_REQUEST_JSON))
				.andExpect(status().isNotImplemented());

		verifyNoInteractions(budgetService);
	}

	@ParameterizedTest
	@ValueSource(strings = {"K", " key with spaces ", "arbitrary:key/1"})
	void putBudgetAcceptsNonblankIdempotencyKeysWithoutNewFormatRules(String key) throws Exception {
		mockMvc.perform(put("/api/budgets/2026-12")
				.header("Idempotency-Key", key)
				.contentType(MediaType.APPLICATION_JSON)
				.content(SAVE_REQUEST_JSON))
				.andExpect(status().isNotImplemented());

		verifyNoInteractions(budgetService);
	}

	@ParameterizedTest(name = "{0}")
	@MethodSource("invalidBodies")
	void putBudgetRejectsInvalidBodiesBeforeCallingService(String description, String json) throws Exception {
		assertInvalidRequest(put("/api/budgets/2026-12")
				.header("Idempotency-Key", "save-test-key")
				.contentType(MediaType.APPLICATION_JSON)
				.content(json));
	}

	static Stream<Arguments> invalidBodies() {
		JsonMapper mapper = JsonMapper.builder().build();
		ObjectNode valid = (ObjectNode) mapper.readTree(SAVE_REQUEST_JSON);
		List<Arguments> cases = new ArrayList<>();
		for (String root : List.of("", "null", "[]", "[{}]", "7", "true", "\"budget\"", "{}",
				"{\"expectedVersion\":", SAVE_REQUEST_JSON + " {}")) {
			cases.add(Arguments.of("invalid root: " + root, root));
		}
		for (String field : List.of("expectedVersion", "income", "spending", "investments")) {
			ObjectNode body = valid.deepCopy();
			body.remove(field);
			cases.add(Arguments.of("missing " + field, body.toString()));
		}
		for (String field : List.of("month", "userId", "formatVersion", "unknown")) {
			ObjectNode body = valid.deepCopy();
			body.put(field, "unexpected");
			cases.add(Arguments.of("extra " + field, body.toString()));
		}
		for (String version : List.of("\"7\"", "\"\"", "true", "false", "[]", "{}", "7.5", "-0.1",
				"7.000000000000000001", "1e-9999", "9223372036854775808", "-9223372036854775809",
				"9223372036854775807.1", "-9223372036854775808.1", "1e100")) {
			cases.add(Arguments.of("invalid expectedVersion: " + version,
					SAVE_REQUEST_JSON.replace("\"expectedVersion\": null", "\"expectedVersion\": " + version)));
		}
		for (String value : List.of("null", "[]", "\"\"", "\"spending\"", "0", "true", "false")) {
			ObjectNode body = valid.deepCopy();
			body.set("spending", mapper.readTree(value));
			cases.add(Arguments.of("invalid spending type: " + value, body.toString()));
		}
		List<String> categories = new ArrayList<>();
		valid.get("spending").properties().forEach(entry -> categories.add(entry.getKey()));
		for (String category : categories) {
			ObjectNode body = valid.deepCopy();
			((ObjectNode) body.get("spending")).remove(category);
			cases.add(Arguments.of("missing category: " + category, body.toString()));
		}
		for (boolean replaceCategory : List.of(false, true)) {
			ObjectNode body = valid.deepCopy();
			ObjectNode spending = (ObjectNode) body.get("spending");
			if (replaceCategory) {
				spending.remove("travel");
			}
			spending.put("unknown", "");
			cases.add(Arguments.of("unknown category, replacing existing: " + replaceCategory, body.toString()));
		}
		List<String> amountFields = new ArrayList<>(List.of("income", "investments"));
		amountFields.addAll(categories);
		List<String> invalidAmounts = new ArrayList<>(List.of("null", "0", "1.5", "true", "false", "[]", "{}"));
		for (String amount : List.of("-1", "-0", "+1", "1.", "1,25", "1 000", " ", "\t", " 1", "1 ", "1\n",
				"١", "１", "NaN", "Infinity", "1e309", "1e", ".", "0x10")) {
			invalidAmounts.add(mapper.writeValueAsString(amount));
		}
		for (String field : amountFields) {
			for (String amount : invalidAmounts) {
				ObjectNode body = valid.deepCopy();
				ObjectNode target = categories.contains(field) ? (ObjectNode) body.get("spending") : body;
				target.set(field, mapper.readTree(amount));
				cases.add(Arguments.of("invalid " + field + ": " + amount, body.toString()));
			}
		}
		return cases.stream();
	}

	@ParameterizedTest
	@ValueSource(strings = {"empty", "mixed", "representation"})
	void putBudgetAcceptsExistingValidAmountFixtures(String fixture) throws Exception {
		JsonMapper mapper = JsonMapper.builder().build();
		ObjectNode body = (ObjectNode) mapper.readTree(Files.readString(
				Path.of("..", "fixtures", "budget-backup", "v2", "valid", fixture + ".json")));
		body.remove("formatVersion");
		body.remove("month");
		body.putNull("expectedVersion");

		mockMvc.perform(put("/api/budgets/2026-12")
				.header("Idempotency-Key", "save-test-key")
				.contentType(MediaType.APPLICATION_JSON)
				.content(body.toString()))
				.andExpect(status().isNotImplemented());

		verifyNoInteractions(budgetService);
	}

	private void assertInvalidRequest(MockHttpServletRequestBuilder request) throws Exception {
		mockMvc.perform(request)
				.andExpect(status().isBadRequest())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
				.andExpect(content().string("{\"code\":\"INVALID_REQUEST\"}"));

		verifyNoInteractions(budgetService);
	}
}
