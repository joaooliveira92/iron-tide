// AC-3: ammunition + atomic consume (DESIGN-40 §3). Every launch consumes
// exactly one loaded torpedo per fired tube; a reload reserves + consumes one
// compatible reserve torpedo and the required reload time. The module NEVER
// creates ammunition, substitutes an incompatible model, or exceeds physical
// tube/magazine capacity; failures use TORPEDO_AMMUNITION_UNAVAILABLE or
// TORPEDO_MODEL_INCOMPATIBLE (structural violations fail closed with
// TORPEDO_STATE_INVARIANT_FAILED).
import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  completeTorpedoReload,
  consumeForLaunch,
  EMPTY_TUBE,
  INVALID_TORPEDO_MODEL_DEFINITION,
  NO_RELOAD_IN_PROGRESS,
  reserveForReload,
  TORPEDO_AMMUNITION_UNAVAILABLE,
  TORPEDO_MODEL_INCOMPATIBLE,
  TORPEDO_STATE_INVARIANT_FAILED,
  type TorpedoLauncherState,
  withTorpedoLauncherStateHash,
} from "../../src/torpedoes/index.js";
import { COMPILED_TORPEDOES } from "../fixtures/compiledTorpedoes.js";

const G7A = "ger_533mm_g7a_1934";
const G7E = "ger_533mm_g7e_1936";
const RELOAD_MS = 120_000;

function baseLauncher(overrides: Partial<TorpedoLauncherState> = {}): TorpedoLauncherState {
  const surface: Omit<TorpedoLauncherState, "stateHash"> = {
    launcherId: "LCH-1",
    ownerPlatformId: "SHIP-ALPHA",
    launcherFamilyId: "533mm_underwater_trainable",
    mountPosition: "port_amidships",
    mountType: "UNDERWATER_TRAINABLE",
    tubeCount: 4,
    loadedPerTube: [G7A, G7A, EMPTY_TUBE, G7A],
    reserveAmmunition: { [G7A]: 6, [G7E]: 3 },
    reloadState: NO_RELOAD_IN_PROGRESS,
    trainingLimitsMdeg: { min: -45_000, max: 45_000 },
    underwaterLaunchCapability: true,
    fireControlConnectionState: "CONNECTED",
    damageState: "OPERATIONAL",
    floodingIsolationState: "INTACT",
    activeFireSolution: "SOL-1",
    rulesetVersion: "torpedo_ruleset_v1",
    formulaVersion: "torpedo_formula_v1",
    ...overrides,
  };
  return withTorpedoLauncherStateHash(surface);
}

function totalInventory(s: TorpedoLauncherState): number {
  let total = 0;
  for (const count of Object.values(s.reserveAmmunition)) total += count;
  for (const entry of s.loadedPerTube) if (entry !== EMPTY_TUBE) total += 1;
  return total;
}

function expectCode(fn: () => unknown, code: string): BluewaveError {
  let err: BluewaveError | undefined;
  try {
    fn();
  } catch (e) {
    err = e as BluewaveError;
  }
  expect(err).toBeDefined();
  expect(err!.message).toBe(code);
  return err!;
}

