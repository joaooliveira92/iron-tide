# ADR-0310: E-1 catalogue technologies for carrier, mine and submarine engine ids

## Status

Accepted (2026-10-26) for [#294](https://github.com/joaooliveira92/iron-tide/issues/294),
[#297](https://github.com/joaooliveira92/iron-tide/issues/297) and
[#298](https://github.com/joaooliveira92/iron-tide/issues/298), part of
[#278](https://github.com/joaooliveira92/iron-tide/issues/278) under
[#249](https://github.com/joaooliveira92/iron-tide/issues/249). Applies
[ADR-0297](ADR-0297-engine-reads-catalogue-technology-ids.md): the catalogue is the source and the engine id moves.
Values follow the `BALANCE_TARGET` policy of [ADR-0283](ADR-0283-e1-1940-1970-content-decisions.md) and
[ADR-0239](ADR-0239-s2-prestige-values-balance-targets.md).

## Context

Five engine constants gated on technology ids no catalogue entry carried, so researching the authored
technology changed nothing: `modern_jet_carrier_operations`, `controlled_mine_technology`,
`minelaying_submarine_technology`, `missile_submarine_technology`, and the four aviation ids in
`hasAviationTech`. ADR-0297 deliberately left them named because the catalogue had no counterpart and
choosing one would invent a mapping; the remaining sourcing was split into #294, #297 and #298.

## Decision

1. **Author one catalogue technology per missing id**, dated from the historical-analogue policy and
   marked `BALANCE_TARGET` because the manual gives no technology date or cost (manual pp.33-36,
   72-74, 102-120, 121-123). The research record is
   [`e-1-1940-1970-timeline.md`](../research/e-1-1940-1970-timeline.md), "Catalogue-id alignment
   candidates".
2. **Move the engine constants to the authored ids.**

   | Before | After | Year |
   | --- | --- | --- |
   | `modern_jet_carrier_operations` | `cop_heavy_jet_operations` | 1955 |
   | `controlled_mine_technology` | `m_asw_controlled_mine` | 1890 |
   | `minelaying_submarine_technology` | `sub_minelaying` | 1916 |
   | `missile_submarine_technology` | `sub_missile` | 1955 |
   | `early_aviation`, `aviation`, `flight`, `basic_aviation` | `av_early_aviation` | 1912 |

   The constants live in their owning module (`carrier-operations`, `mines`, `submarines`,
   `phase-engine`), and a cross-process drift test fails if one leaves the production catalogue.
3. **Costs and discovery weights are copied from the nearest existing technology** in the same field
   and named in each entry's provenance note; no value is invented without a stated derivation.
4. **Aircraft development now starts from research.** `hasAviationTech` reads the one authored id, so
   the monthly aircraft phase can begin for a nation that discovers it. The 1880 production start
   researches nothing below 1880, and the changed behaviour is limited to a campaign that reaches
   1912 and researches aviation.

## Compatibility

A content change, so the content hash and lock move and every replay is re-recorded. The mine and
submarine modules remain dormant per [ADR-0300](ADR-0300-unreachable-combat-modules-wire-by-owner-dormant-until-then.md),
so their ids change no battle. The replay approvals carry `EXPECTED_GAMEPLAY_CHANGE` because the
aviation gate is a real behavioural change for a long campaign, even though the recorded months do
not reach it.

## Consequences

- #278 can close once this lands; #292, #293, #295 and #296 keep their own values and reachability work.
- A later edits to any of these years or costs is a content change with a new lock and replay approvals.
- The `technologies.yaml` notes for the earlier ADR-0297 mappings can be corrected with the next
  content change without changing the meaning recorded here.
