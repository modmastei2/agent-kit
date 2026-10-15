#!/usr/bin/env node
// Claude Code `statusLine` command: runs every module in the config with the
// session JSON on stdin, in parallel, and prints their outputs, one row per line.
import { readRawConfig, render } from './hub-run.mjs'

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

const input = await readStdin()
process.stdout.write(await render(readRawConfig(), input, { isColored: !process.env.NO_COLOR }))
