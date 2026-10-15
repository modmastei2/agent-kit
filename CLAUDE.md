# CLAUDE.md

## Commit policy

Never commit automatically. Always wait for the user to explicitly ask for a commit,
even after finishing edits, bumping a skill's or mod's version, or running `bin/agent-kit.mjs add`.

# Commit Message Convention

Use semantic commit messages: `<type>(<scope>): <subject>`

- `type`: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`, `chore`, `revert`
- `scope`: the affected area (feature folder, module, package) — omit it rather than invent one
- `subject`: imperative mood, lowercase, no trailing period
- One line only, ≤ 100 characters total — no body, no footer, even for a multi-file change
- One logical change per commit — never mix a refactor with a feature or a format-only sweep with a fix
- Breaking change: `!` before the colon (e.g. `feat!: drop the v1 auth endpoint`)
- NO Co-Authored-By, Claude-Session or any footer

Examples:
- `feat(orders): add csv export to order list`
- `fix(auth): correct token refresh race condition`
- `docs: add commit message convention`


## Repo Layout

The repo holds two kinds of items, each in its own top-level folder:

- `skills/<category>/<name>/` — Claude Code skills, grouped by category
  (`engineering`, `productivity`, `creative`). Put a new skill in the category that
  fits its purpose; add a new category folder only when none does.
- `mods/<name>/` — Claude Code mods (plugins of function hooks: panes, status lines,
  slash commands, tool-call hooks; or scripts another mod runs, such as status line
  modules). Each needs `.claude-plugin/plugin.json` (with `name`, `version`,
  `description`), plus `hooks/hooks.json` pointing at its hooks module when it hooks
  anything. Install hints for `bin/agent-kit.mjs` go under `metadata.agentKit` in
  `plugin.json`: `requires` (items installed alongside it) and `statusLine` (the
  command to set, `{dir}` being the folder Claude Code loads the mod from).

Categories exist only in the repo: everything installs flat under `~/.claude/skills/<name>`,
so a name must be unique across categories and across skills and mods. For the same
reason, a skill that imports from another skill (e.g. `../code-review/...`) must sit in
the same category as it, or the relative path breaks in the repo.

## Skill Structure

New skills use this layout. Only `SKILL.md` is required; create the other folders only when the skill needs them.

```
skills/<category>/<skill-name>/
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

## Versioning

Every skill declares `version: <major>.<minor>.<patch>` in its `SKILL.md` frontmatter;
every mod declares `"version"` in its `.claude-plugin/plugin.json`. Whenever a skill's
or mod's files change, bump that version before committing — compare against the
current value and pick the bump by scope:

- **major**: breaking change — command/flag renamed or removed, behavior changed in a
  way that invalidates existing usage.
- **minor**: new capability added, backward-compatible (new command, new flag, new
  workflow branch).
- **patch**: fix, wording/doc tweak, internal refactor with no behavior change.

Skip the bump only for changes that touch no skill or mod (e.g. this file, `README.md`,
`bin/agent-kit.mjs`).

## Installation

This repo is the source of truth for skills and mods, but editing a file here does not make it live. Claude Code loads both from `~/.claude/skills/<name>` (a mod there auto-loads as `<name>@skills-dir`), which is a symlink to `~/.agents/skills/<name>` for a skill or `~/.agents/mods/<name>` for a mod (plain global folders, not git repos).

When a skill or mod changes, always follow this order:

1. Edit its files in this repo (`skills/<category>/<name>/` or `mods/<name>/`) and commit them — `add` only installs git-tracked files.
2. Run `node bin/agent-kit.mjs add skill <name>` or `node bin/agent-kit.mjs add mod <name>` (or `npx . add <kind> <name>`) from the repo root. It copies the tracked files into `~/.agents/<kind>s/<name>/`, overwriting what's there, and creates the `~/.claude/skills/<name>` symlink if it doesn't already exist.

Run `node bin/agent-kit.mjs list` to see each item's install status (not installed / installed / update). Both `list` and `add` take `--project [path]` to work on a project instead of the home folder, and `add` takes `--to both|claude|agents` and `--copy` to choose the folders (default: both, linked, for global; `.claude` only for a project), and `--status-line` to let a mod replace an existing `statusLine`. The steps above are the default global flow this repo's own skills use. Running it with no arguments opens an interactive picker meant for a human — agents use `list` and `add` instead.

Never edit `~/.agents/<kind>s/<name>` or `~/.claude/skills/<name>` directly and treat that as done — those aren't tracked by git, so the change would be lost from version history and out of sync with the repo.
