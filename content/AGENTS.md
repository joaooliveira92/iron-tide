# Content

**Role:** Authored game content: YAML compiled into canonical artifacts by `content-compiler`.

**Invariants:**

- Author YAML without executable tags; `pack.json` is the single authority for the loaded surface.
- Gameplay numbers live here, marked PROVISIONAL until sourced or playtested.
- A change that moves golden hashes follows golden repinning.

**Governing ADRs:** [every current ADR for content](../docs/adr/by-scope/content.md), with superseded records marked.

Root rules in [AGENTS.md](../AGENTS.md) apply. Layout: [content/README.md](README.md).
