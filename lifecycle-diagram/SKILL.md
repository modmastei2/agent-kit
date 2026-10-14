---
name: lifecycle-diagram
version: 0.1.0
description: Build an interactive single-file HTML page that explains the lifecycle / state machine of one entity — every status it can be in, how it moves between them, every place it can end, what each status means, and the API calls, webhooks and payloads an integrator deals with at each step. Use this whenever the user wants to see or explain a status flow — "วงจรชีวิตของ order", "lifecycle", "state machine", "status flow", "แผนภาพสถานะ", "ไปจบที่ไหนได้บ้าง", "แต่ละจุดมี status/code อะไร", "ต้อง deal กับ payload แบบไหน" — for orders, payments, refunds, shipments, subscriptions, tickets, approvals, KYC, deployments or any other entity with statuses, even if they don't say "HTML" or "diagram". Also use it to compare the same lifecycle across several providers (one page per provider, linked together).
---

# Lifecycle Diagram

Turns research about an entity's statuses into one self-contained, interactive HTML page:

- **Diagram** — every status as a box, transitions as arrows, grouped in semantic rows
  (main path / side states / failure-reversal branch). Terminal states are marked `END`;
  an optional coloured dot shows a side effect per status (e.g. stock consumed / restored).
- **"Where can it end?"** — outcome buttons highlight one full path; ▶ walks it step by step.
- **Detail panel** — click a status: raw code, meaning, mapped internal status, who causes it,
  where it comes from / goes next, gotchas, the webhook you receive there, and the API calls
  you make there with copyable request/response examples.
- **"Before your first API call"** cards (auth, signing, envelope, reconciliation) and a
  raw → internal **mapping table**.
- Every API/payload carries a **confidence tag** so the reader knows what is verified.

The page shape is fixed by `assets/template.html`; your job is the content, written as one
data file. `scripts/build.mjs` merges them and lints the layout.

## Workflow

### 1. Pin down the scope

Settle before researching (ask only if it can't be inferred):
- **Entity and level** — what is one "thing" moving through the states? Say so on the page
  when it is surprising (e.g. Lazada statuses live per order *item*, not per order).
- **Providers** — one page per provider when comparing several; they link via `nav`.
- **Audience** — usually "an outsider integrating with this API", which is why API/webhook
  payloads are first-class. For a purely internal workflow, drop `apis`/`basics`.
- **Output location** — follow the user's folder conventions (e.g. one page per provider folder).

### 2. Gather sources, then model

Read the primary material first: the codebase (status enums, mappers, migrations, adapters),
research notes, and official docs. Record where each fact came from — it becomes the tag.
If there is nothing to read and you can browse, check at least the status enum, the webhook
envelope and the main detail call in official docs; a page written purely from memory is
still useful, but say so plainly (see the tags section of the schema).

Model it as a graph before writing anything:
1. **Statuses** — the exact raw values the provider sends (spelling and case matter:
   `CANCELED` vs `CANCELLED` is a real bug class). Mark sub-states that don't belong to the
   main enum (cancellation request, return request, package-level exceptions) — they are
   real places the entity sits even though they live elsewhere in the API.
2. **Transitions** — who/what triggers each (buyer, us, platform, carrier, timeout, an API call).
3. **Outcomes** — enumerate every way the lifecycle ends (success, never paid, cancelled
   after paying, delivery failure, return...). These become the outcome buttons and are the
   answer to "where can it end?"; aim for 4–7.
4. **Per status** — what does an integrator receive (webhook) and do (API calls) there?
   Put each API on the status where you'd call it, not everywhere it is legal.

### 3. Write the data file

Read `references/data-schema.md` (full schema, layout rules, tag meanings) and use
`examples/tiktok-shop-order.js` as the model of depth and tone. Write in the user's language.

Content quality is what makes these pages useful:
- **Payloads are realistic and annotated** — real field names, plausible values, `// comments`
  on the fields that bite (units, string-vs-number, absolute vs relative timestamps).
  Show both what we send and what comes back; for webhooks show what we must reply.
- **Tag honestly.** `doc` = read in official docs, `repo` = proven in code/sandbox,
  `unv` = sources say unconfirmed, `gen` = general knowledge you did not verify. If a body is
  from memory, tag it `gen` and say so in the note — a confident wrong payload is worse
  than a marked guess.
- **Gotchas** are the traps that cost someone a day: misleading success codes, spelling
  mismatches between webhook and API, states that look final but aren't, side effects.
- Same-row edge labels must be short (≈ ≤ 8 characters); put the full reason in `why`,
  which shows in the detail panel.

### 4. Build, lint, look

```bash
node <skill>/scripts/build.mjs <data.js> --check          # schema + layout lint only
node <skill>/scripts/build.mjs <data.js> <out.html>       # write the page
node <skill>/scripts/screenshot.mjs <out.html> shot.png --node <id> [--dark] [--outcome <id>]
```

Fix every `WARN` — each one is visible on the page (an arrow through a box, a label over
a node or row label, box text overflowing, an outcome step that won't highlight). The usual
fixes, in order: move a node to a free fractional column (`col: 3.5`) or another row; set
`fs`/`ts` sides and `fo`/`to_` offsets on the edge; raise `k` (even to 150–200) so the curve
drops straight before bending; nudge the label with `lx`/`ly`; shorten the label. Rebuild
until `clean`.

`clean` is necessary, not sufficient — in testing, the screenshot review found more real
problems than the linter. Screenshot and actually look, light and dark plus one outcome
highlighted. Judge whether a newcomer could follow the main path in five seconds. If one
area is a tangle (watch the crossing count the linter prints), remove edges rather than
re-route them: rare transitions belong in a `why` or a gotcha, not on the canvas.

Keep the data file next to the output (or in a scratch folder the user agrees to) so the
page can be rebuilt later — the HTML embeds a copy, but editing the HTML is painful.

### 5. Deliver

Tell the user where the page(s) are, what the outcome buttons cover, and — most
importantly — which parts are `gen`/`unv` and need checking. Mention any real bugs or
risks the modelling surfaced (e.g. a status the code doesn't map, a stock rule that fires
too early); those are often the most valuable output.

## Files

- `assets/template.html` — page shell, styles (light/dark), all interaction. Text defaults
  are Thai; override any label via `DATA.ui`.
- `assets/layout.js` — geometry shared by the page and the linter.
- `scripts/build.mjs` — validate + lint + inline everything into one HTML file.
- `scripts/screenshot.mjs` — headless Chrome/Edge screenshot for visual checks.
- `references/data-schema.md` — the data file format and layout rules. Read before writing data.
- `examples/tiktok-shop-order.js` — complete real example.
