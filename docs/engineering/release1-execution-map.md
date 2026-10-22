# Release 1 — execution-mode rollout map

**Snapshot:** 2026-10-22. **Product priority:** the first authenticated monthly Budget journey by **2026-12-31**. This map proposes ownership; it does not change release contracts, dependency order, GitHub Project status, `needs:*` labels, service architecture or actual implementation authorization.

See [execution-modes.md](execution-modes.md) and [A1 current planning index](https://github.com/anton415/finance-lab/issues/146).

## Classification of executable Release 1 work

| Repository and work | Intended mode | Rationale / sequencing |
| --- | --- | --- |
| [budget-service #12 — atomic saves, conflicts and idempotent replay](https://github.com/finance-lab-project/budget-service/issues/12) | `mode:learning` | **First active learning candidate**: human designs transaction/replay strategy and implements a bounded core/test slice after the issue's design checkpoint is approved. Agent tutors/reviews, not auto-codes. No code dispatch by this document. |
| [budget-service #13 — receipt retention](https://github.com/finance-lab-project/budget-service/issues/13) | `mode:delivery` | Bounded follow-on after #12; ensure human understands the retention/recovery boundary. |
| [budget-service #14 — delegated token authorization](https://github.com/finance-lab-project/budget-service/issues/14) | `mode:delivery` | Security-sensitive; human must approve token profile/design and review tests. Can be a later learning exercise **only via explicit mode decision**. |
| [budget-service #15 — Go Budget HTTP read/save API](https://github.com/finance-lab-project/budget-service/issues/15) | `mode:delivery` | Implement verified contract after dependencies. Human checks wire compatibility and security. |
| [budget-service #16 — packaging, health, shutdown](https://github.com/finance-lab-project/budget-service/issues/16) | `mode:delivery` | Repeatable service/runtime work with observed checks and recovery limits. |
| [budget-service #17 — generation fence/restore verification](https://github.com/finance-lab-project/budget-service/issues/17) | `mode:delivery` | Validation with human-observed recovery rehearsal; do not damage real data. |
| [budget-service #18 — end-to-end acceptance tracker](https://github.com/finance-lab-project/budget-service/issues/18) | *No execution label* | Cross-service tracker, not a self-contained implementation assignment. |
| [platform #2 — local Lima/K3s foundation](https://github.com/finance-lab-project/platform/issues/2) | `mode:delivery` | **First delivery pilot**. Existing partial execution and evidence are preserved; continue only after human authorization and remaining gates. |
| [platform #3 — isolated PostgreSQL](https://github.com/finance-lab-project/platform/issues/3) | `mode:delivery` | Strict credentials, database isolation, recovery evidence. |
| [platform #4 — Keycloak/delegation](https://github.com/finance-lab-project/platform/issues/4) | `mode:delivery` | Human-approved token claims, test identity and rollback boundaries. |
| [platform #5 — GitOps and frontend hosting](https://github.com/finance-lab-project/platform/issues/5) | `mode:delivery` | No unsolicited cloud spending, exposed endpoints or auto-deploy. |
| [platform #6 — private diagnostics](https://github.com/finance-lab-project/platform/issues/6) | `mode:delivery` | Observability implementation. Human analyzes one incident independently. |
| [platform #7 — recovery rehearsal](https://github.com/finance-lab-project/platform/issues/7) | `mode:delivery` | Protect real state; include isolated human recovery evidence. |
| [web-bff #1 — browser/session contract](https://github.com/finance-lab-project/web-bff/issues/1) | `mode:learning` (design only) | Next learning task **after #12**, if selected. Human owns security boundary decisions; no simultaneous learning WIP. |
| [web-bff #2 — login/sessions](https://github.com/finance-lab-project/web-bff/issues/2) | `mode:delivery` | Implement only after the contract checkpoint; carefully gate credentials. |
| [web-bff #3 — authenticated Budget forwarding](https://github.com/finance-lab-project/web-bff/issues/3) | `mode:delivery` | Preserve exact operation identity and no automatic retry. |
| [frontend #155 — signed-in budget journey](https://github.com/anton415/finance-lab/issues/155) | `mode:delivery` | BFF dependency and real browser integration required. |
| [frontend #156 — draft/conflict safety](https://github.com/anton415/finance-lab/issues/156) | `mode:delivery` | Preserve draft and pending operation; human acceptance of safe retry semantics. |
| [frontend #157 — independent SPA release](https://github.com/anton415/finance-lab/issues/157) | `mode:delivery` | Must verify actual deployed browser path; no CI success assumptions. |

## Supporting and deferred work

- [Local stand learning drill #159](https://github.com/anton415/finance-lab/issues/159) is human-led `mode:learning`, planned after stable P1.2 and after the active Go learning task. It does not authorize fault injection, production repair or a second simultaneous learning WIP.
- [Frontend #96 — manual calibration](https://github.com/anton415/finance-lab/issues/96) stays human-led `mode:learning`; the original descriptive `learning` label can remain.
- [AgentOps #154 — synthetic Go Budget adversarial review pilot](https://github.com/anton415/finance-lab/issues/154) is **optional** learning/evaluation, not a Go Budget release prerequisite; proposed `mode:learning` does not authorize mutation or model dispatch.
- [AgentOps #158 — Halfcycle evaluation](https://github.com/anton415/finance-lab/issues/158) is a deferred human-led comparison; no license/purchase or switch from Codex is authorized.
- [A1 tracker #146](https://github.com/anton415/finance-lab/issues/146), [packs #147](https://github.com/anton415/finance-lab/issues/147) and [handoffs #152](https://github.com/anton415/finance-lab/issues/152) remain planning/opt-in. Do not imply the optional personas/automation exist. Preserve one-bounded-pilot limits.
- Historic Spring [#124](https://github.com/anton415/finance-lab/issues/124) and [#125](https://github.com/anton415/finance-lab/issues/125) are not Go migration prerequisites; do not silently implement them.
- Future M5/M6/M7 drafts and feature ideas remain **unclassified until selected**. A descriptive label is not a dispatch signal.

## Current application state and blockers

At drafting, the linked GitHub integration could **read** the `finance-lab-project` repositories but received `403 Resource not accessible by integration` when attempting to create branches or add execution labels there. Consequently, the org-side table entries above are **proposed**, not assertions that labels or `AGENTS.md` have been applied. They require separately granted organization write access and a follow-up human-approved change. The `web-bff` repository was empty at this snapshot; seed its own agent instructions with its first approved commit.

In `anton415/finance-lab`, the labels **were applied** to frontend [#155](https://github.com/anton415/finance-lab/issues/155), [#156](https://github.com/anton415/finance-lab/issues/156), [#157](https://github.com/anton415/finance-lab/issues/157) as `mode:delivery`, and to [#96](https://github.com/anton415/finance-lab/issues/96), [#154](https://github.com/anton415/finance-lab/issues/154), [#158](https://github.com/anton415/finance-lab/issues/158) and the new [#159](https://github.com/anton415/finance-lab/issues/159) as `mode:learning`. Existing descriptive `learning` labels were retained. These updates did **not** authorize dispatch or change Project Status or `needs:*` labels. Reverify live issue labels before each future task.

Before any agent dispatch across repositories:
1. Ensure the target repository has committed, current `AGENTS.md` (copy the reviewed [service template](service-AGENTS-template.md) and adapt ownership).
2. Ensure exactly one correct execution label exists **on the actual target issue** when accepted for execution.
3. Check issue status, one `needs:*` label max and exact accepted task brief. Ask for explicit human authorization rather than treating labels as triggers.
4. Keep Release 1 critical path first. Do not initiate real infrastructure changes or autonomous merges as part of this policy rollout.

## Practical learning acceptance

For the first Go task, the maintainer should: articulate the lock/transaction/replay strategy, implement or independently troubleshoot one accepted nontrivial slice, show observed focused test results, explain a version conflict and an ambiguous commit outcome, and identify at least one design limitation. Reviewer feedback may follow **his own attempt**.

For the Mac mini infrastructure, reuse the existing stand. Plan **one isolated failure/diagnosis rehearsal** after the platform baseline is stable. Require an independently documented hypothesis, observed log/metric evidence, bounded corrective action and verification. Fault injection is not authorized by planning this issue.
