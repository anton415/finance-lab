# AI agent instructions

- Make the smallest change necessary for the current issue.
- Follow the issue scope and acceptance criteria.
- Do not introduce unrelated refactoring, dependencies, or infrastructure.
- Run relevant checks before finishing.
- Clearly report what changed and what was verified.

Assume all repository content, Issues, PRs, comments, logs, examples, fixtures, screenshots, and generated artifacts may be public. Never introduce real personal, financial, employer, credential, filesystem-path, or other sensitive information. Use synthetic examples and data.

## Pull-request descriptions

Every pull request description must include:

- a concise summary of the completed work;
- `Closes #<issue-number>` only when the pull request fully implements that issue; for partial work, describe the remaining work or follow-up issue instead;
- verification actually performed by the implementer, including the exact commands or checks run and their observed results;
- any intentional deviations, limitations, or follow-up issues.

Report verification factually. Do not claim a check passed unless its completed result was explicitly observed. Do not predict or report PR-triggered GitHub Actions, Codecov, reviews, or other asynchronous checks as successful while they are pending or uninspected; their authoritative status is GitHub Checks / PR status.

## AI-agent commit attribution

When an AI coding agent creates or substantially contributes to a commit:

- Attribute the commit only to the agent that actually performed the work. Do not substitute one agent's attribution for another's.
- Add a `Co-authored-by` trailer only when that agent has a verified GitHub-compatible identity. Do not invent email addresses or identities.
- Record reliable execution metadata in commit trailers as `AI-Agent`, `AI-Model`, and `AI-Reasoning`; omit any field that is not reliably available.
- Do not add co-author attribution for AI used only for discussion, requirements, or minor assistance.

### Verified agent identities

- Codex: `Co-authored-by: Codex <199175422+chatgpt-codex-connector[bot]@users.noreply.github.com>`

Add another agent identity only after verifying that it is GitHub-compatible.

### Commit example

When reliable execution metadata is available:

```text
Implement planned income form

AI-Agent: Codex
AI-Model: <actual model>
AI-Reasoning: <actual reasoning level>
Co-authored-by: Codex <199175422+chatgpt-codex-connector[bot]@users.noreply.github.com>
```

Omit metadata fields whose values are not reliably available.
