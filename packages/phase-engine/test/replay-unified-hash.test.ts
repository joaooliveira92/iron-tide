import type { CampaignSnapshot } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor, ReplayVerifier, unifiedSnapshotHash } from "../src/index.js";
import { makeBattleSnapshot } from "./battle-fixtures.js";

function replay(snapshot: CampaignSnapshot, expectedHash: string) {
  return new ReplayVerifier().verify(
    snapshot,
    [],
    new MonthExecutor().execute(snapshot, [], "unified-replay-seed", new DiagnosticCollector())
      .commandLedger,
    expectedHash,
    "unified-replay-seed",
    new DiagnosticCollector(),
  );
}

function base(): { snapshot: CampaignSnapshot; expected: string } {
  const snapshot = makeBattleSnapshot();
  const result = new MonthExecutor().execute(
    snapshot,
    [],
    "unified-replay-seed",
    new DiagnosticCollector(),
  );
  return { snapshot, expected: unifiedSnapshotHash(result.finalSnapshot) };
}

describe("replay verifier uses the unified snapshot hash", () => {
  it("accepts an unchanged snapshot", () => {
    const { snapshot, expected } = base();
    expect(replay(snapshot, expected).match).toBe(true);
  });

  it("rejects a snapshot whose only difference is a design", () => {
    const { snapshot, expected } = base();
    const designs = new Map(snapshot.designs);
    const first = designs.get("dv-att-a")!;
    designs.set("dv-att-a", { ...first, hitPoints: SafeInt(101) });
    expect(replay({ ...snapshot, designs }, expected).match).toBe(false);
  });

  it("rejects a snapshot whose only difference is a design family", () => {
    const { snapshot, expected } = base();
    const mutated: CampaignSnapshot = {
      ...snapshot,
      designFamilies: new Map([
        [
          "family-new",
          {
            designFamilyId: "family-new",
            nationId: "GBR",
            rootDesignVersionId: "dv-att-a",
            memberDesignVersionIds: ["dv-att-a"],
            familyCreationMonth: "1880-01",
          },
        ],
      ]),
    };
    expect(replay(mutated, expected).match).toBe(false);
  });

  it("rejects a snapshot whose only difference is a prestige rule", () => {
    const { snapshot, expected } = base();
    const mutated: CampaignSnapshot = {
      ...snapshot,
      prestigeRules: {
        ...snapshot.prestigeRules,
        sackingThreshold: snapshot.prestigeRules.upperBound,
      },
    };
    expect(replay(mutated, expected).match).toBe(false);
  });

  it("rejects a snapshot whose only difference is the player nation", () => {
    const { snapshot, expected } = base();
    const mutated: CampaignSnapshot = {
      ...snapshot,
      slots: [{ nationId: "FRA", type: "playable" }],
    };
    expect(replay(mutated, expected).match).toBe(false);
  });

  it("rejects a snapshot whose only difference is an active research candidate", () => {
    const { snapshot, expected } = base();
    const nations = new Map(snapshot.nations);
    const nation = nations.get("GBR")!;
    nations.set("GBR", {
      ...nation,
      research: {
        ...nation.research,
        activeCandidates: new Map([["torpedo", "tech-drift"]]),
      },
    });
    expect(replay({ ...snapshot, nations }, expected).match).toBe(false);
  });
});
