# 06: Deterministic migration and corruption recovery

**What to build:** A trustworthy upgrade path for settings — the values players
already have migrate into the versioned domain exactly and reproducibly, and a
corrupt or unknown value falls back to a safe default without ever touching a save
or breaking startup.

**Blocked by:** 02, 03, 04, 05.

**Status:** done

- [x] Migration is a pure, ordered, total list of steps from the implicit
      `localStorage`-era version `0` to `1`; it preserves every valid legacy value,
      fills missing keys from the central defaults, turns unknown legacy values
      into defaults, and is idempotent.
- [x] The same legacy state always migrates to the same preferences state (a
      determinism test over the legacy fixtures).
- [x] A corrupt or undecodable preferences file and an unknown/out-of-range value
      each recover to the central defaults with a logged diagnostic; startup does
      not fail and no save file is touched.
- [x] Recovery is explicit and logged, distinct from validation; no silent repair
      hides a defect.
- [x] Tests cover a clean migration, an idempotent re-run, a corrupt file, and an
      unknown value, and assert the save directory is byte-identical after each.
