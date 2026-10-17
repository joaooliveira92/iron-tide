# 09: Seed active research projects for idle nations

**What to build:** Seven nations (`brazil`, `japan`, `netherlands`,
`ottoman_empire`, `portugal`, `qing`, `spain`) start with no
`currentProjectTechId`, and every nation starts with empty `activeCandidates`
and `discoveredTechs`. Seed a sensible opening research project per nation so
turn 1 already has research movement, consistent with the nation's field
priorities.

**Blocked by:** 04

**Status:** done

- [x] Every nation with a research budget above zero starts with an active project
      whose prerequisites are met: seeded `gun_breech_rifled` (GUNNERY-matched) for
      japan, qing, ottoman_empire and spain, and `mac_compound_engine` for
      netherlands, portugal and brazil.
- [x] A deterministic test asserts no nation begins idle while funded
      (`packages/content-compiler/test/initialResearchActivity.test.ts`; verified
      red with japan's project removed).
