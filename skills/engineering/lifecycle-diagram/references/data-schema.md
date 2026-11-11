# Data file schema

A data file is plain JavaScript that sets `window.DATA`. JS rather than JSON lets payload
examples be template literals and lets you share snippets through `const`s:

```js
window.DATA = (function(){
  const GET = { title:'Get item', method:'GET', path:'/items/{id}', tag:'doc', req:`…`, res:`…` };
  return { name:'Acme Items', nodes:[ … ], edges:[ … ], outcomes:[ … ] };
})();
```

It is a working file: keep it in the work dir (`build.mjs --workdir <name>`), never next to
the page. A built page embeds it, and `build.mjs <page.html> --extract <data.js>` gets it back.
The embedded block can also be edited in the page itself: add a node and its edges, reload.

Fields marked * are required. Fields marked html accept HTML; everything else is escaped.
Write every human-readable field in the reader's language, in plain words; keep raw values,
codes and proper names verbatim. No emoji or symbol glyphs (the linter warns): the template
draws its own icons. Arrows such as → are ordinary text and fine, in `raw` or in prose.

## Page

| Field | Notes |
|---|---|
| `name`* | Subject of the page, the heading |
| `title` | Browser tab title; defaults to `name` |
| `eyebrow` | Small label above the heading (default `ui.eyebrow`, `Lifecycle`) |
| `embed` | `true` builds the page for an iframe inside another page (same as opening it with `?embed=1`); see Embedding |
| `lang` | `<html lang>` (default `en`) — set it to the page's language |
| `accent` | `{light, dark}` hex colours for links, the start node and tags; `dark` is a lighter tint |
| `lead` (html) | Optional, one sentence: what one "thing" is, or the one trap to know before reading the diagram, or that the page is unverified. Everything else goes on the status it concerns |
| `crumb`, `nav` | Breadcrumb text and `[{label, href, current}]` links to sibling pages (relative) |
| `rows` | Label per diagram row, top to bottom |
| `effects` | `{key: {label, tone}}` — optional side effect per status, shown as a dot; tone ∈ blue, green, gray, amber, red, purple |
| `actors` | `{key: label}` — labels for `who`; there are no built-ins |
| `ui` | Overrides for built-in labels (see the `UI` object at the top of the template script), e.g. `eyebrow`, `outTitle`, `noPath`, `apis`, `webhook`, `basicsTitle`, `mapTitle`, `mappedLabel`, `effectLabel`, `legend:{main,cancel,ret,exc,back}`, `kinds:{…}` |
| `tags`, `tagDesc` | Overrides for tag labels and their descriptions in the footer |
| `basics` | `[{title, tag, body(html), code, codeLabel}]` — "before your first call" cards; omit to hide |
| `mapTable` | `false` hides the status table |
| `sources` (html list) | Provenance, folded away in the footer |
| `colW`, `rowH`, `nodeW`, `top` | Grid tuning; defaults: `colW` 215, widened to fit the longest label between two neighbours in a row; `rowH` 122; `nodeW` 156; `top` 30 (78 when an edge arcs over the first row) |

`facts`, `callout`, `footer`, `titlePrefix` and the `ui` keys `outSub`, `basicsSub`, `mapSub`
are no longer shown; the linter says where their content belongs.

## Nodes

```js
{ id:'IN_REVIEW', raw:'pull_request: open · review_requested', code:'IN_REVIEW', short:'Awaiting review',
  col:3, row:0, kind:'main', level:'pull request', mapped:'in_review', effect:'none',
  who:['dev'], tag:'gen', desc:'…html…', webhook:{…api}, apis:[{…api}], gotchas:['…html…'] }
```

| Field | Notes |
|---|---|
| `id`* | Unique; used by edges, outcomes and the URL hash |
| `raw`* | The exact value(s) the source system uses — shown in full in the panel |
| `code` | Text in the box when `raw` is long (~18 monospace chars fit at default width) or ambiguous across objects (`refund: succeeded`) |
| `short` | Short human meaning, the box's second line (`th` is accepted as a pre-1.0 alias) |
| `col`, `row` | Grid position, `col` may be fractional. Leave them out for automatic placement (see Layout); set one only to pin a node |
| `w` | Box width override |
| `kind` | `start` · `main` (default) · `side` (dashed: sub-state or signal outside the main enum) · `ok` (success end) · `cancel` (cancel / failure) · `ret` (reversal: return, refund, rollback) · `exc` (exception, e.g. delivery or infrastructure level) |
| `end` | Force the END badge. Default: `ok`/`cancel` nodes without a non-`back` outgoing edge. Set it on a state that ends the main object but still points into a related object, and on terminal `ret` nodes |
| `level` | Which object/level holds this status (`order item`, `pull request`, `refund (separate object)`) |
| `mapped` | The normalised/internal status it maps to |
| `effect` | Key into `effects` |
| `who` | Keys into `actors` |
| `tag` | Confidence of the status itself |
| `desc` (html) | What it means and what the integrator does here |
| `webhook` | api object — the event received on entering this status |
| `apis` | api objects — calls made while in this status (the first one opens by default) |
| `gotchas` | html list of pitfalls |
| `map` | `false` keeps it out of the table (for things that are not raw statuses) |

## API / event object

```js
{ title:'Merge pull request', method:'PUT', path:'/repos/{owner}/{repo}/pulls/{n}/merge', tag:'gen',
  note:'…html: limits, idempotency, error codes…',
  req:`PUT …\n\n{ "merge_method": "squash" }`, reqLabel:'Request',
  res:`{ "merged": true }`, resLabel:'Response' }
```

