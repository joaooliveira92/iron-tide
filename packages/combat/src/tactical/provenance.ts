import { BluewaveError } from "@bluewave/contracts";

export const TACTICAL_PROVENANCE_INVALID = "TACTICAL_PROVENANCE_INVALID" as const;
export const TEMPORARY_ASSET_PROVENANCE_INVALID = "TEMPORARY_ASSET_PROVENANCE_INVALID" as const;

// DESIGN-26 §23 campaign asset provenance.
export interface CampaignAssetProvenance {
  battleAssetId: string;
  campaignAssetId: string;
  campaignAggregateType: string;
  sourcePermanentDivisionId: string | null;
  sourceCompiledDesignId: string;
  sourceCompiledDesignHash: string;
  preBattleStateHash: string;
  projectionReason: string;
  persistenceDisposition: string;
  provenanceHash: string;
}

// DESIGN-26 §24 temporary asset provenance.
export interface TemporaryAssetProvenance {
  temporaryAssetId: string;
  generatorIdentifier: string;
  generatorVersion: string;
  battleManifestId: string;
  canonicalSourceType: string;
  creationReason: string;
  battleSeedReference: string;
  persistenceDisposition: string;
  campaignConsequencePolicy: string;
  provenanceHash: string;
}

export function assertProvenanceUnique(
  provenances: ReadonlyArray<Pick<CampaignAssetProvenance, "campaignAssetId" | "battleAssetId">>,
  context?: Record<string, unknown>,
): void {
  const seen = new Set<string>();
  for (const p of provenances) {
    const key = p.campaignAssetId;
    if (seen.has(key)) {
      throw new BluewaveError(TACTICAL_PROVENANCE_INVALID, {
        code: TACTICAL_PROVENANCE_INVALID,
        campaignAssetId: key,
        ...context,
      });
    }
    if (!p.battleAssetId) {
      throw new BluewaveError(TACTICAL_PROVENANCE_INVALID, {
        code: TACTICAL_PROVENANCE_INVALID,
        campaignAssetId: key,
        reason: "missing battleAssetId",
        ...context,
      });
    }
    seen.add(key);
  }
}

export function assertTacticProvenanceUnique(
  provenances: ReadonlyArray<Pick<TemporaryAssetProvenance, "temporaryAssetId">>,
  context?: Record<string, unknown>,
): void {
  const seen = new Set<string>();
  for (const p of provenances) {
    if (seen.has(p.temporaryAssetId)) {
      throw new BluewaveError(TEMPORARY_ASSET_PROVENANCE_INVALID, {
        code: TEMPORARY_ASSET_PROVENANCE_INVALID,
        temporaryAssetId: p.temporaryAssetId,
        ...context,
      });
    }
    seen.add(p.temporaryAssetId);
  }
}
