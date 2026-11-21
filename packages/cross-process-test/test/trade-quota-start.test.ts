import { tradeProtectionQuota } from "@bluewave/campaign";
import { CampaignCompiler } from "@bluewave/campaign/compiler";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { CURRENT_COMPATIBILITY_VERSION } from "@bluewave/persistence";
import { describe, expect, it } from "vite-plus/test";

import { compileProductionBundle } from "../src/production-pack.js";
import { fleetManagementOptions } from "../src/replay-corpus/corpus.js";

const SEEDS = ["0123456789abcdef0123456789abcdef", "fedcba9876543210fedcba9876543210"];
const PLAYABLE = [
  "austria_hungary",
  "france",
  "germany",
  "italy",
  "japan",
  "qing",
  "russia",
  "spain",
  "uk",
  "usa",
] as const;
const MAX_SHARE_OF_CONTRIBUTING_BP = 7500;

const { bundle, contentHash } = compileProductionBundle();
const rules = fleetManagementOptions("uk").tradeProtection!;

function startingNations(campaignSeed: string) {
  const output = new CampaignCompiler().compile(
    {
      contentBundle: bundle,
      contentHash,
      rulesetVersion: "1.0",
      compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
      legacyFleet: { campaignSeed, scaleBp: 10_000 },
    },
    new AbortController().signal,
    new DiagnosticCollector(),
  );
  return output!.state.snapshot;
}

function startingQuota(snapshot: ReturnType<typeof startingNations>, nationId: string) {
  const nation = snapshot.nations.get(nationId)!;
  const operational = nation.fleets
    .flatMap((f) => f.ships)
    .filter((s) => s.nationId === nationId && !s.isUnderConstruction);
  const contributing = operational.filter((s) => {
    const design = snapshot.designs.get(s.designVersionId);
    return design !== undefined && rules.contributingHullTypes.includes(design.hullType);
  }).length;
  const quota = tradeProtectionQuota(rules, operational.length, Number(nation.baseResources));
  return { quota, contributing };
}

describe("1880 starting trade-protection quota (#1042)", () => {
  for (const seed of SEEDS) {
    const snapshot = startingNations(seed);
    for (const nationId of PLAYABLE) {
      it(`keeps the ${nationId} quota within reach of its contributing ships (${seed.slice(0, 4)})`, () => {
        const { quota, contributing } = startingQuota(snapshot, nationId);
        expect(quota).toBeGreaterThanOrEqual(1);
        expect(quota * 10_000).toBeLessThanOrEqual(contributing * MAX_SHARE_OF_CONTRIBUTING_BP);
      });
    }

    it(`still scales the quota with the economy (${seed.slice(0, 4)})`, () => {
      const uk = startingQuota(snapshot, "uk").quota;
      const austria = startingQuota(snapshot, "austria_hungary").quota;
      const spain = startingQuota(snapshot, "spain").quota;
      expect(uk).toBeGreaterThan(austria);
      expect(austria).toBeGreaterThanOrEqual(spain);
    });
  }
});