describe("AC-3: consumeForLaunch consumes exactly one torpedo per fired tube", () => {
  it("consumes exactly one per fired tube and never touches the reserve", () => {
    const state = baseLauncher();
    const { state: next, accounts } = consumeForLaunch(state, [0, 3]);
    expect(accounts.map((a) => a.tubeIndex)).toEqual([0, 3]);
    expect(accounts.every((a) => a.modelId === G7A)).toBe(true);
    expect(next.loadedPerTube).toEqual([EMPTY_TUBE, G7A, EMPTY_TUBE, EMPTY_TUBE]);
    expect(next.reserveAmmunition).toEqual({ [G7A]: 6, [G7E]: 3 });
    // no creation: exactly two torpedoes left the loaded surface
    expect(totalInventory(next)).toBe(totalInventory(state) - 2);
  });

  it("is atomic: an EMPTY tube in the salvo consumes NOTHING (TORPEDO_AMMUNITION_UNAVAILABLE)", () => {
    const state = baseLauncher();
    const err = expectCode(() => consumeForLaunch(state, [1, 2]), TORPEDO_AMMUNITION_UNAVAILABLE);
    expect(err.context.tubeIndex).toBe(2);
    // the original state is untouched — tube 1 was never consumed
    expect(state.loadedPerTube).toEqual([G7A, G7A, EMPTY_TUBE, G7A]);
    // concrete expected total: 3 loaded + 6 G7a + 3 G7e reserve = 12
    expect(totalInventory(state)).toBe(12);
  });

  it("rejects duplicate tube indexes in one salvo — a tube fires at most once (F4)", () => {
    const state = baseLauncher();
    expectCode(() => consumeForLaunch(state, [0, 0]), TORPEDO_STATE_INVARIANT_FAILED);
    // atomic: nothing was consumed
    expect(state.loadedPerTube).toEqual([G7A, G7A, EMPTY_TUBE, G7A]);
    expect(state.reserveAmmunition).toEqual({ [G7A]: 6, [G7E]: 3 });
    expect(totalInventory(state)).toBe(12);
  });

  it("fails with TORPEDO_AMMUNITION_UNAVAILABLE on an empty tube", () => {
    expectCode(() => consumeForLaunch(baseLauncher(), [2]), TORPEDO_AMMUNITION_UNAVAILABLE);
  });

  it("rejects out-of-range or non-integer tube indexes with TORPEDO_STATE_INVARIANT_FAILED", () => {
    expectCode(() => consumeForLaunch(baseLauncher(), [9]), TORPEDO_STATE_INVARIANT_FAILED);
    expectCode(() => consumeForLaunch(baseLauncher(), [1.5]), TORPEDO_STATE_INVARIANT_FAILED);
  });

  it("rejects an empty salvo (no tubes)", () => {
    expectCode(() => consumeForLaunch(baseLauncher(), []), TORPEDO_STATE_INVARIANT_FAILED);
  });
});

