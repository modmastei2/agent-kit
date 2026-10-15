// Pure helpers for hub.mjs, kept free of I/O so they can be tested directly.

export const DEFAULTS = { timeoutMs: 2000, separator: ' │ ', modules: [] }

const RESET = '\x1b[0m'
const DIM = '\x1b[2m'

// Fills in defaults and drops malformed or disabled modules, so a bad config
// degrades to fewer modules instead of a broken status line.
export function normalizeConfig(raw) {
  const config = raw && typeof raw === 'object' ? raw : {}
  const timeoutMs = Number.isFinite(config.timeoutMs) && config.timeoutMs > 0 ? config.timeoutMs : DEFAULTS.timeoutMs
  const separator = typeof config.separator === 'string' ? config.separator : DEFAULTS.separator
  const modules = (Array.isArray(config.modules) ? config.modules : [])
    .filter(m => m && typeof m.command === 'string' && m.command.trim() !== '' && m.enabled !== false)
    .map(m => ({
      name: typeof m.name === 'string' ? m.name : m.command,
      command: m.command,
      line: lineOf(m),
    }))
  return { timeoutMs, separator, modules }
}

// `{mods}` is the folder the hub itself is installed in, so a module that sits
// beside it is found wherever mods are installed.
export function expandCommand(command, vars) {
  return command.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? vars[key] : match))
}

// One module's output as one segment: its lines joined, colors closed so they
// never bleed into the next module.
export function toSegment(output, { isColored = true } = {}) {
  if (typeof output !== 'string') return undefined
  const text = output
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(line => line.trim() !== '')
    .join(' ')
  if (text === '') return undefined
  return isColored ? text + RESET : text
}

// One row per `line` number, in ascending order, each module in its configured
// order. A module that failed or printed nothing is left out, and a row left
// empty is dropped rather than printed blank.
export function compose(modules, outputs, separator, { isColored = true } = {}) {
  const gap = isColored ? DIM + separator + RESET : separator
  const rows = new Map()
  modules.forEach((module, i) => {
    const segment = toSegment(outputs[i], { isColored })
    if (segment === undefined) return
    rows.set(module.line, [...(rows.get(module.line) ?? []), segment])
  })
  return [...rows.keys()]
    .sort((a, b) => a - b)
    .map(line => rows.get(line).join(gap))
    .join('\n')
}

// Layout edits for setup.mjs. Each returns a new modules list, leaving the
// fields it does not touch (command, enabled, anything else) as written.

export const MAX_LINE = 9

export function lineOf(module) {
  return Number.isInteger(module.line) && module.line > 0 ? module.line : 1
}

export function shiftLine(modules, index, delta) {
  return modules.map((m, i) =>
    i === index ? { ...m, line: Math.min(MAX_LINE, Math.max(1, lineOf(m) + delta)) } : m,
  )
}

export function moveModule(modules, index, delta) {
  const target = index + delta
  if (target < 0 || target >= modules.length) return modules
  const next = [...modules]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export function toggleModule(modules, index) {
  return modules.map((m, i) => (i === index ? { ...m, enabled: m.enabled === false } : m))
}
