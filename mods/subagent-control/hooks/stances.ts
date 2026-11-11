// The two settings a press cycles through, each on its own: the model every
// subagent runs on and the effort it thinks with. Auto (undefined) leaves that
// setting to Claude and the agent's own definition.

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export const MODELS: readonly (string | undefined)[] = [undefined, 'haiku', 'sonnet', 'opus', 'fable']
export const EFFORTS: readonly (Effort | undefined)[] = [undefined, 'low', 'medium', 'high', 'xhigh', 'max']

const EFFORT_NAMES: Record<Effort, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Max',
}

// The stances of 0.x, so a saved one carries over as its model and effort.
const LEGACY: Record<string, { model?: string; effort?: Effort }> = {
  fast: { model: 'haiku', effort: 'low' },
  balanced: { model: 'sonnet', effort: 'medium' },
  deep: { model: 'opus', effort: 'high' },
  max: { model: 'opus', effort: 'max' },
}

export function legacyStance(id: unknown): { model?: string; effort?: Effort } {
  return (typeof id === 'string' && LEGACY[id]) || {}
}

// A saved value no longer offered reads as Auto.
export function modelOf(value: unknown): string | undefined {
  return MODELS.find(model => model !== undefined && model === value)
}

export function effortOf(value: unknown): Effort | undefined {
  return EFFORTS.find(effort => effort !== undefined && effort === value)
}

function after<T>(list: readonly T[], value: T): T {
  return list[(list.indexOf(value) + 1) % list.length] as T
}

export const nextModel = (model: string | undefined) => after(MODELS, modelOf(model))
export const nextEffort = (effort: Effort | undefined) => after(EFFORTS, effortOf(effort))

// How the band spells each setting: "Opus", "High", "Auto".
export function modelLabel(model: string | undefined): string {
  return model === undefined ? 'Auto' : model.charAt(0).toUpperCase() + model.slice(1)
}

export function effortLabel(effort: Effort | undefined): string {
  return effort === undefined ? 'Auto' : EFFORT_NAMES[effort]
}

// How the band spells a chord: "ctrl+x a" reads "Ctrl+X A".
export function formatChord(chord: string): string {
  return chord.replace(/[a-z0-9]+/gi, part => part.charAt(0).toUpperCase() + part.slice(1))
}

// The chord bound to an action in a keybindings.json, for the band's hint.
export function chordFor(keybindings: unknown, action: string): string | undefined {
  const blocks = (keybindings as { bindings?: unknown })?.bindings
  if (!Array.isArray(blocks)) return undefined
  for (const block of blocks) {
    const bindings = (block as { bindings?: unknown })?.bindings
    if (!bindings || typeof bindings !== 'object') continue
    for (const [chord, bound] of Object.entries(bindings)) {
      if (bound === action) return chord
    }
  }
  return undefined
}
