import { describe, expect, mock, test } from 'claude-code/testing'
import type { AgentSpawnInput, On } from 'claude-code'

import { chordFor, nextStanceId, stanceOf } from '../hooks/stances'

const START = { cwd: '/work', surface: 'terminal', isInteractive: true } as const

const BAND = {
  plugin: 'subagent-control',
  surface: 'terminal',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const SPAWN: AgentSpawnInput = {
  tool_use_id: 'toolu_1',
  prompt: 'Find the config loader',
  description: 'Find config loader',
  subagentType: 'Explore',
  provider: { plugin: 'engine', tier: 'core' },
  parentModel: 'claude-opus-5-5',
  background: false,
  fork: false,
}

// Answers what the engine would beneath the plugin, recording each spawn's model.
function fakeSession(on: On, store: Record<string, unknown>, spawned: (string | undefined)[]) {
  mock.store(on, store)
  mock.env(on, { HOME: '/home/me' })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('fs.read', () => ({ deny: 'no keybindings file' }))
  // What the engine answers beneath the band: its own drawing, which is empty.
  on('ui.render', () => ({ type: 'engine', ref: 0 }))
  on('agent.spawn', ($, e) => {
    spawned.push(e.model)
    return { model: e.model ?? e.parentModel, agentId: 'agent_1' }
  })
}

describe('stances', () => {
  test('cycle in order and wrap back to Auto', () => {
    const order = ['auto']
    for (let i = 0; i < 5; i++) order.push(nextStanceId(order[order.length - 1] ?? 'auto'))
    expect(order).toEqual(['auto', 'fast', 'balanced', 'deep', 'max', 'auto'])
  })

  test('an unknown stance reads as Auto', () => {
    expect(stanceOf('gone').id).toBe('auto')
  })

  test('finds the chord bound to the cycle action', () => {
    const keybindings = { bindings: [{ context: 'Global', bindings: { 'ctrl+x a': 'app:toggleDiffPreSession' } }] }
    expect(chordFor(keybindings, 'app:toggleDiffPreSession')).toBe('ctrl+x a')
    expect(chordFor({}, 'app:toggleDiffPreSession')).toBeUndefined()
  })
})

test('Auto leaves the subagent model alone', async ($, on) => {
  const spawned: (string | undefined)[] = []
  fakeSession(on, {}, spawned)

  await $.session.start(START)
  await $.agent.spawn(SPAWN)

  expect(spawned).toEqual([undefined])
})

test('a saved stance sets the model of every subagent but a fork', async ($, on) => {
  const spawned: (string | undefined)[] = []
  fakeSession(on, { stance: 'deep' }, spawned)

  await $.session.start(START)
  await $.agent.spawn(SPAWN)
  await $.agent.spawn({ ...SPAWN, tool_use_id: 'toolu_2', fork: true })

  expect(spawned).toEqual(['opus', undefined])
})

test('pressing the band cycles the stance', async ($, on) => {
  const spawned: (string | undefined)[] = []
  fakeSession(on, {}, spawned)
  await $.session.start(START)

  const band = await $.ui.mount(BAND)
  expect(await band.find({ type: 'Text', text: 'Auto' })).toBeDefined()

  await band.press({ key: 'cycle' })
  expect(await band.find({ type: 'Text', text: 'Fast' })).toBeDefined()

  await $.agent.spawn(SPAWN)
  expect(spawned).toEqual(['haiku'])
  await band.unmount()
})
