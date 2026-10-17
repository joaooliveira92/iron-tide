# 01: Model initial-fleet ship legality against 1880 technology

**What to build:** A deterministic check that every starting ship in the 1880
scenario is legal under the technology available at 1880-01, and the content
edits the check proves are needed. Today fleet ships in
`content/production/1880/fleets.yaml` carry hand-authored stats with no link to
a design or technology, and 6 of 20 ships have no `designVersionId` at all
(`aut_custoza`, `fra_courbet`, `fra_devastation`, `ott_mesudiye`, `esp_numancia`,
`gbr_malta_temp`). Resolve open decision **D1** first (see
`.ai/reports/n-1-1880-scenario-audit.md`): is legality judged against each
nation's completed techs, or against the global 1880 tech set? Then give every
starting ship a resolvable design (or an explicit, documented exemption), and
add a test that drives the compiled 1880 snapshot and asserts legality.

**Blocked by:** None (can start immediately). Requires decision D1 before the
rule can be fixed.

**Status:** done

- [x] D1 recorded as an ADR: ADR-0212 (global 1880 tech set; research gates new
      construction, modernization and design, not inherited service).
- [x] Every starting ship resolves to a design, or carries a documented exemption
      (`packages/content-compiler/test/initialFleetLegality.test.ts`).
- [x] A deterministic test compiles the 1880 pack and fails when any starting ship
      is illegal under the chosen rule (verified red on a 1906 design link, green
      on the shipped content).
- [x] The design-less starting ships are exempted with a reason: `aut_custoza`,
      `gbr_malta_temp`, `ott_mesudiye`, `esp_numancia`. The two French hulls
      (`fra_courbet`, `fra_devastation`) gained the `des_fra_devastation` design
      in ticket 03; the UK placeholder is resolved in ticket 08.

