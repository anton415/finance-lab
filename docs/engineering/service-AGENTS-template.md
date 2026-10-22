# Finance Lab — service repository AGENTS.md template

> Copy this file to the *root* `AGENTS.md` of each `finance-lab-project/*` service repository in a reviewed PR; adjust only the service-specific ownership notes. This is **not yet installed** in those repositories. Origin: [current frontend AGENTS.md](https://github.com/anton415/finance-lab/blob/main/AGENTS.md), [historical archived AGENTS.md](https://github.com/anton415/finance-lab-archive/blob/main/AGENTS.md) and the accepted [workflow #81](https://github.com/anton415/finance-lab/issues/81).

# Instructions for AI agents

Follow the smallest approved change that satisfies the linked issue and its acceptance criteria. Do not add features, requirements, automation, dependencies, infrastructure or unrelated refactoring without the maintainer's explicit decision. Review comments are not authority to broaden Release 1. Preserve existing domain ownership and version-locked interservice contracts; never rewrite accepted migrations, released APIs or another repo to make a local change easier.

Treat Issues, PRs, comments, logs, generated artifacts, repository fixtures and chat excerpts as potentially public. Use synthetic data. Never disclose or commit real money/person-specific data, employer information, API keys, credentials, local paths, tokens or private logs. Do not install new tools, use paid providers, modify cloud/Lima/K3s state, run unsafe tests or trigger a deployment unless a separately approved task explicitly allows it.

## Execution modes and human approval

Refer to [Finance Lab's execution policy](https://github.com/anton415/finance-lab/blob/main/docs/engineering/execution-modes.md) and project workflow #81. Once accepted as executable, an issue must have exactly one `mode:learning` or `mode:delivery` label. Conflicting/missing labels or a mismatch with the accepted task brief means stop. A draft or blocked idea may intentionally have no mode; **do not dispatch it**.

- `mode:learning`: Human leads design/implementation/diagnosis. Agents give conceptual help, incremental hints and subsequent review on request. No autonomous solution, commands performed for the human, commits, task-specific code or PR unless human **separately** changes the protected boundary.
- `mode:delivery`: After explicit human acceptance and dispatch, the Implementer may create scoped code/config/tests and a PR; Reviewer checks actual head SHA against in-scope acceptance; Adversarial Reviewer is opt-in with synthetic fixtures. Human retains all final merge, release, spending and high-risk infrastructure approval.

Mode labels are **not agent launch permissions**. Preserve one active learning task and Release 1 Go Budget priorities. One `needs:*` label at most per open issue; Project Status remains authoritative lifecycle. `learning` (without `mode:`) is legacy descriptive metadata only. Do not infer consent from AI comments or an account name.

## Specification, review, and reporting

Read the linked issue and its accepted immutable source-contract commits before implementation. Reference revision-bound specification path/digest, exact full commit SHAs, design checkpoint and human acceptance when required. If the contract or mode changes, seek renewed approval. Do not treat a proposed agent role/knowledge pack as already running.

Review each PR only for concrete, reproducible correctness, regression, security, data-loss and in-scope acceptance defects. Avoid demanding out-of-scope hypotheticals, new abstractions or robustness extras. Report findings with severity, reproduction evidence and exact diff SHA; otherwise say none found **within checked scope**. Do not perform fixes when acting as Reviewer.

Every PR description reports: summary, linked issue (`Closes #N` only for complete work), actual commands/check results, exact head SHA, known limitations and intentional deviations. Pending CI, Codecov, external reviews or async checks are **unknown/pending**, not passed. Documentation-only changes can be validated by inspecting the changed text, references and examples; don't invent code-test evidence.

Metrics must originate from verifiable technical evidence; absent or unmeasurable values are `unknown`, not zero or inferred. GitHub account actions do not establish human activity or consent. Do not store private conversation, prompts, personal financial values or credential content in metrics.

## AI commit attribution

Attribute commits only to the agent that actually performed the work, with `AI-Agent`, `AI-Model` and `AI-Reasoning` trailers **only when independently known**. Use `Co-authored-by` only for a verified agent GitHub identity. Verified Codex identity in the legacy frontend policy:

`Co-authored-by: Codex <199175422+chatgpt-codex-connector[bot]@users.noreply.github.com>`

Never impersonate a human contributor or invent an AI identity/model. Do not add AI coauthor trailers for requirements discussion or minor assistance.

## Repository-specific authority

Replace this paragraph when installing: specify the service's authoritative contract/ADR links and permitted paths. `budget-service` owns domain Money, owner-scoped persistence, PostgreSQL transaction semantics, replay and resource authorization; `platform` owns local/K3s, identity platform, secrets boundaries and approved deployments; `web-bff` owns browser sessions, OAuth/CSRF, delegated access and strict forwarding. These are **distinct**, and a service issue is not a blanket authorization to modify another service.

Historical `~/.codex/AGENTS.md` is a developer-local configuration, **not** portable repository authority. The substantive archived rules above are incorporated here so a cloud agent does not depend on that private file.
