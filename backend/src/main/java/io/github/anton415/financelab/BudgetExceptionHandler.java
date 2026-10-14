package io.github.anton415.financelab;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = BudgetController.class)
public class BudgetExceptionHandler {

	@ExceptionHandler({
			HttpMessageNotReadableException.class,
			MissingRequestHeaderException.class
	})
	public ResponseEntity<Map<String, String>> handleInvalidRequest() {
		return ResponseEntity.badRequest().body(Map.of("code", "INVALID_REQUEST"));
	}
}
