// packages/cross-process-test/src/run-acceleration-child.ts
// INC-4 / SB3-R9: cross-process determinism child for engine-side acceleration. Builds a minimal campaign with one
// accelerated project whose demand puts its construction pool far above the capacity-pressure threshold, runs one
// month with a keyed acceleration-pressure decision, and prints the snapshot hash, the random-decision ledger hash
// and the decisions themselves as JSON for byte-for-byte comparison across two clean processes.
import type {
  CampaignSnapshot,
  CompiledDesignVersion,
  ConstructionPackage,
  ConstructionProject,
  NationState,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { MonthExecutor } from "@bluewave/phase-engine";

const LINES: readonly string[] = [
  "slipway",
  "armour_plate",
  "heavy_gun",
  "machinery",
  "quay",
  "trials",
];

function capacityUnits(perLine: number): Record<string, SafeInt> {
  return Object.fromEntries(LINES.map((line) => [line, SafeInt(perLine)]));
}

function design(): CompiledDesignVersion {
  return {
    designVersionId: "d1",
    designFamilyId: "fam",
    className: "Test",
    nationId: "GBR",
    hullType: "DD",
    normalizedDisplacementKg: SafeInt(1_000_000),
    normalizedSpeedUms: SafeInt(10_000_000),
    normalizedArmorUm: SafeInt(0),
    hitPoints: SafeInt(100),
    mainGunsCaliber: SafeInt(0),
    mainGunsCount: SafeInt(0),
    machineryType: "steam",
    crewComplement: SafeInt(10),
    contentVersion: "t",
    compiledHash: "h",
    constructionCostUnits: SafeInt(600),
    constructionPlan: { yardId: "yard_small", packages: [], capacityUnits: capacityUnits(10) },
  };
}

function packages(): ConstructionPackage[] {
  return LINES.map((line, index) => ({
    id: `pkg-${String(index)}`,
    kind: "HULL",
    line,
    totalWork: SafeInt(100),
    doneWork: SafeInt(0),
    dependsOn: [],
  }));
}

function project(): ConstructionProject {
  return {
    id: "proj-1",
    type: "ship",
    projectType: "NEW_CONSTRUCTION",
    targetId: "ship-x",
    designVersionId: "d1",
    totalWork: SafeInt(600),
    completedWork: SafeInt(0),
    paidWork: SafeInt(0),
    status: "ACCELERATED",
    startedAt: "1880-01",
    packages: packages(),
  };
}

function nation(): NationState {
  return {
    id: "GBR",
    name: "Great Britain",
    tag: "GBR",
    treasury: SafeInt(1_000),
    income: SafeInt(0),
    expenses: SafeInt(0),
    baseResources: SafeInt(1_200),
    navalAppropriationRateBp: SafeInt(2_000),
    maintenanceCost: SafeInt(0),
    fleets: [],
    divisions: [],
    research: {
      nationId: "GBR",
      technologies: [],
      fieldPriorities: {},
      researchBudget: SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [],
    },
    constructionProjects: [project()],
    isPlayable: true,
    isAI: false,
  };
}

function snapshot(): CampaignSnapshot {
  return {
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "acceleration-cross-process",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "GBR", type: "playable" }],
    world: { areas: [], routes: [], ports: [] },
    nations: new Map([["GBR", nation()]]),
    wars: {
      wars: [],
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    },
    politics: { relations: [], shells: {} },
    intelligence: { shells: {} },
    designs: new Map([["d1", design()]]),
    designFamilies: new Map(),
    rulesetVersion: "0.1.0",
    compatibilityVersion: "1.2.0",
  };
}

function run(): void {
  try {
    const result = new MonthExecutor().execute(
      snapshot(),
      [],
      "accel-cross-process-seed",
      new DiagnosticCollector(),
    );
    const output = {
      snapshotHash: sha256Hex(canonicalSerialize(result.finalSnapshot)),
      randomLedgerHash: result.randomLedger.hash(),
      decisions: result.randomLedger.all.map((d) => ({
        streamId: d.streamId,
        entityKey: d.entityKey,
        draw: d.draw,
        outcome: d.outcome,
        reasonCode: d.reasonCode,
      })),
      success: result.success,
    };
    process.stdout.write(JSON.stringify(output) + "\n");
  } catch (err) {
    process.stdout.write(
      JSON.stringify({
        snapshotHash: "",
        randomLedgerHash: "",
        decisions: [],
        success: false,
        error: String(err),
      }) + "\n",
    );
  }
}

run();
