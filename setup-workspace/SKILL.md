---
name: setup-workspace
description: Generate or update the AI agent system-prompt file (CLAUDE.md/AGENTS.md) documenting this repo's stack and conventions — works for both an existing codebase and a brand-new/empty one.
disable-model-invocation: true
---

# Setup Workspace

Generate or update the system-prompt file (`CLAUDE.md`/`AGENTS.md`) that documents this
repo's tech stack and coding conventions for AI coding agents. This does NOT scaffold the
project itself — it doesn't run stack init commands (`npm create vite`, `dotnet new`,
`go mod init`) or create source folders. It writes documentation, for an existing repo or
a brand-new one.

## Process

### 1. Explore

Look at the current repo to understand its structure and tech stack.

- has any `AGENTS.md` or `CLAUDE.md` at the repo — record **every** location found, not
  just the root. Their presence means this is a re-run, which puts step 4 in update mode
  instead of fresh-write mode; carry the finding forward rather than noting it and
  moving on
- has an `.editorconfig` at the repo root already
- check for stack signals per top-level folder (in case the repo is a mono-repo):

| Signal                                  | Stack     | Template                  |
| ----------------------------------------- | --------- | --------------------------- |
| `package.json` deps on `react`            | React     | `templates/react.md`         |
| `package.json` deps on `@angular/core`    | Angular   | `templates/angular.md`       |
| `*.csproj` / `*.sln`                       | .NET Core | `templates/netcore.md`       |
| `go.mod`                                   | Go        | `templates/go.md`            |

- if none of the signal files exist AND the repo has little/no source content (empty,
  or just a README/.git/license) — this is a **new project**, not an unrecognized stack.
  Note this distinction explicitly; it changes how step 2 Section A and step 4 behave
  (ask instead of detect, propose instead of describe).

### 2. Present findings and ask for confirmation

Summarize what's present and what's missing in the repo. Then take the sections in order — one section, one answer, then the next.

Lead each section with the recommended answer so the user can accept it in a word. Give a one-line explainer only when the choice genuinely branches; skip the explainer if the choice is obvious.

**Section A — Confirm detected stack(s)**

> Explainer: template choice and which subsections apply (`For Typescript`, `UI & Design System`, etc.) depend on getting the stack right — worth a quick confirm before generating anything, especially for mono-repos.

When this needs to be asked as a question (ambiguous or new-project case), make it
multi-select. A repo — existing or brand-new — can commit to more than one stack at once
(e.g. a new project planned as React frontend + .NET Core backend from day one), and
asking single-select forces the user to re-run the flow once per stack instead of
declaring the whole mono-repo in one pass.

Present what step 1 found against the signal table:

- **Single, unambiguous stack** — state it as the recommended answer so the user can accept in a word, e.g. "Detected React (`package.json` has `react` + `vite`) — proceeding with `templates/react.md`, correct?"
- **Multiple stacks in one repo** (e.g. `frontend/` = React, `backend/` = .NET Core) — list each sub-app/folder with its detected stack and matching template, and confirm the split before writing anything.
- **New project** (per step 1's empty-repo check) — there's nothing to detect. Ask the user directly which stack they're building with; if it's one of the four in `templates/`, use that template with step 4's "new project" fallback. If it's a stack with no template, say so and confirm whether to hand-write a fresh system prompt from the canonical skeleton in step 4 instead.
- **Existing repo, but no known stack detected or signals conflict** — do not guess silently. Ask the user which stack to use; if none of `templates/` fits, say so and confirm whether to hand-write a fresh system prompt from the canonical skeleton in step 4 instead.

**Section B — Create a system prompt**

> Explainer: The system prompt is a crucial part of the agent's configuration, guiding its behavior and responses.

Ask the user which system prompt to use. User can choose from the following options:

- **CLAUDE.md (preferred)**: File containing the system prompt for the agent, typically used for Claude-based agents.
- **AGENTS.md**: File containing the system prompt for the agent, typically used for other types of agents.
- **Both**: Use both files to create a combined system prompt for the agent.

Rules for choosing the system prompt:
- If step 1 found existing system-prompt file(s), lead with what's already there as the
  recommended answer (`CLAUDE.md` alone → recommend `CLAUDE.md`; both present →
  recommend "Both"). Switching filenames on a re-run orphans the old file rather than
  replacing it — if the user does want to switch, confirm what happens to the old one.
- If the user selected "Both," write `AGENTS.md` first, then copy the content verbatim to `CLAUDE.md` — the two files must stay identical (aside from the `{{FILE_NAME}}` substitution in step 4). Otherwise, create only the one file the user chose.
- The system prompt works like a standing instruction set for the agent — write it clear, concise, and actionable, not descriptive prose.

### 3. Plan the output file(s)

Use the stack(s) confirmed in step 2 Section A and the filename confirmed in step 2
Section B — do not re-detect or re-ask either here.

- **Single stack** → one output file (or two, if "Both" was chosen in Section B) at the repo root.
- **Multiple stacks in one repo** (mono-repo) → do NOT merge them into one file. Write a
  root system-prompt file that holds only what's genuinely shared (Security Rules,
  repo-wide Definition of Done) plus a link to each sub-app's own file, then write one
  system-prompt file per sub-app using its matching template — see the `resolve:` comment
  near the top of `templates/netcore.md` for the sub-app link pattern. Every file uses the
  same filename chosen in Section B — a mono-repo doesn't mix filenames across sub-apps.

