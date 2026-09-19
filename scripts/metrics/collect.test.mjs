import assert from 'node:assert/strict'
import test from 'node:test'
import { collectObservation } from './collect.mjs'

test('collectObservation preserves observable PR and CI data', async () => {
  const responses = new Map([
    ['/repos/example/finance/pulls/7', { number: 7, state: 'closed', draft: false, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z', closed_at: '2026-01-02T00:00:00Z', merged_at: null, head: { sha: 'head' }, base: { sha: 'base' }, additions: 4, deletions: 2 }],
    ['/repos/example/finance/pulls/7/commits?per_page=100&page=1', [{}, {}]],
    ['/repos/example/finance/pulls/7/files?per_page=100&page=1', [{}]],
    ['/repos/example/finance/pulls/7/reviews?per_page=100&page=1', [{ id: 1, state: 'CHANGES_REQUESTED', submitted_at: null, commit_id: null }]],
    ['/repos/example/finance/actions/runs?event=pull_request&head_sha=head&per_page=100&page=1', { workflow_runs: [{ id: 10, name: 'CI', event: 'pull_request', head_sha: 'head', run_attempt: 1, status: 'completed', conclusion: 'failure', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:01:00Z', html_url: 'https://example.test/run/10' }] }],
  ])
  const observation = await collectObservation({ request: async (path) => responses.get(path) ?? [], repository: 'example/finance', prNumber: 7, collectedAt: '2026-01-03T00:00:00Z', run: { id: '1' } })
  assert.equal(observation.pr.commits, 2)
  assert.equal(observation.pr.changed_files, 1)
  assert.equal(observation.pr.merged_at, 'unknown')
  assert.equal(observation.ci_runs[0].conclusion, 'failure')
})
