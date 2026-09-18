# Block Palettes

Material choice is an architectural decision assigned by role, not a paint job applied
after the fact.

## Material roles

Assign every block choice one of these roles before naming specific blocks:

| Role | Purpose |
| --- | --- |
| Foundation | Grounds the structure, reads as load-bearing base; usually darker/heavier stone or brick. |
| Primary Wall | The dominant surface material across most of the structure. |
| Structural Frame | Visually expresses the load path — timber frame, exposed beams, columns, ribs, riveted frame. |
| Roof | Distinct from wall material; reads clearly as "roof" even in silhouette-adjacent lighting. |
| Secondary Surface | Infill or contrast surface within the structural frame, or on secondary masses. |
| Accent | Small-quantity highlight material — trim, banding, metalwork, glowing elements. Used sparingly. |

## Material count discipline

More materials is not more richness. A well-hierarchized 3–5 material palette (Foundation,
Primary Wall, Roof, one Structural/Secondary, one Accent) usually reads as more
intentional than an 8-material palette with no clear role assignment. If a design needs
more materials than that, check whether each additional one has a distinct role — if two
materials are doing the same job, drop one.

## Contrast and hierarchy

Use value/color contrast to reinforce the structure's own hierarchy: the primary mass can
carry the primary wall material; secondary masses can shift to a related but distinguishable
material; accents should contrast enough to read as intentional highlights, not blend in as
noise. `taste_profile.palette.contrast` and `.material_count` track how much a given user
wants this pushed.

## Weathering and gradients

Deliberate weathering (moss, cracked variants, mixed cobble/mossy cobble at a structure's
base or shaded faces) is different from random block-variant noise: weathering should
follow a logic (age, water exposure, damage location), not be scattered indiscriminately.
`taste_profile.palette.gradients` and `atmosphere.weathering`/`.age` track whether and how
much a user wants this. Avoid the critique-checklist failure "random block gradients" —
gradients need a physical/atmospheric reason, not just visual texture-breaking.

## Style-to-material translation

Translate a style's real-world material vocabulary into a role-assigned Minecraft palette
rather than picking blocks that merely "look right" individually:

- **Medieval/rustic** — cobblestone/stone brick foundation, wood or wattle-and-daub
  primary wall, timber structural frame, thatch/wood-plank/shingle-textured roof.
- **Gothic** — stone brick throughout, ribbed structural expression (stone brick
  wall/stairs as ribs), dark roofing, sparse but tall accent (lanterns, deepslate).
- **Steampunk/industrial** — dark stone/deepslate or blackstone foundation, copper/
  oxidized-copper and iron-block structural frame and accents, glass panes, exposed
  "pipework" using stairs/fences/chains as structural expression.
- **Japanese** — dark wood structural frame, white/light plaster-like primary wall (white
  concrete/terracotta), dark tiered roof (dark prismarine, black/gray concrete/stairs).
- **Classical/brutalist** — quartz/smooth stone/concrete-family blocks, minimal accent,
  large flat surfaces with disciplined repetition rather than timber framing.
- **Desert** — sandstone family for foundation and primary wall, terracotta for accent,
  minimal roof overhang, flat roofs.
- **Ruined** — the intended style's palette, deliberately degraded: cobweb/vines,
  cracked/mossy variants, partial structure with exposed "structural frame" that would
  otherwise be hidden.

These are starting vocabularies, not fixed rules — a user's palette taste and any
`constraints.palette.preferred/forbidden` list always take precedence.
