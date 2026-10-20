# Stage 0 revision 1 record

Date: 2026-10-20. Target: `anton415/finance-lab`
[#142](https://github.com/anton415/finance-lab/issues/142).
Author: Codex (OpenAI), recording the maintainer's planning baseline.
This record identifies the exact documentation candidate; it is not an
independent review or human acceptance.

## Immutable candidate and design

| Artifact | Immutable revision | SHA-256 of complete UTF-8 bytes |
| --- | --- | --- |
| Captured issue body | [issue-142-source.md](https://github.com/anton415/finance-lab/blob/ae6d355bffc397d7714d583befdce54332a6c712/docs/go-budget/issue-142-source.md) | `b1c753c74e1f699e6986b4f9773ab8e24bd23d705f634511718445cc233e8cb5` |
| Repository specification and design revision 1 | [stage-0-specification.md](https://github.com/anton415/finance-lab/blob/ae6d355bffc397d7714d583befdce54332a6c712/docs/go-budget/stage-0-specification.md) | `37402bd2d3cf4a04c43579d7247b46969c0766581adfa4e4f35dae69d5abb136` |

Artifact commit: `ae6d355bffc397d7714d583befdce54332a6c712`. The design checkpoint is included
in the specification's bytes, not an independently mutable design attachment.

Capture convention: the issue's GitHub API `body` string was saved as UTF-8;
trailing LF characters were replaced with exactly one final LF. No wording,
headings, links or decisions were inserted into that captured body. Its original
pending-capture statements remain historical text; this record supplies the
actual capture identifiers. The specification is a separate authored elaboration,
not a claim that the captured issue body was edited or newly accepted.

## Complete bound source set

All entries below are in `anton415/finance-lab` at the same inspected source
snapshot `a214a664f5409e91c10ec4468a53c2a104936bc5`. Contract and implementation evidence links
are enumerated so a reviewer can bind the exact input set. Live issue pages
#122–#125 are historical context, not substitutes for these pinned sources.

| Source path | Full commit / immutable link |
| --- | --- |
| `docs/architecture/decisions/0030-release1-go-migration-implementation-sequence.md` | [a214a664f5409e91c10ec4468a53c2a104936bc5](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/architecture/decisions/0030-release1-go-migration-implementation-sequence.md) |
| `docs/architecture/decisions/0022-exact-decimal-money-currency-contract.md` | [a214a664f5409e91c10ec4468a53c2a104936bc5](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/architecture/decisions/0022-exact-decimal-money-currency-contract.md) |
| `docs/architecture/decisions/0024-openapi-contract-first-rest-versioning.md` | [a214a664f5409e91c10ec4468a53c2a104936bc5](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/architecture/decisions/0024-openapi-contract-first-rest-versioning.md) |
| `docs/architecture/decisions/0014-keycloak-service-to-service-security.md` | [a214a664f5409e91c10ec4468a53c2a104936bc5](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/architecture/decisions/0014-keycloak-service-to-service-security.md) |
| `docs/architecture/decisions/0023-postgresql-bff-sessions-and-oauth-lifecycle.md` | [a214a664f5409e91c10ec4468a53c2a104936bc5](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/architecture/decisions/0023-postgresql-bff-sessions-and-oauth-lifecycle.md) |
| `docs/architecture/decisions/0019-backup-recovery-objectives-drills.md` | [a214a664f5409e91c10ec4468a53c2a104936bc5](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/architecture/decisions/0019-backup-recovery-objectives-drills.md) |
| `docs/agentops/specification-contract.md` | [a214a664f5409e91c10ec4468a53c2a104936bc5](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/agentops/specification-contract.md) |
| `docs/t2/api-contract.md` | [a214a664f5409e91c10ec4468a53c2a104936bc5](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/t2/api-contract.md) |
| `docs/t2/design.md` | [a214a664f5409e91c10ec4468a53c2a104936bc5](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/t2/design.md) |
| `docs/budget-backup-contract.md` | [a214a664f5409e91c10ec4468a53c2a104936bc5](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/docs/budget-backup-contract.md) |
| `src/budgetModel.ts` | [a214a664f5409e91c10ec4468a53c2a104936bc5](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/src/budgetModel.ts) |
| `src/App.tsx` | [a214a664f5409e91c10ec4468a53c2a104936bc5](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/src/App.tsx) |
| `src/budgetStorage.ts` | [a214a664f5409e91c10ec4468a53c2a104936bc5](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/src/budgetStorage.ts) |
| `src/budgetRestore.ts` | [a214a664f5409e91c10ec4468a53c2a104936bc5](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/src/budgetRestore.ts) |
| `src/budgetBackup.ts` | [a214a664f5409e91c10ec4468a53c2a104936bc5](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/src/budgetBackup.ts) |
| `fixtures/budget-backup/v2/manifest.json` | [a214a664f5409e91c10ec4468a53c2a104936bc5](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/fixtures/budget-backup/v2/manifest.json) |
| `backend/src/main/java/io/github/anton415/financelab/BudgetController.java` | [a214a664f5409e91c10ec4468a53c2a104936bc5](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/backend/src/main/java/io/github/anton415/financelab/BudgetController.java) |
| `backend/src/main/java/io/github/anton415/financelab/BudgetService.java` | [a214a664f5409e91c10ec4468a53c2a104936bc5](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/backend/src/main/java/io/github/anton415/financelab/BudgetService.java) |
| `backend/src/main/java/io/github/anton415/financelab/SaveBudgetRequestDeserializer.java` | [a214a664f5409e91c10ec4468a53c2a104936bc5](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/backend/src/main/java/io/github/anton415/financelab/SaveBudgetRequestDeserializer.java) |
| `backend/src/main/java/io/github/anton415/financelab/BudgetExceptionHandler.java` | [a214a664f5409e91c10ec4468a53c2a104936bc5](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/backend/src/main/java/io/github/anton415/financelab/BudgetExceptionHandler.java) |
| `backend/src/test/java/io/github/anton415/financelab/BudgetControllerTest.java` | [a214a664f5409e91c10ec4468a53c2a104936bc5](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/backend/src/test/java/io/github/anton415/financelab/BudgetControllerTest.java) |
| `backend/src/test/java/io/github/anton415/financelab/SaveBudgetRequestTest.java` | [a214a664f5409e91c10ec4468a53c2a104936bc5](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/backend/src/test/java/io/github/anton415/financelab/SaveBudgetRequestTest.java) |
| `backend/pom.xml` | [a214a664f5409e91c10ec4468a53c2a104936bc5](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/backend/pom.xml) |
| `.github/workflows/ci.yml` | [a214a664f5409e91c10ec4468a53c2a104936bc5](https://github.com/anton415/finance-lab/blob/a214a664f5409e91c10ec4468a53c2a104936bc5/.github/workflows/ci.yml) |

## Observed documentation verification

- Source inspection confirmed the Spring GET stub and valid-PUT 501 checkpoint,
  local React persistence, legacy amount preservation and unimplemented
  authentication/persistence. Source tests were inspected, not executed.
- One-off Python documentation checks verified the exact issue capture, all
  local/reference links, 24 immutable source links against the Git object
  database, balanced fences and consistent table columns.
- The JSON create example parsed with duplicate-key rejection and matched all
  fifteen catalog IDs and the five required root fields. Canonical valid/invalid
  amount examples and totals were checked with Python `decimal.Decimal`:
  spending `0.3`, remaining `899.7`, and maximum aggregate magnitudes requiring
  twenty integer digits. These are example checks, not Go implementation tests.
- GitHub's GFM renderer (`gh api markdown`) rendered the specification's complete
  heading structure, eleven tables and one JSON code block successfully.
- `git diff --cached --check` passed before the specification commit.
- `git diff --exit-code a214a664f5409e91c10ec4468a53c2a104936bc5 -- backend src fixtures docs/t2 docs/budget-backup-contract.md .github`
  passed with no differences. A separate allowed-path check restricted changes to
  README and the three files in `docs/go-budget/`.

Digest verification, from the repository root:

```sh
shasum -a 256 docs/go-budget/issue-142-source.md docs/go-budget/stage-0-specification.md
```

No application/database suite was run for this documentation task. No Go,
Keycloak, BFF, migration, replay or recovery runtime outcome is asserted.
The draft PR reports final diff checks; GitHub Checks remain authoritative for
any asynchronous CI and reviews, which are not preclaimed here.

## Decisions and authority

- **Author consistency check:** the specification maps all nine #142 acceptance
  criteria to sections and preserves open choices with owners and needed-by stages.
  This is not an independent quality verdict.
- **Independent reviewer / verdict / immutable review link:** pending; no
  independent PASS is asserted.
- **Human baseline/design acceptance and decision link:** pending. The request to
  record Stage 0 and open a draft documentation PR authorizes that work only.
- **Implementation, Project promotion, merge and production approval:** not
  granted by this record. Spring issues/milestones are unchanged.
- **Open decisions:** D1–D8 in the pinned specification, including public problem
  types, exhaustion response, generation acceptance and actual token issuance.

A specification edit creates a new digest/revision. A source-contract or design
revision change also needs renewed review and human acceptance under the bound
specification contract; no decision transfers implicitly to a later candidate.
