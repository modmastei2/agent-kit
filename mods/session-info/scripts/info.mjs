// Pure helpers for session-info.mjs, kept free of I/O so they can be tested directly.

export const SEGMENTS = ['model', 'effort', 'time', 'lines', 'cache']
export const DEFAULT_SEGMENTS = SEGMENTS.join(',')

// Semantic colors (24-bit), the same set token-weather uses: the model as the
// headline, quiet labels, plain values, color only where a value says how
// things are going, and lines changed in the usual diff green and red.
export const COLORS = {
  headline: '38;2;121;192;255',
  label: '38;2;139;148;158',
  value: '',
  ok: '38;2;63;185;80',
  warn: '38;2;242;204;96',
  critical: '38;2;248;81;73',
  separator: '38;2;72;79;88',
}

// A prompt cache reading below this hit ratio is worth a look.
const GOOD_HIT_RATIO = 0.7

export function paint(color, text, isColored) {
  return isColored && color !== '' ? `\x1b[${color}m${text}\x1b[0m` : text
}

// Unknown names are dropped, duplicates kept once, so a typo never breaks the line.
export function parseSegments(spec) {
  const picked = []
  for (const raw of String(spec).split(',')) {
    const name = raw.trim().toLowerCase()
    if (SEGMENTS.includes(name) && !picked.includes(name)) picked.push(name)
  }
  return picked
}

export function duration(ms) {
  const minutes = Math.floor(ms / 60000)
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`
}

const number = value => (Number.isFinite(value) ? value : undefined)

// The facts a line is built from, out of Claude Code's statusLine JSON.
export function readFacts(data) {
  const cache = data.prompt_cache
  return {
    model: data.model?.display_name ?? data.model?.id,
    effort: typeof data.effort?.level === 'string' ? data.effort.level : undefined,
    durationMs: number(data.cost?.total_duration_ms),
    linesAdded: number(data.cost?.total_lines_added),
    linesRemoved: number(data.cost?.total_lines_removed),
    cache:
      cache && typeof cache === 'object' && cache.caching_observed !== false
        ? { isWarm: cache.warm === true, hitRatio: number(cache.hit_ratio) }
        : undefined,
  }
}

function render(segment, facts, isColored) {
  const label = text => paint(COLORS.label, text, isColored)
  const value = text => paint(COLORS.value, text, isColored)
  switch (segment) {
    case 'model':
      return facts.model === undefined ? undefined : paint(COLORS.headline, facts.model, isColored)
    case 'effort':
      return facts.effort === undefined ? undefined : `${label('effort')} ${value(facts.effort)}`
    case 'time':
      return facts.durationMs === undefined ? undefined : `${label('⏱')} ${value(duration(facts.durationMs))}`
    case 'lines': {
      const { linesAdded: added = 0, linesRemoved: removed = 0 } = facts
      if (added === 0 && removed === 0) return undefined
      return `${paint(COLORS.ok, `+${added}`, isColored)} ${paint(COLORS.critical, `−${removed}`, isColored)}`
    }
    case 'cache': {
      if (facts.cache === undefined) return undefined
      if (!facts.cache.isWarm) return label('cache cold')
      const { hitRatio } = facts.cache
      if (hitRatio === undefined) return `${label('cache')} ${value('warm')}`
      const color = hitRatio >= GOOD_HIT_RATIO ? COLORS.ok : COLORS.warn
      return `${label('cache')} ${paint(color, `${Math.round(hitRatio * 100)}%`, isColored)}`
    }
  }
}

// Empty segments are skipped.
export function buildLine(segments, facts, { separator = ' · ', isColored = true } = {}) {
  return segments
    .map(segment => render(segment, facts, isColored))
    .filter(part => part !== undefined && part !== '')
    .join(paint(COLORS.separator, separator, isColored))
}
