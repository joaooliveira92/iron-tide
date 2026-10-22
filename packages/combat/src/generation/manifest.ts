import { BluewaveError } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { BATTLE_MANIFEST_INVALID } from "./reasonCodes.js";
import type { TacticalSideId } from "../tactical/state.js";
import type { TacticalDivision } from "../tactical/division.js";
import type {
  AirDefenseInstallationDeclaration,
  AirGroupDeclaration,
  SmokeSourceDeclaration,
} from "./capabilities.js";

export const MANIFEST_HASH_V1 = "manifest_hash_v1" as const;

export interface BattleManifest {
  battleId: string;
  opportunityId: string;
  warId: string;
  areaId: string;
  missionType: string;
  attackerId: string;
  defenderId: string;
  acceptanceClass: string;
  missionObjectives: string[];
  sides: Array<{ sideId: TacticalSideId; participantIds: string[] }>;
  persistentAssets: string[];
  temporaryAssets: string[];
  permanentDivisionIds: string[];
  tacticalDivisions: TacticalDivision[];
  commanders: string[];
  weather: string;
  seaState: string;
  visibility: string;
  environment: string;
  sourceStateHashes: Record<string, string>;
  reservations: string[];
  autoResolutionProof: string;
  provenanceRecords: string[];
  battleSeed: string;
  rulesetVersion: string;
  formulaVersion: string;
  aiPolicyVersion: string;
  rngVersion: string;
  contentVersion: string;
  manifestHash: string;
  smokeSources?: SmokeSourceDeclaration[];
  airGroups?: AirGroupDeclaration[];
  airDefenseInstallations?: AirDefenseInstallationDeclaration[];
}

export function canonicalizeManifest(manifest: BattleManifest): BattleManifest {
  const canonical: BattleManifest = {
    ...manifest,
    sides: manifest.sides.map((s) => ({
      sideId: s.sideId === "DEFENDER" ? "DEFENDER" : "ATTACKER",
      participantIds: [...s.participantIds].sort(),
    })),
    permanentDivisionIds: [...manifest.permanentDivisionIds].sort(),
    persistentAssets: [...manifest.persistentAssets].sort(),
    temporaryAssets: [...manifest.temporaryAssets].sort(),
    missionObjectives: [...manifest.missionObjectives].sort(),
    commanders: [...manifest.commanders].sort(),
    reservations: [...manifest.reservations].sort(),
    provenanceRecords: [...manifest.provenanceRecords].sort(),
    sourceStateHashes: Object.fromEntries(
      Object.entries(manifest.sourceStateHashes).sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
  return canonical;
}

export function computeManifestHash(manifest: BattleManifest): string {
  const { battleSeed: _seed, manifestHash: _hash, ...preSeed } = canonicalizeManifest(manifest);
  return sha256Hex(canonicalSerialize({ version: MANIFEST_HASH_V1, manifest: preSeed }));
}

export function assertManifestValid(
  manifest: BattleManifest,
  context?: Record<string, unknown>,
): void {
  const required = [
    manifest.battleId,
    manifest.opportunityId,
    manifest.warId,
    manifest.areaId,
    manifest.missionType,
    manifest.attackerId,
    manifest.defenderId,
    manifest.acceptanceClass,
  ];
  if (required.some((v) => !v)) {
    throw new BluewaveError(BATTLE_MANIFEST_INVALID, {
      code: BATTLE_MANIFEST_INVALID,
      reason: "missing required field",
      ...context,
    });
  }
  if (manifest.sides.length !== 2) {
    throw new BluewaveError(BATTLE_MANIFEST_INVALID, {
      code: BATTLE_MANIFEST_INVALID,
      reason: "must have exactly two sides",
      sides: manifest.sides.length,
      ...context,
    });
  }
}

export function buildManifest(
  base: Omit<BattleManifest, "battleSeed" | "manifestHash">,
): BattleManifest {
  const pre: BattleManifest = { ...base, battleSeed: "", manifestHash: "" };
  assertManifestValid(pre);
  const canonical = canonicalizeManifest(pre);
  const hash = computeManifestHash(canonical);
  return { ...canonical, manifestHash: hash };
}
