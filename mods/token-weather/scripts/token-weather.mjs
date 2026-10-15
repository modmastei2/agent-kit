#!/usr/bin/env node
// Status line module: reads Claude Code's statusLine JSON on stdin and prints
// the token weather. Runs on its own as a `statusLine` command too.
import { readRateLimits, weatherLine } from './weather.mjs'

let input = ''
process.stdin.setEncoding('utf8')
for await (const chunk of process.stdin) input += chunk

let data = {}
try {
  data = JSON.parse(input || '{}')
} catch {
  // Unreadable input: show the empty forecast rather than nothing.
}

const line = weatherLine(
  {
    contextPercent: data.context_window?.used_percentage ?? undefined,
    rateLimits: readRateLimits(data.rate_limits),
  },
  Date.now(),
  { isColored: !process.env.NO_COLOR },
)
process.stdout.write(line)
