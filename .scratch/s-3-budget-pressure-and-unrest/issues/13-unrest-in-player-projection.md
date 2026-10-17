# 13: Unrest and its reasons in the player projection

**What to build:** The player sees current unrest, proximity to the strike and
revolution thresholds, and the last few reasons, via the structured explanation data
(ADR-0221). Presentation preferences change formatting only.

**Blocked by:** 04, 05, 06

**Status:** ready-for-agent

- [ ] The projection exposes the level, the thresholds and the last reasons as stable
      codes, not display text.
- [ ] The status strip and an explanation surface render them; the renderer and
      preload import no `effect`.
- [ ] Hashes are identical under every currency mode and preset (U-5 invariance).
- [ ] No unrest figure is formatted in the engine.
