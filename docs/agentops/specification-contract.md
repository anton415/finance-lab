# Specification contract v1

Status: proposed for [#127](https://github.com/anton415/finance-lab/issues/127);
human baseline acceptance and device evidence are pending. This is a manual
contract, not an implemented approval controller. Use the
[worked example and review evidence](specification-review-example.md).

## Roles and authority

- **Author (ChatGPT-like planner):** states what, why and acceptance; cites existing
  contracts, flags unknowns, and owns revisions after review. Record actual author
  provenance; a GitHub posting account alone does not identify the drafting agent.
- **Independent reviewer (Codex):** challenges the supplied revision against the
  rubric below. Record the actual input and findings, not a simulated second role.
  Suggestions or edits are proposals, never product approval.
- **Human maintainer:** resolves product/scope decisions and accepts or rejects
  the exact specification and any required design. All pilot baselines require
  this decision. No low-risk auto-promotion policy is established here.
- **Trusted controller:** alone may promote an accepted pilot to
  `Ready + needs:implementation`, after validating authority and current revision.
  The spec-acceptance path is not implemented; keep promotion disabled until
  [#131](https://github.com/anton415/finance-lab/issues/131) verifies a viable gate.

[AGENTS.md](../../AGENTS.md) continues to govern review scope.
[#81](https://github.com/anton415/finance-lab/issues/81) keeps Project Status as the
only lifecycle field and permits at most one `needs:*` label; descriptive labels
remain orthogonal. The following are review outcomes, not new Project fields:

| Situation | Next action / existing workflow |
| --- | --- |
| Draft or rejected ambiguity | Author refines; `needs:spec` if selected for work, otherwise deferred without a workflow label. |
| Product decision or baseline acceptance needed | Human decides; `needs:human`, without declaring the issue Ready. |
| Quality PASS plus human acceptance for the same current revision | Eligible for trusted promotion only when the gate is implemented and enabled. |
| Revision changes | Prior quality and human acceptance are invalid; return for review, never continue on stale consent. |

Reuse [#94's current-state reconciliation](../pr-lifecycle-live.md) for linked
implementation PRs. Its PR fingerprint does **not** validate a specification
body. [#95](https://github.com/anton415/finance-lab/issues/95) is the deferred
current-head code-review handoff, not a specification gate. This contract adds no
labels, dispatch, credentials, workflow writes, merge or deployment authority.

## Short issue template

Every field needs a concrete answer, or `N/A` with a reason. An unresolved
decision must be listed, not filled with an invented requirement.

```markdown
## Problem / evidence
Observed gap; links to current code, issue or reproducible evidence.
## Outcome / value
Who benefits and the measurable result.
## Behavior
User-visible/API inputs, outputs, errors and unchanged behavior.
## Scope
In scope; explicitly out of scope.
## Contracts / dependencies
Source-of-truth links at immutable revisions; prerequisites and their status.
## Data / security invariants
Preservation, ownership/isolation, side effects and synthetic-data constraints.
## Acceptance / negative cases
Numbered, observable input -> result criteria; failures and no-change assertions.
## Verification / evidence
Named tests/checks, how to run them, expected results and where observed results go.
Distinguish planned verification from completed evidence.
## Learning / human demonstration
What the human will explain or demonstrate, or N/A with reason.
## Design checkpoint
Required with reason and revision link, or not required with existing-design link.
## Questions / risks
Unresolved decisions, owner and consequence; explicit none if resolved.
## Revision / decisions
Author provenance, source snapshot, spec digest, design revision if applicable,
quality verdict link and separate human decision link (pending until observed).
```

## Conditional design checkpoint

Specification is **what/why/acceptance**; design is **how/alternatives/constraints**.
Require a short design note only for persistent schema or data ownership,
authentication/authorization, service/API boundaries, external integrations,
agent tool permissions, execution concurrency/retries, or cloud/release architecture.
A local validation/UI rule normally links existing design and stops at spec + tests.

Use the issue or an existing `docs/t2/` or `docs/agentops/` note, preferably one
page: context/constraints; component responsibilities; sequence/data flow;
interfaces/storage; security and failure invariants; one reasonable alternative
and its tradeoff; chosen decision/rationale; testability; open questions.
The planner proposes; Codex independently checks correctness, compatibility,
feasibility and unnecessary complexity. Include design in the accepted snapshot
or bind its separate immutable revision in the same decision record.

## Independent review rubric

Check every row against the exact snapshot and cited contracts. A finding records
`ID | blocking/question/optional | spec criterion + contract reference | concrete
problem and consequence | proposed resolution / decision owner`.

| Check | Reject or return for clarification when |
| --- | --- |
| R1 Completeness / verification | A required field is absent without justification; a criterion lacks an observable result or test/evidence path. |
| R2 Contradictions / ambiguity | Two clauses conflict, or materially different behaviors could both satisfy the wording. |
| R3 Error cases | An in-scope invalid input/failure lacks its expected error and side-effect outcome. |
| R4 Compatibility / isolation | A criterion violates a cited contract, exact data preservation, user/month isolation or existing behavior. |
| R5 Scope / complexity | A requirement has no source in the selected issue/accepted decision, or adds unnecessary infrastructure/abstractions. |
| R6 Revision / design / authority | Provenance, source revision or necessary design is missing; stale review, self-approval or unverified human consent is used. |

`blocking` means a concrete in-scope defect prevents acceptance. `question` means
the author/human must supply missing information; material unanswered questions
prevent PASS. `optional` means a nonblocking suggestion and cannot enlarge scope.
Do not demand out-of-scope robustness or future capabilities.

Return **PASS** (all rows checked, no blockers/material questions),
**CHANGES_REQUESTED** (concrete blocking defects), or **BLOCKED** (insufficient
context or a required decision). Report explicitly when there are no findings.
Every verdict names the exact spec digest and design revision reviewed. A PASS is
only a quality verdict; it never supplies human authorization.

## Immutable revisions and revision ownership

1. Preserve the reviewed issue body as a repository artifact and calculate
   SHA-256 over its UTF-8 bytes. Document any capture transformation (for example,
   one final LF). Pin source contracts to full commit SHAs. Link the artifact at
   its full commit SHA; an issue URL, branch URL or `updatedAt` alone is not a version.
2. Record target repo/issue, artifact path + digest, source contract revisions,
   design revision, reviewer/verdict and decision links. Human acceptance must
   name the same tuple; changes to any member require renewed review/acceptance.
3. Any body/artifact edit, including a Codex edit, creates a new revision. Return
   it to the author for resolution and independent review. The human may explicitly
   resolve a disputed finding on the new digest; preserve that resolution without
   relabelling it as an independent Codex PASS. Never inherit acceptance implicitly.
4. Immediately before promotion, the trusted gate must reread current source and
   candidate revisions and validate both decisions. Stale/missing/ambiguous evidence
   means zero writes. An edit after acceptance invalidates eligibility; an eventual
   controller must reconcile this, not assume a previous label proves approval.

Example digest check (not an approval action):

```bash
shasum -a 256 docs/agentops/examples/issue-123-source.md
```

## Human summary and iPhone decision boundary

Each handoff fits in a short summary: **what changes; why; tests and actual status;
decisions needed; risks; direct links** to the pinned spec/design, critique, diff,
checks and decision surface. Include the full digest in copyable text.

The proposed phone action is an authenticated maintainer decision on the linked
GitHub issue/PR, naming `accept`, `reject` or `request changes`, target, spec digest
and design revision (or N/A). This is a record format, **not a functioning command**.
GitHub Mobile or Safari must support the entire action; record actual device
results in #131 before enabling it. No local file editing or terminal is required
of the human. A missing phone path keeps the gate disabled.

The eventual trusted gate must validate the authenticated sender/authorization,
target, exact current revisions, lifecycle eligibility and single-use decision;
duplicates are no-ops, stale/unauthorized/malformed decisions make no writes.
Agent-authored messages, reactions, copied usernames and `LGTM` are not consent.
Sender identity alone cannot distinguish a human from an agent using that same
account's credentials: #131 must establish a human-only decision path before
promotion is enabled. Do not use an agent to submit the human's acceptance.

A PR author cannot formally approve their own PR. An owner-authenticated comment
can record project signoff only after the above boundary is verified; it is not
a native required-review approval. Preserve branch protection, required checks
and explicit human merge. Spec, design, merge, permissions and deployment are
separate decisions, each requiring a phone-capable path when enabled.

The remaining human demonstration is to explain one corrected ambiguous criterion
and identify its accepted digest; from an actual iPhone, accept/reject current
spec/design revisions and show stale-revision refusal with attributable evidence.
Manual rubric exercises do not prove that device/controller behavior.
