---
name: code-review
version: 0.2.0
description: Review source code changes independently of any Git hosting provider. Use when the user asks to review a pull request, working-tree changes, staged changes, a commit range, specific files, or a directory, or when another skill (e.g. review-pr) needs a structured review result.
argument-hint: "[--working-tree] · [--staged] · [--diff <base>...<head>] · [--commits <a>..<b>] · [--files <path> ...] · [--path <dir>] · [--input <file.json>] · [--lang <tag>]"
---

# Code Review

Reviews a set of code changes and returns a **structured review result** plus a
human-readable Markdown report. Provider-agnostic: it never talks to a Git host, and
never posts, approves, merges, or pushes anything.

Callable by a human (`/code-review ...`) or by an orchestrator skill, which supplies a
target and consumes the JSON.

## Workflow

Run these steps in order. Do not skip step 2 — repository rules outrank the generic
policies in this skill. Settle the report language together with step 1, not after the
review is written: see [references/report-language.md](references/report-language.md).

### 1. Resolve the review target

| Invocation | Target |
| --- | --- |
| `--working-tree` | `git diff` (unstaged + untracked) |
| `--staged` | `git diff --cached` |
| `--diff dev...HEAD` | `git diff dev...HEAD` (three-dot: merge-base) |
| `--commits abc123..def456` | `git diff abc123..def456` |
| `--files a.cs b.cs` | those files, full content, reviewed as-is |
| `--path src/Payments` | changed files under that path, else the whole subtree |
| `--input review-context.json` | target described by the JSON file |
| *(none)* | inferred — see below |

With no flag, take the first that applies: unstaged/untracked changes → working tree;
staged changes → staged; current branch differs from the default branch →
`git diff <default>...HEAD`; otherwise the last commit, saying so in the summary. If the
repo state is ambiguous or the branch has no clear base, **ask** rather than guess.

`--input` accepts at least `{ "type", "base", "head" }` or `{ "type": "files", "files" }`.
Extra fields (PR title, description, linked issue) are claims to verify, not facts.

Record the target in `reviewTarget`. Never widen the range on your own; a huge
accidental diff is a reason to stop and ask, not to review everything.

### 2. Read repository instructions

Look, from the changed paths upward, for the project's own guidance — agent instruction
files (`AGENTS.md`, `CLAUDE.md`), review, architecture, design or contribution guides,
and READMEs. **Closest wins** on conflict: the changed file's directory, then module,
then repository root, then this skill's [policies](references/policies/).

Read selectively — only what covers the affected modules — and list what you actually
read in `repositoryContext.instructionsRead`.

Cite a mandatory rule ("must", "never", "always") in the finding's `rule` field
(`AGENTS.md#layering`). Severity still comes from impact, not the rule's tone: a
violation is blocking only when it causes wrong behavior, a security or data risk, or a
broken build; a purely conventional rule (formatting, layout, naming) is a warning.

### 3. Detect the stack

Infer it from repository files and changed paths (build manifests, lockfiles, framework
config, infrastructure files) and record it in `detectedStacks`. Use only conventions
and tools that exist in this repository — **never invent** a test framework, layering
rule, or lint config it does not have.

### 4. Read the diff and its context

Read the full diff, then enough surrounding code to verify claims: contracts,
interfaces, call sites, existing implementations, tests, dependency direction,
migrations, error-handling conventions. A finding you could not verify by reading code
is a hypothesis — verify it or leave it out.

### 5. Run deterministic checks

Discover commands from the project's build files, task runners, docs and CI config;
prefer what CI runs. Run what is relevant and practical: build, type check, lint,
format check, unit tests, and analysis or security scans **already configured**.

- **Do not install dependencies** unless the user explicitly allows it.
- **Never claim a check passed unless you ran it and it exited zero.** Report
  `passed` / `failed` / `skipped` / `not_available`; a check that could not run goes in
  `limitations` with the reason.
- Run read-only commands only — nothing that deploys, migrates data, rewrites history,
  or mutates remote state. Skip checks that hang or need unavailable infrastructure.

A failure **caused by the change** is a blocking finding; a pre-existing failure is a
limitation.

### 6. Review against the policies

Read the policies relevant to the change:

| Policy | Covers |
| --- | --- |
| [correctness](references/policies/correctness.md) | Logic, null/boundary handling, contracts, breaking changes, concurrency, transactions |
| [security](references/policies/security.md) | AuthN/AuthZ, injection, secrets, input validation, sensitive data |
| [architecture](references/policies/architecture.md) | Layering, dependency direction, module boundaries, data integrity |
| [testing](references/policies/testing.md) | When tests are required and what makes them adequate |
| [maintainability](references/policies/maintainability.md) | Clarity, duplication, error handling, performance, naming |

**Priority:** correctness → security → data integrity → breaking changes → architecture
→ error handling → concurrency/transactions → test adequacy → performance →
maintainability → naming and style.

**Diff-aware:** report only what the change introduces or exposes. Unrelated legacy
problems are out of scope unless the new code depends on or worsens them.

**Severity** — exactly three levels, never inflated:

- `blocking` — incorrect behavior, security vulnerability, data corruption risk, severe
  architecture violation, missing required validation, unhandled breaking change, or a
  build/test failure caused by the change.
- `warning` — a meaningful issue to weigh before merge. Anything you are unsure is a real
  defect is at most a warning, with what you could not verify.
- `suggestion` — non-blocking improvement. A style nit is never blocking.

Every finding names a concrete problem, why it matters, file and line when possible, the
project rule when one applies, and a practical fix. No vague statements, no praise, no
one root cause split into several findings. An empty findings list is a valid outcome.
How to write them — length limits, ordering, patches, and recording what you dismissed —
is in [references/writing-findings.md](references/writing-findings.md).

### 7. Emit the result

**Never write the report by hand.** Write a draft JSON (the result without `verdict`),
run `scripts/review.mjs` to validate it, derive the verdict and render the Markdown, and
relay its output. Usage, the verdict rules, what the script enforces, and a sample
report are in [references/output.md](references/output.md).

Return the report to the caller or user — **never post it anywhere.**

## Boundaries

This skill **must not**: merge branches, approve pull requests, push commits, create or
comment on PRs/issues, modify production configuration, expose secrets, run destructive
database commands, or silently edit source code.

It **may** propose patches inside findings. Applying a fix requires a separate, explicit
instruction from the user.
