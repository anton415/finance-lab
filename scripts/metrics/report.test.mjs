import assert from 'node:assert/strict'
import test from 'node:test'
import { buildReport } from './report.mjs'

function observation(overrides = {}) {
  return {
    collected_at: '2026-01-02T00:00:00Z',
    pr: { number: 2, created_at: '2026-01-01T00:00:00Z', closed_at: '2026-01-02T00:00:00Z', commits: 1, additions: 2, deletions: 0, changed_files: 1 },
    reviews: [],
    ci_runs: [],
    ...overrides,
  }
}

function ciRun(overrides = {}) {
  return { id: 10, run_attempt: 1, event: 'pull_request', head_sha: 'head-a', status: 'completed', conclusion: 'success', ...overrides }
}

test('buildReport uses the latest observation per PR and preserves unknown first-pass success', () => {
  const latest = observation({
    collected_at: '2026-01-03T00:00:00Z',
    pr: { ...observation().pr, commits: 3, additions: 8, deletions: 1, changed_files: 2 },
    reviews: [{ state: 'CHANGES_REQUESTED' }, { state: 'COMMENTED' }],
    ci_runs: [ciRun({ conclusion: 'failure' }), ciRun({ id: 11 })],
  })
  const open = observation({ pr: { ...observation().pr, number: 1, closed_at: 'unknown' } })
  const report = buildReport([latest, observation(), open])
  assert.deepEqual(report.prs.map((pr) => pr.pr_number), [1, 2])
  assert.equal(report.prs[0].cycle_time_hours, 'unknown')
  assert.equal(report.prs[0].ci_attempts, 0)
  assert.deepEqual(report.prs[1], {
    pr_number: 2,
    cycle_time_hours: 24,
    commits: 3,
    additions: 8,
    deletions: 1,
    changed_files: 2,
    ci_attempts: 2,
    ci_failures: 1,
    review_correction_rounds: 1,
    first_pass_success: 'unknown',
  })
})

test('buildReport retains CI runs from earlier heads without counting repeated snapshots', () => {
  const first = observation({ ci_runs: [ciRun()] })
  const second = observation({
    collected_at: '2026-01-03T00:00:00Z',
    ci_runs: [ciRun({ id: 11, head_sha: 'head-b' })],
  })
  const snapshots = [second, first, second, first]
  const report = buildReport(snapshots)
  assert.equal(report.prs[0].ci_attempts, 2)
  assert.equal(report.prs[0].ci_failures, 0)
  assert.deepEqual(buildReport(snapshots.toReversed()), report)
})

test('buildReport retains a failed attempt when a retry succeeds and uses the latest attempt state', () => {
  const failed = observation({ ci_runs: [ciRun({ conclusion: 'failure' })] })
  const retrying = observation({
    collected_at: '2026-01-03T00:00:00Z',
    ci_runs: [ciRun({ run_attempt: 2, status: 'in_progress', conclusion: 'unknown' })],
  })
  const succeeded = observation({
    collected_at: '2026-01-04T00:00:00Z',
    ci_runs: [ciRun({ run_attempt: 2 })],
  })
  const snapshots = [succeeded, failed, retrying, succeeded]
  const report = buildReport(snapshots)
  assert.equal(report.prs[0].ci_attempts, 2)
  assert.equal(report.prs[0].ci_failures, 1)
  assert.deepEqual(buildReport(snapshots.toReversed()), report)
})

test('buildReport counts only retained attempts when earlier retry history is missing', () => {
  const report = buildReport([observation({ ci_runs: [ciRun({ run_attempt: 3 })] })])
  assert.equal(report.prs[0].ci_attempts, 1)
  assert.equal(report.prs[0].ci_failures, 0)
  assert.equal(report.prs[0].first_pass_success, 'unknown')
})

test('buildReport uses the latest observed conclusion for a repeated attempt', () => {
  const pending = observation({ ci_runs: [ciRun({ status: 'in_progress', conclusion: 'unknown' })] })
  const completed = observation({
    collected_at: '2026-01-03T00:00:00Z',
    ci_runs: [ciRun({ conclusion: 'failure' })],
  })
  const report = buildReport([completed, pending, completed])
  assert.equal(report.prs[0].ci_attempts, 1)
  assert.equal(report.prs[0].ci_failures, 1)
})

test('buildReport retains a pending run when the latest snapshot has no CI data', () => {
  const earlier = observation({ ci_runs: [ciRun({ status: 'in_progress', conclusion: 'unknown' })] })
  const latest = observation({ collected_at: '2026-01-03T00:00:00Z' })
  const report = buildReport([earlier, latest])
  assert.equal(report.prs[0].ci_attempts, 1)
  assert.equal(report.prs[0].ci_failures, 0)
})
