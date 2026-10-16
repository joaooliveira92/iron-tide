# 07: Readiness, crew and maintenance in the player projection

**What to build:** The player projection and the fleet screen expose each ship's
readiness state, crew quality and the fleet's monthly maintenance, so the player can
see what the fleet costs and which ships are not ready. Renderer and preload stay
runtime-free; presentation never changes hashes.

**Blocked by:** 01, 02, 03

**Status:** ready-for-agent

- [ ] `PlayerProjectionShip` carries readiness and crew quality; the projection reads
      `nation.maintenanceCost` rather than re-deriving it (or both agree, asserted).
- [ ] The fleet screen shows the state (with the repair/mothball notifications),
      replacing the `isUnderConstruction`-only status.
- [ ] The renderer and preload import no `effect`; the screen is presentation only.
- [ ] Changing a presentation preference does not change any authoritative hash
      (projection invariance test).
