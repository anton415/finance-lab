const apiVersion = '2022-11-28'

function asUnknown(value) {
  return value ?? 'unknown'
}

async function allPages(request, path, property) {
  const items = []
  for (let page = 1; ; page += 1) {
    const response = await request(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`)
    const values = property ? response[property] : response
    items.push(...values)
    if (values.length < 100) return items
  }
}

export async function collectObservation({ request, repository, prNumber, collectedAt, run }) {
  const pr = await request(`/repos/${repository}/pulls/${prNumber}`)
  const [commits, files, reviews, runs] = await Promise.all([
    allPages(request, `/repos/${repository}/pulls/${prNumber}/commits`),
    allPages(request, `/repos/${repository}/pulls/${prNumber}/files`),
    allPages(request, `/repos/${repository}/pulls/${prNumber}/reviews`),
    allPages(request, `/repos/${repository}/actions/runs?event=pull_request&head_sha=${encodeURIComponent(pr.head.sha)}`, 'workflow_runs'),
  ])

  return {
    schema_version: 1,
    record_kind: 'github_pr_ci_observation',
    collected_at: collectedAt,
    collector_run: run,
    pr: {
      number: pr.number,
      state: pr.state,
      draft: pr.draft,
      created_at: pr.created_at,
      updated_at: pr.updated_at,
      closed_at: asUnknown(pr.closed_at),
      merged_at: asUnknown(pr.merged_at),
      head_sha: pr.head.sha,
      base_sha: pr.base.sha,
      commits: commits.length,
      additions: pr.additions,
      deletions: pr.deletions,
      changed_files: files.length,
    },
    reviews: reviews.map((review) => ({
      id: review.id,
      state: review.state,
      submitted_at: asUnknown(review.submitted_at),
      commit_id: asUnknown(review.commit_id),
    })),
    ci_runs: runs.map((ciRun) => ({
      id: ciRun.id,
      name: ciRun.name,
      event: ciRun.event,
      head_sha: ciRun.head_sha,
      run_attempt: ciRun.run_attempt,
      status: ciRun.status,
      conclusion: asUnknown(ciRun.conclusion),
      created_at: ciRun.created_at,
      updated_at: ciRun.updated_at,
      html_url: ciRun.html_url,
    })),
  }
}

function parsePrNumbers(value) {
  if (!value) return []
  if (!/^[1-9]\d*(,[1-9]\d*)*$/.test(value)) {
    throw new Error('PR numbers must be comma-separated positive integers')
  }
  return [...new Set(value.split(',').map(Number))]
}

async function main() {
  const [outputDirectory, repository, prNumbersInput = ''] = process.argv.slice(2)
  if (!outputDirectory || !repository) throw new Error('Usage: collect.mjs <output-directory> <owner/repo> [pr-numbers]')
  const prNumbers = parsePrNumbers(prNumbersInput)
  if (prNumbers.length === 0) return

  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error('GITHUB_TOKEN is required')
  const request = async (path) => {
    const response = await fetch(`https://api.github.com${path}`, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': apiVersion },
    })
    if (!response.ok) throw new Error(`GitHub API request failed: ${response.status} ${path}`)
    return response.json()
  }

  const fs = await import('node:fs/promises')
  await fs.mkdir(outputDirectory, { recursive: true })
  for (const prNumber of prNumbers) {
    const observation = await collectObservation({
      request,
      repository,
      prNumber,
      collectedAt: new Date().toISOString(),
      run: { id: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT, sha: process.env.GITHUB_SHA },
    })
    await fs.writeFile(`${outputDirectory}/${prNumber}.json`, `${JSON.stringify(observation, null, 2)}\n`)
  }
}

if (import.meta.main) main()
