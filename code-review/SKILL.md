---
name: code-review
description: Review source code changes independently of any Git hosting provider. Use when the user asks to review a pull request, working-tree changes, staged changes, a commit range, specific files, or a directory, or when another skill (e.g. review-pr) needs a structured review result.
disable-model-invocation: true
argument-hint: "[--working-tree] · [--staged] · [--diff <base>...<head>] · [--commits <a>..<b>] · [--files <path> ...] · [--path <dir>] · [--input <file.json>]"
---

# Code Review

Reviews a set of code changes and returns a **structured review result** plus a
human-readable Markdown report. Provider-agnostic: it never talks to GitHub, GitLab,
or Bitbucket, and never posts, approves, merges, or pushes anything.

Callable by a human (`/code-review ...`) or by an orchestrator skill such as
`review-pr`, which supplies a target and consumes the JSON.

## Workflow

Run these steps in order. Do not skip step 2 — repository rules outrank the generic
policies in this skill.

1. **[Resolve the review target](#1-resolve-the-review-target)**
2. **[Read repository instructions](#2-read-repository-instructions)**
3. **[Detect the stack](#3-detect-the-stack)**
4. **[Read the diff and its context](#4-read-the-diff-and-its-context)**
5. **[Run deterministic checks](#5-run-deterministic-checks)**
6. **[Review against the policies](#6-review-against-the-policies)**
7. **[Emit the result](#7-emit-the-result)**

## 1. Resolve the review target

| Invocation | Target |
| --- | --- |
| `--working-tree` | `git diff` (unstaged + untracked) |
| `--staged` | `git diff --cached` |
| `--diff dev...HEAD` | `git diff dev...HEAD` (three-dot: merge-base) |
| `--commits abc123..def456` | `git diff abc123..def456` |
| `--files a.cs b.cs` | those files, full content, reviewed as-is |
| `--path src/Payments` | changed files under that path, else the whole subtree |
| `--input review-context.json` | target described by the JSON file (see below) |
| *(none)* | inferred — see below |

**Inference when no flag is given**, in this order:

1. Unstaged or untracked changes exist → review the working tree.
2. Staged changes exist → review staged.
3. Current branch differs from the default branch (`main`/`master`/`dev`) →
   review `git diff <default>...HEAD`.
4. Otherwise → review the last commit (`HEAD~1..HEAD`), and say so in the summary.
5. If the repo state is ambiguous or the branch has no clear base, **ask** rather
   than guessing a wide range.

`--input` accepts a JSON file with at least `{ "type": ..., "base": ..., "head": ... }`
or `{ "type": "files", "files": [...] }`. Extra fields (PR title, description,
linked issue) are context only — treat them as claims to verify, not as facts.

Record the resolved target in `reviewTarget`. Never widen the range on your own; a
huge accidental diff is a reason to stop and ask, not to review everything.

## 2. Read repository instructions

Search for and read, from the changed paths upward:

`AGENTS.md`, `CLAUDE.md`, `CODE_REVIEW.md`, `ARCHITECTURE.md`, `DESIGN.md`,
`PRODUCT.md`, `PLAN.md`, `TASK.md`, `README.md`, `CONTRIBUTING.md`

**Precedence** (closest wins on conflict):

1. Instructions in or nearest the changed file's directory
2. Module-level instructions
3. Repository-root instructions
4. The policies in `policies/`

Read selectively — only documents covering the affected modules. Skip a 400-line
`README.md` about deployment when reviewing a UI component. List everything you
actually read in `repositoryContext.instructionsRead`; do not list files you skipped.

When a repository rule is marked mandatory ("must", "never", "always"), a violation
is **blocking** and the finding's `rule` field cites it (e.g. `AGENTS.md#layering`).

## 3. Detect the stack

Infer from repo files and changed paths — `*.sln`/`*.csproj` (ASP.NET Core / C#),
`package.json` + `angular.json` (Angular), `package.json` + React deps, plain
Node.js, `go.mod` (Go), `*.sql`, `Dockerfile`/`compose.yml`, Terraform/Helm/k8s
manifests. Record them in `detectedStacks`.

Use only conventions and tools that exist in this repository. **Never invent** a test
framework, layering rule, or lint config the repo does not have.

## 4. Read the diff and its context

Read the full diff, then read enough surrounding code to actually verify claims:
method contracts, interfaces, call sites, existing implementations, tests,
dependency direction, migrations and DB behavior, and error-handling conventions.

A finding you could not verify by reading the code is a hypothesis — either verify
it or leave it out. Do not report an issue you inferred purely from a file name.

## 5. Run deterministic checks

Discover commands from `package.json` scripts, `*.sln`/`*.csproj`, `Makefile`,
`Taskfile.yml`, `README.md`, `AGENTS.md`/`CLAUDE.md`, and CI config
(`.github/workflows/`, `.gitlab-ci.yml`, `azure-pipelines.yml`). Prefer what CI runs.

Run what is relevant and practical: build, type check, lint, format check, unit
tests, static analysis, architecture tests, security scans **already configured**
in the repo.

Rules:

- **Do not install dependencies** unless the user explicitly allows it.
- **Do not claim a check passed unless you ran it and it exited zero.** Report the
  real status: `passed` / `failed` / `skipped` / `not_available`.
- A check that could not run goes in `limitations` with the reason.
- Run read-only/verification commands only — never a command that deploys, migrates
  production data, rewrites history, or mutates remote state.
- If tests take unreasonably long or need unavailable infrastructure, skip them and
  record the limitation rather than hanging.

A build or test failure **caused by the reviewed change** is a blocking finding.
A pre-existing failure is a limitation, not a finding.

## 6. Review against the policies

Read the policy files relevant to the change:

| Policy | Covers |
| --- | --- |
| [policies/correctness.md](policies/correctness.md) | Logic, null/boundary handling, contracts, breaking changes, concurrency, transactions |
| [policies/security.md](policies/security.md) | AuthN/AuthZ, injection, secrets, input validation, sensitive data |
| [policies/architecture.md](policies/architecture.md) | Layering, dependency direction, module boundaries, data integrity |
| [policies/testing.md](policies/testing.md) | When tests are required and what makes them adequate |
| [policies/maintainability.md](policies/maintainability.md) | Clarity, duplication, error handling, performance, naming |

**Priority order** for findings: correctness → security → data integrity → breaking
changes → architecture violations → error handling → concurrency/transactions →
test adequacy → performance regressions → maintainability → naming and style.

**Diff-aware:** report only what the change introduces or exposes. Unrelated legacy
problems are out of scope unless the new code depends on or worsens them.

**Severity** — exactly three levels:

- `blocking` — incorrect behavior, security vulnerability, data corruption risk,
  severe architecture violation, missing required validation, unhandled breaking
  change, build/test failure caused by the change, or violation of a mandatory
  repository rule. Should normally prevent merge.
- `warning` — a meaningful issue to consider before merge; may not always block.
- `suggestion` — non-blocking improvement.

Do not inflate severity. A style nit is never blocking. If you are unsure whether
something is a real defect, it is at most a `warning`, and say what you could not
verify.

**Every finding must:** name a concrete problem, explain why it matters, cite
file and line when possible, cite the project rule when one applies, and give a
practical remediation. No vague statements, no praise, no restating one root cause
as several findings — merge them into one with the strongest evidence.

Bad: `This code could be improved.`

Good: ``` `PaymentController.cs:42` accesses `ApplicationDbContext` directly, which
violates the repository rule requiring persistence access to stay in services. Move
this query into `IPaymentService` and keep the controller to request orchestration. ```

Say nothing about subjective preference unless it materially affects clarity,
consistency, safety, or maintainability. An empty findings list is a valid, good
outcome — do not manufacture findings to look thorough.

## 7. Emit the result

Produce **both** outputs, JSON first.

### JSON

Must validate against [schemas/review-result.schema.json](schemas/review-result.schema.json).
Findings are numbered `CR-001`, `CR-002`, … in the order reported (most severe first).

**The verdict is derived, not chosen:**

| Condition | Verdict |
| --- | --- |
| any `blocking` finding | `changes_required` |
| `warning`s but no `blocking` | `pass_with_warnings` |
| no actionable findings | `pass` |
| target unresolvable / diff unreadable / review aborted | `unable_to_complete` |

Compute it from the findings array. Never state a verdict the findings contradict.
`unable_to_complete` requires at least one entry in `limitations`.

### Markdown report

```markdown
## Code Review

**Verdict:** Changes required
**Reviewed range:** `abc123..def456`

### Blocking

1. **Possible null dereference**
   `src/PaymentService.cs:84`

   Explanation of the issue.

   **Recommended change:** Practical remediation.

### Warnings

...

### Checks

- `dotnet build` — Passed
- `dotnet test` — Failed

### Limitations

- Integration tests were not executed because the required database was unavailable.
```

Omit empty sections. Return the report to the caller or user — **never post it
anywhere.**

## Boundaries

This skill **must not**: merge branches, approve pull requests, push commits, create
or comment on PRs/issues, modify production configuration, expose secrets, run
destructive database commands, or silently edit source code.

It **may** propose patches inside findings. Actually applying a fix requires a
separate, explicit instruction from the user.
