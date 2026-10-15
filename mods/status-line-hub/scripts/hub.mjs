#!/usr/bin/env node
// Claude Code `statusLine` command: runs every module in the config with the
// session JSON on stdin, in parallel, and prints their outputs as one line.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DEFAULTS, compose, expandCommand, normalizeConfig } from './hub-lib.mjs'

const hubRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const modsDir = path.dirname(hubRoot).replaceAll('\\', '/')

// The user's own config lives outside the mod folder, so reinstalling the hub
// never overwrites it; the bundled config.json is the fallback.
const CONFIG_PATHS = [
  process.env.STATUS_LINE_HUB_CONFIG,
  path.join(os.homedir(), '.claude', 'status-line-hub.json'),
  path.join(hubRoot, 'config.json'),
].filter(Boolean)

function loadConfig() {
  for (const file of CONFIG_PATHS) {
    try {
      return normalizeConfig(JSON.parse(fs.readFileSync(file, 'utf8')))
    } catch {
      // Missing or unreadable: try the next one.
    }
  }
  return normalizeConfig(DEFAULTS)
}

function readStdin() {
  return new Promise(resolve => {
    if (process.stdin.isTTY) return resolve('')
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', chunk => (data += chunk))
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', () => resolve(data))
  })
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

const config = loadConfig()
const input = await readStdin()
const outputs = await Promise.all(
  config.modules.map(m => runModule(expandCommand(m.command, { mods: modsDir }), input, config.timeoutMs)),
)
process.stdout.write(compose(outputs, config.separator, { isColored: !process.env.NO_COLOR }))
