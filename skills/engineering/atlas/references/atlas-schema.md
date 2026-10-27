# Atlas dataset

One JSON file. `scripts/build.mjs` validates it, lays it out and embeds it in the page; overlays
( `--overlay` ) use the same shape and are merged on top.

```jsonc
{
  "title": "…", "description": "…",          // shown on the start panel
  "ui": { "search": "…", "files": "…" },     // label overrides, in the reader's language ( keys: assets/template.html UI )
  "fields": { "Generated": "2026-01-31" },   // start panel facts
  "direction": "RIGHT",                      // flow of the layers: RIGHT ( default ) or DOWN
  "scale": 0.15,                             // page px per unit of a node's space ( imaged nodes )
  "aspectRatio": 2.5,
  "groups": [ { "id": "a", "name": "…", "color": "#e05a4f" } ],   // in flow order: ELK partitions
  "kinds": { "person": { "label": "…", "color": "#4fb3ff", "shape": "dot" } },
  "edgeKinds": { "door": { "label": "…", "color": "auto" }, "bus": { "label": "…", "color": "#ff9f43", "dash": true } },
  "nodes": [ … ],
  "edges": [ … ],
  "entities": { "<id>": { … } }
}
```

## nodes

The places that link to each other ( maps, rooms, floors, services, systems, sites ).

| Field | Meaning |
|---|---|
| `id` | unique, stable across runs ( it is the URL hash and the overlay key ) |
| `name`, `code` | display name; `code` is the id people search and track by, shown beside the name ( defaults to `id` ) |
| `group` | a `groups` id; the layout keeps groups in order along the flow |
| `root` | `true` on start points: edges are oriented away from them and nodes nothing reaches are reported |
| `image` | background picture, relative to the page ( a minimap, floor plan, diagram ) |
| `space` | `{ x0, y0, x1, y1, flipY }`: the coordinates of `ports` and `markers` that the box spans; `flipY` when y grows upward. Default 0–1 |
| `size` | `[w, h]` page px, overriding the size from `space × scale` |
| `fields`, `files` | label → value facts and source files ( a file value may be a list ) for the detail panel |
| `ports` | `{ id, name, x, y, hidden }`: the points edges leave from or arrive at ( doors, gates, endpoints ) |
| `markers` | `{ entity, kind, label, points: [[x, y], …] }`: entities placed inside the node |
| `sections` | as on entities |

A node with no `image` is drawn as a labelled box: use it for hubs that are not places ( a transit
line, a message bus, a shared service ).

## edges

`{ from, fromPort, to, toPort, kind, label, both }`. Give the real direction: the build merges an
edge and its reverse into one drawn both ways ( `↔` ), and a lone edge is shown one way ( dashed ).
A port id not in the node's `ports` attaches to the node's centre. An edge to a node that does
not exist is dropped with a warning.

## entities

The things on, in or between nodes ( people, items, services, records ).

| Field | Meaning |
|---|---|
| `name`, `code`, `kind`, `badge` | `kind` is a `kinds` id ( colour, shape, toggle ); `badge` is a short tag after the name ( a level, a status ) |
| `fields`, `files` | as on nodes |
| `sections` | `{ title, text, rows: [ { ref, text, note, value } | { heading } ] }`: lists in the detail panel. `ref` links to a node or entity id; `heading` starts a sub-group |

Every `ref` also makes a back link: the referenced item lists who refers to it, under the section's
title ( a product page lists the shops that sell it and the sources that drop it, without storing
that twice ).

## kinds

`{ label, color, shape, spread }`. `shape`: `dot`, `square`, `diamond`, `star`. `spread: true` draws
every point as a small dot with one label at their centre: for things with many places each ( a
population, sensors ), so the node stays readable.

## edgeKinds

`{ label, color, dash }`. `color: "auto"` gives each edge its own hue ( golden-angle steps, so
neighbouring lines differ ); a fixed colour suits a kind that should read as one system ( a transit
network ). `dash` draws the kind dotted.
