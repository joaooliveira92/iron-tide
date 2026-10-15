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

**Status:** ready-for-agent

- [ ] No nation's `currentProjectTechId` has an unfinished prerequisite.
- [ ] Technology seeds are consistent with starting fleets under the D1 rule.
- [ ] A deterministic test asserts project prerequisites hold for every nation.

