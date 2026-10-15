// Pure helpers for git-repo.mjs, kept free of I/O so they can be tested directly.

export const SEGMENTS = ['repo', 'branch', 'pr', 'ci', 'diff', 'sync']
export const DEFAULT_SEGMENTS = SEGMENTS.join(',')

// Semantic colors (24-bit), the same set the other status line modules use:
// quiet labels, plain values, and a color only where something wants action.
export const COLORS = {
  label: '38;2;139;148;158',
  value: '',
  ok: '38;2;63;185;80',
  warn: '38;2;242;204;96',
  critical: '38;2;248;81;73',
  separator: '38;2;72;79;88',
}

export function paint(color, text, isColored) {
  return isColored && color !== '' ? `\x1b[${color}m${text}\x1b[0m` : text
}

// An OSC 8 hyperlink, clickable in terminals that support it.
function link(url, text, isColored) {
  return isColored && url ? `\x1b]8;;${url}\x07${text}\x1b]8;;\x07` : text
}

// Unknown names are dropped, duplicates kept once, so a typo never breaks the line.
export function parseSegments(spec) {
  const picked = []
  for (const raw of String(spec).split(',')) {
    const name = raw.trim().toLowerCase()
    if (SEGMENTS.includes(name) && !picked.includes(name)) picked.push(name)
  }
  return picked
}

// `git diff --shortstat` output as added and removed line counts.
export function parseShortstat(text) {
  const added = /(\d+) insertion/.exec(text)
  const removed = /(\d+) deletion/.exec(text)
  return { added: added ? Number(added[1]) : 0, removed: removed ? Number(removed[1]) : 0 }
}

// `git rev-list --left-right --count @{upstream}...HEAD` output: behind, then ahead.
export function parseAheadBehind(text) {
  const match = /^(\d+)\s+(\d+)/.exec(String(text).trim())
  return match ? { behind: Number(match[1]), ahead: Number(match[2]) } : undefined
}

const ACTIVE = new Set(['queued', 'in_progress', 'waiting', 'pending', 'requested'])
const FAILED = new Set(['failure', 'timed_out', 'startup_failure', 'action_required'])

// `gh run list --json status,conclusion` rows, newest first, as one CI state:
// how many runs are queued or running, else how the latest finished one ended.
export function summarizeRuns(runs) {
  if (!Array.isArray(runs) || runs.length === 0) return undefined
  const active = runs.filter(run => ACTIVE.has(run.status)).length
  if (active > 0) return { state: 'running', count: active }
  const latest = runs.find(run => run.status === 'completed')
  if (!latest) return undefined
  if (latest.conclusion === 'success') return { state: 'passed' }
  if (FAILED.has(latest.conclusion)) return { state: 'failed' }
  return { state: 'other', conclusion: latest.conclusion }
}

// The repository's name: owner/name from the origin remote, else its folder.
export function repoName(data, toplevel) {
  const repo = data.workspace?.repo
  if (repo?.owner && repo?.name) return `${repo.owner}/${repo.name}`
  if (!toplevel) return undefined
  const parts = String(toplevel).split(/[\\/]+/).filter(Boolean)
  return parts[parts.length - 1]
}

const REVIEW = {
  approved: { mark: '✓', color: 'ok' },
  changes_requested: { mark: '✗', color: 'warn' },
  pending: { mark: '…', color: 'label' },
  draft: { mark: 'draft', color: 'label' },
}

function render(segment, facts, isColored) {
  const label = text => paint(COLORS.label, text, isColored)
  const value = text => paint(COLORS.value, text, isColored)
  switch (segment) {
    case 'repo':
      return facts.repo === undefined ? undefined : value(facts.repo)
    case 'branch':
      return facts.branch === undefined ? undefined : `${label('⎇')} ${value(facts.branch)}`
    case 'pr': {
      if (!facts.pr?.number) return undefined
      const prefix = facts.pr.kind === 'mr' ? 'MR !' : 'PR #'
      const text = link(facts.pr.url, value(`${prefix}${facts.pr.number}`), isColored)
      const review = REVIEW[facts.pr.reviewState]
      return review ? `${text} ${paint(COLORS[review.color], review.mark, isColored)}` : text
    }
    case 'ci': {
      const ci = facts.ci
      if (ci === undefined) return undefined
      if (ci.state === 'running') return `${label('CI')} ${paint(COLORS.warn, `⏳${ci.count}`, isColored)}`
      if (ci.state === 'passed') return `${label('CI')} ${paint(COLORS.ok, '✓', isColored)}`
      if (ci.state === 'failed') return `${label('CI')} ${paint(COLORS.critical, '✗', isColored)}`
      return `${label('CI')} ${label(ci.conclusion ?? '?')}`
    }
    case 'diff': {
      const { added = 0, removed = 0 } = facts.diff ?? {}
      if (added === 0 && removed === 0) return undefined
      return `${paint(COLORS.ok, `+${added}`, isColored)} ${paint(COLORS.critical, `−${removed}`, isColored)}`
    }
    case 'sync': {
      const { ahead = 0, behind = 0 } = facts.sync ?? {}
      const parts = []
      if (ahead > 0) parts.push(value(`↑${ahead}`))
      if (behind > 0) parts.push(paint(COLORS.warn, `↓${behind}`, isColored))
      return parts.length === 0 ? undefined : parts.join(' ')
    }
  }
}

// Empty segments are skipped.
export function buildLine(segments, facts, { separator = ' · ', isColored = true } = {}) {
  return segments
    .map(segment => render(segment, facts, isColored))
    .filter(part => part !== undefined && part !== '')
    .join(paint(COLORS.separator, separator, isColored))
}
