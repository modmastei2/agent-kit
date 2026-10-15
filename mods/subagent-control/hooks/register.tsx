import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { chordFor, describeStance, formatChord, nextStanceId, stanceOf } from './stances'

// A Global keybinding action Claude Code itself leaves unhandled (it reaches
// only the old diff panel), so a chord bound to it presses the band's button
// from the prompt without taking a key from the CLI.
const CYCLE_ACTION = 'app:toggleDiffPreSession'

// The same semantic colors as the status line modules.
const COLORS = { headline: '#79C0FF', label: '#8B949E' }

const stance = atom({ plugin: 'subagent-control', key: 'stance' } as const, 'auto')
const chord = atom({ plugin: 'subagent-control', key: 'chord' } as const, '')

// Copies the saved stance into $.state; /clear, /resume and /branch reset it.
async function load($: EngineInterface) {
  const saved = await $.store.get('stance')
  await update($, stance, () => (typeof saved === 'string' ? stanceOf(saved).id : 'auto'))
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

async function cycle($: EngineInterface) {
  const next = nextStanceId(await read($, stance))
  await update($, stance, () => next)
  await $.store.set('stance', next)
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
    const { model } = stanceOf(await read($, stance))
    return model !== undefined && !e.fork ? next({ ...e, model }) : next(e)
  })

  // Effort: set on every request a subagent makes; the main loop is left alone.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined) {
      const { effort } = stanceOf(await read($, stance))
      if (effort !== undefined) return yield* next({ ...e, effort })
    }
    return yield* next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const current = stanceOf(await read($, stance))
    const hint = await read($, chord)
    const theirs = await next(e)

    const ours = (
      <Box flexDirection="row" columnGap={2}>
        <Button key="cycle" plain action={CYCLE_ACTION} onPress={() => cycle($)}>
          <Text color={COLORS.label}>Subagents: </Text>
          <Text color={COLORS.headline} bold>
            {current.label}
          </Text>
          <Text color={COLORS.label}>  {describeStance(current)}</Text>
        </Button>
        {hint !== '' ? <Text color={COLORS.label}>{formatChord(hint)} to change</Text> : null}
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
