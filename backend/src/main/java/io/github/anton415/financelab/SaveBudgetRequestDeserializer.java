package io.github.anton415.financelab;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

import tools.jackson.core.JsonParser;
import tools.jackson.core.JsonToken;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ValueDeserializer;

final class SaveBudgetRequestDeserializer extends ValueDeserializer<SaveBudgetRequest> {

	private static final Set<String> FIELDS = Set.of("expectedVersion", "income", "spending", "investments");
	private static final Set<String> SPENDING_IDS = Set.of(
			"groceries", "restaurants", "utilities", "transport", "household", "health",
			"personal-care", "clothing", "subscriptions", "education", "tech", "culture",
			"entertainment", "gifts", "travel");
	private static final Pattern AMOUNT = Pattern.compile("(?:[0-9]+(?:\\.[0-9]+)?|\\.[0-9]+)(?:[eE][+-]?[0-9]+)?");

	@Override
	public SaveBudgetRequest deserialize(JsonParser parser, DeserializationContext context) {
		if (!parser.isExpectedStartObjectToken()) {
			return context.reportInputMismatch(SaveBudgetRequest.class, "Expected a budget object");
		}

		Set<String> fields = new HashSet<>();
		Long expectedVersion = null;
		String income = null;
		Map<String, String> spending = null;
		String investments = null;
		while (parser.nextToken() == JsonToken.PROPERTY_NAME) {
			String field = parser.currentName();
			parser.nextToken();
			fields.add(field);
			switch (field) {
				case "expectedVersion" -> expectedVersion = readVersion(parser, context);
				case "income" -> income = readAmount(context.readTree(parser), context);
				case "spending" -> spending = readSpending(context.readTree(parser), context);
				case "investments" -> investments = readAmount(context.readTree(parser), context);
				default -> context.reportInputMismatch(SaveBudgetRequest.class, "Unexpected budget property");
			}
		}
		if (!parser.hasToken(JsonToken.END_OBJECT) || !fields.equals(FIELDS)) {
			return context.reportInputMismatch(SaveBudgetRequest.class,
					"Required properties: expectedVersion, income, spending, investments");
		}
		return new SaveBudgetRequest(expectedVersion, income, spending, investments);
	}

	@Override
	public SaveBudgetRequest getNullValue(DeserializationContext context) {
		return context.reportInputMismatch(SaveBudgetRequest.class, "Expected a budget object");
	}

	private static Long readVersion(JsonParser parser, DeserializationContext context) {
		if (parser.hasToken(JsonToken.VALUE_NULL)) {
			return null;
		}
		if (parser.currentToken().isNumeric()) {
			try {
				// Read the exact JSON number so rounding cannot hide fractions or overflow.
				return parser.getDecimalValue().longValueExact();
			} catch (ArithmeticException exception) {
				return context.reportInputMismatch(SaveBudgetRequest.class, "expectedVersion must fit a Long exactly");
			}
		}
		return context.reportInputMismatch(SaveBudgetRequest.class, "expectedVersion must be null or an integral number");
	}

	private static Map<String, String> readSpending(JsonNode node, DeserializationContext context) {
		if (!node.isObject() || node.size() != SPENDING_IDS.size()
				|| !SPENDING_IDS.stream().allMatch(node::has)) {
			return context.reportInputMismatch(SaveBudgetRequest.class, "spending must contain exactly the fifteen category IDs");
		}
		Map<String, String> spending = new LinkedHashMap<>();
		for (Map.Entry<String, JsonNode> entry : node.properties()) {
			spending.put(entry.getKey(), readAmount(entry.getValue(), context));
		}
		return spending;
	}

	private static String readAmount(JsonNode node, DeserializationContext context) {
		if (node.isString()) {
			String amount = node.stringValue();
			if (amount.isEmpty() || (AMOUNT.matcher(amount).matches() && Double.isFinite(Double.parseDouble(amount)))) {
				return amount;
			}
		}
		return context.reportInputMismatch(SaveBudgetRequest.class, "Expected a valid amount string");
	}
}
