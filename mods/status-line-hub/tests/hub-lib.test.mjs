import assert from 'node:assert/strict'
import { test } from 'node:test'

import { compose, expandCommand, moveModule, normalizeConfig, shiftLine, toggleModule, toSegment } from '../scripts/hub-lib.mjs'

const RESET = '\x1b[0m'

test('drops disabled and malformed modules, fills defaults', () => {
  const config = normalizeConfig({
    modules: [
      { name: 'a', command: 'node a.mjs' },
      { name: 'b', command: 'node b.mjs', line: 2 },
      { name: 'off', command: 'node c.mjs', enabled: false },
      { name: 'empty', command: '  ' },
      { name: 'bad-line', command: 'node d.mjs', line: 0 },
      null,
    ],
  })
  assert.deepEqual(config, {
    timeoutMs: 2000,
    separator: ' │ ',
    modules: [
      { name: 'a', command: 'node a.mjs', line: 1 },
      { name: 'b', command: 'node b.mjs', line: 2 },
      { name: 'bad-line', command: 'node d.mjs', line: 1 },
    ],
  })
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

const plain = { isColored: false }
const on = (...lines) => lines.map((line, i) => ({ name: `m${i}`, command: 'x', line }))

test('composes in order on one line, skipping failed modules', () => {
  assert.equal(compose(on(1, 1, 1), ['one', undefined, 'two'], ' | ', plain), 'one | two')
})

test('puts each line number on its own row, in ascending order', () => {
  assert.equal(compose(on(2, 1, 2), ['b', 'a', 'c'], ' | ', plain), 'a\nb | c')
})

test('drops a row whose modules all came out empty', () => {
  assert.equal(compose(on(1, 2, 3), ['a', undefined, 'c'], ' | ', plain), 'a\nc')
})

test('layout edits keep every other field and stay within lines 1 to 9', () => {
  const modules = [
    { name: 'a', command: 'x', line: 1, extra: true },
    { name: 'b', command: 'y' },
  ]
  assert.deepEqual(shiftLine(modules, 0, -1)[0], { name: 'a', command: 'x', line: 1, extra: true })
  assert.equal(shiftLine(modules, 1, 1)[1].line, 2)
  assert.equal(shiftLine([{ name: 'c', line: 9 }], 0, 1)[0].line, 9)
  assert.deepEqual(moveModule(modules, 0, 1).map(m => m.name), ['b', 'a'])
  assert.equal(moveModule(modules, 0, -1), modules)
  assert.equal(toggleModule(modules, 1)[1].enabled, false)
  assert.equal(toggleModule(toggleModule(modules, 1), 1)[1].enabled, true)
})
