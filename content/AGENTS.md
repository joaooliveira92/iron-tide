# Content

**Role:** Authored game content: declarative TypeScript compiled into canonical artifacts by `content-compiler`.

**Invariants:**

- Author domain content as declarative TypeScript (`define…(...)` from `@bluewave/content-authoring`); `pack.json` is the single authority for the loaded surface.
- YAML is permitted only for internationalization catalogues under `ui/`; `scripts/assert-no-foreign-yaml.mjs` fails on any other tracked `.yaml`/`.yml` outside the named infrastructure exceptions (ADR-0334, superseded by ADR-0361).
- Gameplay numbers live here, marked PROVISIONAL until sourced or playtested.
- A change that moves golden hashes follows golden repinning.

**Governing ADRs:** [every current ADR for content](../docs/adr/by-scope/content.md), with superseded records marked.

Root rules in [AGENTS.md](../AGENTS.md) apply. Layout: [content/README.md](README.md).
