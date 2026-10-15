# agent-kit

Skills and mods for [Claude Code](https://claude.com/claude-code). Install only the ones you want.

- **Skills** teach Claude a task.
- **Mods** change Claude Code itself, for example by adding a panel, a status line or a slash command.

## Install

Requires Node.js 18+ and git.

```bash
npx github:modmastei2/agent-kit list                    # see what's available
npx github:modmastei2/agent-kit add skill code-review   # install a skill
npx github:modmastei2/agent-kit add mod <mod-name>      # install a mod
```

Then start a new Claude Code session. Run `add` again to update.

<details>
<summary>From a clone instead</summary>

```bash
git clone https://github.com/modmastei2/agent-kit.git
cd agent-kit
node bin/agent-kit.mjs add skill code-review
```

</details>

Each item is installed at `~/.claude/skills/<name>`. To uninstall, delete that folder and `~/.agents/skills/<name>` (or `~/.agents/mods/<name>`).

## Before you use one

- **to-note** writes to a hard-coded Obsidian vault path. Change the path in its `SKILL.md` first.

## Skills

*Invoked*: **user** means you call it with `/name`. **model** means Claude can also trigger it on its own.

| Skill | Category | Invoked | Requires | What it's for |
| --- | --- | --- | --- | --- |
| [bridge](skills/engineering/bridge/SKILL.md) | Engineering | model | — | Hand work to another CLI agent (Claude Code, Codex, …) and check for replies. |
| [code-review](skills/engineering/code-review/SKILL.md) | Engineering | model | — | Review a diff, commit range or PR against repo standards. |
| [lifecycle-diagram](skills/engineering/lifecycle-diagram/SKILL.md) | Engineering | model | — | Build an interactive HTML page of an entity's status lifecycle. |
| [review-pr](skills/engineering/review-pr/SKILL.md) | Engineering | model | [code-review](skills/engineering/code-review/SKILL.md) | Review a PR/MR on GitHub, GitLab or Bitbucket. |
| [setup-workspace](skills/engineering/setup-workspace/SKILL.md) | Engineering | user | — | Generate a repo's `CLAUDE.md`/`AGENTS.md`. |
| [jira-tracker](skills/productivity/jira-tracker/SKILL.md) | Productivity | user | — | List, create, move and pull Jira Cloud issues. |
| [to-note](skills/productivity/to-note/SKILL.md) | Productivity | model | — | File notes into an Obsidian vault. |
| [minecraft-structure-design](skills/creative/minecraft-structure-design/SKILL.md) | Creative | model | — | Design Minecraft structures, from concept to buildable spec. |

## Mods

None yet.
