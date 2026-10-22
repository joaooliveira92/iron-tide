import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { toStr } from "./campaignInput.js";
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
  const nationIds = [...nations.keys()].sort((a, b) => a.localeCompare(b));
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
  diplomacyData: unknown[],
  nations: Map<string, NationState>,
  collector: DiagnosticCollector,
): PoliticalState {
  const relations: DiplomaticRelation[] = [];
  const seen = new Set<string>();

  for (const r of diplomacyData) {
    const rRec = r as Record<string, unknown>;
    const nationA = toStr(rRec["nationA"], "");
    const nationB = toStr(rRec["nationB"], "");
    if (nationA === nationB) {
      collector.addError(
        "INVALID_DIPLOMATIC_PAIR_REGISTRY",
        `Self-relation for nation ${nationA} is not allowed`,
        { stage: "campaign-compile" },
      );
      continue;
    }
    const relation = (rRec["relation"] as DiplomaticRelation["relation"]) ?? "neutral";

    let tension = 5;
    const authoredTension = rRec["tension"];
    if (typeof authoredTension === "number") {
      if (authoredTension < 0 || authoredTension > 10) {
        collector.addError(
          "TENSION_OUT_OF_RANGE",
          `Tension ${authoredTension} for pair ${nationA}/${nationB} is outside 0..10`,
          { stage: "campaign-compile" },
        );
      } else {
        tension = authoredTension;
      }
    }
    const nap = rRec["nap"] === true;

    relations.push({
      nationA,
      nationB,
      relation,
      tension,
      nap,
      since: toStr(rRec["since"], "1880-01"),
    });
    seen.add(pairKey(nationA, nationB));
  }

  enforcePairRegistry(relations, seen, nations);

  relations.sort((a, b) =>
    pairKey(a.nationA, a.nationB).localeCompare(pairKey(b.nationA, b.nationB)),
  );
  return { relations, shells: {} };
}
