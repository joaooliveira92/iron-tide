# 06: Fill empty 1880 fleets and AI-only nation content

**What to build:** Complete the 1880 starting fleets so all fourteen nations are
credible. Today `brazil`, `netherlands`, and `portugal` start with zero ships,
and five nations (`brazil`, `netherlands`, `ottoman_empire`, `portugal`, `spain`)
have zero own designs and zero technologies — the AI-only nations are
placeholders, not opponents. Author historic 1880 ships, designs, and minimal
research seeds per nation. This is the N-2 content-completion lane; N-1 files it
rather than performing it.

**Blocked by:** 01, 04

**Status:** done

- [x] No playable or AI nation starts with an empty fleet: brazil
      (`bra_brasil`), netherlands (`nld_schorpioen`, `nld_buffel`) and portugal
      (`por_vasco_da_gama`) now start with ships. The one remaining empty fleet
      (`fleet_gbr_cape`) carries a documented provenance note (a station with no
      permanently-attached ironclads at the January 1880 start).
- [x] Every nation has at least one own design and a coherent research seed: added
      six 1880-or-earlier designs (Schorpioen, Buffel, Vasco da Gama, Brasil,
      Mesudiye, Numancia) and linked the Ottoman and Spanish starting ships to
      their new designs, so all fourteen nations have own designs; every nation
      already carries a research programme (tickets 04/09) with met prerequisites.
      Each new design carries ESTIMATE provenance (figures are game estimates, not
      sourced measurements); see ADR-0213.
- [x] A deterministic per-nation viability smoke test passes
      (`packages/content-compiler/test/perNationViability.test.ts`; verified red on
      an unknown design reference).

