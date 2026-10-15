import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const START = { cwd: '/work', surface: 'terminal', isInteractive: true } as const

function fakeSession(on: On, statusLine: unknown, toasts: string[]) {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('settings.read', () => ({ value: statusLine === undefined ? {} : { statusLine } }))
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
}

test('says how to turn the hub on when statusLine does not run it', async ($, on) => {
  const toasts: string[] = []
  fakeSession(on, undefined, toasts)

  await $.session.start(START)

  expect(toasts).toHaveLength(1)
  expect(toasts[0]).toContain('/scripts/hub.mjs')
})

test('stays quiet once statusLine runs the hub', async ($, on) => {
  const toasts: string[] = []
  fakeSession(on, { type: 'command', command: 'node "~/.claude/skills/status-line-hub/scripts/hub.mjs"' }, toasts)

  await $.session.start(START)

  expect(toasts).toEqual([])
})
