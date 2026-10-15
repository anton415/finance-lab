package io.github.anton415.financelab;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.json.JsonTest;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.exc.MismatchedInputException;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

@JsonTest
class SaveBudgetRequestTest {

	private static final String CREATION_JSON = """
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
	private JsonMapper jsonMapper;

	@Test
	void readsExplicitNullVersionAndPreservesAmountStrings() {
		SaveBudgetRequest request = jsonMapper.readValue(CREATION_JSON, SaveBudgetRequest.class);

		assertThat(request.expectedVersion()).isNull();
		assertThat(request.income()).isEqualTo("10000.00");
		assertThat(request.spending()).isEqualTo(Map.ofEntries(
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
				Map.entry("travel", "200")));
		assertThat(request.investments()).isEqualTo("1e3");
	}

	@ParameterizedTest
	@CsvSource({"7, 7", "7.0, 7", "7e0, 7", "9007199254740993, 9007199254740993",
			"9223372036854775807, 9223372036854775807", "-9223372036854775808, -9223372036854775808",
			"9223372036854775807.0, 9223372036854775807", "-9223372036854775808.0, -9223372036854775808"})
	void readsNumericVersionExactly(String version, long expectedVersion) {
		String json = CREATION_JSON.replace("\"expectedVersion\": null", "\"expectedVersion\": " + version);

		SaveBudgetRequest request = jsonMapper.readValue(json, SaveBudgetRequest.class);

		assertThat(request.expectedVersion()).isEqualTo(expectedVersion);
		SaveBudgetRequest creation = jsonMapper.readValue(CREATION_JSON, SaveBudgetRequest.class);
		assertThat(request.income()).isEqualTo(creation.income());
		assertThat(request.spending()).isEqualTo(creation.spending());
		assertThat(request.investments()).isEqualTo(creation.investments());
	}

	@Test
	void rejectsMissingExpectedVersion() {
		String json = CREATION_JSON.replace("\"expectedVersion\": null,", "");

		assertThatThrownBy(() -> jsonMapper.readValue(json, SaveBudgetRequest.class))
				.isInstanceOf(MismatchedInputException.class)
				.hasMessageContaining("expectedVersion");
	}

	@ParameterizedTest
	@ValueSource(strings = {"empty", "mixed", "representation"})
	void preservesAllAmountStringsFromExistingFixtures(String fixture) throws Exception {
		ObjectNode body = (ObjectNode) jsonMapper.readTree(Files.readString(
				Path.of("..", "fixtures", "budget-backup", "v2", "valid", fixture + ".json")));
		body.remove("formatVersion");
		body.remove("month");
		body.putNull("expectedVersion");

		SaveBudgetRequest request = jsonMapper.readValue(body.toString(), SaveBudgetRequest.class);

		JsonNode rebound = jsonMapper.valueToTree(request);
		assertThat(rebound).isEqualTo(body);
	}
}
