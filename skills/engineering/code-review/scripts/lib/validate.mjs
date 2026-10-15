import { CAPS, isLanguageTag, missingStrings, writingStyle } from './i18n.mjs';
import { deriveVerdict, severityRank, SEVERITIES, VERDICTS } from './verdict.mjs';

export class ValidationError extends Error {
  constructor(problems) {
    super(
      `Review result failed validation (${problems.length} problem(s)):\n` +
        problems.map((p) => `  - ${p}`).join('\n')
    );
    this.name = 'ValidationError';
    this.problems = problems;
  }
}

const CATEGORIES = [
  'correctness',
  'security',
  'data_integrity',
  'breaking_change',
  'architecture',
  'error_handling',
  'concurrency',
  'testing',
  'performance',
  'maintainability',
  'style',
];

const CHECK_STATUSES = ['passed', 'failed', 'skipped', 'not_available'];
const TARGET_TYPES = ['git_diff', 'commit_range', 'working_tree', 'staged', 'files', 'path'];

/**
 * Count sentences in space-separated prose.
 *
 * Periods inside code spans (`.editorconfig`, `FileHelper.cs`) and inside
 * version numbers (6.0.302) are not sentence boundaries — without stripping
 * them first, a single well-cited sentence reads as four.
 */
export function countSentences(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return 0;
  const flattened = trimmed.replace(/`[^`]*`/g, 'X').replace(/(\d)\.(\d)/g, '$1$2');
  const boundaries = flattened.match(/[.!?](\s|$)/g);
  return boundaries ? boundaries.length : 1;
}

function checkProse(finding, field, problems) {
  const value = finding[field];
  if (value === undefined || value === null) return;

  const style = writingStyle(value);
  const caps = CAPS[style];
  const charCap = caps.chars[field];
  if (charCap && value.length > charCap) {
    problems.push(
      `${finding.id ?? '(no id)'} ${field}: ${value.length} characters, over the ${charCap} cap for ${style} text — ` +
        `shorten it, or move the verification detail into evidence`
    );
  }

  const sentenceCap = caps.sentences?.[field];
  if (sentenceCap) {
    const count = countSentences(value);
    if (count > sentenceCap) {
      problems.push(
        `${finding.id ?? '(no id)'} ${field}: ${count} sentences, over the cap of ${sentenceCap}`
      );
    }
  }
}

const PATCH_CODE_CAP = 800;
const PATCH_MAX_HUNKS = 5;

function validatePatch(finding, label, problems) {
  const patch = finding.patch;
  if (patch === undefined || patch === null) return;

  if (!Array.isArray(patch)) {
    problems.push(`${label}: patch must be an array`);
    return;
  }
  if (patch.length > PATCH_MAX_HUNKS) {
    problems.push(
      `${label}: patch has ${patch.length} entries, over the limit of ${PATCH_MAX_HUNKS} — ` +
        `show one or two representative sites and describe the rest in suggestion`
    );
  }

  for (const [index, hunk] of patch.entries()) {
    const at = `${label} patch[${index}]`;
    if (!hunk.file) problems.push(`${at}: missing file`);
    if (!hunk.after) problems.push(`${at}: missing after (the corrected code)`);

    for (const field of ['before', 'after']) {
      const value = hunk[field];
      if (value != null && value.length > PATCH_CODE_CAP) {
        problems.push(
          `${at} ${field}: ${value.length} characters, over the limit of ${PATCH_CODE_CAP} — ` +
            `quote only the lines that change, not the whole method`
        );
      }
    }

    if (hunk.before != null && hunk.before === hunk.after) {
      problems.push(`${at}: before and after are identical — nothing to change`);
    }
  }
}

function validateFinding(finding, index, problems) {
  const label = finding.id ?? `findings[${index}]`;

  for (const field of ['id', 'severity', 'category', 'title', 'message', 'impact', 'suggestion']) {
    if (!finding[field]) problems.push(`${label}: missing field ${field}`);
  }

  if (finding.id && !/^CR-\d{3,}$/.test(finding.id)) {
    problems.push(`${label}: id must look like CR-001`);
  }
  if (finding.severity && !SEVERITIES.includes(finding.severity)) {
    problems.push(`${label}: severity "${finding.severity}" is not allowed (${SEVERITIES.join('/')})`);
  }
  if (finding.category && !CATEGORIES.includes(finding.category)) {
    problems.push(`${label}: category "${finding.category}" is not allowed`);
  }
  if (finding.line != null && finding.file == null) {
    problems.push(`${label}: line is set but file is not`);
  }
  if (finding.endLine != null && finding.line != null && finding.endLine < finding.line) {
    problems.push(`${label}: endLine is before line`);
  }

  // Prose only. `patch` is intentionally absent from this list: it carries code,
  // and applying a prose budget to code would truncate exactly the part that
  // makes a finding actionable.
  for (const field of ['title', 'message', 'impact', 'suggestion', 'evidence']) {
    checkProse(finding, field, problems);
  }

  validatePatch(finding, label, problems);

  // The one exception to diff-awareness: a pre-existing committed secret is
  // reported, but it must never be the reason an author cannot merge.
  if (finding.preExisting && finding.severity === 'blocking') {
    problems.push(
      `${label}: a preExisting finding cannot be blocking — ` +
        `the author cannot fix what was committed before their change`
    );
  }
}

/**
 * Validate a draft review result. Returns nothing; throws ValidationError with
 * every problem at once so the caller fixes them in one pass rather than
 * discovering them one at a time.
 */
export function validateDraft(draft, lang) {
  const problems = [];

  if (!isLanguageTag(lang)) {
    throw new ValidationError([`"${lang}" is not a language tag (expected e.g. en, th, ja, pt-BR)`]);
  }

  const missing = missingStrings(lang, draft.reportStrings);
  if (missing.length) {
    problems.push(
      `no bundled locale for "${lang}" — add reportStrings translating these keys from ` +
        `assets/locales/en.json: ${missing.join(', ')}`
    );
  }

  for (const field of ['summary', 'reviewTarget', 'repositoryContext', 'checks', 'findings', 'limitations']) {
    if (draft[field] === undefined) problems.push(`missing top-level field: ${field}`);
  }

  if (draft.verdict && !VERDICTS.includes(draft.verdict)) {
    problems.push(`verdict "${draft.verdict}" is not allowed (${VERDICTS.join('/')})`);
  }

  const target = draft.reviewTarget;
  if (target) {
    if (!TARGET_TYPES.includes(target.type)) {
      problems.push(`reviewTarget.type "${target.type}" is not allowed`);
    }
    if (['git_diff', 'commit_range'].includes(target.type) && !(target.base && target.head)) {
      problems.push(`reviewTarget type ${target.type} needs both base and head`);
    }
    if (target.type === 'files' && !(target.files?.length > 0)) {
      problems.push('reviewTarget type files needs at least one entry in files');
    }
    if (target.type === 'path' && !target.path) {
      problems.push('reviewTarget type path needs path');
    }
  }

  for (const [index, check] of (draft.checks ?? []).entries()) {
    if (!check.name) problems.push(`checks[${index}]: missing name`);
    if (!CHECK_STATUSES.includes(check.status)) {
      problems.push(`checks[${index}]: status "${check.status}" is not allowed (${CHECK_STATUSES.join('/')})`);
    }
    if ((check.status === 'skipped' || check.status === 'not_available') && !check.details) {
      problems.push(`checks[${index}] (${check.name}): status ${check.status} needs the reason in details`);
    }
  }

  const findings = draft.findings ?? [];
  const seenIds = new Set();
  for (const [index, finding] of findings.entries()) {
    validateFinding(finding, index, problems);
    if (finding.id) {
      if (seenIds.has(finding.id)) problems.push(`duplicate id: ${finding.id}`);
      seenIds.add(finding.id);
    }
    if (index > 0) {
      const previous = findings[index - 1];
      if (severityRank(finding.severity) < severityRank(previous.severity)) {
        problems.push(
          `findings out of order at ${finding.id ?? index}: sort from most to least severe`
        );
      }
    }
  }

  if (draft.scope) {
    const { reviewedFileCount: reviewed, changedFileCount: changed } = draft.scope;
    if (typeof reviewed !== 'number' || typeof changed !== 'number') {
      problems.push('scope needs numeric reviewedFileCount and changedFileCount');
    } else if (reviewed > changed) {
      problems.push(`scope: reviewedFileCount (${reviewed}) is greater than changedFileCount (${changed})`);
    }
  }

  const derived = deriveVerdict(draft);
  if (draft.verdict && draft.verdict !== derived) {
    problems.push(`verdict "${draft.verdict}" contradicts the findings — it should be "${derived}"`);
  }
  if (derived === 'unable_to_complete' && !(draft.limitations?.length > 0)) {
    problems.push('verdict unable_to_complete needs at least one limitation');
  }

  if (problems.length) throw new ValidationError(problems);
}