describe("AC-3: reserveForReload reserves + consumes one compatible reserve", () => {
  it("consumes exactly one compatible reserve and records the in-progress reload", () => {
    const state = baseLauncher();
    const { state: next, account } = reserveForReload(state, {
      tubeIndex: 2,
      modelId: G7A,
      torpedoes: COMPILED_TORPEDOES,
      compatible: true,
      requiredReloadTimeMs: RELOAD_MS,
    });
    expect(account).toEqual({ modelId: G7A, before: 6, after: 5 });
    expect(next.reserveAmmunition[G7A]).toBe(5);
    expect(next.loadedPerTube[2]).toBe(EMPTY_TUBE); // tube fills only on completion
    expect(next.reloadState).toEqual({
      status: "RELOAD_IN_PROGRESS",
      tubeIndex: 2,
      modelId: G7A,
      requiredReloadTimeMs: RELOAD_MS,
      progressMs: 0,
    });
    expect(next.stateHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("fails with TORPEDO_MODEL_INCOMPATIBLE for an incompatible model even when its reserve is available", () => {
    const state = baseLauncher({ reserveAmmunition: { [G7A]: 6, [G7E]: 3 } });
    const err = expectCode(
      () =>
        reserveForReload(state, {
          tubeIndex: 2,
          modelId: G7E,
          torpedoes: COMPILED_TORPEDOES,
          compatible: false,
          requiredReloadTimeMs: RELOAD_MS,
        }),
      TORPEDO_MODEL_INCOMPATIBLE,
    );
    expect(err.context.modelId).toBe(G7E);
    // atomic: nothing consumed
    expect(state.reserveAmmunition[G7E]).toBe(3);
    expect(state.loadedPerTube[2]).toBe(EMPTY_TUBE);
  });

  it("fails with TORPEDO_AMMUNITION_UNAVAILABLE when the compatible reserve is empty", () => {
    const state = baseLauncher({ reserveAmmunition: { [G7A]: 0 } });
    expectCode(
      () =>
        reserveForReload(state, {
          tubeIndex: 2,
          modelId: G7A,
          torpedoes: COMPILED_TORPEDOES,
          compatible: true,
          requiredReloadTimeMs: RELOAD_MS,
        }),
      TORPEDO_AMMUNITION_UNAVAILABLE,
    );
  });

  it("fails with TORPEDO_AMMUNITION_UNAVAILABLE for an unknown model with no reserve entry", () => {
    expectCode(
      () =>
        reserveForReload(baseLauncher(), {
          tubeIndex: 2,
          modelId: "jpn_61cm_type93_1935",
          torpedoes: COMPILED_TORPEDOES,
          compatible: true,
          requiredReloadTimeMs: RELOAD_MS,
        }),
      TORPEDO_AMMUNITION_UNAVAILABLE,
    );
  });

  it("rejects a modelId NOT in the shipped catalog — a caller-supplied compatible flag is never trusted for unknown models (F5)", () => {
    const state = baseLauncher();
    const err = expectCode(
      () =>
        reserveForReload(state, {
          tubeIndex: 2,
          modelId: "ger_533mm_g7a_2040", // never shipped
          torpedoes: COMPILED_TORPEDOES,
          compatible: true, // caller asserts compatibility — must still fail closed
          requiredReloadTimeMs: RELOAD_MS,
        }),
      INVALID_TORPEDO_MODEL_DEFINITION,
    );
    expect(err.context.value).toBe("ger_533mm_g7a_2040");
    // atomic: no reserve consumed, no reload record started
    expect(state.reserveAmmunition).toEqual({ [G7A]: 6, [G7E]: 3 });
    expect(state.loadedPerTube[2]).toBe(EMPTY_TUBE);
    expect(state.reloadState).toEqual(NO_RELOAD_IN_PROGRESS);
  });

  it("never exceeds tube capacity: reload into a LOADED tube fails closed", () => {
    expectCode(
      () =>
        reserveForReload(baseLauncher(), {
          tubeIndex: 0,
          modelId: G7A,
          torpedoes: COMPILED_TORPEDOES,
          compatible: true,
          requiredReloadTimeMs: RELOAD_MS,
        }),
      TORPEDO_STATE_INVARIANT_FAILED,
    );
  });

  it("rejects a reload tube index outside the physical tube count", () => {
    expectCode(
      () =>
        reserveForReload(baseLauncher(), {
          tubeIndex: 4,
          modelId: G7A,
          torpedoes: COMPILED_TORPEDOES,
          compatible: true,
          requiredReloadTimeMs: RELOAD_MS,
        }),
      TORPEDO_STATE_INVARIANT_FAILED,
    );
  });

  it("rejects a second reload while one is already in progress (no double reservation)", () => {
    const state = baseLauncher({
      reloadState: {
        status: "RELOAD_IN_PROGRESS",
        tubeIndex: 2,
        modelId: G7A,
        requiredReloadTimeMs: RELOAD_MS,
        progressMs: 0,
      },
    });
    expectCode(
      () =>
        reserveForReload(state, {
          tubeIndex: 3,
          modelId: G7E,
          torpedoes: COMPILED_TORPEDOES,
          compatible: true,
          requiredReloadTimeMs: RELOAD_MS,
        }),
      TORPEDO_STATE_INVARIANT_FAILED,
    );
  });
});

describe("AC-3: reload completion — no creation, no substitution", () => {
  it("completes the reload: the tube fills with EXACTLY the reserved model (net zero inventory change)", () => {
    const state = baseLauncher();
    const reserved = reserveForReload(state, {
      tubeIndex: 2,
      modelId: G7A,
      torpedoes: COMPILED_TORPEDOES,
      compatible: true,
      requiredReloadTimeMs: RELOAD_MS,
      progressMs: RELOAD_MS, // reload elapsed
    });
    const completed = completeTorpedoReload(reserved.state);
    expect(completed.loadedPerTube[2]).toBe(G7A); // the same model — no substitution
    expect(completed.reloadState).toEqual(NO_RELOAD_IN_PROGRESS);
    // reserve -1, tube +1: no ammunition was created or destroyed across the cycle
    expect(totalInventory(completed)).toBe(totalInventory(state));
    expect(completed.reserveAmmunition[G7A]).toBe(5);
  });

  it("refuses to complete a reload that has not yet elapsed", () => {
    const reserved = reserveForReload(baseLauncher(), {
      tubeIndex: 2,
      modelId: G7A,
      torpedoes: COMPILED_TORPEDOES,
      compatible: true,
      requiredReloadTimeMs: RELOAD_MS,
      progressMs: 0,
    });
    expectCode(() => completeTorpedoReload(reserved.state), TORPEDO_STATE_INVARIANT_FAILED);
  });

  it("refuses to complete a reload when none is in progress", () => {
    expectCode(() => completeTorpedoReload(baseLauncher()), TORPEDO_STATE_INVARIANT_FAILED);
  });
});

describe("AC-3 (NF-1): a missing reloadState fails closed — never a raw TypeError", () => {
  // The construction boundary (withTorpedoLauncherStateHash -> state.ts F3)
  // already rejects a null reloadState; these tests exercise the ammunition
  // module's own guards on a DESERIALIZED/engine-mutated state that bypassed
  // construction (the NF-1 scenario) — the spread preserves the authoritative
  // fields while nulling reloadState.
  it("reserveForReload rejects a null reloadState with TORPEDO_STATE_INVARIANT_FAILED", () => {
    const state = baseLauncher();
    const raw = { ...state, reloadState: null } as unknown as TorpedoLauncherState;
    const err = expectCode(
      () =>
        reserveForReload(raw, {
          tubeIndex: 2,
          modelId: G7A,
          torpedoes: COMPILED_TORPEDOES,
          compatible: true,
          requiredReloadTimeMs: RELOAD_MS,
        }),
      TORPEDO_STATE_INVARIANT_FAILED,
    );
    expect(err.context.field).toBe("reloadState");
    // atomic: nothing reserved, tube untouched
    expect(raw.reserveAmmunition[G7A]).toBe(6);
    expect(raw.loadedPerTube[2]).toBe(EMPTY_TUBE);
  });

  it("completeTorpedoReload rejects a missing reloadState with TORPEDO_STATE_INVARIANT_FAILED", () => {
    const state = baseLauncher();
    const raw = { ...state, reloadState: undefined } as unknown as TorpedoLauncherState;
    const err = expectCode(() => completeTorpedoReload(raw), TORPEDO_STATE_INVARIANT_FAILED);
    expect(err.context.field).toBe("reloadState");
    // atomic: tube untouched
    expect(raw.loadedPerTube).toEqual([G7A, G7A, EMPTY_TUBE, G7A]);
  });
});

describe("AC-3: inventory conservation across consume/reload cycles", () => {
  it("never creates ammunition: every transition either conserves or strictly decreases the total", () => {
    let state = baseLauncher();
    const start = totalInventory(state);
    // fire two tubes
    state = consumeForLaunch(state, [0, 3]).state;
    expect(totalInventory(state)).toBe(start - 2);
    // reload one empty tube (reserve consumed; tube still empty)
    state = reserveForReload(state, {
      tubeIndex: 0,
      modelId: G7A,
      torpedoes: COMPILED_TORPEDOES,
      compatible: true,
      requiredReloadTimeMs: RELOAD_MS,
      progressMs: RELOAD_MS,
    }).state;
    expect(totalInventory(state)).toBe(start - 3);
    // complete the reload (tube fills from the reserved stock)
    state = completeTorpedoReload(state);
    expect(totalInventory(state)).toBe(start - 2);
    // nothing ever increased the total above a prior step
    for (const entry of state.loadedPerTube) {
      expect(entry === EMPTY_TUBE || typeof entry === "string").toBe(true);
    }
  });
});
