import { strings } from '../../../code-review/scripts/lib/i18n.mjs';
import { groupBySeverity } from '../../../code-review/scripts/lib/verdict.mjs';
import { renderFinding, renderScopeLine } from '../../../code-review/scripts/lib/render.mjs';
import { buildMarker } from './state.mjs';
import { fingerprint } from './compare.mjs';

const TITLES = {
  en: (version) => (version > 1 ? `AI-assisted Code Review (update ${version})` : 'AI-assisted Code Review'),
  th: (version) => (version > 1 ? `ผลรีวิวโค้ดโดย AI (รอบที่ ${version})` : 'ผลรีวิวโค้ดโดย AI'),
};

function severityBlock(heading, findings, lang, split) {
  if (!findings.length) return [];
  const out = [`### ${heading}`, ''];

  if (!split) {
    findings.forEach((finding, index) => out.push(renderFinding(finding, index, lang), ''));
    return out;
  }

  const t = strings(lang);
  const unresolved = findings.filter((f) => f.__group === 'stillUnresolved');
  const introduced = findings.filter((f) => f.__group !== 'stillUnresolved');

  if (unresolved.length) {
    out.push(`#### ${t.sections.stillUnresolved}`, '');
    unresolved.forEach((finding, index) => out.push(renderFinding(finding, index, lang), ''));
  }
  if (introduced.length) {
    out.push(`#### ${t.sections.newlyIntroduced}`, '');
    introduced.forEach((finding, index) => out.push(renderFinding(finding, index, lang), ''));
  }
  return out;
}

/**
 * Render the review result as a provider comment.
 *
 * Presentation only. Nothing here may lengthen, reword or re-severity what
 * `code-review` produced — the finding bodies come straight from its renderer.
 */
export function renderComment(result, options) {
  const {
    lang = 'en',
    reviewVersion = 1,
    headSha,
    baseBranch,
    previousSha = null,
    fullRerunReason = null,
    comparison = null,
    dismissed = [],
  } = options;

  const t = strings(lang);
  const out = [`## ${TITLES[lang](reviewVersion)}`, ''];

  out.push(`**${t.labels.status}:** ${t.commentStatus[result.verdict]}  `);
  out.push(`**${t.labels.reviewedCommit}:** \`${headSha}\`  `);
  if (previousSha) out.push(`**${t.labels.previouslyReviewed}:** \`${previousSha}\`  `);
  if (baseBranch) out.push(`**${t.labels.base}:** \`${baseBranch}\`  `);
  const scopeLine = renderScopeLine(result.scope, lang);
  if (scopeLine) out.push(`**${t.labels.scope}:** ${scopeLine}  `);
  out.push('');

  if (fullRerunReason) out.push(`_${t.fullRerunNote(fullRerunReason)}_`, '');
  if (comparison?.resolved?.length) {
    out.push(`_${t.resolvedNote(comparison.resolved.map((f) => f.id))}_`, '');
  }

  const findings = comparison
    ? [
        ...comparison.stillUnresolved.map((f) => ({ ...f, __group: 'stillUnresolved' })),
        ...comparison.newlyIntroduced.map((f) => ({ ...f, __group: 'newlyIntroduced' })),
      ]
    : (result.findings ?? []);

  const groups = groupBySeverity(findings);
  const split = Boolean(comparison);
  out.push(...severityBlock(t.sections.blocking, groups.blocking, lang, split));
  out.push(...severityBlock(t.sections.warning, groups.warning, lang, split));
  out.push(...severityBlock(t.sections.suggestion, groups.suggestion, lang, split));

  const checks = result.checks ?? [];
  if (checks.length) {
    out.push(`### ${t.sections.commentChecks}`, '');
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

  out.push('---', '', t.disclaimer, '');
  out.push(
    buildMarker({
      reviewedHeadSha: headSha,
      reviewVersion,
      findings: (result.findings ?? []).map((f) => ({
        fp: fingerprint(f),
        id: f.id,
        sev: f.severity,
      })),
      dismissed: dismissed.map((d) => ({ fp: d.fp ?? fingerprint(d), why: d.why })),
    })
  );

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
