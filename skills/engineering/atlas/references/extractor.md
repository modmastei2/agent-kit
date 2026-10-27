# Writing the extractor

The extractor is the project's own script that turns its data into the atlas dataset. It lives in
the user's project, in the project's language and conventions, so anyone can run it again when the
data changes. The bundled build script only consumes its output.

## Read the data the way the system reads it

- Prefer the project's own readers: a CLI of its tools, its library, its database views, an export
  command. They know the formats and the edge cases; a hand-written parser of a binary or packed
  format is the last resort, and it gets a check against the official reader.
- Packed or encoded sources ( archives, encrypted text, code pages ) are decoded in the extractor;
  say which reader or key it uses in a comment.
- Code pages and encodings: decode to UTF-8 at the edge and keep the original names; never let a
  console's encoding decide.

## Stages

1. **Raw answers, cached.** Store each reader call's output under a cache folder keyed by its
   arguments, so a rerun is fast and only `--refresh` asks again. Run slow calls in parallel
   ( `--jobs` ).
2. **The relation dataset**, a readable JSON in the project's data folder: nodes, links,
   entities, with stable ids and the source file of each item. This is the deliverable the user
   asked to keep before any drawing; diffs of it show what changed in the data.
3. **The atlas dataset** ( references/atlas-schema.md ), mapped from stage 2: kinds, groups,
   labels in the reader's language. Keep this mapping separate from stage 2, so the relation
   data does not carry presentation.

## Get the links right

- **Every way between nodes counts**: direct links ( doors, gates, calls ), and indirect ones that
  carry the user across ( transport, teleports, queues, routers ). Model an indirect one as a hub
  node with edges from where it is boarded to where it leaves you.
- **Default values that mean "none"**: an unset link often holds the format's default ( id 0, a
  null id that is a real id ). Find out which values mean nothing and drop them, or every node
  will seem to link to that one.
- **Links to what does not exist**: a target missing from the index is a dead end; keep it out of
  the edges and say so.
- **Start points** come from the system's configuration, not from guesses; mark them `root`.
- **Keep only what is reachable** from the roots by default ( an `--all` flag keeps the rest ),
  and report what is left out: a node no one reaches is often a finding.

## Grouping

Groups give the atlas its reading order. Derive them from the graph where possible ( nearest root,
with a border where areas touch ) and let the user's own model win when they state one ( "the shared
hub comes after the three entry areas" ).

## Adding by hand

Read an overlay file ( same shape as the atlas dataset ) and pass it to the build with
`--overlay`, so items not in the data yet can be shown without touching the extractor.

## Images

Background images are converted once to a web format ( JPEG / PNG, a sensible maximum size ) into a
folder next to the page, with the coordinate frame that maps points onto them ( `space` ). Check one
node by eye: a marker known to stand at a landmark must land on it.
