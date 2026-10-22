import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  assertFixedPointTorpedo,
  computeTorpedoLauncherStateHash,
  createTorpedoLauncherState,
  EMPTY_TUBE,
  INVALID_TORPEDO_LAUNCHER_STATE,
  NO_RELOAD_IN_PROGRESS,
  TORPEDO_MOUNT_TYPES,
  TORPEDO_STATE_INVARIANT_FAILED,
  type TorpedoLauncherState,
  verifyTorpedoLauncherStateHash,
  withTorpedoLauncherStateHash,
} from "../../src/torpedoes/index.js";

function surface(
  overrides: Partial<TorpedoLauncherState> = {},
): Omit<TorpedoLauncherState, "stateHash"> {
  return {
    launcherId: "LCH-1",
    ownerPlatformId: "SHIP-ALPHA",
    launcherFamilyId: "533mm_underwater_trainable",
    mountPosition: "port_amidships",
    mountType: "UNDERWATER_TRAINABLE",
    tubeCount: 4,
    loadedPerTube: ["ger_533mm_g7a_1934", "ger_533mm_g7a_1934", EMPTY_TUBE, "ger_533mm_g7a_1934"],
    reserveAmmunition: { ger_533mm_g7a_1934: 6, jpn_61cm_type93_1935: 2 },
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
}

function validState(overrides: Partial<TorpedoLauncherState> = {}): TorpedoLauncherState {
  return withTorpedoLauncherStateHash(surface(overrides));
}

function expectInvariant(
  build: () => TorpedoLauncherState | Omit<TorpedoLauncherState, "stateHash">,
  field: string,
): BluewaveError {
  let err: BluewaveError | undefined;
  try {
    assertFixedPointTorpedo(build() as TorpedoLauncherState);
  } catch (e) {
    err = e as BluewaveError;
  }
  expect(err).toBeDefined();
  expect(err!.message).toBe(TORPEDO_STATE_INVARIANT_FAILED);
  expect(err!.context.field).toBe(field);
  return err!;
}

describe("AC-2: closed mount-type enum (exactly the five DESIGN-40 §2 values)", () => {
  it("ships exactly ABOVE_WATER_FIXED / ABOVE_WATER_TRAINABLE / UNDERWATER_FIXED / UNDERWATER_TRAINABLE / SUBMARINE_INTERNAL", () => {
    expect([...TORPEDO_MOUNT_TYPES]).toEqual([
      "ABOVE_WATER_FIXED",
      "ABOVE_WATER_TRAINABLE",
      "UNDERWATER_FIXED",
      "UNDERWATER_TRAINABLE",
      "SUBMARINE_INTERNAL",
    ]);
  });

  it("rejects a sixth, non-canonical mount type", () => {
    expectInvariant(
      () => surface({ mountType: "SURFACE_TRAINABLE" } as unknown as Partial<TorpedoLauncherState>),
      "mountType",
    );
  });
});

describe("AC-2: assertFixedPointTorpedo invariant guard (TORPEDO_STATE_INVARIANT_FAILED)", () => {
  it("accepts a fully-valid, hash-computed TorpedoLauncherState", () => {
    expect(() => assertFixedPointTorpedo(validState())).not.toThrow();
  });

  it("rejects a missing launcherId", () => {
    expectInvariant(() => surface({ launcherId: "" }), "launcherId");
  });

  it("rejects a non-integer tube count", () => {
    expectInvariant(() => surface({ tubeCount: 4.5 }), "tubeCount");
  });

  it("rejects a zero tube count", () => {
    expectInvariant(() => surface({ tubeCount: 0 }), "tubeCount");
  });

  it("rejects loadedPerTube whose length mismatches tubeCount", () => {
    expectInvariant(() => surface({ loadedPerTube: ["ger_533mm_g7a_1934"] }), "loadedPerTube");
  });

  it("accepts EMPTY entries and rejects empty-string / malformed loaded entries", () => {
    expect(() =>
      assertFixedPointTorpedo(
        validState({
          loadedPerTube: [EMPTY_TUBE, "ger_533mm_g7a_1934", EMPTY_TUBE, "ger_533mm_g7a_1934"],
        }),
      ),
    ).not.toThrow();
    expectInvariant(
      () =>
        surface({ loadedPerTube: ["", "ger_533mm_g7a_1934", EMPTY_TUBE, "ger_533mm_g7a_1934"] }),
      "loadedPerTube[0]",
    );
  });

  it("rejects non-integer or negative reserve counts", () => {
    expectInvariant(
      () => surface({ reserveAmmunition: { ger_533mm_g7a_1934: 6.5 } }),
      "reserveAmmunition[ger_533mm_g7a_1934]",
    );
    expectInvariant(
      () => surface({ reserveAmmunition: { ger_533mm_g7a_1934: -1 } }),
      "reserveAmmunition[ger_533mm_g7a_1934]",
    );
  });

  it("rejects a null/undefined reloadState with TORPEDO_STATE_INVARIANT_FAILED — never a raw TypeError (F3)", () => {
    expectInvariant(
      () => surface({ reloadState: null as unknown as TorpedoLauncherState["reloadState"] }),
      "reloadState",
    );
    expectInvariant(
      () => surface({ reloadState: undefined as unknown as TorpedoLauncherState["reloadState"] }),
      "reloadState",
    );
  });

  it("rejects a reload record with an out-of-range tube index", () => {
    expectInvariant(
      () =>
        surface({
          reloadState: {
            status: "RELOAD_IN_PROGRESS",
            tubeIndex: 7,
            modelId: "ger_533mm_g7a_1934",
            requiredReloadTimeMs: 120_000,
            progressMs: 0,
          },
        }),
      "reloadState.tubeIndex",
    );
  });

  it("rejects reload progress beyond the required reload time", () => {
    expectInvariant(
      () =>
        surface({
          reloadState: {
            status: "RELOAD_IN_PROGRESS",
            tubeIndex: 2,
            modelId: "ger_533mm_g7a_1934",
            requiredReloadTimeMs: 120_000,
            progressMs: 120_001,
          },
        }),
      "reloadState.progressMs",
    );
  });

  it("rejects a non-integer required reload time", () => {
    expectInvariant(
      () =>
        surface({
          reloadState: {
            status: "RELOAD_IN_PROGRESS",
            tubeIndex: 2,
            modelId: "ger_533mm_g7a_1934",
            requiredReloadTimeMs: 120_000.5,
            progressMs: 0,
          },
        } as Partial<TorpedoLauncherState>),
      "reloadState.requiredReloadTimeMs",
    );
  });

  it("rejects training limits where min exceeds max", () => {
    expectInvariant(
      () => surface({ trainingLimitsMdeg: { min: 45_000, max: -45_000 } }),
      "trainingLimitsMdeg",
    );
  });

  it("rejects a non-boolean underwater-launch capability", () => {
    expectInvariant(
      () =>
        surface({ underwaterLaunchCapability: "yes" } as unknown as Partial<TorpedoLauncherState>),
      "underwaterLaunchCapability",
    );
  });

  it("rejects non-canonical fire-control connection / damage / isolation states", () => {
    expectInvariant(
      () =>
        surface({
          fireControlConnectionState: "LINKED",
        } as unknown as Partial<TorpedoLauncherState>),
      "fireControlConnectionState",
    );
    expectInvariant(
      () => surface({ damageState: "SCRAPPED" } as unknown as Partial<TorpedoLauncherState>),
      "damageState",
    );
    expectInvariant(
      () =>
        surface({ floodingIsolationState: "LEAKY" } as unknown as Partial<TorpedoLauncherState>),
      "floodingIsolationState",
    );
  });

  it("rejects an empty-string active fire solution", () => {
    expectInvariant(() => surface({ activeFireSolution: "" }), "activeFireSolution");
  });

  it("accepts the NONE fire-solution marker", () => {
    expect(() => assertFixedPointTorpedo(validState({ activeFireSolution: "NONE" }))).not.toThrow();
  });

  it("rejects missing ruleset/formula versions", () => {
    expectInvariant(() => surface({ rulesetVersion: "" }), "rulesetVersion");
    expectInvariant(() => surface({ formulaVersion: "" }), "formulaVersion");
  });

  it("requires a non-empty stateHash on the full state — a hash-less surface fails closed (F6)", () => {
    expectInvariant(() => surface(), "stateHash");
    expectInvariant(() => ({ ...surface(), stateHash: "" }), "stateHash");
  });
});

describe("AC-2: construction boundary (INVALID_TORPEDO_LAUNCHER_STATE) + state hash", () => {
  it("rejects a structurally-missing field with INVALID_TORPEDO_LAUNCHER_STATE", () => {
    let err: BluewaveError | undefined;
    try {
      const { launcherId: _omit, ...partial } = validState();
      void _omit;
      createTorpedoLauncherState(
        partial as unknown as Parameters<typeof createTorpedoLauncherState>[0],
      );
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(INVALID_TORPEDO_LAUNCHER_STATE);
    expect(err!.context.field).toBe("launcherId");
  });

  it("builds a fully-invariant state with a computed hash", () => {
    const built = createTorpedoLauncherState(surface());
    expect(built.stateHash).toMatch(/^[0-9a-f]{64}$/);
    expect(() => assertFixedPointTorpedo(built)).not.toThrow();
  });

  it("withTorpedoLauncherStateHash computes the authoritative hash", () => {
    const full = withTorpedoLauncherStateHash(surface());
    expect(full.stateHash).toBe(computeTorpedoLauncherStateHash(full));
    expect(full.stateHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("the state hash is deterministic and depends on every state field", () => {
    const a = validState();
    const b = validState();
    expect(a.stateHash).toBe(b.stateHash);
    const c = validState({ damageState: "DAMAGED" });
    expect(c.stateHash).not.toBe(a.stateHash);
  });

  it("verifyTorpedoLauncherStateHash recomputes and compares — tampered fields fail (F6)", () => {
    const a = validState();
    expect(verifyTorpedoLauncherStateHash(a)).toBe(true);
    const tampered = { ...a, damageState: "DAMAGED" } as TorpedoLauncherState;
    expect(verifyTorpedoLauncherStateHash(tampered)).toBe(false);
    const stripped = { ...a, stateHash: "" } as TorpedoLauncherState;
    expect(verifyTorpedoLauncherStateHash(stripped)).toBe(false);
  });
});
