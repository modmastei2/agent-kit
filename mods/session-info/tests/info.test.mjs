import assert from 'node:assert/strict'
import { test } from 'node:test'

import { COLORS, buildLine, duration, paint, parseSegments, readFacts } from '../scripts/info.mjs'

const INPUT = {
  model: { id: 'claude-opus-5-5', display_name: 'Opus' },
  effort: { level: 'high' },
  cost: { total_duration_ms: 65 * 60000, total_lines_added: 156, total_lines_removed: 23 },
  prompt_cache: { warm: true, caching_observed: true, hit_ratio: 0.91 },
}
const plain = { isColored: false }
const c = (color, text) => paint(COLORS[color], text, true)

test('keeps known segments once, in the order given', () => {
  assert.deepEqual(parseSegments(' Model, bogus ,cache,model '), ['model', 'cache'])
})

test('formats running time in minutes, then hours', () => {
  assert.deepEqual([0, 42 * 60000, 65 * 60000].map(duration), ['0m', '42m', '1h05'])
})

test('reads the facts from the statusLine JSON', () => {
  assert.deepEqual(readFacts(INPUT), {
    model: 'Opus',
    effort: 'high',
    durationMs: 65 * 60000,
    linesAdded: 156,
    linesRemoved: 23,
    cache: { isWarm: true, hitRatio: 0.91 },
  })
  // Prompt caching off or unreported: no cache segment at all.
  assert.equal(readFacts({ prompt_cache: { caching_observed: false } }).cache, undefined)
})

test('builds the default line, skipping what is missing', () => {
  const segments = parseSegments('model,effort,time,lines,cache')
  assert.equal(buildLine(segments, readFacts(INPUT), plain), 'Opus · effort high · ⏱ 1h05 · +156 −23 · cache 91%')
  assert.equal(buildLine(segments, readFacts({ model: { id: 'claude-opus-5-5' } }), plain), 'claude-opus-5-5')
})

test('uses the shared palette, coloring only how things are going', () => {
  const sep = c('separator', ' · ')
  assert.equal(
    buildLine(['model', 'lines', 'cache'], readFacts(INPUT)),
    `${c('headline', 'Opus')}${sep}${c('ok', '+156')} ${c('critical', '−23')}${sep}${c('label', 'cache')} ${c('ok', '91%')}`,
  )
  const lowHits = readFacts({ prompt_cache: { warm: true, hit_ratio: 0.4 } })
  assert.equal(buildLine(['cache'], lowHits), `${c('label', 'cache')} ${c('warn', '40%')}`)
  assert.equal(buildLine(['cache'], readFacts({ prompt_cache: { warm: false } })), c('label', 'cache cold'))
})
