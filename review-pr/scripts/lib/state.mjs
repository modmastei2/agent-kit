import { execFileSync } from 'node:child_process';

export class StateError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StateError';
  }
}

const MARKER_RE = /<!--\s*ai-review-state:\s*([\s\S]*?)-->/;

/**
 * Machine-readable state carried in the posted comment.
 *
 * It records more than the SHA: every finding reported and — the part that
 * matters — everything the previous review looked at and deliberately did not
 * report. Without the dismissed list a later run has no way to know it is
 * reversing an earlier judgement, and silently contradicts itself.
 */
export function parseMarker(text) {
  const match = MARKER_RE.exec(text ?? '');
  if (!match) return null;

  let parsed;
  try {
    parsed = JSON.parse(match[1].trim());
  } catch (err) {
    throw new StateError(`state marker อ่านไม่ได้ (JSON เสีย): ${err.message}`);
  }

  if (!parsed.reviewedHeadSha) {
    throw new StateError('state marker ไม่มี reviewedHeadSha');
  }

  return {
    reviewedHeadSha: parsed.reviewedHeadSha,
    reviewVersion: parsed.reviewVersion ?? 1,
    findings: parsed.findings ?? [],
    dismissed: parsed.dismissed ?? [],
  };
}

export function buildMarker({ reviewedHeadSha, reviewVersion, findings = [], dismissed = [] }) {
  const payload = {
    reviewedHeadSha,
    reviewVersion,
    findings: findings.map((f) => ({ fp: f.fp, id: f.id, sev: f.sev ?? f.severity })),
    dismissed: dismissed.map((d) => ({ fp: d.fp, why: d.why })),
  };
  return `<!-- ai-review-state:\n${JSON.stringify(payload, null, 2)}\n-->`;
}

function shaReachable(sha, cwd) {
  try {
    execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Decide whether this run can review incrementally, and say why when it cannot.
 *
 * A full re-review labelled as "update N" without a stated reason is
 * indistinguishable from a bug, so the reason travels with the decision rather
 * than being left to the caller to remember.
 */
export function decideMode({ previousSha, headSha, cwd = process.cwd(), lang = 'en' }) {
  const reasons = {
    en: {
      noPrevious: 'no previous review comment was found on this PR',
      unreachable: (sha) =>
        `the previously reviewed commit \`${sha}\` is no longer reachable, which happens after a force-push, rebase or squash`,
      same: 'the head commit is unchanged since the previous review',
    },
    th: {
      noPrevious: 'ยังไม่เคยมีรีวิวบน PR นี้มาก่อน',
      unreachable: (sha) =>
        `commit ที่รีวิวรอบก่อน (\`${sha}\`) ไม่มีอยู่ใน history แล้ว ซึ่งเกิดจากการ force-push, rebase หรือ squash`,
      same: 'commit ล่าสุดยังเป็นตัวเดิมตั้งแต่รีวิวรอบก่อน',
    },
  }[lang];

  if (!reasons) throw new StateError(`ไม่รองรับภาษา: ${lang}`);
  if (!previousSha) return { mode: 'full', reason: reasons.noPrevious, previousSha: null };

  if (!shaReachable(previousSha, cwd)) {
    return { mode: 'full', reason: reasons.unreachable(previousSha.slice(0, 8)), previousSha: null };
  }

  if (previousSha === headSha) {
    return { mode: 'incremental', reason: reasons.same, previousSha, unchanged: true };
  }

  return { mode: 'incremental', reason: null, previousSha };
}
