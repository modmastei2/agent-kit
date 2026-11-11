import assert from 'node:assert/strict'
import { test } from 'node:test'

import { COLORS, duration, forecast, levelOf, paint, readRateLimits, weatherLine } from '../scripts/weather.mjs'

const HOUR = 60 * 60 * 1000
const NOW = Date.parse('2026-10-15T12:00:00Z')
const inHours = hours => NOW + hours * HOUR
const plain = { isColored: false }
const c = (color, text) => paint(COLORS[color], text, true)

test('each value has its own level', () => {
  assert.deepEqual([8, 69, 70, 89, 90].map(levelOf), ['ok', 'ok', 'warn', 'warn', 'critical'])
})

test('reads the statusLine rate_limits object, seconds to milliseconds', () => {
  assert.deepEqual(readRateLimits({ five_hour: { used_percentage: 23.5, resets_at: 1738425600 }, seven_day: null }), [
    { kind: 'five_hour', percentUsed: 23.5, resetsAtMs: 1738425600000 },
  ])
  assert.deepEqual(readRateLimits(undefined), [])
})

test('forecasts when a window empties before it resets', () => {
  // 2h into the window, 60% gone: empty in 1h20, before the reset in 3h.
  const f = forecast({ kind: 'five_hour', percentUsed: 60, resetsAtMs: inHours(3) }, NOW)
  assert.equal(Math.round(f.runsOutInMs / 60000), 80)
  assert.equal(f.label, '5h')
})

test('no forecast at a pace that lasts, or in a window that has barely started', () => {
  assert.equal(forecast({ kind: 'five_hour', percentUsed: 20, resetsAtMs: inHours(2.5) }, NOW).runsOutInMs, undefined)
  assert.equal(forecast({ kind: 'five_hour', percentUsed: 5, resetsAtMs: inHours(4.95) }, NOW).runsOutInMs, undefined)
})

test('the weekly window reads as weekly', () => {
  assert.equal(forecast({ kind: 'seven_day', percentUsed: 26 }, NOW).label, 'weekly')
})

test('colors each value by its own level, and the forecast apart from it', () => {
  // 5h is 8% used yet on pace to empty in ~3h05: the 8% stays green.
  const line = weatherLine(
    {
      contextPercent: 36,
      rateLimits: [
        { kind: 'five_hour', percentUsed: 8, resetsAtMs: inHours(4.7) },
        { kind: 'seven_day', percentUsed: 26, resetsAtMs: inHours(24 * 2) },
      ],
    },
    NOW,
  )
  const sep = paint(COLORS.separator, ' · ', true)
  assert.equal(
    line,
    `⛅ ${c('weather', 'Cloudy')} ${c('label', 'ctx')} ${c('ok', '36%')}${sep}` +
      `${c('label', '5h')} ${c('ok', '8%')} ${c('label', '↻4h42')} ${c('warn', 'empty in ~3h27')}${sep}` +
      `${c('label', 'weekly')} ${c('ok', '26%')} ${c('label', '↻2d00')}`,
  )
})

test('turns red only near the limit', () => {
  const ctx = weatherLine({ contextPercent: 92, rateLimits: [] }, NOW)
  assert.ok(ctx.includes(c('critical', '92%')))
  assert.ok(ctx.startsWith('⛈'))

  // 3h in, 88% gone: empty in about 25 minutes. The 88% itself is a warning.
  const soon = weatherLine({ rateLimits: [{ kind: 'five_hour', percentUsed: 88, resetsAtMs: inHours(2) }] }, NOW)
  assert.ok(soon.includes(c('warn', '88%')))
  assert.ok(soon.includes(c('critical', 'empty in ~25m')))
})

test('plain text without colors', () => {
  const line = weatherLine(
    { contextPercent: 30, rateLimits: [{ kind: 'five_hour', percentUsed: 60, resetsAtMs: inHours(3) }] },
    NOW,
    plain,
  )
  assert.equal(line, '⛅ Cloudy ctx 30% · 5h 60% ↻3h00 empty in ~1h20')
  assert.equal(weatherLine({ contextPercent: null, rateLimits: [] }, NOW, plain), '☀ Clear ctx –')
})

test('reads resets_at as seconds, milliseconds or an ISO date', () => {
  const at = s => readRateLimits({ five_hour: { used_percentage: 1, resets_at: s } })[0].resetsAtMs
  assert.equal(at(1738425600), 1738425600000)
  assert.equal(at(1738425600000), 1738425600000)
  assert.equal(at('2025-02-01T16:00:00Z'), 1738425600000)
  assert.equal(at('soon'), undefined)
})

test('long durations keep their hours', () => {
  assert.equal(duration(60 * HOUR), '2d12')
  assert.equal(duration(90 * 60000), '1h30')
})
