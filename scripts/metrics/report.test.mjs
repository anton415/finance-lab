import assert from 'node:assert/strict'
import test from 'node:test'
import { buildReport } from './report.mjs'

test('buildReport is deterministic and preserves unknown first-pass success', () => {
  const report = buildReport([{ pr: { number: 2, created_at: '2026-01-01T00:00:00Z', closed_at: '2026-01-02T00:00:00Z', commits: 3, additions: 8, deletions: 1, changed_files: 2 }, reviews: [{ state: 'CHANGES_REQUESTED' }], ci_runs: [{ status: 'completed', conclusion: 'failure' }, { status: 'completed', conclusion: 'success' }] }, { pr: { number: 1, created_at: '2026-01-01T00:00:00Z', closed_at: 'unknown', commits: 1, additions: 1, deletions: 0, changed_files: 1 }, reviews: [], ci_runs: [] }])
  assert.deepEqual(report.prs.map((pr) => pr.pr_number), [1, 2])
  assert.equal(report.prs[0].cycle_time_hours, 'unknown')
  assert.equal(report.prs[1].ci_failures, 1)
  assert.equal(report.prs[1].first_pass_success, 'unknown')
})
