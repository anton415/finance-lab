package io.github.anton415.financelab;

import java.util.Map;

import tools.jackson.databind.annotation.JsonDeserialize;

@JsonDeserialize(using = SaveBudgetRequestDeserializer.class)
public record SaveBudgetRequest(
		Long expectedVersion,
		String income,
		Map<String, String> spending,
		String investments) {
}
