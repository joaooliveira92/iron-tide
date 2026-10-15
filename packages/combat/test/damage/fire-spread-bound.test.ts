// ADR-0098 §8: the bounded one-hop-per-resolution-step fire-spread rule.
//
// Proves the fire-spread implementation is bounded and deterministic:
//  - one originating fire spreads at most one hop per resolution step;
//  - a fire created by spread does not recursively spread in the same step (and
//    never recursively thereafter — the ADR-0094 blow-up bound);
//  - an originating fire may still spread in a later eligible step;
//  - already-burning locations do not receive duplicate fire instances;
//  - ordering is deterministic and iteration order does not change the outcome;
//  - fire still progresses (decays, spreads, produces smoke) under the bound.
import { describe, expect, it } from "vite-plus/test";
import {
  resolveFireProgression,
  computeFireSmokeStrength,
} from "../../src/damage/fireResolution.js";
import { persistCreatedSources } from "../../src/battleResolution/damage.js";
import { initialDamageState } from "../../src/battleResolution/damage.js";
import { FIRE_SPREAD_CREATED } from "../../src/damage/reasonCodes.js";
import type { FireRecord } from "../../src/damage/state.js";

function rngAlways(v: number): (stream: string) => number {
  return () => v;
}

function rngByLocation(values: Record<string, number>): (stream: string) => number {
  return (stream: string) => {
    for (const [loc, v] of Object.entries(values)) {
      if (stream.endsWith(`/${loc}`)) return v;
    }
    return 0.99;
  };
}

const origin: FireRecord = { locationId: "BELT", intensityBp: 5_000, cause: "FIRE_SOURCE_CREATED" };

describe("ADR-0098: bounded fire spread", () => {
  it("one originating fire spreads at most one hop per resolution step", () => {
    const { newFires } = resolveFireProgression([origin], "ORDINARY", rngAlways(0.0));
    expect(newFires).toHaveLength(1);
    expect(newFires[0]!.locationId).toBe("BELT_adj");
    expect(newFires[0]!.cause).toBe(FIRE_SPREAD_CREATED);
  });

  it("a spread-created fire cannot recursively spread in the same step", () => {
    // BELT spreads to BELT_adj; BELT_adj is returned as new, never re-iterated,
    // so no BELT_adj_adj is produced in the same step.
    const { newFires } = resolveFireProgression([origin], "ORDINARY", rngAlways(0.0));
    expect(newFires.map((f) => f.locationId)).toEqual(["BELT_adj"]);
  });

  it("a spread-created fire never recursively spreads (bounded depth)", () => {
    // A BELT_adj fire (cause FIRE_SPREAD_CREATED) is inert for spread forever:
    // no unbounded BELT_adj_adj_adj chain (the ADR-0094 heap blow-up).
    const adj: FireRecord = {
      locationId: "BELT_adj",
      intensityBp: 3_000,
      cause: FIRE_SPREAD_CREATED,
    };
    const { newFires } = resolveFireProgression([adj], "ORDINARY", rngAlways(0.0));
    expect(newFires).toHaveLength(0);
  });

  it("an originating fire may spread again in a later eligible step", () => {
    // Step 1: BELT -> BELT_adj. Step 2: the original BELT fire (persisted) is
    // still an originating fire and spreads again.
    const step1 = resolveFireProgression([origin], "ORDINARY", rngAlways(0.0));
    expect(step1.newFires).toHaveLength(1);
    // The originating fire is unchanged by spread; feed it again next step.
    const step2 = resolveFireProgression([origin], "ORDINARY", rngAlways(0.0));
    expect(step2.newFires).toHaveLength(1);
    expect(step2.newFires[0]!.locationId).toBe("BELT_adj");
  });

  it("already-burning locations do not receive duplicate fire instances", () => {
    // Two spread events to the same location (e.g. two originating fires whose
    // _adj collides) must not create two records for one location.
    const state = initialDamageState("s1");
    const withFire = persistCreatedSources(state, [
      {
        createdFireSources: [
          { locationId: "BELT_adj", intensityBp: 3_000, cause: FIRE_SPREAD_CREATED },
        ],
        createdFloodingSources: [],
      },
      {
        createdFireSources: [
          { locationId: "BELT_adj", intensityBp: 3_000, cause: FIRE_SPREAD_CREATED },
        ],
        createdFloodingSources: [],
      },
    ]);
    expect(withFire.fireRecords.filter((f) => f.locationId === "BELT_adj")).toHaveLength(1);
  });

  it("merges an existing burning location to the higher intensity", () => {
    const state = initialDamageState("s1");
    const seeded = persistCreatedSources(state, [
      { createdFireSources: [{ ...origin, intensityBp: 5_000 }], createdFloodingSources: [] },
    ]);
    const merged = persistCreatedSources(seeded, [
      {
        createdFireSources: [
          { locationId: "BELT", intensityBp: 3_000, cause: FIRE_SPREAD_CREATED },
        ],
        createdFloodingSources: [],
      },
    ]);
    const belt = merged.fireRecords.filter((f) => f.locationId === "BELT");
    expect(belt).toHaveLength(1);
    expect(belt[0]!.intensityBp).toBe(5_000); // the higher intensity is kept
  });

  it("is deterministic and independent of fire-record iteration order", () => {
    const fires: FireRecord[] = [
      { locationId: "BELT", intensityBp: 5_000, cause: "FIRE_SOURCE_CREATED" },
      { locationId: "DECK", intensityBp: 5_000, cause: "FIRE_SOURCE_CREATED" },
    ];
    const rng = rngByLocation({ BELT: 0.0, DECK: 0.0 });
    const forward = resolveFireProgression(fires, "ORDINARY", rng);
    const reversed = resolveFireProgression([...fires].reverse(), "ORDINARY", rng);
    const key = (r: { newFires: readonly FireRecord[] }) =>
      r.newFires.map((f) => f.locationId).sort();
    expect(key(forward)).toEqual(key(reversed));
    // Repeats are byte-identical.
    expect(resolveFireProgression(fires, "ORDINARY", rng)).toEqual(forward);
  });

  it("fire still progresses: decay, spread and smoke under the bound", () => {
    // Decay.
    const decayed = resolveFireProgression([origin], "ORDINARY", null);
    expect(decayed.fireRecords[0]!.intensityBp).toBe(4_800);
    // Spread under the bound.
    const spread = resolveFireProgression([origin], "ORDINARY", rngAlways(0.0));
    expect(spread.newFires).toHaveLength(1);
    // Meaningful progressive effect: an active fire produces smoke.
    expect(computeFireSmokeStrength(spread.newFires[0]!.intensityBp, "COAL")).toBeGreaterThan(0);
  });
});
