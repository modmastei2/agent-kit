import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import {
  chordFor,
  effortLabel,
  effortOf,
  formatChord,
  legacyStance,
  modelLabel,
  modelOf,
  nextEffort,
  nextModel,
} from './stances'

// A Global keybinding action Claude Code itself leaves unhandled (it reaches
// only the old diff panel), so a chord bound to it presses the band's model
// button from the prompt without taking a key from the CLI.
const CYCLE_ACTION = 'app:toggleDiffPreSession'

// The same semantic colors as the status line modules.
const COLORS = { headline: '#79C0FF', label: '#8B949E' }

// '' is Auto: the setting is left to Claude and the agent's definition.
const model = atom({ plugin: 'subagent-control', key: 'model' } as const, '')
const effort = atom({ plugin: 'subagent-control', key: 'effort' } as const, '')
const chord = atom({ plugin: 'subagent-control', key: 'chord' } as const, '')

// Copies the saved settings into $.state; /clear, /resume and /branch reset it.
// A stance saved by 0.x carries over until either setting is changed.
async function load($: EngineInterface) {
  const legacy = legacyStance(await $.store.get('stance'))
  const savedModel = await $.store.get('model')
  const savedEffort = await $.store.get('effort')
  await update($, model, () => modelOf(savedModel === undefined ? legacy.model : savedModel) ?? '')
  await update($, effort, () => effortOf(savedEffort === undefined ? legacy.effort : savedEffort) ?? '')
}

// Finds the chord the person bound to the cycle action, for the band's hint.
async function loadChord($: EngineInterface) {
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
  if (!home) return
  try {
    const keybindings = JSON.parse(await $.fs.read(`${home}/.claude/keybindings.json`))
    await update($, chord, () => chordFor(keybindings, CYCLE_ACTION) ?? '')
  } catch {
    // No keybindings file, or unreadable: no hint.
  }
}

// Saves both, so a change also retires a 0.x stance.
async function save($: EngineInterface) {
  await $.store.set('model', await read($, model))
  await $.store.set('effort', await read($, effort))
}

async function cycleModel($: EngineInterface) {
  const next = nextModel(modelOf(await read($, model))) ?? ''
  await update($, model, () => next)
  await save($)
}

async function cycleEffort($: EngineInterface) {
  const next = nextEffort(effortOf(await read($, effort))) ?? ''
  await update($, effort, () => next)
  await save($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await load($)
    await loadChord($)
    return result
  })

  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    await load($)
    return next(e)
  })

  // Model: set as each subagent starts. A fork always runs on its parent's.
  on('agent.spawn', async ($, e, next) => {
    const chosen = modelOf(await read($, model))
    return chosen !== undefined && !e.fork ? next({ ...e, model: chosen }) : next(e)
  })

  // Effort: set on every request a subagent makes; the main loop is left alone.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined) {
      const chosen = effortOf(await read($, effort))
      if (chosen !== undefined) return yield* next({ ...e, effort: chosen })
    }
    return yield* next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const currentModel = modelOf(await read($, model))
    const currentEffort = effortOf(await read($, effort))
    const hint = await read($, chord)
    const theirs = await next(e)

    const ours = (
      <Box flexDirection="row" columnGap={2}>
        <Text color={COLORS.label}>Subagents</Text>
        <Button key="model" plain action={CYCLE_ACTION} onPress={() => cycleModel($)}>
          <Text color={COLORS.label}>Model: </Text>
          <Text color={COLORS.headline} bold>
            {modelLabel(currentModel)}
          </Text>
        </Button>
        <Button key="effort" plain onPress={() => cycleEffort($)}>
          <Text color={COLORS.label}>Effort: </Text>
          <Text color={COLORS.headline} bold>
            {effortLabel(currentEffort)}
          </Text>
        </Button>
        {hint !== '' ? <Text color={COLORS.label}>{formatChord(hint)} to change model</Text> : null}
      </Box>
    )

    return theirs ? (
      <Box flexDirection="column">
        {ours}
        {theirs}
      </Box>
    ) : (
      ours
    )
  })
}
