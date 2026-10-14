package io.github.anton415.financelab;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PingController {

	@GetMapping("/api/ping")
	public PingResponse ping() {
		return new PingResponse("pong");
	}
}
