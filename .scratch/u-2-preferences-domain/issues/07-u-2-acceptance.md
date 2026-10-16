# 07: U-2 acceptance — presentation invariance and boundary proof

**What to build:** The evidence that the preferences domain is real: changing any
preference moves no authoritative outcome, the boundary is decoded, and the sprint
meets its definition of done on a clean commit.

**Blocked by:** 06.

**Status:** blocked

- [ ] An invariance test changes every preference (all three currency modes, both
      unit presets, language/locale, theme, density, text scale, tooltip detail)
      and observes the compiled campaign snapshot, the save, and the cross-process
      golden reference run unchanged.
- [ ] The boundary test proves the preload capability rejects an excess-key or
      malformed payload with a stable `_tag` and decodes a valid one; the
      runtime-free gate proves the renderer imports no `effect`.
- [ ] The parity test (shared renderer contract equals the schema's decoded type)
      is green.
- [ ] No save format, wire format, or compatibility version changed; no golden hash
      moved (record the before/after hashes as evidence).
- [ ] The U-2 validation report is written with exact commands and observed
      results; the SPRINT-PLAN row and the `.ai/specs/` pointer are updated; the
      tree is clean with Conventional Commit subjects.
- [ ] `pnpm preflight`, `pnpm test:scripts`, and `pnpm check` are green on the
      exact commit.
