# CLAUDE.md

## Commit policy

Never commit automatically. Always wait for the user to explicitly ask for a commit,
even after finishing edits, bumping a skill's version, or running `bin/skills.mjs add`.

## Commit messages

Use semantic commit messages: `<type>(<scope>): <description>`

- `type`: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`
- `scope`: the skill folder name (e.g. `to-note`, `setup-workspace`), omit if repo-wide
- `description`: imperative, lowercase, no trailing period

Examples:
- `feat: add to-note v0.1.0`
- `fix(setup-workspace): route design tokens through Tailwind utilities`
- `docs: add commit message convention`


## Skill Structure

New skills use this layout. Only `SKILL.md` is required; create the other folders only when the skill needs them.

```
<skill-name>/
├── SKILL.md      # Required: instructions with YAML frontmatter (name, description, version)
├── scripts/      # Optional: executable code the skill runs
├── references/   # Optional: docs, schemas, policies, examples loaded on demand
└── assets/       # Optional: templates, fonts, icons, or other files used in output
```

- Keep `SKILL.md` lean; move detail into `references/` and point to it from `SKILL.md`.
- No other top-level folders. Fit content into one of the three: example files and
  schemas go in `references/`, output templates go in `assets/`.
- Existing skills with other layouts stay as they are unless a restructure is explicitly requested.

## Skill Design & Context Isolation

Skills must be reusable, capability-oriented, and domain-agnostic by default. The context in which a skill is created must not become a permanent requirement of that skill.

- **Intent over context**: Derive the skill's purpose and scope from the explicitly requested capability, not from the current conversation, project, or task.
- **Generic by default**: Design around reusable capabilities, workflows, and principles rather than specific domains, technologies, or use cases.
- **Context isolation**: Treat creation-time context as reference material, not permanent requirements. Never carry over incidental entities, APIs, platforms, workflows, or assumptions.
- **No language hardcoding**: Never infer a skill's required language from the creation session. Follow the future user's requested language or current interaction language.
- **Runtime adaptability**: Resolve domain, terminology, tools, conventions, language, and preferences when the skill is invoked, not when it is created.
- **Separation of concerns**: Keep generic instructions separate from domain-specific knowledge, configurations, and examples.
- **Examples are not requirements**: Use examples only to illustrate behavior. Never turn incidental details from examples into universal rules.
- **Minimal assumptions**: Avoid hardcoded paths, tools, frameworks, formats, or project conventions unless essential to the skill's purpose.
- **Adaptive execution**: Prefer principles and decision criteria over rigid procedures unless strict execution order is necessary.
- **Explicit specialization**: Domain-specific behavior is allowed when explicitly requested or inherently necessary. Keep it isolated and clearly documented.

#### Validation

Before finalizing or committing a skill, verify:

1. Can the skill work in an unrelated domain without modifying its core instructions?
2. Does it contain assumptions inherited only from the creation session?
3. Are language, tools, platforms, paths, or formats unnecessarily hardcoded?
4. Are examples being treated as universal requirements?
5. Will the skill adapt correctly to a future user's context and preferences?

Remove or generalize leaked assumptions. If specialization is necessary, ensure it is intentional and justified.


## Skill Maintenance

- **Rewrite over append**: Update existing instructions in place rather than appending new rules or sections.
- **Consolidate**: Merge overlapping requirements into existing principles. Avoid duplication and contradictory instructions.
- **Preserve intent**: Maintain the skill's original purpose, scope, and behavior unless explicitly requested otherwise.
- **Minimal footprint**: Prefer the smallest coherent set of instructions that fully expresses the intended behavior.
- **Refactor when necessary**: Reorganize or rewrite existing content when incremental edits would reduce clarity or consistency.
- **Review holistically**: After editing, review the entire skill for redundancy, contradictions, and unnecessary growth.

## Skill Versioning

Every `SKILL.md` declares `version: <major>.<minor>.<patch>` in its frontmatter. Whenever
a skill's files change, bump that version before committing — compare against the
current value and pick the bump by scope:

- **major**: breaking change — command/flag renamed or removed, behavior changed in a
  way that invalidates existing usage.
- **minor**: new capability added, backward-compatible (new command, new flag, new
  workflow branch).
- **patch**: fix, wording/doc tweak, internal refactor with no behavior change.

Skip the bump only for changes that touch no skill (e.g. this file, `README.md`,
`bin/skills.mjs`).

## Skill Installation

This repo is the source of truth for skills, but editing a file here does not make it live — Claude Code loads skills from `~/.claude/skills/<name>`, which is a symlink to `~/.agents/skills/<name>` (a plain global folder, not a git repo).

When a skill changes, always follow this order:

1. Edit the skill's files in this repo (`<skill-name>/`) and commit them — `add` only installs git-tracked files.
2. Run `node bin/skills.mjs add <skill-name>` (or `npx . add <skill-name>`) from the repo root. It copies the skill's tracked files into `~/.agents/skills/<skill-name>/`, overwriting what's there, and creates the `~/.claude/skills/<skill-name>` symlink if it doesn't already exist.

Run `node bin/skills.mjs list` to see which skills are installed.

Never edit `~/.agents/skills/<name>` or `~/.claude/skills/<name>` directly and treat that as done — those aren't tracked by git, so the change would be lost from version history and out of sync with the repo.
