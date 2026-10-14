package io.github.anton415.financelab;

import java.util.Map;

import com.fasterxml.jackson.annotation.JsonProperty;

public record SaveBudgetRequest(
		@JsonProperty(value = "expectedVersion", required = true) Long expectedVersion,
		String income,
		Map<String, String> spending,
		String investments) {
}
