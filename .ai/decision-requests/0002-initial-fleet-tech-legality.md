# Decision Request: Initial-fleet ship legality — per-nation completed techs or the global 1880 tech set

## Status

Blocked pending owner decision.

## Trigger

N-1 ticket 01 (`.scratch/n-1-1880-scenario-audit/issues/01-initial-fleet-tech-legality.md`)
requires a deterministic rule for whether every starting ship in the 1880 scenario
is legal under 1880 technology. Two readings are plausible and are not decidable
from the code or content as they stand:

1. **Per-nation completed techs** — a ship is legal only if its nation has
   _completed_ every technology its design requires.
2. **Global 1880 tech set** — a ship is legal if the technologies its design
   requires were available by 1880 (year ≤ 1880) _globally_; naval research gates
   new construction, modernization and design, not inherited service.

The choice changes which starting fleets are legal and materially changes the
scope of ticket 04 (research/tech seed reconciliation). Ticket 01 must not be
implemented, and ticket 04 must not start, until the rule is chosen.

## Evidence

- N-1 report F1 (`.ai/reports/n-1-1880-scenario-audit.md`): 6 of 20 starting
  ships carry no `designVersionId` (`aut_custoza`, `fra_courbet`,
  `fra_devastation`, `ott_mesudiye`, `esp_numancia`, `gbr_malta_temp`); ships
  carry hand-authored `hitPoints/speed/firepower/armor`; no compiler stage, test
  or runtime path links a starting ship to the components or technologies it
  needs, so "legal under 1880 tech" cannot be certified either way today.
- F4: completed techs are uneven (`uk` 8 … five nations 0); eight nations own
  ironclads but lack the implied 1880 build set (`sd_ironclad_design` +
  `gun_breech_rifled` + `mac_compound_engine`); Austria's active project
  `gun_qf_light` requires an unmet `gun_breech_rifled`.
- The only ship↔technology gate is the designer-side `unlockedTechs`, keyed off
  the _global_ technology `year`, never a nation's `completedTechs`
  (`packages/ship-design/src/shipBuildingContent.ts:144`,
  `packages/ship-design/src/shipBuildingContent.ts:254`,
  `packages/ship-design/src/armamentContent.ts:403`,
  `packages/ship-design/src/armamentContent.ts:475`).
- The 1880-legal (year ≤ 1880) set is: `hc_wrought_iron_hull`,
  `mac_compound_engine`, `sd_ironclad_design`, `gun_breech_rifled`,
  `torp_whitehead_torpedo`, `m_asw_contact_mine`, `m_asw_spar_torpedo`,
  `infra_dry_dock`, `infra_coaling_station`, `dc_iron_subdivision`
  (`content/production/1880/technologies.yaml`).
- No ADR covers initial-fleet legality; ADR-0210 fixes the authority order
  (accepted decisions → roadmap/plan → manual → tests → production content →
  implementation → new research) but does not settle this.
- Content: `content/production/1880/fleets.yaml`, `designs.yaml`,
  `research.yaml`, `technologies.yaml`.

## Why agent judgment is insufficient

The two readings are not equivalent defects — they change the meaning of the
naval research tree and the opening state of the sole playable scenario:

- Under reading 1, roughly eight nations' starting ironclads are illegal as
  authored, so either every such ship must be re-authored or every such nation's
  tech seed must be expanded to cover its fleet (ticket 04 becomes large and
  content-defining), and each ship must be linked to a design and its required
  technology set (ticket 01).
- Under reading 2, the fleets are legal as authored and only the construction /
  design / modernization paths are gated; ticket 04 shrinks to consistency fixes.

Either changes which opening fleets are playable and how much research content is
authored — a product/design call, not a defect to infer from the code. The N-1
audit deliberately left it unresolved ("not guessed").

## Options

### Option A: Per-nation completed techs (strict)

- Behavior: a starting ship is legal only if its nation has completed every
  technology the ship's design requires.
- Advantages: research state fully explains what a nation may field; tightest
  model; makes tech completion directly observable in the OOB.
- Risks: historical OOB becomes illegal unless nations' tech seeds are expanded
  to cover their fleets; depends on authored ship↔design↔tech links that do not
  exist yet; some historical ships may map to no modeled technology.
- Compatibility impact: none (no wire/schema change).
- Migration impact: content only.
- Scope and effort: L (tickets 01 + 04 both large and coupled).

### Option B: Global 1880 tech set (grandfathering)

- Behavior: a starting ship is legal if the technologies its design requires were
  available by 1880 (year ≤ 1880) globally; research gates new construction,
  modernization and design, not inherited service.
- Advantages: historical OOB stays content truth; matches how real navies field
  legacy ships alongside newer building; keeps research about the future; smaller
  and safer change; consistent with the existing global-`year` gate.
- Risks: a nation with little research may still sail ships it could not build
  today — which is historically accurate but must be documented so it is not read
  as a bug.
- Compatibility impact: none.
- Migration impact: content only.
- Scope and effort: M (ticket 01 links ships to designs + an exemption path;
  ticket 04 becomes consistency fixes).

## Recommendation

**Option B**, with an explicit per-ship exemption mechanism (a documented reason
instead of a fabricated design/tech link) for any starting ship that cannot be
tied to a design, recorded as an ADR. Rationale: naval research is a
construction/modernization gate rather than a service gate; the starting OOB is
canonical content truth (ADR-0210); and B is the reading F1/F4 point to with the
smaller, safer change surface. Do not implement the disputed rule before approval.

## Work safely completed while blocked

- N-1 audit committed (`93dfd3a`).
- Ticket 02 (era gating of the construction design catalog and the order policy,
  `DESIGN_NOT_YET_AVAILABLE`) implemented and committed (`472316b`) — independent
  of D1.
