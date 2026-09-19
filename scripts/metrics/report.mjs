export function buildReport(observations) {
  const latestByPr = new Map()
  for (const observation of observations) {
    const current = latestByPr.get(observation.pr.number)
    if (!current || observation.collected_at > current.collected_at) {
      latestByPr.set(observation.pr.number, observation)
    }
  }

  const prs = [...latestByPr.values()]
    .map((observation) => {
      const runs = observation.ci_runs ?? []
      const completed = runs.filter((run) => run.status === 'completed')
      const failed = completed.filter((run) => run.conclusion !== 'success').length
      const changesRequested = (observation.reviews ?? []).filter((review) => review.state === 'CHANGES_REQUESTED').length
      return {
        pr_number: observation.pr.number,
        cycle_time_hours: observation.pr.closed_at === 'unknown' ? 'unknown' : (new Date(observation.pr.closed_at) - new Date(observation.pr.created_at)) / 3_600_000,
        commits: observation.pr.commits,
        additions: observation.pr.additions,
        deletions: observation.pr.deletions,
        changed_files: observation.pr.changed_files,
        ci_attempts: runs.length,
        ci_failures: failed,
        review_correction_rounds: changesRequested,
        first_pass_success: 'unknown',
      }
    })
    .sort((left, right) => left.pr_number - right.pr_number)
  return { schema_version: 1, generated_from: 'data/prs/*.json', prs }
}

async function main() {
  const [inputDirectory, outputFile] = process.argv.slice(2)
  if (!inputDirectory || !outputFile) throw new Error('Usage: report.mjs <input-directory> <output-file>')
  const fs = await import('node:fs/promises')
  const files = []
  async function collectJsonFiles(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`
      if (entry.isDirectory()) await collectJsonFiles(path)
      else if (entry.name.endsWith('.json')) files.push(path)
    }
  }
  await collectJsonFiles(inputDirectory)
  const observations = await Promise.all(files.map(async (file) => JSON.parse(await fs.readFile(file, 'utf8'))))
  await fs.writeFile(outputFile, `${JSON.stringify(buildReport(observations), null, 2)}\n`)
}

if (import.meta.main) main()
