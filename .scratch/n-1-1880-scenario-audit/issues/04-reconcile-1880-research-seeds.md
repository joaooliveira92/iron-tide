# 04: Reconcile per-nation 1880 research and technology seeds

**What to build:** Make each nation's starting technology and active project
coherent. Completed techs range from 0 to 8 and eight nations that own ironclads
lack the implied 1880 build set (`sd_ironclad_design` + `gun_breech_rifled` +
`mac_compound_engine`); Austria's active project `gun_qf_light` has an unmet
prerequisite (`gun_breech_rifled`). Re-seed
`content/production/1880/research.yaml` so no active project has an unmet
prerequisite and each nation's completed set is consistent with the ships it
fields (per decision D1 in ticket 01).

**Blocked by:** 01

**Status:** done

- [x] No nation's `currentProjectTechId` has an unfinished prerequisite
      (fixed Austria-Hungary, which researched `gun_qf_light` without
      `gun_breech_rifled`; the technology is now seeded as completed, matching
      Germany and Austria's historical breech-loading guns).
- [x] Technology seeds are consistent with starting fleets under the D1 rule
      (ADR-0212: research gates new build/modernization/design, not inherited
      ships, so no fleet-driven completed set is required; every completed
      technology's own prerequisites are completed).
- [x] A deterministic test asserts project prerequisites hold for every nation
      (`packages/content-compiler/test/initialResearchCoherence.test.ts`; verified
      red on the unmet Austria prerequisite).

