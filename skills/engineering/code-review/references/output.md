# Output: script, verdict and report

## Running the script

Write a draft JSON file of findings, then let the script validate it, derive the
verdict and render the Markdown:

```bash
node "$SKILL_DIR/scripts/review.mjs" render --input draft.json           # Markdown
node "$SKILL_DIR/scripts/review.mjs" render --input draft.json --json    # JSON + report
node "$SKILL_DIR/scripts/review.mjs" validate --input draft.json         # check only
```

- `--lang <tag>` overrides the draft's `reportLanguage`.
- `--renumber` reassigns `CR-001`… in severity order instead of failing on ordering.

The draft is a review result **without** `verdict` — everything else per
[schemas/review-result.schema.json](schemas/review-result.schema.json). If the script
exits non-zero, fix the draft and re-run; never hand-write the output to work around
it. Relay its stdout as the report, and its stderr as-is on failure.

## The verdict is derived, never chosen

| Condition | Verdict |
| --- | --- |
| any `blocking` finding | `changes_required` |
| `warning`s but no `blocking` | `pass_with_warnings` |
| no actionable findings | `pass` |
| target unresolvable / diff unreadable / review aborted | `unable_to_complete` |

Only `unable_to_complete` is declared by you — no set of findings can express "the
review did not happen" — and it requires a non-empty `limitations`.

## What the script enforces

Length caps, ordering, enums, verdict consistency, complete `reportStrings` for a
language without a bundled locale, that a `preExisting` finding is never `blocking`, and
that the rendered output contains **no raw HTML** — some providers (Bitbucket) render
none of it, so a tag would reach the reader as literal text.

Prose is handled for you: a tag-shaped sequence left bare in `title`, `message`,
`impact`, `suggestion`, `evidence`, a patch `note`, a check detail or a limitation is
**wrapped in backticks automatically** — `Promise<void>`, `<ng-container>`,
`<UserCard>`, `Map<string, List<int>>`. Without that, GitHub strips the tag and the
sentence silently loses a word. Comparisons that are not tag-shaped (`count < 0`, SQL
`<>`) are untouched, escaping twice is a no-op, and you can still write the backticks
yourself.

**`patch` is never escaped.** Code reaches the reader byte for byte inside a fenced
block, where no provider sanitizes anything.

A `RenderError` means HTML the **renderer itself** produced — a bug in this skill, not
something a finding can cause.

## The Markdown report

Shown so you know what the draft turns into — never reproduce it by hand.

````markdown
## Code Review

**Verdict:** Changes required
**Reviewed range:** `abc123..def456`
**Scope:** 24 of 31 changed files — `docs/**` excluded at the requester's direction

### Blocking

#### 1. Possible null dereference

`src/PaymentService.cs:84` · violates `AGENTS.md#null-handling`

The lookup result can be null before its `Id` property is accessed.
A missing payment record will throw at runtime instead of returning 404.

**Recommended change:** Validate the result and return the repository-standard
not-found response.

```diff
-var payment = await _repo.FindAsync(id);
+var payment = await _repo.FindAsync(id);
+if (payment is null) return NotFound();
```

_Evidence: checked all three call sites; none guard the result._

### Checks

- `dotnet build` — Passed
- `dotnet test` — Failed

### Limitations

- Integration tests were not executed because the required database was unavailable.
````

The renderer puts `message` and `impact` on separate lines, `evidence` last in italics,
`Scope` only when coverage was partial, and omits empty sections. Findings are `####`
headings and **nothing is indented**: some Markdown renderers (Bitbucket) do not parse a
fenced block indented under a list item.
