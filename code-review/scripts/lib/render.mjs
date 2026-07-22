import { strings } from './i18n.mjs';
import { groupBySeverity } from './verdict.mjs';

function targetRange(target) {
  if (!target) return null;
  switch (target.type) {
    case 'git_diff':
      return `${target.base}...${target.head}`;
    case 'commit_range':
      return `${target.base}..${target.head}`;
    case 'working_tree':
      return 'working tree';
    case 'staged':
      return 'staged';
    case 'files':
      return (target.files ?? []).join(', ');
    case 'path':
      return target.path;
    default:
      return null;
  }
}

/**
 * Prefix each line of a code block with a diff marker.
 *
 * Trailing newlines are dropped so a block does not end with a bare marker, but
 * interior blank lines are kept — they are part of the code as written.
 */
function prefixLines(code, marker) {
  if (code == null || code === '') return [];
  return String(code).replace(/\n+$/, '').split('\n').map((line) => `${marker}${line}`);
}

/**
 * One finding, rendered.
 *
 * The order is fixed and deliberate: what is wrong, what it costs, how to fix
 * it, and only then how it was proven. `message` and `impact` sit in one
 * paragraph as separate sentences — never merged into a block of prose, and
 * never reordered so the method comes first.
 */
export function renderFinding(finding, index, lang) {
  const t = strings(lang);
  const lines = [];

  lines.push(`${index + 1}. **${finding.title}**`);

  const locationParts = [];
  if (finding.file) {
    locationParts.push(finding.line ? `\`${finding.file}:${finding.line}\`` : `\`${finding.file}\``);
  }
  if (finding.rule) locationParts.push(`${lang === 'th' ? 'ขัดกับ' : 'violates'} \`${finding.rule}\``);
  if (locationParts.length) lines.push(`   ${locationParts.join(' · ')}`);

  lines.push('');
  const body = [finding.message, finding.impact].filter(Boolean).join('\n   ');
  lines.push(`   ${body}`);

  if (finding.preExisting) {
    lines.push('');
    lines.push(`   _${t.preExisting}_`);
  }

  lines.push('');
  lines.push(`   **${t.recommended}:** ${finding.suggestion}`);

  for (const hunk of finding.patch ?? []) {
    lines.push('');
    const at = hunk.line ? `\`${hunk.file}:${hunk.line}\`` : `\`${hunk.file}\``;
    lines.push(`   ${at}${hunk.note ? ` — ${hunk.note}` : ''}`);
    lines.push('');
    lines.push('   ```diff');
    for (const line of prefixLines(hunk.before, '-')) lines.push(`   ${line}`);
    for (const line of prefixLines(hunk.after, '+')) lines.push(`   ${line}`);
    lines.push('   ```');
  }

  if (finding.previouslyDismissed) {
    lines.push('');
    lines.push(`   _${t.reconsidered}: ${finding.previouslyDismissed}_`);
  }

  if (finding.evidence) {
    lines.push('');
    lines.push(`   <sub>${finding.evidence}</sub>`);
  }

  return lines.join('\n');
}

function renderSection(heading, findings, lang) {
  if (!findings.length) return [];
  const blocks = findings.map((finding, index) => renderFinding(finding, index, lang));
  return [`### ${heading}`, '', ...blocks.flatMap((block) => [block, ''])];
}

export function renderScopeLine(scope, lang) {
  if (!scope) return null;
  const t = strings(lang);
  return t.scopeLine(scope.reviewedFileCount, scope.changedFileCount, scope.exclusions ?? []);
}

/** The standalone Markdown report returned by `code-review` itself. */
export function renderReport(result, lang) {
  const t = strings(lang);
  const out = [`## ${t.reportTitle}`, ''];

  out.push(`**${t.labels.verdict}:** ${t.verdicts[result.verdict]}  `);
  const range = targetRange(result.reviewTarget);
  if (range) out.push(`**${t.labels.range}:** \`${range}\`  `);
  const scopeLine = renderScopeLine(result.scope, lang);
  if (scopeLine) out.push(`**${t.labels.scope}:** ${scopeLine}  `);
  out.push('');

  const groups = groupBySeverity(result.findings ?? []);
  out.push(...renderSection(t.sections.blocking, groups.blocking, lang));
  out.push(...renderSection(t.sections.warning, groups.warning, lang));
  out.push(...renderSection(t.sections.suggestion, groups.suggestion, lang));

  const checks = result.checks ?? [];
  if (checks.length) {
    out.push(`### ${t.sections.checks}`, '');
    for (const check of checks) {
      const detail = check.details ? ` — ${check.details}` : '';
      out.push(`- \`${check.name}\` — ${t.checkStatus[check.status]}${detail}`);
    }
    out.push('');
  }

  const limitations = result.limitations ?? [];
  if (limitations.length) {
    out.push(`### ${t.sections.limitations}`, '');
    for (const limitation of limitations) out.push(`- ${limitation}`);
    out.push('');
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
