# Skills

Source of truth for Claude Code skills. Editing a file here does not make it
live — Claude Code loads skills from `~/.claude/skills/<name>`, which is a
symlink to `~/.agents/skills/<name>`.

## Install

A small CLI (`bin/skills.mjs`, no dependencies, no npm publish needed) does
the copy + symlink step for you, reading the file list straight from git so
only committed files get installed:

```bash
node bin/skills.mjs list            # show what's installed
node bin/skills.mjs add <name>      # install/update one skill
```

Or via `npx` without installing anything globally:

```bash
npx . add <name>
```

Skills are split below by how they get invoked:

- **User-invoked** — `disable-model-invocation: true` in the skill's
  frontmatter, so Claude never triggers it on its own; you have to call it
  explicitly (e.g. `/skill-name`).
- **Model-invoked** — no such flag, so Claude can trigger it automatically
  when the conversation matches the skill's `description`, in addition to
  being callable explicitly.

## User-invoked

| Skill | What it's for |
| --- | --- |
| [jira-tracker](jira-tracker/SKILL.md) | List, create, view, move, and pull Jira Cloud issues via the REST API. |
| [setup-workspace](setup-workspace/SKILL.md) | Generate or update the `CLAUDE.md`/`AGENTS.md` system-prompt file documenting a repo's stack and conventions. |

## Model-invoked

| Skill | What it's for |
| --- | --- |
| [bridge](bridge/SKILL.md) | Hand work to another CLI agent (Claude Code, Codex, etc.) or check for a reply via the Agent Bridge mailbox. |
| [code-review](code-review/SKILL.md) | Review a diff (working tree, staged, commit range, or PR) against repo standards and spec, provider-agnostic. |
| [review-pr](review-pr/SKILL.md) | Orchestrate an AI-assisted review of a PR/MR on GitHub, GitLab, or Bitbucket, using `code-review` for all findings. |
| [to-note](to-note/SKILL.md) | Capture arbitrary input into the personal Obsidian vault, filed under Inbox/Projects/Knowledge/People. |
