# Finance Lab execution modes (v1)

**Status:** Proposed governance policy; becomes operational in a repository only when its applicable `AGENTS.md`, issue labeling and human dispatch workflow adopt it. **Release 1 target:** 2026-12-31. This policy does not authorize model dispatch, commits, infrastructure mutations, spending or merge.

## Why this exists

Finance Lab has two separate outcomes: ship a reliable first authenticated monthly Budget journey, and develop the maintainer's independent engineering competence. Delegating every task may ship features without establishing that competence; implementing all boilerplate manually would jeopardize the release. Execution mode selects **who should do the thinking and implementation**, not feature priority or lifecycle stage.

### Two exclusive labels for executable issues

| Label | Accountable implementation owner | Default agent permissions |
| --- | --- | --- |
| `mode:learning` | Human | Explain, question, give incremental hints, propose test cases, review submitted work, examine evidence **only when asked**. Do not implement the solution, edit files, run a task on the human's behalf, commit, open a solution PR, or dispatch workers without a separate explicit grant. |
| `mode:delivery` | Agent, under human oversight | After explicit human acceptance and dispatch, implement only accepted scope, run agreed checks, document results and open a PR. No autonomous merge or release, no unrelated redesign, and no extra infrastructure or external services without separate authorization. |

For **executable, accepted tasks**, exactly one `mode:*` label must be present. No mode, both modes, or disagreement between label, accepted issue specification, and execution brief means **stop, ask for a human decision and make no write**. A roadmap tracker, draft, blocked/deferred issue, unaccepted design, or future idea may intentionally have **no execution-mode label** until the issue is selected and made executable. Existing `learning` labels are historical descriptive metadata, **not** an execution-mode substitute; retain them when useful.

A label is classification, **never authorization**. An accepted issue, `needs:implementation`, a GitHub Project status, an AI-authored note, or a green check is **not permission** to invoke an agent. The maintainer separately selects a concrete issue and explicitly authorizes the task brief, execution scope, costs, infrastructure changes (when applicable), and any progression to implementation.

## Preserve the existing workflow contract

