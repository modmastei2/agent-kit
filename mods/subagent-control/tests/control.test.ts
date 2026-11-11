import { describe, expect, mock, test } from 'claude-code/testing'
import type { AgentSpawnInput, On } from 'claude-code'

import { chordFor, effortLabel, formatChord, modelLabel, modelOf, nextEffort, nextModel } from '../hooks/stances'

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

describe('settings', () => {
  test('model and effort each cycle in order and wrap back to Auto', () => {
    const models: (string | undefined)[] = [undefined]
    for (let i = 0; i < 5; i++) models.push(nextModel(models[models.length - 1]))
    expect(models).toEqual([undefined, 'haiku', 'sonnet', 'opus', 'fable', undefined])
    const efforts: (string | undefined)[] = [undefined]
    for (let i = 0; i < 6; i++) efforts.push(nextEffort(efforts[efforts.length - 1] as never))
    expect(efforts).toEqual([undefined, 'low', 'medium', 'high', 'xhigh', 'max', undefined])
  })

  test('an unknown model reads as Auto', () => {
    expect(modelOf('gone')).toBeUndefined()
  })

  test('finds the chord bound to the cycle action', () => {
    const keybindings = { bindings: [{ context: 'Global', bindings: { 'ctrl+x a': 'app:toggleDiffPreSession' } }] }
    expect(chordFor(keybindings, 'app:toggleDiffPreSession')).toBe('ctrl+x a')
    expect(chordFor({}, 'app:toggleDiffPreSession')).toBeUndefined()
  })

  test('spell their settings and chord for the band', () => {
    expect(modelLabel('opus')).toBe('Opus')
    expect(effortLabel('xhigh')).toBe('Extra high')
    expect(effortLabel(undefined)).toBe('Auto')
    expect(formatChord('ctrl+x a')).toBe('Ctrl+X A')
  })
})

test('Auto leaves the subagent model alone', async ($, on) => {
  const spawned: (string | undefined)[] = []
  fakeSession(on, {}, spawned)

  await $.session.start(START)
  await $.agent.spawn(SPAWN)

  expect(spawned).toEqual([undefined])
})

test('a saved model applies to every subagent but a fork', async ($, on) => {
  const spawned: (string | undefined)[] = []
  fakeSession(on, { model: 'sonnet', effort: 'max' }, spawned)

  await $.session.start(START)
  await $.agent.spawn(SPAWN)
  await $.agent.spawn({ ...SPAWN, tool_use_id: 'toolu_2', fork: true })

  expect(spawned).toEqual(['sonnet', undefined])
})

test('a 0.x stance carries over as its model', async ($, on) => {
  const spawned: (string | undefined)[] = []
  fakeSession(on, { stance: 'deep' }, spawned)

  await $.session.start(START)
  await $.agent.spawn(SPAWN)

  expect(spawned).toEqual(['opus'])
})

test('the band cycles model and effort on their own', async ($, on) => {
  const spawned: (string | undefined)[] = []
  fakeSession(on, {}, spawned)
  await $.session.start(START)

  const band = await $.ui.mount(BAND)
  await band.press({ key: 'model' })
  expect(await band.find({ type: 'Text', text: 'Haiku' })).toBeDefined()

  await band.press({ key: 'effort' })
  await band.press({ key: 'effort' })
  expect(await band.find({ type: 'Text', text: 'Medium' })).toBeDefined()
  expect(await band.find({ type: 'Text', text: 'Haiku' })).toBeDefined()

  await $.agent.spawn(SPAWN)
  expect(spawned).toEqual(['haiku'])
  await band.unmount()
})
