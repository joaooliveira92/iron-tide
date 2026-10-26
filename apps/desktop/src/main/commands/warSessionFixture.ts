import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCampaignSnapshotEnvelope } from "@bluewave/campaign";
import type { CampaignState, CampaignSnapshot, NationState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore } from "@bluewave/persistence";
import { registerCampaignSession } from "../campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { toSaveableState } from "../saveHelpers.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../../..");
export const GENERATED_ARTIFACT = resolve(REPO_ROOT, "content", "generated", "1880");
export const WAR_SEED = "offer-command-seed-0123456789abcdef";
export const WAR_AREA = "eng_home_coast";

export function warSnapshot(base: CampaignSnapshot): CampaignSnapshot {
  const nations = new Map<string, NationState>(base.nations);
  for (const id of ["uk", "france"]) {
    const nation = nations.get(id);
    if (!nation) throw new Error(`production nation ${id} missing`);
    const ships = nation.fleets
      .flatMap((fleet) => fleet.ships)
      .slice(0, 2)
      .map((ship) => ({
        ...ship,
        locationAreaId: WAR_AREA,
        firepower: SafeInt(200),
        hitPoints: ship.maxHitPoints,
        isUnderConstruction: false,
        readiness: "ACTIVE" as const,
        crewQuality: SafeInt(100),
      }));
    nations.set(id, {
      ...nation,
      fleets: [
        {
          id: `fleet-${id}`,
          nationId: id,
          name: `${id} fleet`,
          ships,
          locationAreaId: WAR_AREA,
        },
      ],
    });
  }
  return {
    ...base,
    nations,
    wars: {
      ...base.wars,
      wars: [
        {
          id: "war_offer",
          attackerSideId: "side_a",
          defenderSideId: "side_d",
          attackerSideMembers: ["uk"],
          defenderSideMembers: ["france"],
          attackerWarScore: 0,
          defenderWarScore: 0,
          attackerId: "uk",
          defenderId: "france",
          startDate: "1880-01",
          status: "ACTIVE",
        },
      ],
      battles: [],
    },
  };
}

export function registerWarSession(sessionId: string, saveDir: string): void {
  const collector = new DiagnosticCollector();
  const output = compileProductionCampaignFromArtifact(
    GENERATED_ARTIFACT,
    new AbortController().signal,
    collector,
  );
  if (collector.hasErrors || !output) throw new Error("production pack failed to compile");
  const base = toSaveableState(output.state);
  const snapshot = warSnapshot(base.snapshot);
  const envelope = createCampaignSnapshotEnvelope(snapshot.compatibilityVersion, snapshot);
  const state: CampaignState = toSaveableState({
    snapshot,
    envelope,
    rawHash: base.rawHash,
  });
  new SaveStore().save(state, saveDir);
  registerCampaignSession({
    sessionId,
    saveDir,
    playerSlotId: "uk",
    campaignSeed: WAR_SEED,
    month: { month: 1, year: 1880 },
    state,
  });
}
