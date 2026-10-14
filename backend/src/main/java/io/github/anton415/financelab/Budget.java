package io.github.anton415.financelab;

import java.util.Map;

public record Budget(
		String month,
		long version,
		String income,
		Map<String, String> spending,
		String investments) {
}
