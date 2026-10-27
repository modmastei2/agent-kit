---
name: atlas
version: 0.1.0
description: Build an interactive, regenerable HTML atlas of how the things in a system relate — places or components linked to each other (maps joined by gates, rooms by doors, services by calls, sites by routes), the entities inside them (people, items, services, devices) and what those entities offer, hold or produce — first as a relation dataset extracted from the project's own data, then as one page that lays the nodes out left to right with ELK, routes every link around them, can show each node's own picture (a minimap, floor plan, diagram) with markers on it, and lists ids, source files and cross references in a detail panel. Use whenever someone wants to see, trace or document how a world, building, network or codebase connects end to end, or asks for a relationship map they can rebuild when data is added, even if they don't name HTML or a graph.
---

# Atlas

> **Preview** ( 0.x ): tried on one game world and one service map. The dataset format and
> build flags may still change; expect a major bump when they settle.

Turns a system's data into two things the user keeps:

1. a **relation dataset** — readable JSON made by an extractor in the user's project, rerun when
   the data changes;
2. **one self-contained HTML page** — nodes in flow order, every link routed at right angles in
   the space between them, optional background images with markers, hover tooltips on links, a
   search, and a detail panel with ids, source files, lists and back links.

`scripts/build.mjs` lays out and embeds an atlas dataset ( `references/atlas-schema.md` ) into
`assets/template.html`. The extractor is yours to write, per project ( `references/extractor.md` ).

## Principles

- **Data first, drawing second.** Settle and save the relation dataset before any page work; it is
  a deliverable, not scaffolding.
- **Read data the way the system does** — its own tools, library or exports, not guesses.
  Everything shown traces to a source file, and the page says which.
- **Regenerable by design.** One command rebuilds the page from the data; an overlay file adds what
  the data lacks. Never hand-edit the built page.
- **Resolve the domain at run time.** Node and entity types, kinds, groups, start points and
  vocabulary come from the user's system. Nothing about any one domain is a default.
- **Write in the reader's language**: names stay as the data has them; labels and `ui` text follow
  the request or the conversation.
- **The user's model wins**: when they say how to read the system ( an order, what sits behind
  what ), group and order by it, and say where the data disagrees.

## Workflow

### 1. Scope

Settle, asking only what cannot be found: what the **nodes** are and what **links** them ( every
way across, including indirect transport ), the **entities** and what to list for each ( what they
sell, drop, own, call ), the **start points**, any **pictures** per node and the coordinates that
map onto them, and where the dataset, extractor and page go in the project.

### 2. Find the sources

Locate the data and its readers: CLIs, libraries, configs, packed archives, databases. Probe one
of each kind by hand and note the shape. Find the defaults that mean "none" and the links to
missing targets before they mislead the layout ( `references/extractor.md` ).

### 3. Extract the relation dataset

Write the extractor in the project ( its language, its folders ): cached raw calls, parallel when
slow, a reachable set from the roots, stable ids, source files on every item. Run it, then read the
counts and a few records back against the source.

### 4. Map to the atlas and build

Map the relation dataset to the atlas schema ( a separate step or script ): `groups` in reading
order, `kinds` and `edgeKinds` with labels, `code` on everything people track by id, `files`,
`sections` with `ref`s so back links come for free.

```bash
node <skill>/scripts/build.mjs <atlas.json> --check [--overlay <extra.json>]
node <skill>/scripts/build.mjs <atlas.json> <page.html> [--overlay <extra.json>] [--direction RIGHT|DOWN]
node <skill>/scripts/screenshot.mjs <page.html> <shot.png> [--node <id>] [--entity <id>]
```

The first build installs elkjs into `~/.cache/atlas` unless the project has it ( needs npm ).
Wire both steps into one project command, so a rebuild is a single line.

### 5. Verify

Fix every `WARN`. Then look at screenshots — the whole atlas, a busy node, an entity — and check:
markers land where the picture says they should; nothing is isolated that the user can reach; the
start points and groups read in the user's order; a newcomer can follow a link by colour or by
hovering it. A node nothing reaches is a finding to report, not to hide.

### 6. Deliver

Tell the user where the dataset, extractor and page are, the one command that rebuilds, how to add
by overlay, and what the data revealed: dead links, unreachable places, ways in that are not links
( transport, scripts ), defaults that pretend to be links.

## Files

- `scripts/build.mjs` — validate, merge overlays, ELK layout, embed.
- `scripts/screenshot.mjs` — headless Chrome / Edge screenshot.
- `assets/template.html` — the page: pan and zoom, toggles, search, tooltips, detail panel, light and dark.
- `references/atlas-schema.md` — the dataset the build reads.
- `references/extractor.md` — how to write a project's extractor.
