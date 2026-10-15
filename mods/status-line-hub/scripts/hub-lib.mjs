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
    .map(m => ({ name: typeof m.name === 'string' ? m.name : m.command, command: m.command }))
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

// Keeps the configured order; a module that failed or printed nothing is left out.
export function compose(outputs, separator, { isColored = true } = {}) {
  const segments = outputs.map(output => toSegment(output, { isColored })).filter(segment => segment !== undefined)
  const gap = isColored ? DIM + separator + RESET : separator
  return segments.join(gap)
}
