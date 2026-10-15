import assert from 'node:assert/strict'
import { test } from 'node:test'

import { compose, expandCommand, normalizeConfig, toSegment } from '../scripts/hub-lib.mjs'

const RESET = '\x1b[0m'

test('drops disabled and malformed modules, fills defaults', () => {
  const config = normalizeConfig({
    modules: [
      { name: 'a', command: 'node a.mjs' },
      { name: 'off', command: 'node b.mjs', enabled: false },
      { name: 'empty', command: '  ' },
      null,
    ],
  })
  assert.deepEqual(config, { timeoutMs: 2000, separator: ' │ ', modules: [{ name: 'a', command: 'node a.mjs' }] })
})

test('expands known placeholders and leaves the rest', () => {
  assert.equal(expandCommand('node "{mods}/x/{name}.mjs"', { mods: '/home/me/.claude/skills' }), 'node "/home/me/.claude/skills/x/{name}.mjs"')
})

test('joins a module output into one segment and closes its colors', () => {
  assert.equal(toSegment('\x1b[32mok\x1b[0m\n\nsecond \n'), `\x1b[32mok\x1b[0m second${RESET}`)
  assert.equal(toSegment('\n  \n'), undefined)
  assert.equal(toSegment(undefined), undefined)
  assert.equal(toSegment('plain\n', { isColored: false }), 'plain')
})

test('composes in order, skipping failed modules', () => {
  assert.equal(compose(['one', undefined, 'two'], ' | ', { isColored: false }), 'one | two')
})
