#!/usr/bin/env node
// Interactive layout editor for the hub: which modules show, in what order and
// on which line, with a live preview drawn by the hub itself from sample
// session data. Saves to the user's config (~/.claude/status-line-hub.json).
//
//   node setup.mjs
import fs from 'node:fs'
import path from 'node:path'

import { MAX_LINE, lineOf, moveModule, shiftLine, toggleModule } from './hub-lib.mjs'
import { USER_CONFIG, readRawConfig, render } from './hub-run.mjs'

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error(`setup needs an interactive terminal. Edit ${USER_CONFIG} instead.`)
  process.exit(1)
}

// A session as the status line would see it mid-work, so every module has
// something to show. The folder is the current one, for git modules.
function sampleInput() {
  const now = Math.floor(Date.now() / 1000)
  return JSON.stringify({
    cwd: process.cwd(),
    model: { id: 'claude-opus-5-5', display_name: 'Opus' },
    effort: { level: 'high' },
    workspace: { current_dir: process.cwd() },
    cost: { total_cost_usd: 3.91, total_duration_ms: 42 * 60000, total_lines_added: 156, total_lines_removed: 23 },
    context_window: { used_percentage: 36, context_window_size: 200000 },
    prompt_cache: { warm: true, caching_observed: true, hit_ratio: 0.91 },
    rate_limits: {
      five_hour: { used_percentage: 34, resets_at: now + 3 * 3600 },
      seven_day: { used_percentage: 26, resets_at: now + 2 * 86400 },
    },
  })
}

const dim = text => `\x1b[2m${text}\x1b[0m`
const bold = text => `\x1b[1m${text}\x1b[0m`
const inverse = text => `\x1b[7m${text}\x1b[0m`

const config = readRawConfig()
let modules = Array.isArray(config.modules) ? config.modules : []
let cursor = 0
let preview = dim('(rendering…)')
let renderId = 0
const input = sampleInput()

function draw() {
  const rows = modules.map((m, i) => {
    const box = m.enabled === false ? '[ ]' : '[x]'
    const name = m.enabled === false ? dim(m.name ?? m.command) : (m.name ?? m.command)
    const line = `${box} line ${lineOf(m)}  ${name}`
    return i === cursor ? `${inverse('>')} ${line}` : `  ${line}`
  })
  const screen = [
    bold('status-line-hub') + dim(' — layout'),
    dim(`↑/↓ select · ←/→ line (1–${MAX_LINE}) · shift+↑/↓ or J/K move · space show/hide · enter save · esc cancel`),
    '',
    ...(rows.length ? rows : [dim('  (no modules in the config)')]),
    '',
    dim('Preview, with sample session data:'),
    '',
    preview,
  ]
  process.stdout.write('\x1b[H\x1b[2J' + screen.join('\n'))
}

// Re-renders the preview; an older render that finishes late is ignored.
async function refreshPreview() {
  const id = ++renderId
  const text = await render({ ...config, modules }, input)
  if (id !== renderId) return
  preview = text === '' ? dim('(nothing to show)') : text
  draw()
}

function finish(message, code = 0) {
  process.stdin.setRawMode(false)
  process.stdin.pause()
  process.stdout.write('\x1b[?25h\x1b[?1049l')
  if (message) console.log(message)
  process.exit(code)
}

function save() {
  fs.mkdirSync(path.dirname(USER_CONFIG), { recursive: true })
  fs.writeFileSync(USER_CONFIG, JSON.stringify({ ...config, modules }, null, 2) + '\n')
  finish(`Saved the status line layout to ${USER_CONFIG}`)
}

function onKey(key) {
  const before = modules
  if (key === '\x03' || key === '\x1b' || key === 'q') return finish('Layout unchanged.')
  if (key === '\r' || key === '\n') return save()
  if (modules.length === 0) return
  if (key === '\x1b[A' || key === 'k') cursor = (cursor - 1 + modules.length) % modules.length
  else if (key === '\x1b[B' || key === 'j') cursor = (cursor + 1) % modules.length
  else if (key === '\x1b[D' || key === 'h') modules = shiftLine(modules, cursor, -1)
  else if (key === '\x1b[C' || key === 'l') modules = shiftLine(modules, cursor, 1)
  else if (key === ' ') modules = toggleModule(modules, cursor)
  else if (key === '\x1b[1;2A' || key === 'K') {
    modules = moveModule(modules, cursor, -1)
    if (modules !== before) cursor -= 1
  } else if (key === '\x1b[1;2B' || key === 'J') {
    modules = moveModule(modules, cursor, 1)
    if (modules !== before) cursor += 1
  }
  draw()
  if (modules !== before) refreshPreview()
}

process.stdout.write('\x1b[?1049h\x1b[?25l')
process.stdin.setRawMode(true)
process.stdin.resume()
process.stdin.setEncoding('utf8')
process.stdin.on('data', onKey)
process.stdout.on('resize', draw)
draw()
refreshPreview()
