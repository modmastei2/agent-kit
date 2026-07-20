# Bitbucket Cloud adapter

Provider commands for Bitbucket Cloud. There is no official first-party CLI equivalent
to `gh`/`glab`, so this adapter combines **local Git** with the **Bitbucket REST API
v2.0**.

Do not require Bitbucket Rovo AI review or any paid AI review product.

## Conventions

```text
API base:   https://api.bitbucket.org/2.0
Workspace:  the org/team slug        (e.g. acme)
Repo slug:  the repository slug      (e.g. payments-api)
PR id:      the number shown in the UI
```

Derive workspace and repo slug from the remote:

```bash
git remote get-url origin
# https://bitbucket.org/<workspace>/<repo>.git
# git@bitbucket.org:<workspace>/<repo>.git
```

## detect

Host is `bitbucket.org`. Confirm with an authenticated read before proceeding:

```bash
curl -sS -f -u "$BB_USER:$BB_APP_PASSWORD" \
  "https://api.bitbucket.org/2.0/repositories/$WORKSPACE/$REPO"
```

## authenticate

Bitbucket Cloud accepts an app password (`user:app_password`) or a workspace/repository
access token (`Authorization: Bearer`). Use whichever already exists:

```text
BITBUCKET_USERNAME + BITBUCKET_APP_PASSWORD
BITBUCKET_TOKEN
the Git credential manager entry for bitbucket.org
```

Required permissions: **Repositories: Read** and **Pull requests: Write** (write is what
grants comment creation). Do not request Admin, Webhooks, or merge permissions.

If no credential is available, stop and tell the user to create an app password with
those two permissions. **Never echo the username:password pair, the token, the `-u`
argument, or a `.netrc`/credential file.** When showing a command in output, mask it as
`-u "$BB_USER:$BB_APP_PASSWORD"`.

Prefer `curl --netrc` or an env var over an inline literal so no secret ever reaches the
transcript.

## listOpen

```bash
curl -sS -f -u "$BB_USER:$BB_APP_PASSWORD" -G \
  "https://api.bitbucket.org/2.0/repositories/$WORKSPACE/$REPO/pullrequests" \
  --data-urlencode 'state=OPEN' \
  --data-urlencode "q=destination.branch.name=\"$BASE\"" \
  --data-urlencode 'sort=-updated_on' \
  --data-urlencode 'pagelen=20'
```

Useful fields per entry:

```text
id
title
author.display_name  /  author.nickname
destination.branch.name        → base branch
source.branch.name             → head branch
source.commit.hash             → head SHA (short; expand locally)
destination.commit.hash        → base commit
updated_on
state
```

Bitbucket has no draft flag — treat every open PR as reviewable. Verify the base branch
exists before filtering:

```bash
git ls-remote --heads origin dev
```

## get

```bash
curl -sS -f -u "$BB_USER:$BB_APP_PASSWORD" \
  "https://api.bitbucket.org/2.0/repositories/$WORKSPACE/$REPO/pullrequests/$ID"
```

Read `id`, `title`, `description`, `author`, `source`, `destination`, `state`,
`updated_on`, `participants` (for existing approvals), `merge_commit`.

Bitbucket returns **12-character short hashes**. Expand to full SHAs locally after
fetching, and use the full SHAs everywhere downstream:

```bash
git rev-parse "$SHORT_SHA"
```

Resolve the base as the merge base, not the destination tip:

```bash
git fetch origin "$BASE_BRANCH" "$HEAD_BRANCH"
git merge-base "origin/$BASE_BRANCH" "$HEAD_SHA"
```

## checkout

Bitbucket exposes no `pull-requests/*/head` ref namespace. Fetch the source branch and
verify it still points at the PR head:

```bash
git fetch origin "$HEAD_BRANCH"
git worktree add ".review-worktrees/pr-$ID" "$HEAD_SHA"
```

Check out the **SHA**, not the branch name — the contributor may push between the
metadata call and the checkout, and the review must be pinned to a known commit.

Verify:

```bash
git -C ".review-worktrees/pr-$ID" rev-parse HEAD   # must equal the expanded head SHA
```

If the SHA is not reachable after fetching (branch deleted or force-pushed), stop and
report it.

## getDiff

From the worktree, using the verified range:

```bash
git diff "$BASE_SHA...$HEAD_SHA"
```

Or from the API when local fetch is unavailable:

```bash
curl -sS -f -u "$BB_USER:$BB_APP_PASSWORD" -L \
  "https://api.bitbucket.org/2.0/repositories/$WORKSPACE/$REPO/pullrequests/$ID/diff"
```

`-L` matters — the diff endpoint redirects.

## getChangedFiles

```bash
curl -sS -f -u "$BB_USER:$BB_APP_PASSWORD" \
  "https://api.bitbucket.org/2.0/repositories/$WORKSPACE/$REPO/pullrequests/$ID/diffstat?pagelen=100"
```

Read `values[].new.path` (`old.path` for deletions). Follow the `next` link when the
result is paginated — a truncated file list silently narrows the review.

## getComments

```bash
curl -sS -f -u "$BB_USER:$BB_APP_PASSWORD" \
  "https://api.bitbucket.org/2.0/repositories/$WORKSPACE/$REPO/pullrequests/$ID/comments?pagelen=100"
```

Skip entries with `deleted: true`. Scan `content.raw` for the
`<!-- ai-review-state: ... -->` marker.

## postComment

```bash
curl -sS -f -u "$BB_USER:$BB_APP_PASSWORD" \
  -X POST \
  -H 'Content-Type: application/json' \
  --data @"$PAYLOAD_FILE" \
  "https://api.bitbucket.org/2.0/repositories/$WORKSPACE/$REPO/pullrequests/$ID/comments"
```

`$PAYLOAD_FILE` holds `{"content": {"raw": "<markdown>"}}`. Build it with a JSON
encoder — do not hand-splice Markdown into a JSON string; backticks, quotes and newlines
in findings will corrupt the payload.

To update a previous AI review comment instead of duplicating:

```bash
curl -sS -f -u "$BB_USER:$BB_APP_PASSWORD" \
  -X PUT \
  -H 'Content-Type: application/json' \
  --data @"$PAYLOAD_FILE" \
  "https://api.bitbucket.org/2.0/repositories/$WORKSPACE/$REPO/pullrequests/$ID/comments/$COMMENT_ID"
```

Only update a comment authored by the authenticated account **and** carrying the state
marker. Never edit or delete a human's comment.

Treat the comment as posted only on HTTP 201 (or 200 for update) with an `id` in the
response. `-f` makes curl exit non-zero on HTTP errors — keep it, and check the exit
code rather than assuming success.

## postInlineComment

**Optional; not required for the initial version.** Bitbucket supports it via an `inline`
object:

```json
{
  "content": { "raw": "..." },
  "inline": { "path": "src/PaymentService.cs", "to": 84 }
}
```

`to` is a line in the new file, `from` a line in the old. Bitbucket silently orphans
comments whose line is not in the diff, so prefer the general comment unless the position
is certain.

## Disabled by default

```text
POST .../pullrequests/$ID/approve   # never
POST .../pullrequests/$ID/merge     # never
```

Approval and merge are not implemented in this adapter. Bitbucket's "request changes"
maps to `POST .../request-changes` and requires an explicit Senior Developer
instruction — see the approval policy in [../SKILL.md](../SKILL.md).
