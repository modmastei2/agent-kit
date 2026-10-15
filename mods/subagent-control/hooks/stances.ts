// The stances a press cycles through: Auto leaves every subagent as Claude and
// its definition decide; the rest set one model and effort for all of them.

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export type Stance = {
  id: string
  label: string
  model?: string
  effort?: Effort
}

export const STANCES: readonly Stance[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'fast', label: 'Fast', model: 'haiku', effort: 'low' },
  { id: 'balanced', label: 'Balanced', model: 'sonnet', effort: 'medium' },
  { id: 'deep', label: 'Deep', model: 'opus', effort: 'high' },
  { id: 'max', label: 'Max', model: 'opus', effort: 'max' },
]

const AUTO = STANCES[0] as Stance

// An unknown id (a stance removed since it was saved) reads as Auto.
export function stanceOf(id: string): Stance {
  return STANCES.find(stance => stance.id === id) ?? AUTO
}

export function nextStanceId(id: string): string {
  const index = STANCES.findIndex(stance => stance.id === id)
  return (STANCES[(index + 1) % STANCES.length] ?? AUTO).id
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
