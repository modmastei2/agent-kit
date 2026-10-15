import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  COLORS,
  buildLine,
  paint,
  parseAheadBehind,
  parseSegments,
  parseShortstat,
  repoName,
  summarizeRuns,
} from '../scripts/repo.mjs'

const plain = { isColored: false }
const c = (color, text) => paint(COLORS[color], text, true)

test('keeps known segments once, in the order given', () => {
  assert.deepEqual(parseSegments(' Branch, bogus ,ci,branch '), ['branch', 'ci'])
})

test('reads git diff --shortstat', () => {
  assert.deepEqual(parseShortstat(' 3 files changed, 12 insertions(+), 4 deletions(-)'), { added: 12, removed: 4 })
  assert.deepEqual(parseShortstat(' 1 file changed, 1 insertion(+)'), { added: 1, removed: 0 })
  assert.deepEqual(parseShortstat(''), { added: 0, removed: 0 })
})

test('reads git rev-list --left-right --count: behind, then ahead', () => {
  assert.deepEqual(parseAheadBehind('2\t1'), { behind: 2, ahead: 1 })
  assert.equal(parseAheadBehind(''), undefined)
})

test('summarizes CI runs: running first, else the latest finished run', () => {
  assert.deepEqual(
    summarizeRuns([
      { status: 'in_progress', conclusion: '' },
      { status: 'queued', conclusion: '' },
      { status: 'completed', conclusion: 'failure' },
    ]),
    { state: 'running', count: 2 },
  )
  assert.deepEqual(summarizeRuns([{ status: 'completed', conclusion: 'success' }]), { state: 'passed' })
  assert.deepEqual(summarizeRuns([{ status: 'completed', conclusion: 'failure' }]), { state: 'failed' })
  assert.equal(summarizeRuns([]), undefined)
})

test('names the repository from the origin remote, else its folder', () => {
  assert.equal(repoName({ workspace: { repo: { owner: 'modmastei2', name: 'agent-kit' } } }, 'D:/x/y'), 'modmastei2/agent-kit')
  assert.equal(repoName({}, 'D:\\Projects\\agent-kit'), 'agent-kit')
})

const FACTS = {
  repo: 'modmastei2/agent-kit',
  branch: 'master',
  pr: { number: 12, url: 'https://github.com/modmastei2/agent-kit/pull/12', reviewState: 'approved' },
  ci: { state: 'running', count: 2 },
  diff: { added: 12, removed: 4 },
  sync: { ahead: 1, behind: 3 },
}

test('builds the whole line', () => {
  assert.equal(
    buildLine(parseSegments('repo,branch,pr,ci,diff,sync'), FACTS, plain),
    'modmastei2/agent-kit · ⎇ master · PR #12 ✓ · CI ⏳2 · +12 −4 · ↑1 ↓3',
  )
})

test('skips what is clean or missing', () => {
  const quiet = { repo: 'agent-kit', branch: 'main', diff: { added: 0, removed: 0 }, sync: { ahead: 0, behind: 0 } }
  assert.equal(buildLine(parseSegments('repo,branch,pr,ci,diff,sync'), quiet, plain), 'agent-kit · ⎇ main')
})

test('colors only what wants action', () => {
  assert.equal(buildLine(['ci'], { ci: { state: 'failed' } }), `${c('label', 'CI')} ${c('critical', '✗')}`)
  assert.equal(buildLine(['ci'], { ci: { state: 'passed' } }), `${c('label', 'CI')} ${c('ok', '✓')}`)
  assert.equal(buildLine(['sync'], { sync: { ahead: 1, behind: 3 } }), `↑1 ${c('warn', '↓3')}`)
  assert.equal(buildLine(['diff'], { diff: { added: 12, removed: 4 } }), `${c('ok', '+12')} ${c('critical', '−4')}`)
  // The PR number is a link, its review state a colored mark.
  const pr = buildLine(['pr'], FACTS)
  assert.ok(pr.includes('\x1b]8;;https://github.com/modmastei2/agent-kit/pull/12\x07PR #12\x1b]8;;\x07'))
  assert.ok(pr.endsWith(c('ok', '✓')))
})
