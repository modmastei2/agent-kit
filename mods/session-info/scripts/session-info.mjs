#!/usr/bin/env node
// Status line module: reads Claude Code's statusLine JSON on stdin and prints the
// session's model, effort, running time, lines changed and prompt cache state.
// Runs on its own as a `statusLine` command too.
//
//   node session-info.mjs [--segments model,effort,time,lines,cache] [--separator " · "]
import { parseArgs } from 'node:util'

import { DEFAULT_SEGMENTS, buildLine, parseSegments, readFacts } from './info.mjs'

const { values } = parseArgs({
  options: {
    segments: { type: 'string', default: DEFAULT_SEGMENTS },
    separator: { type: 'string', default: ' · ' },
  },
  strict: false,
})

let input = ''
process.stdin.setEncoding('utf8')
for await (const chunk of process.stdin) input += chunk

let data = {}
try {
  data = JSON.parse(input || '{}')
} catch {
  // Unreadable input: print what can still be known.
}

process.stdout.write(
  buildLine(parseSegments(values.segments), readFacts(data), {
    separator: String(values.separator),
    isColored: !process.env.NO_COLOR,
  }),
)
