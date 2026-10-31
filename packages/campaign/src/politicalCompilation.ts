import { compareCodePoints } from "@bluewave/deterministic";
import type { CampaignDiplomacy } from "@bluewave/content-schema";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import type { DiplomaticRelation, NationState, PoliticalState, WarState } from "./state.js";

export function buildWarState(): WarState {
  return {
    wars: [],
    battles: [],
    participantMemberships: [],
    blockadeState: [],
    battleManifests: [],
  };
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("\u0000");
}

function enforcePairRegistry(
  relations: DiplomaticRelation[],
  seen: Set<string>,
  nations: Map<string, NationState>,
): void {
  const nationIds = [...nations.keys()].sort((a, b) => compareCodePoints(a, b));
  for (let i = 0; i < nationIds.length; i++) {
    for (let j = i + 1; j < nationIds.length; j++) {
      const a = nationIds[i]!;
      const b = nationIds[j]!;
      const key = pairKey(a, b);
      if (!seen.has(key)) {
        relations.push({
          nationA: a,
          nationB: b,
          relation: "neutral",
          tension: 5,
          nap: false,
          since: "1880-01",
        });
        seen.add(key);
      }
    }
  }
}

export function buildPoliticalState(
  diplomacyData: readonly CampaignDiplomacy[],
  nations: Map<string, NationState>,
  collector: DiagnosticCollector,
): PoliticalState {
  const relations: DiplomaticRelation[] = [];
  const seen = new Set<string>();

  for (const r of diplomacyData) {
    const nationA = r.nationA;
    const nationB = r.nationB;
    if (nationA === nationB) {
      collector.addError(
        "INVALID_DIPLOMATIC_PAIR_REGISTRY",
        `Self-relation for nation ${nationA} is not allowed`,
        { stage: "campaign-compile" },
      );
      continue;
    }
    const relation = r.relation;
    const tension = r.tension ?? 5;
    const nap = r.nap === true;

    relations.push({
      nationA,
      nationB,
      relation,
      tension,
      nap,
      ...(r.frictionBp === undefined ? {} : { frictionBp: r.frictionBp }),
      since: r.since ?? "1880-01",
    });
    seen.add(pairKey(nationA, nationB));
  }

  enforcePairRegistry(relations, seen, nations);

  relations.sort((a, b) =>
    compareCodePoints(pairKey(a.nationA, a.nationB), pairKey(b.nationA, b.nationB)),
  );
  return { relations, shells: {} };
}
