import {
  LEGACY_FLEET_ATTEMPT_LIMIT,
  legacyFleetBaseCount,
  shipBuildingDataFromBundle,
  type CampaignState,
  type LegacyFleetReport,
} from "@bluewave/campaign";
import { CampaignCompiler } from "@bluewave/campaign/compiler";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { CURRENT_COMPATIBILITY_VERSION } from "@bluewave/persistence";
import {
  buildShipBuildingContent,
  compileDesign,
  dockRecordFor,
  evaluateShipTypeAvailability,
  newConstructionDockEligibility,
  shipTypeForHullType,
  type DesignDraft,
} from "@bluewave/ship-design";
import { beforeAll, describe, expect, it } from "vite-plus/test";

import { compileProductionBundle } from "../src/production-pack.js";

const SEED = "0123456789abcdef0123456789abcdef";
const CORPUS_SEEDS = 100;
const MONTH = "1880-01";
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
const GOLDEN_SEEDS = ["uk", "austria_hungary", "russia", "spain", "qing"] as const;
const GOLDEN_DIGESTS: Readonly<Record<(typeof GOLDEN_SEEDS)[number], string>> = {
  uk: "7aedb39c73a2b683141c244eaecb8e747103e960fd31d69ec4734e97ff782650",
  austria_hungary: "dc70a8aeb4dafd2557746396a93c56a3ae8e6bb198bb17bc2c25dcf84f4f7c48",
  russia: "50c4ee129a0a58756a5917c9fa089c1c209ff7f7f79f419114a9fbcdaefea199",
  spain: "9eb18904f648f56eb20eeed100a1e11a259f8a71e0c05420330fd210888df1ea",
  qing: "4025a87d379e86a8e61d3be54aba52c2595c22122adccad48e3d9926570d9a85",
};

const { bundle, contentHash } = compileProductionBundle();
const shipBuildingData = shipBuildingDataFromBundle(bundle)!;
const content = buildShipBuildingContent(shipBuildingData);

interface Compiled {
  readonly state: CampaignState;
  readonly report: LegacyFleetReport;
  readonly errors: readonly string[];
}

function compile(legacyFleet?: { campaignSeed: string; scaleBp: number }): {
  readonly state: CampaignState | undefined;
  readonly report: LegacyFleetReport | undefined;
  readonly errors: readonly string[];
} {
  const collector = new DiagnosticCollector();
  const output = new CampaignCompiler().compile(
    {
      contentBundle: bundle,
      contentHash,
      rulesetVersion: "1.0",
      compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
      ...(legacyFleet === undefined ? {} : { legacyFleet }),
    },
    new AbortController().signal,
    collector,
  );
  return {
    state: output?.state,
    report: output?.legacyFleetReport,
    errors: collector.all.filter((d) => d.severity === "error").map((d) => d.message),
  };
}

const seedFor = (index: number): string =>
  sha256Hex(`legacy-fleet-corpus-${String(index)}`).slice(0, 32);

const generatedShips = (state: CampaignState, nationId: string) =>
  state.snapshot.nations
    .get(nationId)!
    .fleets.flatMap((f) => f.ships)
    .filter((s) => s.id.startsWith(`${nationId}_gen_`));

describe("generated legacy fleet (compiler)", () => {
  it("leaves the compiled campaign untouched without a legacyFleet input", () => {
    const { state, report } = compile();
    expect(report).toBeUndefined();
    expect(state).toBeDefined();
    expect(compile().state!.rawHash).toBe(state!.rawHash);
  });

  it("adds generated ships with generated designs for the uk and reports them", () => {
    const historical = compile().state!;
    const { state, report, errors } = compile({ campaignSeed: SEED, scaleBp: 10_000 });
    expect(errors).toEqual([]);
    const ships = (n: string, s: CampaignState) =>
      s.snapshot.nations.get(n)!.fleets.flatMap((f) => f.ships);
    expect(ships("uk", state!).length).toBeGreaterThan(ships("uk", historical).length);
    const generated = generatedShips(state!, "uk");
    expect(generated.length).toBeGreaterThan(0);
    for (const ship of generated)
      expect(state!.snapshot.designs.has(ship.designVersionId)).toBe(true);
    const row = report!.nations.find((n) => n.nationId === "uk")!;
    expect(row.generated).toBe(generated.length);
    expect(row.baseCount).toBe(legacyFleetBaseCount(10_000));
    expect(state!.rawHash).not.toBe(historical.rawHash);
  });

  it("is a pure function of the campaign seed", () => {
    const a = compile({ campaignSeed: SEED, scaleBp: 10_000 }).state!;
    const b = compile({ campaignSeed: SEED, scaleBp: 10_000 }).state!;
    const c = compile({ campaignSeed: seedFor(1), scaleBp: 10_000 }).state!;
    expect(a.rawHash).toBe(b.rawHash);
    expect(a.rawHash).not.toBe(c.rawHash);
  });

  it("scales the target fleet with the fleet-size setting", () => {
    const small = compile({ campaignSeed: SEED, scaleBp: 7_500 }).report!;
    const large = compile({ campaignSeed: SEED, scaleBp: 15_000 }).report!;
    const total = (r: LegacyFleetReport) => r.nations.reduce((sum, n) => sum + n.generated, 0);
    expect(total(large)).toBeGreaterThan(total(small));
  });
});

