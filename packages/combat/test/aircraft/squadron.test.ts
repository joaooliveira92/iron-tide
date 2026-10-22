import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  createSquadronState,
  withSquadronStateHash,
  assertSquadronExperience,
} from "@bluewave/combat/aircraft";
import { INVALID_AIRCRAFT_STATE } from "@bluewave/combat/aircraft";
import type { BluewaveError } from "@bluewave/contracts";

describe("AC-13: SquadronState creation", () => {
  it("creates a valid initial squadron state with default experience 50", () => {
    const sq = createSquadronState("sq_1", "nation_france", "FIGHTER", SafeInt(18), "base_brest");
    expect(sq.squadronId).toBe("sq_1");
    expect(sq.ownerNationId).toBe("nation_france");
    expect(sq.squadronRole).toBe("FIGHTER");
    expect(Number(sq.authorizedStrength)).toBe(18);
    expect(sq.assignedModelId).toBeNull();
    expect(Number(sq.squadronExperience)).toBe(50);
    expect(sq.reequipmentState).toBe("NONE");
    expect(sq.stateHash).toBe("");
  });

  it("computes a deterministic state hash", () => {
    const a = withSquadronStateHash(
      createSquadronState("sq_1", "nation_france", "FIGHTER", SafeInt(18), "base_brest"),
    );
    const b = withSquadronStateHash(
      createSquadronState("sq_1", "nation_france", "FIGHTER", SafeInt(18), "base_brest"),
    );
    expect(a.stateHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.stateHash).toBe(b.stateHash);
  });

  it("produces different hashes for different states", () => {
    const a = withSquadronStateHash(
      createSquadronState("sq_1", "nation_france", "FIGHTER", SafeInt(18), "base_brest"),
    );
    const b = withSquadronStateHash(
      createSquadronState("sq_2", "nation_france", "FIGHTER", SafeInt(18), "base_brest"),
    );
    expect(a.stateHash).not.toBe(b.stateHash);
  });
});

describe("AC-13: squadron experience 0-100", () => {
  it("accepts valid experience 0, 50, 100", () => {
    expect(() => assertSquadronExperience(SafeInt(0))).not.toThrow();
    expect(() => assertSquadronExperience(SafeInt(50))).not.toThrow();
    expect(() => assertSquadronExperience(SafeInt(100))).not.toThrow();
  });

  it("rejects experience below 0", () => {
    let err: BluewaveError | undefined;
    try {
      assertSquadronExperience(SafeInt(-1));
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(INVALID_AIRCRAFT_STATE);
  });

  it("rejects experience above 100", () => {
    let err: BluewaveError | undefined;
    try {
      assertSquadronExperience(SafeInt(101));
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(INVALID_AIRCRAFT_STATE);
  });
});
