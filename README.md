# agent-kit

Skills and mods for [Claude Code](https://claude.com/claude-code). Install only the ones you want.

- **Skills** teach Claude a task.
- **Mods** change Claude Code itself, for example by adding a panel, a status line or a slash command.

## Install

Requires Node.js 18+ and git.

```bash
npx github:modmastei2/agent-kit
```

Run it from inside your project. It opens a picker:

1. Pick what to install. Each item shows whether it's not installed, installed,
   or has an update. Use ↑/↓ to move, space to select, `u` to select every
   update, and enter when you're done.
2. Pick where to install it:
   - **Global** (your home folder): every project on your machine sees it.
   - **Project**: only that project sees it.
3. Tick the folders it goes into. You can pick one or both:
   - **.claude** (`.claude/skills/`): Claude Code reads this one.
   - **.agents** (`.agents/skills/` or `.agents/mods/`): for other agents
     that read it.

   If you pick both, you then choose **Link** (files live in `.agents` and
   `.claude` links to it, so you update once) or **Copy** (a separate copy
   in each folder). If you pick one, it's a plain copy.

   The defaults are both folders linked for global, and `.claude` only for a
   project, since plain copies can be committed for your team.
4. Start a new Claude Code session.

The picker offers the current folder as the project when it has a `.git` or
`.claude` folder. You can also type another path, or pass one up front with
`--project ../my-app`.

For scripts, there's a non-interactive form:

```bash
npx github:modmastei2/agent-kit list                    # same list, printed
npx github:modmastei2/agent-kit add skill code-review   # install or update a skill
npx github:modmastei2/agent-kit add mod <mod-name>      # install or update a mod
```

Options:

- `--project [path]`: work on a project instead of global. Without a path it uses the current directory.
- `--to both|claude|agents`: choose the folders, same as step 3.
- `--copy`: with `both`, make two copies instead of a link.

<details>
<summary>From a clone instead</summary>

```bash
git clone https://github.com/modmastei2/agent-kit.git
cd agent-kit
node bin/agent-kit.mjs                        # then choose "A project…" and type its path
node bin/agent-kit.mjs --project ../my-app   # or pass it up front
```

</details>

To uninstall, delete the item's folder from `.claude/skills/` and `.agents/skills/` (`.agents/mods/` for a mod), under your home folder or the project.

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
