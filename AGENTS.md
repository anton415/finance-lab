# AI agent instructions

- Make the smallest change necessary for the current issue.
- Follow the issue scope and acceptance criteria.
- Do not introduce unrelated refactoring, dependencies, or infrastructure.
- Run relevant checks before finishing.
- Clearly report what changed and what was verified.

Assume all repository content, Issues, PRs, comments, logs, examples, fixtures, screenshots, and generated artifacts may be public. Never introduce real personal, financial, employer, credential, filesystem-path, or other sensitive information. Use synthetic examples and data.

## Execution modes (Release 1)

Use [execution-modes.md](docs/engineering/execution-modes.md) and the [Release 1 map](docs/engineering/release1-execution-map.md) to distinguish **human-led learning** from **AI-led delivery**. For an *accepted executable issue*, exactly one of `mode:learning` or `mode:delivery` is required; drafts/trackers may remain unlabeled. An absent/conflicting mode or a mismatch with the task brief is a **stop condition**, not permission to infer a default. The historical `learning` label remains descriptive.

- **`mode:learning`** — human leads reasoning and selected coding/design/diagnosis; agents explain concepts, offer progressive hints and review human work when requested. Do not complete the protected task, modify task files, dispatch implementers, run the human exercise, commit or open a solution PR without a *separate explicit human authorization* changing the boundary. Record observable human learning evidence, not merely a merged PR.
- **`mode:delivery`** — agent implementation may start only after human approval of an exact revision-bound task brief and explicit dispatch. Constrain code, tests, tools, cloud/infrastructure actions, and costs to the approved scope. Report actual results and stop on changed requirements or missing evidence. No autonomous merge, production deployment or human-signoff impersonation.
- Retain [#81 workflow](https://github.com/anton415/finance-lab/issues/81): Project Status is the lifecycle source of truth, with **at most one** `needs:*` label per open issue. Mode labels do not alter status, next action, dispatch or human approval. Limit active learning WIP to one by default.
- Implementer, Reviewer and Adversarial Reviewer roles/Go Budget and Security packs are **proposed** in [A1 #146](https://github.com/anton415/finance-lab/issues/146) and follow-ups; do not claim the pilots or automated gates are already deployed. Review exact SHA and accepted scope, keep adversarial/mutation testing opt-in and synthetic.
- Each handoff identifies issue, mode, human-owned objective, role permissions, exact source/spec/design SHAs and digest as applicable, explicit authorization, observed checks and actual head SHA. A label alone is never an authorization. See the existing [specification contract](docs/agentops/specification-contract.md).
- For cross-repository work, read that service repository's own `AGENTS.md` before dispatch. Until a service root policy is installed and its mode checked, do not silently rely on this frontend file as controlling external repository agents. The reviewed [service template](docs/engineering/service-AGENTS-template.md) is **not yet installed** in those repositories.

## Historical agent rules carried forward

Rules from [finance-lab-archive](https://github.com/anton415/finance-lab-archive/blob/main/AGENTS.md) supplement the existing protections: do not add new requirements/features/automation without explicit approval; fix review findings with the smallest in-scope change; documentation-only edits need honest review of text, links and examples; metrics must use independently verifiable evidence and represent missing values as `unknown`, not zero; GitHub account activity is not proof of a human action; never store conversation content in metrics. The archive's `~/.codex/AGENTS.md` reference is **local-only**, not authority available to remote agents. See [reconciliation](docs/engineering/legacy-instruction-reconciliation.md).

## Code review rules

- Review each PR against its linked issue's scope and acceptance criteria.
- Report concrete correctness, regression, security, data-loss, or acceptance-criteria problems within that scope.
- Do not require out-of-scope scenarios solely for robustness, extensibility, or architectural completeness.
- Do not require abstractions, infrastructure, synchronization, or defensive behavior unless the current issue requires it or it prevents a concrete in-scope defect.
- Do not treat a potential problem that depends on an out-of-scope scenario as blocking.

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
