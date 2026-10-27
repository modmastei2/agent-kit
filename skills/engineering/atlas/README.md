# Atlas

**Preview** — the dataset format and build flags may still change.

Atlas turns "how does all of this connect?" into a dataset you keep and one interactive web page
you can rebuild at any time. Point it at a system: a game world with maps joined by gates, a building with
rooms and doors, services that call each other, sites linked by routes. It reads the project's own data,
saves the relations as JSON, then draws every place as a box (or as its own picture, such as a minimap or
floor plan, with markers on it), laid out in reading order with every link routed around the boxes.

Readers search by name, id or file, hover a link to see where it goes, and click anything to see its ids,
source files, what it holds or offers, and everything that refers to it. When data is added, rerun the
extractor and the build; things the data lacks go in an overlay file.

- `scripts/build.mjs` — validate, merge overlays, lay out with ELK, write the page.
- `scripts/screenshot.mjs` — screenshot a page for review.
- `references/atlas-schema.md` — the dataset format.
- `references/extractor.md` — how to write the extractor for a project.
