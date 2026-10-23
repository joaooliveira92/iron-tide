# Map prototype — throwaway

Ticket 06, "Map rendering technology and geometry source?"

**This whole directory is disposable.** It exists to answer one question with a running artifact
instead of on paper. The decision is the deliverable; this code is not. When ticket 06 closes, the
correct action is `rm -r` on this folder plus the two references listed under "Deleting this"
below — not a refactor into `screens/strategic-map/`.

Nothing here touches IPC, the engine, or a real campaign. The world is a fixture in
`components/world-map/fixture-world.ts` (36 areas, 59 edges), which is why the screen is never registered in a
production build.

## Running it

Two ways, and the difference matters:

- **Standalone**, for a quick look — `pnpm dev` in `apps/desktop`, then
  <http://localhost:5173/screens/map-prototype/>. Mounts outside the campaign shell, so there is no
  campaign to start first.
- **Inside the app chrome**, which is the comparison that actually decides anything — the "Map
  Prototype" sidebar entry, registered in `shell/campaign-screen-registry.tsx` behind
  `import.meta.env.DEV`.

Switch variants with the floating bar at the bottom, the `←`/`→` arrow keys, or `?variant=A|B|C`.
The bar is deliberately styled to look foreign so nobody mistakes it for the design under
evaluation; it is dev-only scaffolding, **not** a proposed player-facing toggle.

## The three variants

**A — "Admiralty chart" is the chosen design.** Real coastlines carry the geography; areas are
translucent washes over them. B and C are kept deliberately, because each still answers a live
question — the reasoning is recorded in ticket 06 under "Variants B and C — deferred, not
discarded", along with `git show` recovery commands should this folder be deleted first.

- **A — Admiralty chart.** Real coastlines, areas as translucent washes. Its own palette and
  floating chrome, so it reads as a chart.
- **B — Stylised board.** No projection, no polygons, no geography: areas are tiles, edges are
  connectors, passages are gates. Uses the app's theme tokens throughout, so it can be judged as
  part of Bluewave rather than pasted into it.
- **C — Operational graph.** Areas are nodes from computed centroids, coastlines are a faint
  orientation wash, ownership is a node ring, edges are the loudest thing on screen. Split layout
  with a permanent area rail.

Each variant's own docblock states its premise and the costs it exists to make visible. Read those
before judging one — several apparent flaws are the point.

## Coastline geometry

`bake-coastline.ts` is a one-off author-time bake, run by hand, that writes `components/world-map/coastline-data.ts`.
It takes a Natural Earth tier as its argument:

```
pnpm tsx apps/desktop/src/renderer/screens/map-prototype/bake-coastline.ts [110m|50m|10m]
```

**10m is the default and the decided tier.** The number is the map scale each tier is _drawn for_ —
110m is a world thumbnail, 50m a continent, 10m a coastline. The camera reaches 14x
(`components/world-map/useMapCamera.ts`, `MAX_SCALE`), roughly 1:1.5M at the equator, so 110m goes visibly
polygonal exactly where a naval game needs resolution. For a naval game the coast is the subject.

Two properties worth preserving in whatever replaces this:

- Output is **unprojected** lon/lat, so the projection stays a render-time toggle rather than a
  bake-time commitment.
- There is **no runtime geometry dependency** — no `d3-geo`, no `topojson-client`. The TopoJSON arc
  decoder is ~40 lines in the bake script.

Natural Earth is public domain at every tier, so fidelity is not constrained by ticket 10's
originality boundary.

Known and accepted _for a prototype only_: the bake emits a 4.8 MB TypeScript **source module**.
That is fine through Vite in dev and wrong for production. Ticket 06 still owes the real asset
format.

## Deleting this

`rm -r` this folder, then remove:

- the `MAP_PROTOTYPE_SCREEN` definition, its `"map-prototype"` union member, its lazy import, and
  the `import.meta.env.DEV` spread in `shell/campaign-screen-registry.tsx`
- any `?variant=` links you have lying around

Nothing else imports this directory.
