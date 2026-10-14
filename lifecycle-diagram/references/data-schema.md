# Data file schema

A data file is plain JavaScript that sets `window.DATA`. Using JS (not JSON) lets payload
examples be template literals and lets you share snippets via `const`s:

```js
window.DATA = (function(){
  const DETAIL = { title:'Get Order Detail', method:'GET', path:'/orders/{id}', tag:'doc', req:`…`, res:`…` };
  return { name:'Acme Pay', nodes:[ … ], edges:[ … ], outcomes:[ … ] };
})();
```

Fields marked * are required. HTML is allowed in fields documented as "html"; everything
else is escaped.

## Page

| Field | Type | Notes |
|---|---|---|
| `name`* | string | Shown large in the title, coloured with the accent |
| `title` | string | `<title>`; defaults to `name` |
| `titlePrefix` | string | Text before `name` in the h1 (default `วงจรชีวิต `) |
| `lang` | string | `<html lang>`, default `th` |
| `accent` | `{light, dark}` hex | Provider colour; dark is a lighter tint for dark mode |
| `lead` | html | One or two sentences: what one "thing" is and the single most surprising fact |
| `facts` | `[{k, v(html)}]` | 4–6 quick facts: status level, base URL, detail call cost, webhook ack deadline, retries… |
| `callout` | html | The #1 trap, starting with ⚠ |
| `crumb` | string | Small text left of the nav |
| `nav` | `[{label, href, current}]` | Links to sibling pages (relative paths) |
| `rows` | `[string]` | Label for each diagram row, top to bottom |
| `effects` | `{key: {label, tone}}` | Optional side-effect legend; tone ∈ blue, green, gray, amber, red, purple |
| `actors` | `{key: label}` | Extra/override labels for `who` (built-ins: buyer, seller, user, us, platform, carrier, system, admin, bank) |
| `ui` | object | Override any UI string — see the `UI` defaults at the top of the template script (e.g. `outTitle`, `apis`, `basicsTitle`, `mapTitle`, `mapSub`(html), `mappedLabel`, `effectLabel`, `legend:{main,cancel,ret,exc,back}`) |
| `tags` / `tagDesc` | `{key: text}` | Override tag labels / footer descriptions |
| `basics` | `[{title, tag, body(html), code, codeLabel}]` | "Before your first API call" cards. Omit to hide the section |
| `mapTable` | bool | `false` hides the mapping table |
| `sources` | `[html]` | Footer list of sources |
| `footer` | html | Last footer line (e.g. "built from repo X on <date>") |
| `colW`, `rowH`, `nodeW`, `top` | number | Grid tuning; defaults 215 / 122 / 156 / 26 |

## Nodes

```js
{ id:'AWAITING_SHIPMENT', raw:'AWAITING_SHIPMENT', th:'รอร้านจัดส่ง', col:2, row:0,
  kind:'main', level:'order', mapped:'awaiting_fulfilment', effect:'consume',
  who:['platform'], tag:'doc', desc:'…html…', webhook:{…api}, apis:[{…api}], gotchas:['…html…'] }
```