describe(`generated legacy fleet corpus (${String(CORPUS_SEEDS)} seeds)`, () => {
  const runs: Compiled[] = [];
  beforeAll(() => {
    for (let i = 0; i < CORPUS_SEEDS; i++) {
      const { state, report, errors } = compile({ campaignSeed: seedFor(i), scaleBp: 10_000 });
      expect(errors, `seed ${String(i)}`).toEqual([]);
      runs.push({ state: state!, report: report!, errors });
    }
  }, 600_000);

  it.each(PLAYABLE)(
    "%s: terminates with legal, unlocked, dock-fitting, unique ships",
    (nationId) => {
      const profile = content.navalProfileFor(nationId, MONTH)!;
      const dock = dockRecordFor(profile);
      for (const [index, run] of runs.entries()) {
        const ships = generatedShips(run.state, nationId);
        const row = run.report.nations.find((n) => n.nationId === nationId)!;
        expect(row.generated, `seed ${String(index)}`).toBe(ships.length);
        expect(row.attempts).toBeLessThanOrEqual(
          (row.generated + row.skippedRoles.length + 8) * LEGACY_FLEET_ATTEMPT_LIMIT,
        );
        expect(row.maintenance).toBeLessThanOrEqual(row.maintenanceCeiling);
        const ids = new Set<string>();
        const names = new Set<string>();
        for (const ship of ships) {
          expect(ids.has(ship.id)).toBe(false);
          ids.add(ship.id);
          names.add(ship.name);
          const design = run.state.snapshot.designs.get(ship.designVersionId)!;
          expect(design).toBeDefined();
          expect(design.nationId).toBe(nationId);
          const draft: DesignDraft = JSON.parse(JSON.stringify(design.sourceDraft));
          const compiled = compileDesign(draft, content.environmentFor(MONTH, nationId).ctx);
          expect(compiled.valid).toBe(true);
          const shipType = shipTypeForHullType(design.hullType)!;
          expect(
            evaluateShipTypeAvailability(shipType, {
              month: MONTH,
              unlockedTechs: content.environmentFor(MONTH, nationId).ctx.unlockedTechs,
              capabilities: content.environmentFor(MONTH, nationId).ctx.capabilities,
            }).available,
          ).toBe(true);
          expect(
            newConstructionDockEligibility(dock, {
              lengthMm: 0,
              beamMm: 0,
              displacementKg: Number(design.normalizedDisplacementKg),
              heaviestKg: 0,
            }).eligible,
          ).toBe(true);
          expect(JSON.parse(JSON.stringify(ship))).toEqual(ship);
          expect(JSON.parse(JSON.stringify(design))).toEqual(design);
        }
        expect(names.size).toBe(ships.length);
      }
    },
  );

  it("keeps ship ids unique across every nation and seed", () => {
    for (const run of runs) {
      const all = [...run.state.snapshot.nations.values()].flatMap((n) =>
        n.fleets.flatMap((f) => f.ships.map((s) => s.id)),
      );
      expect(new Set(all).size).toBe(all.length);
    }
  });

  it.each(GOLDEN_SEEDS)("%s: golden seed digest is stable", (nationId) => {
    const { state } = compile({ campaignSeed: SEED, scaleBp: 10_000 });
    const ships = generatedShips(state!, nationId);
    const digest = sha256Hex(
      canonicalSerialize({
        ships,
        designs: ships.map((s) => {
          const d = state!.snapshot.designs.get(s.designVersionId)!;
          return { id: d.designVersionId, hash: d.compiledHash, cost: d.constructionCostUnits };
        }),
      }),
    );
    expect(digest).toBe(GOLDEN_DIGESTS[nationId]);
  });
});
