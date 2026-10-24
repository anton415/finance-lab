# finance-lab

[![CI](https://github.com/anton415/finance-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/anton415/finance-lab/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/anton415/finance-lab/graph/badge.svg)](https://codecov.io/gh/anton415/finance-lab)

Finance Lab is an open-source personal-finance application and an engineering lab for experimenting with reliable, efficient AI-agent-assisted software development (AgentOps).

The project is at an early stage. Its initial technology direction is Vite, React, and TypeScript.

All examples and financial data in this repository are synthetic.

## Current organization direction

The maintained frontend is [finance-lab-project/frontend](https://github.com/finance-lab-project/frontend).
[ADR-031](https://github.com/finance-lab-project/platform/blob/a783e14d3ee872245d717eb413f108b811d0209f/docs/architecture/decisions/0031-java-spring-budget-incremental-releases.md) selects **Java + Spring Boot** as the primary Budget backend,
with **React + TypeScript** and **PostgreSQL when needed**. The [current roadmap](https://github.com/finance-lab-project/platform/blob/a783e14d3ee872245d717eb413f108b811d0209f/docs/engineering/current-roadmap.md)
prioritizes a tiny functional frontend-only release on October 24–25, 2026.
Go is optional later standalone service/CLI learning, outside Release 1.

This repository retains the original Spring T2 source and architecture history.
[Platform #16](https://github.com/finance-lab-project/platform/issues/16) audits Spring reuse and
contracts before any separately approved implementation or repository move.
Valid Spring PUT still returns 501; the scaffolding is not a working persistence backend.
No existing code, storage or backup contract changes with this decision.

The [Go Budget Stage 0 specification](docs/go-budget/stage-0-specification.md)
records the historical migration boundaries, API, persistence, testing and recovery
plan. Its Release 1 production direction is superseded by ADR-031; existing Spring and V2 contracts remain unchanged.
Its [revision record](docs/go-budget/revision-1.md) pins the artifacts and evidence.

The monthly planner has one income amount, fifteen fixed spending categories,
and a separate investment allocation. Remaining is Income − Spending − Investments.
All categories stay visible. Valid edits save under the selected month's browser
storage key; totals are derived. Incomplete or invalid amount edits show an error
and are not saved or exported until corrected. Incompatible pre-MVP local data
starts an empty budget with no migration. See the [v2 model and contract](docs/budget-backup-contract.md).

See the [budget export guide](docs/budget-export.md) for selected-month CSV
inspection and lossless JSON backups, including spreadsheet limitations.
Use the [backup preview guide](docs/budget-backup-preview.md) to validate and
inspect a local JSON backup without changing any budgets.
Use the [restore guide](docs/budget-backup-restore.md) to confirm replacement of
the backup's month, including failure handling and storage limitations.
Use the [Python validator guide](docs/python-budget-validator.md) to validate
a local backup with the standard-library CLI and run the shared-contract tests.

See the [coding-agent evaluation guide](docs/evals/README.md) for candidate tasks
and the manually calibrated month-isolation example.
See the [PR lifecycle dry-run guide](docs/pr-lifecycle-dry-run.md) for event
mapping, safe issue resolution, fixture evidence, and the human gate before writes.

## Codex Cloud PR reviews

Codex Cloud is an advisory PR reviewer. It automatically reviews PRs opened by the repository owner when they are opened; exhaustive review is disabled. A human evaluates every finding and decides whether a change is required. Codex findings do not modify code, approve, merge, deploy, or perform external actions. GitHub remains authoritative for relevant CI and check results.

PR #29 was the initial review trial. The integration worked and identified useful defects and edge cases, but some findings expanded beyond the intended MVP scope. Repository-specific review rules in `AGENTS.md` were added as the corrective action.