[Workflow contract #81](https://github.com/anton415/finance-lab/issues/81) remains in force:

- **Project Status:** `Backlog → Ready → In progress → Review → Done` is the lifecycle source of truth.
- **At most one** `needs:spec`, `needs:implementation`, `needs:review`, or `needs:human` label per open issue. Zero is valid for blocked/deferred work.
- **`mode:*`:** orthogonal execution ownership; must not encode a status, route to a provider, or silently change a `needs:*` value.
- **WIP:** aim for one active `mode:learning` task; complete its evidence before choosing another. Delivery issues may progress independently within the existing board WIP limits.

Issue mode must be read *live* at agent-dispatch time and recorded verbatim in the accepted task brief. A CI/controller rule that enforces this does not exist merely because this document exists. Until implemented and verified, **the human performs this gate manually**. Do not claim automated enforcement.

## `mode:learning`: protected learning work

1. The human chooses one **observable competency** (design, implementation, testing, incident diagnosis, security analysis, etc.), reads the accepted requirements and first drafts a plan or solution.
2. The AI acts as tutor: conceptual explanations, diagrams, small examples unrelated to the exact issue, questions, feedback and *progressive hints* rather than a finished solution. Do not reveal full implementation, commands that carry out the protected exercise, or a completed analysis unless the human expressly changes the learning boundary.
3. The human completes a bounded hands-on artifact: design decision, code/tests, independent diagnosis/recovery, or structured review. For production-risk exercises use isolated synthetic data and explicitly approved fault injection.
4. A Reviewer may inspect the human-submitted artifact and verify bounded acceptance criteria. An Adversarial Reviewer may propose failure cases in a **separate, approved** pilot; neither may silently correct the human's work or invent findings.
5. Capture evidence of understanding separately from PR completion: what the human reasoned/changed, a tradeoff they can explain, command/test results they actually observed, and remaining gaps. Failed attempts are useful evidence, not failure of the person.
6. A learning issue is not done solely because an agent produced passing tests or a PR merged. If the human opts to delegate a protected step, record the explicit exception and adjust the learning acceptance evidence; do not imply the human learned or implemented it.

When a learning task threatens Release 1, narrow the learning exercise or defer noncritical breadth with maintainer approval. **Do not silently relabel it as delivery** to meet the deadline.

## `mode:delivery`: bounded AI execution

1. Human selects an issue and approves the latest revision-bound brief, plus any design checkpoint and permitted resource or credential interactions. Prior authorization of a related issue is not enough.
2. Implementer reads its repo `AGENTS.md`, issue, accepted contract/ADR and fixed source revisions. It confirms the execution mode and permitted paths before work.
3. Implement the minimum change; no scope expansion, implicit dependency upgrades, new product requirements, added cloud spend, provider changes, credentials, destructive actions, or changes in other repositories without explicit approval.
4. Execute only allowed tests, record **exact** commands and observed outcomes. Record the full resulting commit SHA, known limitations and any checks not run. Pending async CI is `pending/unknown` until actually observed.
5. Reviewer checks the diff against the linked issue **at exact head SHA**. Adversarial Reviewer stays opt-in and bounded; never make hypothetical out-of-scope scenarios blocking.
6. PR stays open for human judgment. The human alone accepts/rejects changes and explicitly merges, deploys or authorizes paid/cloud/destructive actions. Account identity, AI comments or a review badge are not proof of a distinct human decision.

No agent may submit or fabricate human approval. Project signoff, PR approval, branch protection, deployment and merge are distinct gates.

## Roles and knowledge packs

The existing [A1 Stage 1 tracker](https://github.com/anton415/finance-lab/issues/146) and opt-in [personas/knowledge packs #147](https://github.com/anton415/finance-lab/issues/147), [revision-bound handoffs #152](https://github.com/anton415/finance-lab/issues/152), and [mutation pilot #154](https://github.com/anton415/finance-lab/issues/154) are **proposals**, not automatically installed workers.

- **Implementer:** performs `mode:delivery` execution only after human dispatch; on `mode:learning` supplies guidance only. Works within specified paths and accepted revision.
- **Reviewer:** reads exact diff and issue criteria, provides reproducible, in-scope observations; no autonomous fixes or merges.
- **Adversarial Reviewer:** may design a small synthetic counterexample or mutation *only when separately authorized*; report severity, reproduction, actual/unknown results and scope boundaries. Do not use real money, credentials, personal data or destructive production tests.
- **Go Budget pack:** accepted contract, exact Money arithmetic, ownership and authorization, idempotency, generation fences, PostgreSQL concurrency; never invent unfrozen decisions.
- **Auth/Security pack:** Keycloak delegated identity, BFF sessions, CSRF, isolation and test-only credentials; secure failure handling, no raw secrets in output.

Persona names and packs do not confer permissions. One pilot at a time; protect the current Go Budget implementation sequence.

## Required task brief / handoff fields

Every agent-directed execution request must explicitly contain:

- Repository, issue link, purpose, accepted acceptance criteria and **full issue/spec/source-contract commit SHA(s)**; exact artifact path, digest, linked design revision and human decision reference where the [specification contract](../agentops/specification-contract.md) requires them. Mutable `main` links alone do not freeze inputs.
- `execution_mode`: `mode:learning` or `mode:delivery`; human-owned activity and forbidden agent activity; whether this is planning/review only or *separately authorized* implementation.
- Agent role, permitted/forbidden paths and operations, dependencies, allowed commands/network/cloud resources, sensitive-data handling and stop conditions.
- What must be reported: exact source/head SHA, observed checks with commands/results, changed files, deviations, unresolved questions, risks and immutable review/decision references.
- Explicit statement: **no autonomous merge or deployment; human final approval**.

A new commit, changed source contract, review supersession, changed scope, or conflicting mode invalidates an existing authorization as described by the applicable revision-bound contract; stop for renewed acceptance. Do not silently reuse an old human approval.

## Pilot and measurement

Start with **one Go Budget learning task** (new Go service [#12](https://github.com/finance-lab-project/budget-service/issues/12), subject to human approval of its design checkpoint) and **one platform delivery task** ([#2](https://github.com/finance-lab-project/platform/issues/2), continuing existing partial implementation only within accepted gates). Do **not** relabel or relaunch them solely because this document was published. Record one bounded Mac mini incident/diagnosis exercise separately, not a reason to rebuild the working stand.

Evaluate: (1) human can explain and independently demonstrate selected skill, (2) agents stayed within permissions, (3) measured validation/rework evidence, (4) impact on Release 1's critical path. Do not infer competence or agent authorship from GitHub account names, PR completion, or raw metrics. Record unavailable values as `unknown`, not zero.

The initial rollout and cross-repository status are documented in [Release 1 execution map](release1-execution-map.md).
