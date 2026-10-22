# Legacy instruction reconciliation

The older agent rules were inspected in:
- [anton415/finance-lab AGENTS.md](https://github.com/anton415/finance-lab/blob/main/AGENTS.md) — current frontend source, original core policy.
- [anton415/finance-lab-archive AGENTS.md](https://github.com/anton415/finance-lab-archive/blob/main/AGENTS.md) — older Russian instruction set.
- [archive AI process](https://github.com/anton415/finance-lab-archive/blob/main/docs/ai-process.md) and [current CI/PR observations](../ai-process.md) — evidence limits, not deployment policy.

| Legacy rule | Treatment in 2026 multi-repo policy |
| --- | --- |
| Only smallest issue-scoped changes; no unapproved feature/requirement/automation | Preserve, explicitly apply to each service and both execution modes. |
| Do not expand Release 1 because a reviewer hypothesizes an out-of-scope failure | Preserve, alongside current scoped review rules. |
| For documentation-only changes, inspect changed text, links and examples | Preserve; don't falsely claim a code/test run. |
| Metrics must use verified technical sources; unknown must not be zero | Preserve; use `unknown` for missing evidence. |
| GitHub account activity is not necessarily a human action; do not store chat in metrics | Preserve; apply also to human merge/signoff and learning assessments. |
| Follow `~/.codex/AGENTS.md` | **Not transplanted literally**; local machine file is not available to cloud agents. Its project-relevant substantive rules are now in repository files. |
| AI commit identity/trailers, scoped PR verification and public-data protection | Preserve the more detailed current frontend policy, and share in the service template. |

The [service AGENTS template](service-AGENTS-template.md) is intended for organization repositories that currently lack their own root policy. Do not treat publication here as installation in those repositories. Root `AGENTS.md` governs only the repository where it is committed, not external GitHub organizations.
