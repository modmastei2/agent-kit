// Loading the config and running its modules, shared by hub.mjs (the status
// line itself) and setup.mjs (the layout editor's preview).
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DEFAULTS, compose, expandCommand, normalizeConfig } from './hub-lib.mjs'

export const hubRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const modsDir = path.dirname(hubRoot).replaceAll('\\', '/')

// The user's own config lives outside the mod folder, so reinstalling the hub
// never overwrites it; the bundled config.json is the fallback.
export const USER_CONFIG = process.env.STATUS_LINE_HUB_CONFIG || path.join(os.homedir(), '.claude', 'status-line-hub.json')
const BUNDLED_CONFIG = path.join(hubRoot, 'config.json')

// The config as written, unnormalized, so an editor can save it back whole.
export function readRawConfig() {
  for (const file of [USER_CONFIG, BUNDLED_CONFIG]) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
      // Missing or unreadable: try the next one.
    }
  }
  return structuredClone(DEFAULTS)
}

// Resolves the module's stdout, or undefined when it fails or runs out of time.
function runModule(command, input, timeoutMs) {
  return new Promise(resolve => {
    let out = ''
    let settled = false
    const finish = value => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }
    const child = spawn(command, { shell: true, windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] })
    const timer = setTimeout(() => {
      child.kill()
      finish(undefined)
    }, timeoutMs)
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', chunk => (out += chunk))
    child.on('error', () => finish(undefined))
    child.on('close', code => finish(code === 0 ? out : undefined))
    child.stdin.on('error', () => {})
    child.stdin.end(input)
  })
}

// Runs every enabled module in parallel and composes their rows.
export async function render(rawConfig, input, { isColored = true } = {}) {
  const config = normalizeConfig(rawConfig)
  const outputs = await Promise.all(
    config.modules.map(m => runModule(expandCommand(m.command, { mods: modsDir }), input, config.timeoutMs)),
  )
  return compose(config.modules, outputs, config.separator, { isColored })
}
