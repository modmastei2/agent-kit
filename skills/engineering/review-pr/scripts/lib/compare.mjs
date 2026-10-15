export class ContradictionError extends Error {
  constructor(contradictions) {
    const header = `This review reverses ${contradictions.length} judgement(s) the previous review made deliberately.`;

    const detail = contradictions
      .map((c) => `  - ${c.id} "${c.title}" (${c.fp})\n    previously dismissed as: ${c.why}`)
      .join('\n');

    const fix =
      'Either drop the finding, or set `previouslyDismissed` on it explaining what changed. Silently reversing an earlier conclusion is what makes a reviewer untrustworthy.';

    super(`${header}\n${detail}\n\n${fix}`);
    this.name = 'ContradictionError';
    this.contradictions = contradictions;
  }
}

function slug(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

/**
 * Identity of a finding across review rounds.
 *
 * Deliberately coarse — category plus file, not line number or wording. Line
 * numbers drift as the branch grows and the model rewords titles between runs,
 * so anything finer would stop matching exactly when the comparison matters
 * most. An explicit `fp` on the finding overrides this.
 */
export function fingerprint(finding) {
  if (finding.fp) return finding.fp;
  const where = finding.file ?? slug(finding.title);
  return `${finding.category}:${where}`;
}

/**
 * Compare a new set of findings against the previous review's state.
 *
 * Throws when the new review reports something the previous one explicitly
 * dismissed and offers no explanation for the reversal.
 */
export function compareRounds(previous, findings) {
  const previousState = previous ?? { findings: [], dismissed: [] };
  const dismissedByFp = new Map(previousState.dismissed.map((d) => [d.fp, d.why]));
  const previousByFp = new Map(previousState.findings.map((f) => [f.fp, f]));

  const contradictions = [];
  const stillUnresolved = [];
  const newlyIntroduced = [];
  const seen = new Set();

  for (const finding of findings) {
    const fp = fingerprint(finding);
    seen.add(fp);

    if (dismissedByFp.has(fp) && !finding.previouslyDismissed) {
      contradictions.push({
        fp,
        id: finding.id,
        title: finding.title,
        why: dismissedByFp.get(fp),
      });
    }

    if (previousByFp.has(fp)) stillUnresolved.push({ ...finding, fp });
    else newlyIntroduced.push({ ...finding, fp });
  }

  if (contradictions.length) throw new ContradictionError(contradictions);

  const resolved = previousState.findings.filter((f) => !seen.has(f.fp));

  return {
    stillUnresolved,
    newlyIntroduced,
    resolved,
    counts: {
      stillUnresolved: stillUnresolved.length,
      newlyIntroduced: newlyIntroduced.length,
      resolved: resolved.length,
    },
  };
}