`method` is styled for GET, POST, PUT, PATCH, DELETE and PUSH/EVENT. For an event, put what
arrives in `req` (label it accordingly) and the required reply in `res`, with the
verification and deadline rules in `note`. Code blocks get light JSON highlighting; `//`
comments (preceded by a space) render as comments.

## Edges

```js
{ from:'IN_REVIEW', to:'MERGED', label:'merge', why:'Approved and required checks green', kind:'main' }
```

| Field | Notes |
|---|---|
| `from`*, `to`* | Node ids |
| `kind` | `main` (default) · `cancel` · `ret` · `exc` (dashed) · `back` (dotted: loop back, rejection, retry) |
| `label` | Short text on the canvas |
| `why` | Full reason, shown in the detail panel |
| `fs`, `ts` | Exit / entry side: `t` `b` `l` `r` (default from relative position; see Layout) |
| `fo`, `to_` | Pixel offset of the exit / entry point along its side |
| `k` | Control distance — larger leaves straighter before bending |
| `lx`, `ly` | Label nudge in pixels |

## Outcomes

```js
{ id:'cancel', tone:'cancel', label:'Cancelled', path:['BACKLOG','READY','CANCELLED'], desc:'…html…' }
```

Each outcome is a scenario button that lights its path; `tone` ∈ ok, cancel, ret, exc picks its
icon and colour. Each consecutive pair in `path` should be an edge (the linter
warns otherwise); a node may repeat, e.g. a rework loop.

## Modelling beyond plain statuses

- **Related objects with their own statuses** (refund, return request, review, deployment):
  give them their own row, a fitting `kind`, a `level` naming the object, and a `code`
  prefixed with the object when values collide.
- **Signals that are not a status** (a failure event, a label, a delivery exception):
  `kind:'side'` or `'exc'` with `map:false`, and say in `desc` that the main status does not change.
- **Flags inside a status**: usually not a node — mention them in `desc` or a pitfall.
- **Derived status** (no single field holds it): `raw` describes the combination of signals.

## Confidence tags

| Tag | Use when |
|---|---|
| `doc` | Read in official documentation, directly or via a note that cites it |
| `repo` | Proven by working code, tests or a sandbox run |
| `unv` | A source says it is unconfirmed or contradictory |
| `gen` | General knowledge not checked against a source — say so in the note |

When nothing could be checked, everything is `gen` and the tag stops carrying signal: verify
the riskiest payloads if you can browse (and tag them `doc`), mark individually shaky fields
with a `//` comment, and say in `lead` that the page is unverified and what to check first.

## Embedding

Set `embed:true` (or open the page as `page.html?embed=1`) to show it inside another page,
e.g. an iframe in a training site. The page then:

- drops its top bar, eyebrow and theme button, its background and its side padding, so the
  host's own heading and frame carry it;
- takes its theme from the host instead of the reader's saved choice (a `srcdoc` frame shares
  the host's storage): `?theme=light|dark` up front, then `postMessage({theme:'light'|'dark'|'auto'})`
  from the host whenever the host switches;
- reports its height to the host after every resize, so the iframe needs no scrollbar:

```js
addEventListener('message', e => {
  if (e.data?.type === 'lifecycle-diagram:height' && e.source === frame.contentWindow) frame.style.height = e.data.height + 'px';
});
```

## Layout

Placement is automatic; fields you set always win over it.

- A node without `row` takes the row of its kind: `start`/`main`/`ok` row 0, `side`/`exc`
  row 1, `cancel`/`ret` row 2 (unused rows close up when no `rows` labels are given).
- A node without `col` follows the edges: the main row runs left to right along the longest
  path from the start, so a shortcut (an edge that skips states) never reorders it. `back`
  edges are ignored, and so is any edge that closes a loop (the walk follows the longest
  scenario first), even if it is not marked `back`. A node in another row sits half a column
  right of its one source, or centred under several; auto-placed boxes in one row are pushed
  apart so they never overlap.
- An edge without sides runs straight between neighbours in a row (either direction) and
  right/down/up between rows. Only a same-row edge with a box in the way arcs: over the first
  row (`top` grows to make room), under any other row (the canvas grows to fit). Two opposite
  edges between the same states run side by side with their labels on the outside.

So adding a status is one `nodes` entry plus its `edges`. Start without positions, check,
then pin only what the linter or a screenshot flags. Besides boxes, lines and labels that
overlap or touch, the linter flags anything cut off at the top or left, and a main row that
does not follow the longest scenario. The rules below are for that pinning.

- **Rows carry meaning**: row 0 is the main path left to right; row 1 holds side states and
  exceptions, placed between the states they belong to (often at `.5` columns); lower rows
  hold cancellation and reversal branches with their terminal states.
- Keep the main path at about 7 columns or fewer; beyond ~1600 px of width the text gets small.
- An edge leaving a box downward drops straight first, so keep the space directly below a
  source free unless it holds the target; shift side states half a column instead.
- A state that many others can reach (a shared cancel state) reads best under the middle of
  its sources. Edges arriving from far away read better entering from the side along their
  own row (`fs:'b', ts:'l'` or `ts:'r'`, with a large `k`) than cutting diagonally across rows.
- Opposite edges with sides you set yourself: offset them (`fo`/`to_` ±30) so they don't overlap.
- **Several arcs over the same row**: vary `k`/`fo` so they nest instead of crossing.
- **Density**: past ~20 edges or ~6 crossings (the linter prints the count) the diagram stops
  being readable. Drop edges that are implied or rare and carry them in a `why` or a pitfall;
  prefer one representative edge into a shared terminal over one from every source.
- Row labels sit at the top-left of each row; keep them short. Edges may cross them (the
  label has a halo), but nodes must not.
