#!/usr/bin/env node
// Status line module: reads Claude Code's statusLine JSON on stdin and prints the
// repository, branch, pull request, CI runs, uncommitted line diff and how far the
// branch is ahead of or behind its upstream. Runs on its own as a `statusLine`
// command too.
//
//   node git-repo.mjs [--segments repo,branch,pr,ci,diff,sync] [--separator " · "] [--ci-ttl 60]
//
// CI comes from the GitHub CLI (`gh`), which is too slow to wait for on every
// redraw: the last answer is cached per branch and refreshed in the background
// once it is older than --ci-ttl seconds. Without `gh` the CI segment is empty.
import { execFile, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import {
  DEFAULT_SEGMENTS,
  buildLine,
  parseAheadBehind,
  parseSegments,
  parseShortstat,
  repoName,
  summarizeRuns,
} from './repo.mjs'

const CACHE_DIR = path.join(os.tmpdir(), 'agent-kit-git-repo')

// Resolves the command's trimmed stdout, or undefined when it fails.
function run(file, args, cwd, timeout = 1500) {
  return new Promise(resolve => {
    execFile(file, args, { cwd, timeout, windowsHide: true, encoding: 'utf8' }, (error, stdout) =>
      resolve(error ? undefined : stdout.trim()),
    )
  })
}

const git = (cwd, ...args) => run('git', args, cwd)

function ciFiles(toplevel, branch) {
  const key = createHash('sha1').update(`${toplevel}\0${branch}`).digest('hex').slice(0, 16)
  return { cache: path.join(CACHE_DIR, `${key}.json`), lock: path.join(CACHE_DIR, `${key}.lock`) }
}

// Asks GitHub for the branch's latest runs and caches the summary, gh missing included.
async function refreshCi(toplevel, branch) {
  const files = ciFiles(toplevel, branch)
  const out = await run(
    'gh',
    ['run', 'list', '--branch', branch, '--limit', '10', '--json', 'status,conclusion'],
    toplevel,
    20000,
  )
  let ci = null
  try {
    ci = out === undefined ? null : (summarizeRuns(JSON.parse(out)) ?? null)
  } catch {
    // Unreadable answer: cache it as unknown until the next refresh.
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  fs.writeFileSync(files.cache, JSON.stringify({ checkedAt: Date.now(), ci }))
  fs.rmSync(files.lock, { force: true })
}

// The cached CI state, starting a background refresh when it is stale.
function cachedCi(toplevel, branch, ttlMs) {
  const files = ciFiles(toplevel, branch)
  let cached
  try {
    cached = JSON.parse(fs.readFileSync(files.cache, 'utf8'))
  } catch {
    // No answer yet.
  }
  const isStale = !cached || Date.now() - cached.checkedAt > ttlMs
  if (isStale) {
    let lockAge = Infinity
    try {
      lockAge = Date.now() - fs.statSync(files.lock).mtimeMs
    } catch {
      // No refresh running.
    }
    if (lockAge > 30000) {
      fs.mkdirSync(CACHE_DIR, { recursive: true })
      fs.writeFileSync(files.lock, '')
      const script = fileURLToPath(import.meta.url)
      spawn(process.execPath, [script, '--refresh-ci', toplevel, branch], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      }).unref()
    }
  }
  return cached?.ci ?? undefined
}

const { values, positionals } = parseArgs({
  options: {
    segments: { type: 'string', default: DEFAULT_SEGMENTS },
    separator: { type: 'string', default: ' · ' },
    'ci-ttl': { type: 'string', default: '60' },
    'refresh-ci': { type: 'boolean', default: false },
  },
  allowPositionals: true,
  strict: false,
})

if (values['refresh-ci']) {
  await refreshCi(positionals[0], positionals[1])
  process.exit(0)
}

let input = ''
process.stdin.setEncoding('utf8')
for await (const chunk of process.stdin) input += chunk

let data = {}
try {
  data = JSON.parse(input || '{}')
} catch {
  // Unreadable input: work from the current directory alone.
}

const cwd = data.workspace?.current_dir ?? data.cwd ?? process.cwd()
const segments = parseSegments(values.segments)
const toplevel = await git(cwd, 'rev-parse', '--show-toplevel')

if (toplevel === undefined) {
  // Not a git repository: nothing to show.
  process.exit(0)
}

const [current, shortstat, counts] = await Promise.all([
  git(cwd, 'branch', '--show-current'),
  segments.includes('diff') ? git(cwd, 'diff', '--shortstat', 'HEAD') : undefined,
  segments.includes('sync') ? git(cwd, 'rev-list', '--left-right', '--count', '@{upstream}...HEAD') : undefined,
])
const sha = current ? undefined : await git(cwd, 'rev-parse', '--short', 'HEAD')
const branch = current || (sha ? `@${sha}` : undefined)

const ttlMs = Math.max(10, Number(values['ci-ttl']) || 60) * 1000
const facts = {
  repo: repoName(data, toplevel),
  branch,
  pr: data.pr ? { number: data.pr.number, url: data.pr.url, reviewState: data.pr.review_state, kind: data.pr.kind } : undefined,
  ci: segments.includes('ci') && current ? cachedCi(toplevel, current, ttlMs) : undefined,
  diff: shortstat === undefined ? undefined : parseShortstat(shortstat),
  sync: counts === undefined ? undefined : parseAheadBehind(counts),
}

process.stdout.write(buildLine(segments, facts, { separator: String(values.separator), isColored: !process.env.NO_COLOR }))
