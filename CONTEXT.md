# Bluewave context and glossary

Canonical vocabulary for the repository: one term, one meaning. Prefer these
words in code, docs, and tickets; when a term is missing, add it here rather than
inventing a synonym. (`GLOSSARY.md` is a symlink to this file.)

- **Bluewave** — a deterministic 1880s naval strategy and tactical game, and the
  engine and content-compiler that produce it. Runs as an Electron desktop app.
- **Nation** (never "country") — a playable or AI power with a date-banded naval
  profile, dockyards, fleets, appropriation, and research (see the
  [campaign economy glossary](packages/campaign/GLOSSARY.md)).
- **Naval profile** — a nation's authored capability and doctrine. _Hard
  capability_ (technology, industry, facilities, licences) only ever removes
  options; _soft doctrine_ is preference. See `content/`.
- **Technology year** — a technology's global designer unlock year: from January
  of that year every nation may design with it. It is not an RTW3 research date
  or a per-nation discovery claim; per-nation research wiring is deferred.
- **Campaign** — one loaded scenario instance: the compiled content, a starting
  snapshot, and a turn history.
- **Snapshot** — the validated canonical authoritative state after a month.
- **Month / turn** — the unit of campaign time; advances through ordered phases.
- **Phase** — one registered step of the monthly turn pipeline, with a declared
  read/write footprint and whether it may draw randomness.
- **Command** — an intent envelope that never mutates state directly; it passes
  validation, reservation, locking, and an explicit resolution outcome.
- **Domain event** — an append-only record of what a phase decided.
- **Content pack** — authored YAML plus the manifest (`pack.json`) that declares
  its whole loaded surface.
- **Ruleset** — the versioned constants and rules a scenario is played under.
- **Compiled artifact / body hash** — the canonical JSON the app runs on, named
  by its domain-separated SHA-256 body hash (the recorded content identity).
- **Compatibility version** — the version pinned by a save. A save from a
  different version is refused before decode, never migrated at runtime.
- **Save** — a content-addressed, atomically committed directory of authoritative
  state, ledgers, and replay material.
- **Ship design** — a component-level draft compiled into a validated design.
  A **design study** precedes catalog entry; a **construction project** tracks
  funded progress; a **rebuild** applies a changed design to an existing ship.
- **Division / fleet** — groupings of ships and their officers on the map.
- **Officer** — a named commander, or `VACANT`.
- **War score** — the accumulated measure that classifies a war's outcome.
- **SafeInt / canonical units** — branded integer types and fixed-point check
  arithmetic; compiled design data uses micrometres (µm) and µm/s.
- **Determinism** — identical content, ruleset, inputs, commands, seeds, and
  compatibility versions produce identical authoritative hashes across OSes.
- **Authority categories** — canonical, derived, cached, ledger, and ephemeral
  state stay distinct (see `.ai/REQUIREMENTS.md`).