| Field | Notes |
|---|---|
| `id`* | Unique, used in edges/outcomes and the URL hash |
| `raw`* | Exact provider value(s). Long lists are fine here (shown in the panel) |
| `code` | Short text for the box when `raw` is too long (box fits ~18 mono chars at default width; or set `w`). Also use it to disambiguate when two objects share a raw value, e.g. `code:'refund: succeeded'` |
| `th` | Human meaning, short (second line of the box) |
| `col`*, `row`* | Grid position; `col` may be fractional (`2.5`) |
| `w` | Box width override (default 156) |
| `kind` | `start` · `main` (default) · `side` (dashed: sub-state / not in the main enum) · `ok` (success end) · `cancel` (cancel/failure) · `ret` (return/reversal/refund) · `exc` (exception, e.g. package-level) |
| `end` | Force the END badge on/off. Default: `ok`/`cancel` nodes with no non-`back` outgoing edge. Set `end:true` on a state that ends the main object's life but still has arrows into a *related* object (e.g. `succeeded` → refund/dispute), and on terminal `ret` nodes |
| `level` | Where this status lives: `order`, `order item`, `package (sub_status)`, `cancellation (separate)`… |
| `mapped` | Internal/normalised status this maps to |
| `effect` | Key into `effects` |
| `who` | Actor keys that cause entering this state |
| `tag` | Confidence of the status itself |
| `desc` | html — what it means, what the integrator should do here |
| `webhook` | api object — what you receive when entering this state |
| `apis` | api objects — calls you'd make while in this state (first one opens by default) |
| `gotchas` | html list |
| `map` | `false` excludes it from the mapping table (for sub-states that aren't raw statuses) |

## API / webhook object

```js
{ title:'Ship Package — นัดขนส่ง', method:'POST', path:'/fulfillment/202309/packages/{id}/ship', tag:'doc',
  note:'…html: limits, idempotency, error codes…',
  req:`POST …\n\n{ "handover_method": "PICKUP" }`, reqLabel:'Request',
  res:`{ "code": 0, "data": {} }`, resLabel:'Response' }
```

`method` styles: GET, POST, PUT, PATCH, DELETE, PUSH/EVENT (for webhooks). For a webhook, use
`reqLabel:'ที่เราจะได้รับ'` and `res` = the reply we must send (`HTTP/1.1 200 OK` + rules in `note`).
Code blocks get light JSON highlighting; `// comments` render as comments (keep a space before `//`).

## Edges

```js
{ from:'AWAITING_SHIPMENT', to:'AWAITING_COLLECTION', label:'นัดส่ง', why:'ร้านเรียก Ship Package', kind:'main' }
```

| Field | Notes |
|---|---|
| `from`*, `to`* | Node ids |
| `kind` | `main` (default) · `cancel` · `ret` · `exc` (dashed) · `back` (dotted: loop back / rejection) |
| `label` | Text on the diagram — short |
| `why` | Longer reason, shown in the detail panel's transitions list |
| `fs`, `ts` | Exit / entry side: `t` `b` `l` `r` (default picked from relative position) |
| `fo`, `to_` | Pixel offset of the exit / entry point along that side |
| `k` | Control-point distance: larger = leaves straighter before curving |
| `lx`, `ly` | Label nudge in pixels |

## Outcomes

```js
{ id:'cancel', tone:'cancel', label:'ยกเลิกหลังจ่าย', path:['UNPAID','ON_HOLD','AWAITING_SHIPMENT','CANCEL_REQ','CANCELLED'], desc:'…html…' }
```

`tone` ∈ ok, cancel, ret, exc. Each consecutive pair in `path` should be an edge (the linter
warns otherwise). A node may repeat (e.g. a retry loop).

## Modelling cases that aren't plain statuses

- **Related objects with their own statuses** (refund, dispute, return request, cancellation
  request): give them their own row(s), `kind:'ret'`/`'cancel'`/`'exc'`, a `level` that names
  the object, and `code` prefixed with the object (`dispute: lost`).
- **Events that aren't a status** (e.g. `payment_intent.payment_failed`, a package exception):
  `kind:'side'` or `'exc'`, `map:false`, and say in `desc` that the object's status does not change.
- **Flags inside a status** (e.g. `is_cancel_pending`): usually not a node — put it in `desc`
  or a gotcha.

## Confidence tags

| Tag | Use when |
|---|---|
| `doc` | You read it in official documentation (directly or via a research note citing it) |
| `repo` | Proven by working code, tests or sandbox runs |
| `unv` | A source explicitly says it is unverified/conflicting |
| `gen` | General knowledge you did not verify in the sources — say so in the note |

When there are no sources at all, everything is `gen` and the tag stops carrying signal. Then:
check the riskiest payloads against official docs if you can browse (and tag those `doc`);
mark individual shaky fields with `// ไม่แน่ใจ` comments; and state in `lead` or `footer`
that the page is from memory and list what to verify first.

## Layout rules of thumb

- **Rows carry meaning**: row 0 = happy path left→right; row 1 = side states and
  exceptions (placed between the two main states they sit between, often at `.5` columns);
  row 2 = cancellation / reversal branch with terminal states. Add rows only if needed.
- Keep the main path ≤ 7 columns; past ~1600 px of viewBox the text renders small.
- An edge leaving a box downward travels straight down first: don't put another box directly
  below its source unless that box is the target. Shift side states half a column instead.
- Converging edges (several states → one cancel state) read best when the target sits under
  the middle of its sources.
- Edges into a terminal from far away: try `fs:'b', ts:'l'` or `ts:'r'` so they arrive
  from the side along the bottom row instead of cutting diagonally across row 1.
- Back edges (`back`) between vertically stacked nodes: offset them (`fo`/`to_` ±30) so the
  two directions don't overlap.
- **Skipping ahead in the same row** (one state can jump to several later ones): draw an arc
  over the top with `fs:'t', ts:'t'`, raise `top` (e.g. 70–90) to make room, and stagger
  several arcs with different `k`/`fo` so they nest instead of overlapping.
- **Density.** Past ~20 edges or ~6 crossings (the linter prints the count) the diagram
  stops being readable. Cut edges that are implied or rare and move them into a `why` or a
  gotcha; split related objects onto their own row; prefer one representative edge into a
  shared terminal over one edge from every source.
- Row labels sit at the top-left of each row: keep them short; the linter warns when a node
  overlaps one (edges may cross them; the label has a halo).
