# AI agent instructions

- Make the smallest change necessary for the current issue.
- Follow the issue scope and acceptance criteria.
- Do not introduce unrelated refactoring, dependencies, or infrastructure.
- Run relevant checks before finishing.
- Clearly report what changed and what was verified.

Assume all repository content, Issues, PRs, comments, logs, examples, fixtures, screenshots, and generated artifacts may be public. Never introduce real personal, financial, employer, credential, filesystem-path, or other sensitive information. Use synthetic examples and data.

## AI-agent commit attribution

When an AI coding agent creates or substantially contributes to a commit:

- Attribute the commit only to the agent that actually performed the work. Do not substitute one agent's attribution for another's.
- Add a `Co-authored-by` trailer only when that agent has a verified GitHub-compatible identity. Do not invent email addresses or identities.
- Record reliable execution metadata in commit trailers as `AI-Agent`, `AI-Model`, and `AI-Reasoning`; omit any field that is not reliably available.
- Do not add co-author attribution for AI used only for discussion, requirements, or minor assistance.

### Verified agent identities

- Codex: `Co-authored-by: Codex <199175422+chatgpt-codex-connector[bot]@users.noreply.github.com>`

Add another agent identity only after verifying that it is GitHub-compatible.
