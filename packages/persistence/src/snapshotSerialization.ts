import type {
  CampaignSnapshot,
  CompiledDesignVersion,
  DesignFamily,
  NationState,
  ResearchState,
} from "@bluewave/campaign";

type StorableResearchState = Omit<ResearchState, "activeCandidates"> & {
  activeCandidates: Record<string, string>;
};

type StorableNationState = Omit<NationState, "research"> & {
  research: StorableResearchState;
};

export type StorableCampaignSnapshot = Omit<
  CampaignSnapshot,
  "nations" | "designs" | "designFamilies"
> & {
  nations: Record<string, StorableNationState>;
  designs: Record<string, CompiledDesignVersion>;
  designFamilies: Record<string, DesignFamily>;
};

function mapToRecord<V>(map: Map<string, V>): Record<string, V> {
  return Object.fromEntries(map);
}

function recordToMap<V>(record: Record<string, V>): Map<string, V> {
  return new Map(Object.entries(record));
}

export function toStorableSnapshot(snapshot: CampaignSnapshot): StorableCampaignSnapshot {
  const nations: Record<string, StorableNationState> = {};
  for (const [nationId, nation] of snapshot.nations) {
    nations[nationId] = {
      ...nation,
      research: {
        ...nation.research,
        activeCandidates: mapToRecord(nation.research.activeCandidates),
      },
    };
  }

  return {
    ...snapshot,
    nations,
    designs: mapToRecord(snapshot.designs),
    designFamilies: mapToRecord(snapshot.designFamilies),
  };
}

export function fromStorableSnapshot(storable: StorableCampaignSnapshot): CampaignSnapshot {
  const nations = new Map<string, NationState>();
  for (const [nationId, nation] of Object.entries(storable.nations)) {
    nations.set(nationId, {
      ...nation,
      research: {
        ...nation.research,
        activeCandidates: recordToMap(nation.research.activeCandidates),
      },
    });
  }

  return {
    ...storable,
    nations,
    designs: recordToMap(storable.designs),
    designFamilies: recordToMap(storable.designFamilies),
  };
}
