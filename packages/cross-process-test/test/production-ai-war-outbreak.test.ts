import type { CampaignSnapshot } from "@bluewave/campaign";
import { battleOffersFromRulesets } from "@bluewave/content-compiler";
import type { BattleOfferRules } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { MonthExecutor, type MonthResult } from "@bluewave/phase-engine";
import { describe, expect, it } from "vite-plus/test";

import { compileProductionCampaign } from "../src/production-pack.js";
import { fleetManagementOptions } from "../src/replay-corpus/corpus.js";

const PLAYER = "germany";
const AGGRESSOR = "france";
const SEED = "production-ai-war-outbreak";
const MONTH_BUDGET = 36;

const { state, bundle } = compileProductionCampaign();
const offers = battleOffersFromRulesets(bundle.rulesets) as BattleOfferRules;

const start: CampaignSnapshot = {
  ...state.snapshot,
  slots: [...state.snapshot.slots].map((slot) => ({
    ...slot,
    type: slot.nationId === PLAYER ? "playable" : "ai",
  })),
};

interface Outbreak {
  readonly declaredAt: number | undefined;
  readonly offerAt: number | undefined;
  readonly attackerId: string | undefined;
  readonly finalHash: string;
}

function runUnattended(from: CampaignSnapshot): Outbreak {
  let snapshot = from;
  let declaredAt: number | undefined;
  let attackerId: string | undefined;
  for (let month = 1; month <= MONTH_BUDGET; month += 1) {
    const result: MonthResult = new MonthExecutor().execute(
      snapshot,
      [],
      `${SEED}-${String(month)}`,
      new DiagnosticCollector(),
      undefined,
      {
        ...fleetManagementOptions(PLAYER),
        playerNationId: PLAYER,
        battleOffers: offers,
        interruptions: { turnId: `${SEED}-turn-${String(month)}`, recordedInputs: [] },
      },
    );
    const war = result.finalSnapshot.wars.wars.find(
      (w) => w.attackerId !== PLAYER && w.defenderId === PLAYER,
    );
    if (war !== undefined && declaredAt === undefined) {
      declaredAt = month;
      attackerId = war.attackerId;
    }
    if (result.outcome === "suspended" && result.suspended?.request.kind === "offer") {
      return {
        declaredAt,
        offerAt: month,
        attackerId,
        finalHash: sha256Hex(canonicalSerialize(result.finalSnapshot)),
      };
    }
    snapshot = {
      ...result.finalSnapshot,
      turnNumber: SafeInt.add(result.finalSnapshot.turnNumber, SafeInt.ONE),
    };
  }
  return {
    declaredAt,
    offerAt: undefined,
    attackerId,
    finalHash: sha256Hex(canonicalSerialize(snapshot)),
  };
}

describe("unattended AI war outbreak from the 1880 start (#995)", () => {
  const first = runUnattended(start);

  it("has the player issue no command, yet an AI declares war on the player", () => {
    expect(first.declaredAt).toBe(1);
    expect(first.attackerId).toBe(AGGRESSOR);
  });

  it("raises a battle offer for the player after the declaration", () => {
    expect(first.offerAt).toBe(7);
  });

  it("reproduces the same outbreak month, offer month and hash from the same seed", () => {
    const again = runUnattended(start);
    expect(again).toEqual(first);
  });

  it("declares no war while every tension to the player stays below the authored threshold", () => {
    const calm: CampaignSnapshot = {
      ...start,
      politics: {
        ...start.politics,
        relations: start.politics.relations.map((relation) =>
          relation.nationA === PLAYER || relation.nationB === PLAYER
            ? { ...relation, tension: 0, frictionBp: 0 }
            : relation,
        ),
      },
    };
    expect(runUnattended(calm).declaredAt).toBeUndefined();
  });
});
