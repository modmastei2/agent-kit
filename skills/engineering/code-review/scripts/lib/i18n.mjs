import { readdirSync, readFileSync } from 'node:fs';

/**
 * Any well-formed language tag is accepted (`en`, `th`, `ja`, `pt-BR`). The
 * reviewer writes the finding prose in that language itself; this module only
 * supplies the handful of sentences the renderer generates.
 */
const LANGUAGE_TAG_RE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/;

export function isLanguageTag(value) {
  return typeof value === 'string' && LANGUAGE_TAG_RE.test(value);
}

/**
 * Prose length limits, per writing style rather than per language.
 *
 * Scripts written without inter-word spaces (Thai, Lao, Khmer, Myanmar, Chinese,
 * Japanese) pack more meaning into the same character count, so a single cap
 * calibrated on space-separated text silently allows a much longer finding. The
 * compact limits are ~60% of the spaced ones, roughly where the two carry
 * equivalent content.
 *
 * `sentences` is only enforced for spaced text: several compact scripts do not
 * mark sentence boundaries with terminal punctuation, so counting them is
 * unreliable and the character cap does the work instead.
 */
export const CAPS = {
  spaced: {
    chars: { title: 120, message: 300, impact: 300, suggestion: 400, evidence: 300 },
    sentences: { message: 2, impact: 2, suggestion: 3, evidence: 2 },
  },
  compact: {
    chars: { title: 80, message: 180, impact: 180, suggestion: 240, evidence: 180 },
    sentences: null,
  },
};

const COMPACT_SCRIPT_RE =
  /[\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu;

/**
 * Classify a piece of prose by how it is written, ignoring code spans.
 * Detected from the text itself, so a language needs no registration here.
 */
export function writingStyle(text) {
  const prose = String(text ?? '').replace(/`[^`]*`/g, '');
  const letters = prose.match(/\p{L}/gu)?.length ?? 0;
  if (!letters) return 'spaced';
  const compact = prose.match(COMPACT_SCRIPT_RE)?.length ?? 0;
  return compact / letters > 0.5 ? 'compact' : 'spaced';
}

/**
 * Structural chrome — identical in every language, by design.
 *
 * Headings, field labels and status values name things from the output
 * contract, and the team says them in English regardless of which language the
 * review is written in. Translating them would give one state two names.
 *
 * Sharing one object rather than repeating the values per language makes that
 * rule structural: a heading cannot drift into a translation, because there is
 * nowhere to put the translation.
 */
const CHROME = {
  reportTitle: 'Code Review',
  commentTitle: 'AI-assisted Code Review',
  labels: {
    verdict: 'Verdict',
    range: 'Reviewed range',
    scope: 'Scope',
    status: 'Status',
    reviewedCommit: 'Reviewed commit',
    previouslyReviewed: 'Previously reviewed',
    base: 'Base',
  },
  sections: {
    blocking: 'Blocking',
    warning: 'Warnings',
    suggestion: 'Suggestions',
    checks: 'Checks',
    commentChecks: 'Automated checks',
    limitations: 'Limitations',
    stillUnresolved: 'Still unresolved',
    newlyIntroduced: 'Newly introduced',
  },
  recommended: 'Recommended change',
  evidenceLabel: 'Evidence',
  verdicts: {
    pass: 'Pass',
    pass_with_warnings: 'Pass with warnings',
    changes_required: 'Changes required',
    unable_to_complete: 'Unable to complete',
  },
  checkStatus: {
    passed: 'Passed',
    failed: 'Failed',
    skipped: 'Skipped',
    not_available: 'Not available',
  },
};

/**
 * Sentences. These carry meaning rather than naming a contract value, so they
 * are written in the reader's language. They live in `assets/locales/<tag>.json`
 * as `{placeholder}` templates; English is the reference set of keys.
 *
 * A language without a bundled locale is covered by `reportStrings` in the
 * review result — the reviewer translates the English file's values — so no
 * language needs a code change to be supported.
 */
const LOCALES_DIR = new URL('../../assets/locales/', import.meta.url);
const LOCALES = Object.fromEntries(
  readdirSync(LOCALES_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => [
      name.slice(0, -5).toLowerCase(),
      JSON.parse(readFileSync(new URL(name, LOCALES_DIR), 'utf8')),
    ])
);

export const BUNDLED_LANGS = Object.keys(LOCALES);

function bundledLocale(lang) {
  const tag = String(lang).toLowerCase();
  return LOCALES[tag] ?? LOCALES[tag.split('-')[0]] ?? null;
}

/** Dotted paths of every string leaf, e.g. `fullRerunReasons.unreachable`. */
function leafPaths(object, prefix = '') {
  return Object.entries(object).flatMap(([key, value]) =>
    value && typeof value === 'object'
      ? leafPaths(value, `${prefix}${key}.`)
      : [`${prefix}${key}`]
  );
}

function lookup(object, path) {
  return path.split('.').reduce((node, key) => node?.[key], object);
}

function merge(base, override) {
  if (!override || typeof override !== 'object') return base;
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    out[key] =
      value && typeof value === 'object' && !Array.isArray(value)
        ? merge(base[key] ?? {}, value)
        : value;
  }
  return out;
}

/**
 * Keys a language still needs from `reportStrings`. Empty for a bundled
 * language; otherwise every English key the overrides leave untranslated, so
 * the report never comes out half in English.
 */
export function missingStrings(lang, overrides) {
  if (bundledLocale(lang)) return [];
  return leafPaths(LOCALES.en).filter((path) => typeof lookup(overrides, path) !== 'string');
}

function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

/**
 * Strings for one report: English chrome plus prose for `lang`, layered as
 * English → bundled locale → `overrides` (the result's `reportStrings`).
 */
export function strings(lang, overrides) {
  const prose = merge(merge(LOCALES.en, bundledLocale(lang)), overrides);
  return {
    ...CHROME,
    commentStatus: prose.commentStatus,
    violates: prose.violates,
    preExisting: prose.preExisting,
    reconsidered: prose.reconsidered,
    disclaimer: prose.disclaimer,
    updateSuffix: (version) => fill(prose.updateSuffix, { version }),
    scopeLine: (reviewed, changed, exclusions) =>
      fill(prose.scopeLine, { reviewed, changed }) +
      (exclusions.length ? ` — ${exclusions.join('; ')}` : ''),
    resolvedNote: (ids) => fill(prose.resolvedNote, { ids: ids.join(', ') }),
    fullRerunNote: (reason) => fill(prose.fullRerunNote, { reason }),
    fullRerunReasons: {
      noPrevious: prose.fullRerunReasons.noPrevious,
      same: prose.fullRerunReasons.same,
      unreachable: (sha) => fill(prose.fullRerunReasons.unreachable, { sha }),
    },
  };
}
