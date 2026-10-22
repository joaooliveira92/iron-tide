import { describe, expect, it, vi } from "vite-plus/test";
import type { PlayerProjection } from "@bluewave/campaign-engine";

import type { CampaignCommandClient } from "../../shared/campaign-contract.js";
import { activeAlertsCount, readCampaign } from "./campaign-reads.js";

const projection: PlayerProjection = {
  campaignIdentity: "campaign_1",
  snapshotHash: "hash_abc",
  revision: 4,
  month: { year: 1900, month: 2 },
  playerNationId: "uk",
  nationName: "United Kingdom",
  projectedSurplusDeficit: 1200,
  economy: {
    treasury: 50_000,
    monthlyAppropriation: 5000,
    shipyardCapacity: 7,
    constructionSpend: 1000,
    researchSpend: 800,
    maintenanceCost: 2000,
    obligations: 500,
    researchRequested: 800,
    researchCap: 600,
    plannedConstruction: 1000,
    projectedNet: 1200,
    shortfall: 0,
    status: "healthy",
    monthEndTreasury: 51_200,
  },
  knownTechnologyIds: [],
  fleet: [],
  strategicAreas: [],
  ports: [],
  knownEnemyNations: [],
  commandWorkspace: { commands: [], movementCommands: [] },
};

const priorities = [
  { severity: "critical", id: "a" },
  { severity: "warning", id: "b" },
  { severity: "advisory", id: "c" },
];

const ok = <T>(value: T) => ({
  outcome: "success" as const,
  value,
  diagnostics: [],
});

function clientWith(handler: (command: string) => unknown): {
  readonly client: CampaignCommandClient;
  readonly execute: ReturnType<typeof vi.fn>;
} {
  const execute = vi.fn();
  execute.mockImplementation(async (command: string) => handler(command));
  const client: CampaignCommandClient = { execute };
  return { client, execute };
}

describe("readCampaign", () => {
  it("reads every campaign view exactly once for the session", async () => {
    const { client, execute } = clientWith((command) => {
      if (command === "inspectCampaign") return ok({ projection });
      if (command === "inspectMap") return ok({ strategic: { world: { areas: [] } } });
      if (command === "readMonthlyReports") return ok({ reports: [] });
      return ok({ priorities });
    });

    const reads = await readCampaign(client, "ses-1");

    expect(execute).toHaveBeenCalledTimes(4);
    expect(execute).toHaveBeenCalledWith("inspectCampaign", "ses-1");
    expect(execute).toHaveBeenCalledWith("inspectMap", "ses-1");
    expect(execute).toHaveBeenCalledWith("readMonthlyReports", "ses-1");
    expect(execute).toHaveBeenCalledWith("inspectPriorities", "ses-1");
    expect(reads.projection).toEqual({ status: "ready", value: projection });
    expect(reads.areas).toEqual({ status: "ready", value: [] });
    expect(reads.reports).toEqual({ status: "ready", value: [] });
    expect(reads.priorities).toEqual({ status: "ready", value: priorities });
  });

  it("keeps the projection readable when an optional view fails", async () => {
    const { client } = clientWith((command) =>
      command === "inspectCampaign"
        ? ok({ projection })
        : {
            outcome: "rejected",
            reason: `${command.toUpperCase()}_FAILED`,
            diagnostics: [],
          },
    );
    const reads = await readCampaign(client, "ses-1");

    expect(reads.projection).toEqual({ status: "ready", value: projection });
    expect(reads.areas).toEqual({
      status: "unavailable",
      reason: "INSPECTMAP_FAILED",
    });
    expect(reads.reports).toEqual({
      status: "unavailable",
      reason: "READMONTHLYREPORTS_FAILED",
    });
    expect(reads.priorities).toEqual({
      status: "unavailable",
      reason: "INSPECTPRIORITIES_FAILED",
    });
  });

  it("folds a transport throw into the same unavailable shape", async () => {
    const { client } = clientWith((command) => {
      if (command === "inspectCampaign") throw new Error("bridge down");
      return ok({});
    });
    const reads = await readCampaign(client, "ses-1");

    expect(reads.projection).toEqual({
      status: "unavailable",
      reason: "bridge down",
    });
  });

  it("derives the alert count from the priorities read, or null when unavailable", async () => {
    const ready = clientWith((command) =>
      command === "inspectPriorities" ? ok({ priorities }) : ok({}),
    );
    expect(activeAlertsCount(await readCampaign(ready.client, "ses-1"))).toBe(2);

    const unavailable = clientWith(() => ({
      outcome: "rejected",
      reason: "NO",
      diagnostics: [],
    }));
    expect(activeAlertsCount(await readCampaign(unavailable.client, "ses-1"))).toBeNull();
  });
});