### 4. Resolve the template and write real content

**Fresh write vs. update** — decide this per output location planned in step 3, using
what step 1 found on disk. A mono-repo can be a fresh write in one sub-app and an update
in another; a "Both" pair (`CLAUDE.md` + `AGENTS.md`) where only one file exists is an
update of that file plus a fresh write of its twin, and the two must end up identical
again.

- **No file at that location** → fresh write. Resolve the template as described below.
- **File already exists** → update it in place. Never resolve the template from scratch
  and write it over the top: on a re-run, the file on disk is the source of truth for
  everything the user has customised, and the template is only the source of
  skill-authored content that is new or has changed since the last run.

Update procedure:

1. Read the existing file and map its `##`/`###` headings onto the canonical skeleton below.
2. Classify every section, then act:
   - **In the skeleton, absent on disk** → resolve it from the template and insert it at
     its skeleton position. This is how a repo picks up a section added to this skill
     after its last run.
   - **Present and still matching what this skill would have produced** → replace with
     the newly resolved content, so wording fixes to a shared fragment actually land.
   - **Present but diverged** — the user edited it, extended it, or deliberately trimmed
     bullets → keep their version. Do not restore template wording and do not re-add
     bullets they removed. If the skill has genuinely new content for that section, show
     it as a proposed addition and let the user decide.
   - **Present, not in the skeleton** → user-authored section; leave it untouched. An
     unrecognised section is a deliberate addition, not drift to clean up.
3. `## Tech Stack`, `## Architecture`, `## Project Structure`, and every table of real
   folder/feature/class names describe *this* repo, not the template. Re-survey the repo
   and correct them only where the repo itself has changed — never overwrite them with
   the template's defaults.
4. Before writing, show the user a short summary: sections to add, sections to update,
   sections left alone. Confirm, then write.

A section that exists in the skeleton but not in the delivered file is a user decision as
often as it is a gap — ask before adding it back, the same way step 5 asks before
touching an existing `.editorconfig`.

**Resolve `{{FILE_NAME}}`** — every template's H1 header is `# {{FILE_NAME}}`. Substitute
the literal filename chosen in step 2 Section B (`CLAUDE.md` or `AGENTS.md`). If the user
chose "Both," resolve the rest of the template once, write it to `AGENTS.md`, then copy
it verbatim to `CLAUDE.md` and swap only that one substituted word in the H1 — the body
stays identical between the two files.

If step 3 planned more than one output location (mono-repo: root + one per sub-app), this
"Both" duplication applies at **every** location, not just the first one you write. Before
finishing, check step 3's file list against what's actually on disk — each planned
location needs both `CLAUDE.md` and `AGENTS.md` if "Both" was chosen, not only the root.

In a mono-repo, files also cross-link each other (root ↔ sub-app links, the
frontend/backend pointer from `templates/netcore.md`'s `resolve:` comment). When copying
the `AGENTS.md` body to `CLAUDE.md` (or vice versa), any link inside that body pointing
at a sibling system-prompt file must also be swapped to the matching filename — a
`CLAUDE.md` links to sibling `CLAUDE.md` files, an `AGENTS.md` links to sibling
`AGENTS.md` files. Grep the finished output for the wrong filename before considering
step 4 done, e.g. `grep -rn "CLAUDE.md" **/AGENTS.md`.

**Resolve shared fragments** — a subsection may contain a marker like
`<!-- resolve: _shared/formatting-display.md (Plain) -->` instead of inline content. For
each marker:

1. Open the referenced file under `templates/_shared/`.
2. Take the `## Plain` block. If the marker's selector names an extra stack (e.g.
   `Plain + Go`), append that stack's `##` block's bullets after the Plain ones.
3. If the marker passes a token, e.g. `{{ARTIFACTS}}="component, hook, util, or type"`,
   substitute every `{{ARTIFACTS}}` in the fragment's text with that value before inlining.
4. Replace the marker comment with the merged, substituted content, inlined directly in
   the output file.

The marker is a build-time-only mechanism for keeping the template sources in this skill
DRY — it must never survive into the file written to the user's repo. A delivered
CLAUDE.md/AGENTS.md that still contains a `<!-- resolve: ... -->` line or a live pointer
to `_shared/` is a bug: that content is not auto-loaded by any agent and the rule would
silently vanish from context every session.

**Fill the rest with real project content** — every template follows the same canonical
skeleton so output stays consistent across stacks:

