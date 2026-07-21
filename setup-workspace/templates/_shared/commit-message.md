# Commit Message (shared fragment)

Used by: react, angular, netcore, go

Resolve rule: emit `## Plain` bullets always as `## Commit Message` in the final
CLAUDE.md/AGENTS.md. If the marker's selector names an extra stack, append that stack's
`##` block's bullets after the Plain ones. Never leave a pointer to this file in
delivered output.

## Plain

- Format: `<type>(<scope>): <subject>` — Conventional Commits
- Types: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`, `chore`, `revert`
- Scope is the affected area (feature folder, module, package) — omit it rather than invent one
- Subject: imperative mood, lowercase, no trailing period, ≤ 72 chars ("add order export", not "added"/"adds")
- One logical change per commit — never mix a refactor with a feature or a format-only sweep with a fix
- Body (optional, after a blank line): explain **why**, not what — the diff already shows what
- Breaking change: `!` before the colon plus a `BREAKING CHANGE:` footer
- Ticket reference goes in a footer (`Refs: PROJ-123`), never in the subject

```
feat(orders): add csv export to order list

Finance was pulling this by hand every month.

Refs: PROJ-142
```
