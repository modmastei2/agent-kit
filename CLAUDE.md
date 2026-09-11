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

1. Edit the skill's files in this repo (`<skill-name>/`) and commit them — `add` only installs git-tracked files.
2. Run `node bin/skills.mjs add <skill-name>` (or `npx . add <skill-name>`) from the repo root. It copies the skill's tracked files into `~/.agents/skills/<skill-name>/`, overwriting what's there, and creates the `~/.claude/skills/<skill-name>` symlink if it doesn't already exist.

Run `node bin/skills.mjs list` to see which skills are installed.

Never edit `~/.agents/skills/<name>` or `~/.claude/skills/<name>` directly and treat that as done — those aren't tracked by git, so the change would be lost from version history and out of sync with the repo.
