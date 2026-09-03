# CLAUDE.md

## Commit messages

Use semantic commit messages: `<type>(<scope>): <description>`

- `type`: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`
- `scope`: the skill folder name (e.g. `to-note`, `setup-workspace`), omit if repo-wide
- `description`: imperative, lowercase, no trailing period

Examples:
- `feat: add to-note v0.1.0`
- `fix(setup-workspace): route design tokens through Tailwind utilities`
- `docs: add commit message convention`

## Skill Installation

This repo is the source of truth for skills, but editing a file here does not make it live — Claude Code loads skills from `~/.claude/skills/<name>`, which is a symlink to `~/.agents/skills/<name>` (a plain global folder, not a git repo).

When a skill changes, always follow this order:

1. Edit the skill's files in this repo (`<skill-name>/`).
2. Copy the changed files to `~/.agents/skills/<skill-name>/`, overwriting what's there.
3. Verify `~/.claude/skills/<skill-name>` is a symlink that resolves to `~/.agents/skills/<skill-name>` (it should already be set up this way — this step is just a sanity check, not a step that creates the symlink).

Never edit `~/.agents/skills/<name>` or `~/.claude/skills/<name>` directly and treat that as done — those aren't tracked by git, so the change would be lost from version history and out of sync with the repo.