```
## Tech Stack
## Architecture
## Project Structure
    ### Rules
## Coding Convention
    ### Naming
    ### Coding Rules
    ### For Typescript        (React / Angular only)
    ### Editor Config
    ### Formatting Display
    ### UI & Design System    (only if the repo renders UI)
    ### Comment Code
    ### Before Creating New Code
    ### Loading Indicator     (React / Angular only)
    ### Commands
## Testing & Quality
    ### Test Runner
    ### Unit Test Rules
    ### Rules
## Security Rules
## Commit Message
## Definition of Done
```

The template is a starting skeleton with real-world defaults, not a file to copy
verbatim — replace every library choice, folder name, and naming-table entry with what's
actually in the repo. Never leave a template placeholder like `<Project>` or `<Feature>`
unresolved in the output — substitute the repo's real project/solution name and real
feature folder names.

**`## Tech Stack` is deliberately thin in every template — write it yourself, don't copy
it.** The template only lists what's common/core to the stack (framework, language,
maybe styling). Everything deeper — UI kit, charts, auth provider, state management,
backend, database, hosting, analytics — is intentionally left out because it varies per
project and would go stale fast if hardcoded here. Explore the actual repo
(`package.json`/lockfile, `*.csproj`/`packages.lock.json`, `go.mod`) and write the real
list yourself; if a dependency's purpose isn't obvious from its name, ask the user rather
than guessing. If you can't confidently determine something, leave it out rather than
inventing a plausible-sounding entry.

**New project fallback** — if step 1 flagged this as a new/empty project, there's no
lockfile/`.csproj`/`go.mod` to read yet. Don't leave `Tech Stack` empty or invent
libraries: ask the user directly what they plan to use beyond the template's baseline
(state management, UI kit, testing tools, backend, hosting, etc.) and write their answer.
Likewise treat each template's `## Project Structure` tree as the proposed starting
layout to adopt, not a description of something that already exists — call this out to
the user so they know it's a proposal, not a survey result.

**Detected-pattern subsections** — some template subsections (e.g. `Business Validation`
in `templates/netcore.md`) exist only if the agent actually finds that pattern in the
repo — a `resolve:` comment says what to search for. Three outcomes:

1. **Found** — name the real class/function as it exists in *this* repo (never assume
   the template's example name is the real one) and show real usage pulled from an
   actual call site, covering every usage variant the template calls out (e.g. both a
   single-error and a multi-error form), not just whichever one you happened to find first.
2. **Not found, existing repo, no interest in adding one** — delete the whole
   subsection. Don't leave a placeholder or invent a pattern nobody asked for.
3. **Not found, new/empty project** — don't scaffold the actual source file (this skill
   only writes documentation — see the top of this SKILL.md); instead write the section
   as a standing instruction with a minimal canonical shape embedded directly inline, so
   a future agent creates it consistently the first time the need comes up, rather than
   reinventing it per feature. The embedded shape must be self-contained (no reference to
   this skill's own files — the target repo can't see them) and deliberately minimal, not
   a copy of every feature a more battle-tested version might have.

This is the template for adding similar detect-or-drop guidance later: describe what to
search for, what each outcome looks like, and never let "not found" default to inventing
something plausible-sounding.

Do not drop a section just because the surveyed repo happens not to need it yet
(e.g. `Formatting Display` still matters for a Go service with no UI) — only drop
`For Typescript`, `UI & Design System`, and `Loading Indicator` when the stack genuinely
doesn't apply (i.e. it's not React or Angular).

### 5. Generate `.editorconfig`

Unlike the system-prompt file, `.editorconfig` is written **once at the repo root only**
— even in a mono-repo. Its glob rules (`[*.go]`, `[*.{ts,tsx}]`, etc.) already match
files anywhere in the tree from a single `root = true` file; there's no need for one per
sub-app the way `CLAUDE.md`/`AGENTS.md` need one per sub-app.

Build it from `templates/editorconfig/`:

1. Start with `_base.editorconfig` (charset, line endings, base indent, the `[*.md]`
   override) — this part never changes.
2. For every stack confirmed in step 2 Section A, check `templates/editorconfig/` for a
   matching override file (`<stack>.editorconfig`) and append it below the base if one
   exists. Not every stack has one — React and Angular currently don't, because both
   match the 4-space base default with nothing left to override. A mono-repo with
   React + .NET Core gets the base plus just .NET Core's override block (React
   contributes nothing, which is correct, not a gap).
3. Write the combined result to `.editorconfig` at the repo root.

**If `.editorconfig` already exists** (flagged in step 1): do not overwrite it silently.
Show the user what this would add or change and confirm before touching it — an
existing `.editorconfig` may encode project-specific decisions (e.g. a team that
deliberately chose tabs) that this skill has no way to know about.

`.editorconfig` only helps human contributors — an AI agent has no built-in mechanism to
auto-load it the way an IDE does. That's why every template also has its own
`### Editor Config` subsection in `## Coding Convention` (resolved from
`_shared/editor-config.md`): it restates the same indent rule in prose, directly in the
context an agent actually reads, instead of relying on it to go open a config file. Keep
both in sync — if you change one stack's indent convention, change it in both the
`templates/editorconfig/<stack>.editorconfig` override and `_shared/editor-config.md`'s
matching block.
