// Token pressure as weather. Pure functions; token-weather.mjs does the I/O.

// The overall sky, from clear (0) to storm (3): the worst of every reading.
export const SKIES = [
  { icon: '☀', word: 'Clear' },
  { icon: '⛅', word: 'Cloudy' },
  { icon: '🌧', word: 'Rain' },
  { icon: '⛈', word: 'Storm' },
]

// Semantic colors (24-bit): the weather word, quiet labels, and each value
// colored by its own level only.
export const COLORS = {
  weather: '38;2;121;192;255',
  label: '38;2;139;148;158',
  ok: '38;2;63;185;80',
  warn: '38;2;242;204;96',
  critical: '38;2;248;81;73',
  separator: '38;2;72;79;88',
}

const HOUR = 60 * 60 * 1000

const WINDOWS = {
  five_hour: { label: '5h', lengthMs: 5 * HOUR },
  seven_day: { label: 'weekly', lengthMs: 7 * 24 * HOUR },
  spend_limit: { label: 'spend' },
}

// Below this share of a window the pace is too young to extrapolate.
const MIN_ELAPSED_SHARE = 0.05

// A window this close to empty is critical.
const CRITICAL_MS = 30 * 60 * 1000

export function paint(color, text, isColored) {
  return isColored ? `\x1b[${color}m${text}\x1b[0m` : text
}

// A value's own level: ok below 70%, warn below 90%, critical from 90%.
export function levelOf(percent) {
  if (percent >= 90) return 'critical'
  if (percent >= 70) return 'warn'
  return 'ok'
}

function skyOf(percent) {
  if (percent >= 90) return 3
  if (percent >= 70) return 2
  if (percent >= 40) return 1
  return 0
}

// The statusLine input's `rate_limits` object as a list of windows.
export function readRateLimits(rateLimits) {
  if (!rateLimits || typeof rateLimits !== 'object') return []
  return Object.entries(rateLimits)
    .filter(([, w]) => w && Number.isFinite(w.used_percentage))
    .map(([kind, w]) => ({
      kind,
      percentUsed: w.used_percentage,
      resetsAtMs: toMs(w.resets_at),
    }))
}

// resets_at as unix seconds, milliseconds or an ISO date.
function toMs(value) {
  if (typeof value === 'string') {
    const n = Number(value)
    value = Number.isFinite(n) && value.trim() !== '' ? n : Date.parse(value)
  }
  if (!Number.isFinite(value)) return undefined
  return value < 1e12 ? value * 1000 : value
}

// When the window empties at its pace so far, if that comes before it resets.
export function forecast(limit, now) {
  const window = WINDOWS[limit.kind]
  const label = window?.label ?? limit.kind
  const used = limit.percentUsed
  const remainingMs = limit.resetsAtMs === undefined ? undefined : limit.resetsAtMs - now
  const plain = { label, percentUsed: used, resetsInMs: remainingMs > 0 ? remainingMs : undefined }

  if (window?.lengthMs === undefined || remainingMs === undefined || used >= 100 || used <= 0) return plain

  const elapsedMs = window.lengthMs - remainingMs
  if (remainingMs <= 0 || elapsedMs < window.lengthMs * MIN_ELAPSED_SHARE) return plain

  const untilEmptyMs = ((100 - used) / used) * elapsedMs
  return { ...plain, runsOutInMs: untilEmptyMs < remainingMs ? untilEmptyMs : undefined }
}

// A forecast clouds the sky, and storms once the window is minutes from empty.
function forecastSky(f) {
  if (f.runsOutInMs === undefined) return 0
  return f.runsOutInMs <= CRITICAL_MS ? 3 : 1
}

export function duration(ms) {
  const minutes = Math.max(1, Math.round(ms / 60000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h${String(minutes % 60).padStart(2, '0')}`
  return `${Math.floor(hours / 24)}d${String(hours % 24).padStart(2, '0')}`
}

const percent = value => `${Math.round(value)}%`

export function weatherLine({ contextPercent, rateLimits }, now, { isColored = true } = {}) {
  const forecasts = rateLimits.map(limit => forecast(limit, now))
  const hasContext = Number.isFinite(contextPercent)
  const skies = forecasts.flatMap(f => [skyOf(f.percentUsed), forecastSky(f)])
  if (hasContext) skies.push(skyOf(contextPercent))
  const { icon, word } = SKIES[Math.max(0, ...skies)]

  const label = text => paint(COLORS.label, text, isColored)
  const value = pct => paint(COLORS[levelOf(pct)], percent(pct), isColored)

  const parts = [
    `${icon} ${paint(COLORS.weather, word, isColored)} ${label('ctx')} ${hasContext ? value(contextPercent) : label('–')}`,
    ...forecasts.map(f => {
      const resets = f.resetsInMs === undefined ? '' : ` ${label(`↻${duration(f.resetsInMs)}`)}`
      const reading = `${label(f.label)} ${value(f.percentUsed)}${resets}`
      if (f.runsOutInMs === undefined) return reading
      const color = f.runsOutInMs <= CRITICAL_MS ? COLORS.critical : COLORS.warn
      return `${reading} ${paint(color, `empty in ~${duration(f.runsOutInMs)}`, isColored)}`
    }),
  ]
  return parts.join(paint(COLORS.separator, ' · ', isColored))
}
