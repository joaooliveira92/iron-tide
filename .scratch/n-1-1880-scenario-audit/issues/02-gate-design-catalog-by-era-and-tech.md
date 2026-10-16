# 02: Gate the construction design catalog by era and technology

**What to build:** Stop the 1880 construction catalog from offering later-era
designs. `buildConstructionDesignCatalog` returns every nation design, hardcodes
`requiredTechnologyIds: []`, and exposes only an informational `year`, so a 1880
player can see and start a 1906–1937 design (UK: Dreadnought 1906 … King George V
1937; Japan: Kongō 1913 … Yamato 1937). Make the catalog treat designs as
unavailable until their era/technology is reached, and make the start-construction
path refuse an unavailable design with a stable reason code rather than silently
accepting an anachronism.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] A design whose `familyCreationMonth` year is after the campaign year is not
      offered as buildable (or is clearly marked unavailable) at 1880.
- [x] Starting construction of an unavailable design fails with a stable reason code.
- [x] A deterministic test drives the compiled 1880 snapshot and asserts no
      post-1880 design is buildable.

Done by gating the catalog (`available`) and the order policy (reason code
`DESIGN_NOT_YET_AVAILABLE`) on one shared rule, `isDesignBuildableByYear`
(family year ≤ campaign year; no family year is never gated). The catalog still
lists later-era designs for information; the picker disables and marks them
"Not yet available".

