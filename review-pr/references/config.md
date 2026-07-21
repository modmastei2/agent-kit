# Local config

Optional per-project config, mirroring `jira-tracker`'s `.jira/config.local.json`. It
lives in the **project being reviewed** (the current working directory), never in the
skills repository, and holds two things:

- **Bitbucket credentials** — the only provider that needs them here. GitHub and GitLab
  use their own CLI auth stores (`gh auth login`, `glab auth login`) and are **not**
  configured in this file.
- **Defaults** — a default base branch and/or provider, so you can skip `--base` and
  `--provider` on every call.

Everything in this file is optional. With no file at all, review-pr still works for
GitHub and GitLab via their CLIs, and for Bitbucket via environment variables.

## Location and template

```text
<project>/.review-pr/config.local.json
```

```json
{
  "defaultProvider": null,
  "defaultBaseBranch": "dev",
  "reportLanguage": null,
  "bitbucket": {
    "username": "your-bitbucket-username",
    "appPassword": "YOUR_APP_PASSWORD_HERE",
    "token": null
  }
}
```

- `defaultProvider` — `"github"`, `"gitlab"`, `"bitbucket"`, or `null` to auto-detect.
  A `--provider` argument overrides it.
- `defaultBaseBranch` — used when listing PRs if `--base` is not given and the branch
  exists. `null` falls back to `dev`-if-present, else the repo default branch.
- `reportLanguage` — `"en"` or `"th"`, the language of the posted comment. Set it once
  for a team that always reviews in one language and the skill stops asking. `null`
  means ask on each run; a `--lang` argument overrides it either way.
- `bitbucket.token` — a workspace/repository **access token**. When set, it is used as
  `Authorization: Bearer <token>` and `username`/`appPassword` are ignored.
- `bitbucket.username` + `bitbucket.appPassword` — an **app password** pair, used as
  HTTP Basic when no token is set.

Fill in **either** `token` **or** (`username` + `appPassword`) — not necessarily both.
Required Bitbucket permissions stay the same: Repositories **Read**, Pull requests
**Write**. Nothing more.

## Setup

Run the `init` subcommand, which writes the template and the `.gitignore` entry for you:

```bash
/review-pr init
# → node <skill>/scripts/init-config.mjs
```

Then fill in the Bitbucket section (skip it entirely for GitHub/GitLab-only projects).

- `init` never overwrites a config that already has real values; `--force` resets it to
  the placeholder template.
- It also runs automatically, non-destructively, the first time a Bitbucket review needs
  the file — after which review-pr stops and asks you to fill in the credentials.

`scripts/init-config.mjs` is the **only** writer of this file; `scripts/bb-auth.mjs` only
reads it.

## How the secret is used

The Bitbucket app password / token is sensitive, so it is **never read into the agent's
context** and **never printed**. Instead the [Bitbucket adapter](../providers/bitbucket.md)
sources it into the shell environment at command time:

```bash
eval "$(node <skill-dir>/scripts/bb-auth.mjs)"
# -> exports BB_AUTH holding a ready Authorization header value; nothing printed
curl -sS -f -H "Authorization: $BB_AUTH" "https://api.bitbucket.org/2.0/..."
```

[scripts/bb-auth.mjs](../scripts/bb-auth.mjs) reads the config, picks token-over-password,
builds the header value (`Bearer …` or `Basic …`), and writes only an `export BB_AUTH=…`
line to stdout — which `eval` consumes without displaying. The raw credential exists only
in the file (gitignored) and in the process environment, exactly as with `jira-tracker`.

## Precedence for Bitbucket credentials

1. `.review-pr/config.local.json` (`bitbucket.token`, then `username`+`appPassword`)
2. Environment variables (`BITBUCKET_TOKEN`, or `BITBUCKET_USERNAME` +
   `BITBUCKET_APP_PASSWORD`)
3. A `bitbucket.org` entry in the Git credential manager / `~/.netrc`

Use the first that yields a usable credential. If none do, stop and tell the user to fill
in the config or set the environment variables — never guess, never proceed unauthenticated.

## Safety

- The config file is gitignored and its contents are never echoed, logged, or included in
  a PR comment.
- `bb-auth.mjs` writes only the `export` line to stdout and all diagnostics to stderr, so
  even a failed run does not leak the secret.
- This file is the single source of Bitbucket credentials for review-pr; do not scatter
  copies elsewhere in the project.
