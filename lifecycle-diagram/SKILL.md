---
name: lifecycle-diagram
version: 1.0.0
description: Build an interactive, self-contained HTML page explaining the lifecycle (state machine) of one entity — every status it can be in, how it moves between them, every way it can end, what each status means, and the API calls, events and payloads an integrator deals with at each step. Use whenever someone wants to see, explain, document or compare a status flow — of orders, payments, refunds, shipments, subscriptions, tickets, work items, deployments, approvals, accounts or any other entity with statuses — even if they don't ask for HTML or a diagram. Also use it to compare one lifecycle across several providers (one linked page per provider).
---

# Lifecycle Diagram

Turns knowledge about an entity's statuses into **one self-contained HTML file** — the only
thing the user receives. The page has:

- a **diagram**: statuses as boxes in semantic rows (main path / side states / failure and
  reversal branches), transitions as arrows, terminal states marked, and an optional
  per-status side effect shown as a coloured dot;
- **"where can it end?"** buttons that highlight a full path and can walk it step by step;
- a **detail panel** per status: raw value, meaning, mapped status, who triggers it, where it
  comes from and goes next, pitfalls, the event received there, and the calls made there
  with copyable request/response examples;
- optional **"before your first API call"** cards and a raw → mapped **status table**;
- a **confidence tag** on everything, so the reader knows what is verified.

`assets/template.html` fixes the page; you supply the content as a data file that
`scripts/build.mjs` validates, lints and embeds. The data file is scaffolding, not output.

## Principles

- **Only the HTML is delivered.** Keep the data file and screenshots in a work dir outside the
  user's project (`build.mjs --workdir <name>`). The page embeds its data, so it can be
  edited later without any leftover file: `build.mjs <page.html> --extract <data.js>`
  recovers the data, and `build.mjs <page.html> <page.html>` rebuilds a page on the current
  template. `build.mjs` refuses a data file sitting next to its output and warns about
  untracked data files inside a git work tree.
- **Write in the reader's language.** Use the language of the request or the user's
  conversation for all page text: content fields plus `ui` overrides for the built-in labels,
  which default to English. Raw status values and payloads stay verbatim.
- **Resolve the domain at run time.** Entity, actors, side effects, terminology and sources
  come from the user's context. The bundled example shows depth and format only — none of
  its specifics are defaults.
- **Honest confidence beats confident guesses.** A wrong payload presented as fact costs
  more than a marked guess.

## Workflow

### 1. Scope

Settle (ask only what cannot be inferred): the **entity and the level its status lives at**
(say so on the page when surprising, e.g. per item rather than per order, or derived from
several objects); **one page or one per provider** (sibling pages link via `nav`); the
**audience** (integrators need events/calls/basics; for an internal workflow drop them); and
the **output location**, following the user's folder conventions.

### 2. Research and model

Read primary material first — code (status enums, mappers, migrations, adapters), notes,
official docs — and record where each fact came from; it becomes the tag. With no sources
but web access, check at least the status enum, the event envelope and the main read call.

Model a graph before writing:
1. **Statuses** — exact raw values (spelling and case matter). Include places the entity sits
   that live outside the main enum: requests (cancel, return), related objects (refund,
   review, deployment), package or delivery exceptions.
2. **Transitions** — what triggers each: an actor, a timeout, an API call.
3. **Outcomes** — every way it can end; these answer "where can it end?" (aim for 4–7).
4. **Per status** — the event received on entering it and the calls made while in it.
   Attach a call where you would make it, not everywhere it is legal.

### 3. Write the data file

Create the work dir, then read `references/data-schema.md` (format, layout rules, tags) and
skim `examples/sdlc-work-item.js` for the expected depth.

- **Payloads are realistic and annotated**: real field names, plausible values, `//` comments
  on fields that bite (units, string vs number, absolute vs relative times). Show what is
  sent and what comes back; for events, also what must be replied.
- **Tag honestly** — see the schema's tag section, including what to do when everything is
  from memory.
- **Pitfalls** are what costs someone a day: misleading success codes, values that differ
  between event and API, states that look final but aren't, side effects of an action.
- **Labels on the canvas are short**; the full reason goes in the edge's `why`.

### 4. Build and verify

```bash
node <skill>/scripts/build.mjs --workdir <name>                       # prints the work dir
node <skill>/scripts/build.mjs <workdir>/data.js --check              # schema + layout lint
node <skill>/scripts/build.mjs <workdir>/data.js <out.html>           # write the page
node <skill>/scripts/screenshot.mjs <out.html> <workdir>/shot.png [--node <id>] [--outcome <id>] [--dark]
```

Fix every `WARN`; each is visible on the page (an arrow through a box, overlapping labels,
overflowing text, an outcome step that won't highlight). Fixes, in order of preference: move
a node (fractional `col`, another row); set the edge's `fs`/`ts` sides and `fo`/`to_`
offsets; raise `k` so the curve drops straight before bending; nudge the label with
`lx`/`ly`; shorten the label.

`clean` is necessary, not sufficient. Look at screenshots — light, dark, and one outcome
highlighted — and ask whether a newcomer can follow the main path in five seconds. If an area
is tangled (watch the crossing count), remove edges rather than re-route them: rare
transitions belong in a `why` or a pitfall.

### 5. Deliver

Run the final build with `--clean`, which removes the work dir once the page is written, and
confirm the output location holds only the HTML. Then tell the user where the page is, what
the outcomes cover, which parts are unverified and need checking, and any real risks the
modelling surfaced (an unmapped status, a side effect firing too early) — often the most
valuable part.

## Files

- `assets/template.html` — page shell, light/dark styles, interaction, default labels.
- `assets/layout.js` — geometry shared by the page and the linter.
- `scripts/build.mjs` — work dir, validation, layout lint, build, extract, rebuild, clean.
- `scripts/screenshot.mjs` — headless Chrome/Edge screenshot for visual review.
- `references/data-schema.md` — data format, layout rules, confidence tags.
- `examples/sdlc-work-item.js` — complete illustrative example.
