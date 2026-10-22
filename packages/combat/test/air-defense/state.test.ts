import { describe, it, expect } from "vite-plus/test";
import { BluewaveError, SafeInt, isBluewaveError } from "@bluewave/contracts";
import {
  createAirDefenseState,
  computeAirDefenseStateHash,
  addDisruptionRecord,
  DisruptionSeverity,
  Layer,
  Category,
  createAirDefenseSystemDefinition,
  INVALID_AIR_DEFENSE_STATE,
} from "@bluewave/combat/air-defense";

describe("AirDefenseState", () => {
  describe("required fields presence", () => {
    it("should have all required fields in AirDefenseState", () => {
      const system = createAirDefenseSystemDefinition({
        systemId: "sys_001",
        layer: Layer.HEAVY_AA,
        category: Category.HEAVY_AA,
        profileEligibility: new Set(["CA"]),
        engagementChannels: new Set(["ch001"]),
      });

      const directorState = {
        channelId: "ch001",
        assignedLayer: Layer.HEAVY_AA,
        directorIndex: SafeInt(0),
        scalingBp: SafeInt(10_000),
      };

      const radarState = {
        channelId: "radar01",
        assignedLayer: Layer.HEAVY_AA,
        saturationGroup: SafeInt(0),
        diminishingReturnsBp: SafeInt(10_000),
      };

      const state = createAirDefenseState(
        "ship_001",
        "SHIP",
        [system],
        directorState,
        radarState,
        SafeInt(10_000),
      );

      expect(state.defenderId).toBe("ship_001");
      expect(state.scope).toBe("SHIP");
      expect(Array.isArray(state.systems)).toBe(true);
      expect(state.systems.length).toBe(1);
      expect(state.directorState).toEqual(directorState);
      expect(state.radarState).toEqual(radarState);
      expect(Number(state.crewQuality)).toBe(10_000);
      expect(Number(state.damageBp)).toBe(0);
      expect(Number(state.powerBp)).toBe(0);
      expect(state.ammunitionByType).toBeInstanceOf(Map);
      expect(state.targetAllocations).toBeInstanceOf(Map);
      expect(state.channelReservations).toBeInstanceOf(Map);
      expect(Array.isArray(state.disruptionRecords)).toBe(true);
      expect(typeof state.stateHash).toBe("string");
    });
  });

  describe("deterministic state hash computation", () => {
    it("should compute a deterministic state hash", () => {
      const system = createAirDefenseSystemDefinition({
        systemId: "sys_001",
        layer: Layer.HEAVY_AA,
        category: Category.HEAVY_AA,
        profileEligibility: new Set(["CA"]),
        engagementChannels: new Set(["ch001"]),
      });

      const directorState = {
        channelId: "ch001",
        assignedLayer: Layer.HEAVY_AA,
        directorIndex: SafeInt(0),
        scalingBp: SafeInt(10_000),
      };

      const radarState = {
        channelId: "radar01",
        assignedLayer: Layer.HEAVY_AA,
        saturationGroup: SafeInt(0),
        diminishingReturnsBp: SafeInt(10_000),
      };

      const state = createAirDefenseState(
        "ship_001",
        "SHIP",
        [system],
        directorState,
        radarState,
        SafeInt(10_000),
      );

      expect(state.stateHash).toHaveLength(64);
      expect(/^[a-fA-F0-9]{64}$/.test(state.stateHash)).toBe(true);
    });

    it("should produce identical hashes for identical states", () => {
      const system1 = createAirDefenseSystemDefinition({
        systemId: "sys_001",
        layer: Layer.HEAVY_AA,
        profileEligibility: new Set(["CA"]),
        engagementChannels: new Set(["ch001"]),
      });

      const system2 = createAirDefenseSystemDefinition({
        systemId: "sys_001",
        layer: Layer.HEAVY_AA,
        profileEligibility: new Set(["CA"]),
        engagementChannels: new Set(["ch001"]),
      });

      const directorState = {
        channelId: "ch001",
        assignedLayer: Layer.HEAVY_AA,
        directorIndex: SafeInt(0),
        scalingBp: SafeInt(10_000),
      };

      const radarState = {
        channelId: "radar01",
        assignedLayer: Layer.HEAVY_AA,
        saturationGroup: SafeInt(0),
        diminishingReturnsBp: SafeInt(10_000),
      };

      const state1 = createAirDefenseState(
        "ship_001",
        "SHIP",
        [system1],
        directorState,
        radarState,
        SafeInt(10_000),
      );

      const state2 = createAirDefenseState(
        "ship_001",
        "SHIP",
        [system2],
        directorState,
        radarState,
        SafeInt(10_000),
      );

      expect(state1.stateHash).toBe(state2.stateHash);
    });

    it("should compute same hash when calling computeAirDefenseStateHash directly", () => {
      const system = createAirDefenseSystemDefinition({
        systemId: "sys_001",
        layer: Layer.HEAVY_AA,
        profileEligibility: new Set(["CA"]),
        engagementChannels: new Set(["ch001"]),
      });

      const directorState = {
        channelId: "ch001",
        assignedLayer: Layer.HEAVY_AA,
        directorIndex: SafeInt(0),
        scalingBp: SafeInt(10_000),
      };

      const radarState = {
        channelId: "radar01",
        assignedLayer: Layer.HEAVY_AA,
        saturationGroup: SafeInt(0),
        diminishingReturnsBp: SafeInt(10_000),
      };

      const state = createAirDefenseState(
        "ship_001",
        "SHIP",
        [system],
        directorState,
        radarState,
        SafeInt(10_000),
      );

      const recomputedHash = computeAirDefenseStateHash(state);
      expect(state.stateHash).toBe(recomputedHash);
    });

    it("should produce different hashes for different defenderIds", () => {
      const system = createAirDefenseSystemDefinition({
        systemId: "sys_001",
        layer: Layer.HEAVY_AA,
        profileEligibility: new Set(["CA"]),
        engagementChannels: new Set(["ch001"]),
      });

      const directorState = {
        channelId: "ch001",
        assignedLayer: Layer.HEAVY_AA,
        directorIndex: SafeInt(0),
        scalingBp: SafeInt(10_000),
      };

      const radarState = {
        channelId: "radar01",
        assignedLayer: Layer.HEAVY_AA,
        saturationGroup: SafeInt(0),
        diminishingReturnsBp: SafeInt(10_000),
      };

      const state1 = createAirDefenseState(
        "ship_001",
        "SHIP",
        [system],
        directorState,
        radarState,
        SafeInt(10_000),
      );

      const state2 = createAirDefenseState(
        "ship_002",
        "SHIP",
        [system],
        directorState,
        radarState,
        SafeInt(10_000),
      );

      expect(state1.stateHash).not.toBe(state2.stateHash);
    });

    it("should produce different hashes for different systems", () => {
      const system1 = createAirDefenseSystemDefinition({
        systemId: "sys_001",
        layer: Layer.HEAVY_AA,
        profileEligibility: new Set(["CA"]),
        engagementChannels: new Set(["ch001"]),
      });

      const system2 = createAirDefenseSystemDefinition({
        systemId: "sys_002",
        layer: Layer.LIGHT_AA,
        profileEligibility: new Set(["DD"]),
        engagementChannels: new Set(["ch002"]),
      });

      const directorState = {
        channelId: "ch001",
        assignedLayer: Layer.HEAVY_AA,
        directorIndex: SafeInt(0),
        scalingBp: SafeInt(10_000),
      };

      const radarState = {
        channelId: "radar01",
        assignedLayer: Layer.HEAVY_AA,
        saturationGroup: SafeInt(0),
        diminishingReturnsBp: SafeInt(10_000),
      };

      const state1 = createAirDefenseState(
        "ship_001",
        "SHIP",
        [system1],
        directorState,
        radarState,
        SafeInt(10_000),
      );

      const state2 = createAirDefenseState(
        "ship_001",
        "SHIP",
        [system2],
        directorState,
        radarState,
        SafeInt(10_000),
      );

      expect(state1.stateHash).not.toBe(state2.stateHash);
    });

    it("should produce identical hashes regardless of Map insertion order (AC-2)", () => {
      const system = createAirDefenseSystemDefinition({
        systemId: "sys_001",
        layer: Layer.HEAVY_AA,
        profileEligibility: new Set(["CA", "CV"]),
        engagementChannels: new Set(["ch001", "ch002"]),
      });

      const base = {
        defenderId: "ship_001",
        scope: "SHIP" as const,
        systems: [system],
        directorState: {
          channelId: "ch001",
          assignedLayer: Layer.HEAVY_AA,
          directorIndex: SafeInt(0),
          scalingBp: SafeInt(10_000),
        },
        radarState: {
          channelId: "radar01",
          assignedLayer: Layer.HEAVY_AA,
          saturationGroup: SafeInt(0),
          diminishingReturnsBp: SafeInt(10_000),
        },
        crewQuality: SafeInt(10_000),
        damageBp: SafeInt.ZERO,
        powerBp: SafeInt.ZERO,
        targetAllocations: new Map<string, string>(),
        channelReservations: new Map<string, string>(),
        disruptionRecords: [],
        stateHash: "",
      };

      const ammoOrdered = {
        ...base,
        ammunitionByType: new Map([
          ["a", SafeInt(100)],
          ["b", SafeInt(50)],
          ["c", SafeInt(25)],
        ]),
      };
      const ammoReordered = {
        ...base,
        ammunitionByType: new Map([
          ["c", SafeInt(25)],
          ["a", SafeInt(100)],
          ["b", SafeInt(50)],
        ]),
      };

      const targetOrdered = {
        ...ammoOrdered,
        targetAllocations: new Map([
          ["t1", "sys_001"],
          ["t2", "sys_001"],
        ]),
      };
      const targetReordered = {
        ...ammoOrdered,
        targetAllocations: new Map([
          ["t2", "sys_001"],
          ["t1", "sys_001"],
        ]),
      };

      const chanOrdered = {
        ...targetOrdered,
        channelReservations: new Map([
          ["ch1", "sys_001"],
          ["ch2", "sys_001"],
        ]),
      };
      const chanReordered = {
        ...targetOrdered,
        channelReservations: new Map([
          ["ch2", "sys_001"],
          ["ch1", "sys_001"],
        ]),
      };

      expect(computeAirDefenseStateHash(ammoOrdered)).toBe(
        computeAirDefenseStateHash(ammoReordered),
      );
      expect(computeAirDefenseStateHash(targetOrdered)).toBe(
        computeAirDefenseStateHash(targetReordered),
      );
      expect(computeAirDefenseStateHash(chanOrdered)).toBe(
        computeAirDefenseStateHash(chanReordered),
      );
    });

    it("should produce identical hashes regardless of profileEligibility/engagementChannels Set insertion order", () => {
      const systemA = createAirDefenseSystemDefinition({
        systemId: "sys_001",
        layer: Layer.HEAVY_AA,
        profileEligibility: new Set(["CA", "CV", "DD"]),
        engagementChannels: new Set(["ch001", "ch002", "ch003"]),
      });
      const systemB = createAirDefenseSystemDefinition({
        systemId: "sys_001",
        layer: Layer.HEAVY_AA,
        profileEligibility: new Set(["DD", "CV", "CA"]),
        engagementChannels: new Set(["ch003", "ch001", "ch002"]),
      });

      const mk = (system: typeof systemA) =>
        computeAirDefenseStateHash({
          defenderId: "ship_001",
          scope: "SHIP",
          systems: [system],
          directorState: {
            channelId: "ch001",
            assignedLayer: Layer.HEAVY_AA,
            directorIndex: SafeInt(0),
            scalingBp: SafeInt(10_000),
          },
          radarState: {
            channelId: "radar01",
            assignedLayer: Layer.HEAVY_AA,
            saturationGroup: SafeInt(0),
            diminishingReturnsBp: SafeInt(10_000),
          },
          crewQuality: SafeInt(10_000),
          damageBp: SafeInt.ZERO,
          powerBp: SafeInt.ZERO,
          ammunitionByType: new Map<string, SafeInt>(),
          targetAllocations: new Map<string, string>(),
          channelReservations: new Map<string, string>(),
          disruptionRecords: [],
          stateHash: "",
        });

      expect(mk(systemA)).toBe(mk(systemB));
    });
  });

  describe("scope validation", () => {
    it("should accept SHIP scope", () => {
      const system = createAirDefenseSystemDefinition({
        systemId: "sys_001",
        layer: Layer.HEAVY_AA,
        profileEligibility: new Set(["CA"]),
        engagementChannels: new Set(["ch001"]),
      });

      const state = createAirDefenseState(
        "ship_001",
        "SHIP",
        [system],
        {
          channelId: "ch001",
          assignedLayer: Layer.HEAVY_AA,
          directorIndex: SafeInt(0),
          scalingBp: SafeInt(10_000),
        },
        {
          channelId: "radar01",
          assignedLayer: Layer.HEAVY_AA,
          saturationGroup: SafeInt(0),
          diminishingReturnsBp: SafeInt(10_000),
        },
        SafeInt(10_000),
      );

      expect(state.scope).toBe("SHIP");
    });

    it("should accept FLEET scope", () => {
      const system = createAirDefenseSystemDefinition({
        systemId: "sys_001",
        layer: Layer.HEAVY_AA,
        profileEligibility: new Set(["CA"]),
        engagementChannels: new Set(["ch001"]),
      });

      const state = createAirDefenseState(
        "fleet_001",
        "FLEET",
        [system],
        {
          channelId: "ch001",
          assignedLayer: Layer.HEAVY_AA,
          directorIndex: SafeInt(0),
          scalingBp: SafeInt(10_000),
        },
        {
          channelId: "radar01",
          assignedLayer: Layer.HEAVY_AA,
          saturationGroup: SafeInt(0),
          diminishingReturnsBp: SafeInt(10_000),
        },
        SafeInt(10_000),
      );

      expect(state.scope).toBe("FLEET");
    });

    it("should accept BASE scope", () => {
      const system = createAirDefenseSystemDefinition({
        systemId: "sys_001",
        layer: Layer.CIWS_TERMINAL_DEFENSE,
        profileEligibility: new Set(["CA"]),
        engagementChannels: new Set(["ch001"]),
      });

      const state = createAirDefenseState(
        "base_001",
        "BASE",
        [system],
        {
          channelId: "ch001",
          assignedLayer: Layer.CIWS_TERMINAL_DEFENSE,
          directorIndex: SafeInt(0),
          scalingBp: SafeInt(10_000),
        },
        {
          channelId: "radar01",
          assignedLayer: Layer.CIWS_TERMINAL_DEFENSE,
          saturationGroup: SafeInt(0),
          diminishingReturnsBp: SafeInt(10_000),
        },
        SafeInt(10_000),
      );

      expect(state.scope).toBe("BASE");
    });

    it("should reject invalid scope", () => {
      const system = createAirDefenseSystemDefinition({
        systemId: "sys_001",
        layer: Layer.HEAVY_AA,
        profileEligibility: new Set(["CA"]),
        engagementChannels: new Set(["ch001"]),
      });

      expect(() => {
        createAirDefenseState(
          "ship_001",
          // @ts-expect-error testing invalid scope
          "INVALID_SCOPE",
          [system],
          {
            channelId: "ch001",
            assignedLayer: Layer.HEAVY_AA,
            directorIndex: SafeInt(0),
            scalingBp: SafeInt(10_000),
          },
          {
            channelId: "radar01",
            assignedLayer: Layer.HEAVY_AA,
            saturationGroup: SafeInt(0),
            diminishingReturnsBp: SafeInt(10_000),
          },
          SafeInt(10_000),
        );
      }).toThrow("scope must be one of: SHIP, FLEET, BASE");
    });
  });

  describe("default values", () => {
    it("should initialize damageBp and powerBp to zero", () => {
      const system = createAirDefenseSystemDefinition({
        systemId: "sys_001",
        layer: Layer.HEAVY_AA,
        profileEligibility: new Set(["CA"]),
        engagementChannels: new Set(["ch001"]),
      });

      const state = createAirDefenseState(
        "ship_001",
        "SHIP",
        [system],
        {
          channelId: "ch001",
          assignedLayer: Layer.HEAVY_AA,
          directorIndex: SafeInt(0),
          scalingBp: SafeInt(10_000),
        },
        {
          channelId: "radar01",
          assignedLayer: Layer.HEAVY_AA,
          saturationGroup: SafeInt(0),
          diminishingReturnsBp: SafeInt(10_000),
        },
        SafeInt(10_000),
      );

      expect(Number(state.damageBp)).toBe(0);
      expect(Number(state.powerBp)).toBe(0);
    });

    it("should initialize disruptionRecords to empty array", () => {
      const system = createAirDefenseSystemDefinition({
        systemId: "sys_001",
        layer: Layer.HEAVY_AA,
        profileEligibility: new Set(["CA"]),
        engagementChannels: new Set(["ch001"]),
      });

      const state = createAirDefenseState(
        "ship_001",
        "SHIP",
        [system],
        {
          channelId: "ch001",
          assignedLayer: Layer.HEAVY_AA,
          directorIndex: SafeInt(0),
          scalingBp: SafeInt(10_000),
        },
        {
          channelId: "radar01",
          assignedLayer: Layer.HEAVY_AA,
          saturationGroup: SafeInt(0),
          diminishingReturnsBp: SafeInt(10_000),
        },
        SafeInt(10_000),
      );

      expect(state.disruptionRecords).toEqual([]);
    });

    it("should initialize Maps (ammunition seeded to magazineCapacity; others empty)", () => {
      const system = createAirDefenseSystemDefinition({
        systemId: "sys_001",
        layer: Layer.HEAVY_AA,
        profileEligibility: new Set(["CA"]),
        engagementChannels: new Set(["ch001"]),
      });

      const state = createAirDefenseState(
        "ship_001",
        "SHIP",
        [system],
        {
          channelId: "ch001",
          assignedLayer: Layer.HEAVY_AA,
          directorIndex: SafeInt(0),
          scalingBp: SafeInt(10_000),
        },
        {
          channelId: "radar01",
          assignedLayer: Layer.HEAVY_AA,
          saturationGroup: SafeInt(0),
          diminishingReturnsBp: SafeInt(10_000),
        },
        SafeInt(10_000),
      );

      expect(state.ammunitionByType.size).toBe(1);
      expect(Number(state.ammunitionByType.get("sys_001"))).toBe(1_000);
      expect(state.targetAllocations.size).toBe(0);
      expect(state.channelReservations.size).toBe(0);
    });
  });

  describe("validation errors", () => {
    it("should reject empty defenderId", () => {
      const system = createAirDefenseSystemDefinition({
        systemId: "sys_001",
        layer: Layer.HEAVY_AA,
        profileEligibility: new Set(["CA"]),
        engagementChannels: new Set(["ch001"]),
      });

      expect(() => {
        createAirDefenseState(
          "",
          "SHIP",
          [system],
          {
            channelId: "ch001",
            assignedLayer: Layer.HEAVY_AA,
            directorIndex: SafeInt(0),
            scalingBp: SafeInt(10_000),
          },
          {
            channelId: "radar01",
            assignedLayer: Layer.HEAVY_AA,
            saturationGroup: SafeInt(0),
            diminishingReturnsBp: SafeInt(10_000),
          },
          SafeInt(10_000),
        );
      }).toThrow("defenderId must be a non-empty string");
    });

    it("should reject empty systems array", () => {
      expect(() => {
        createAirDefenseState(
          "ship_001",
          "SHIP",
          [],
          {
            channelId: "ch001",
            assignedLayer: Layer.HEAVY_AA,
            directorIndex: SafeInt(0),
            scalingBp: SafeInt(10_000),
          },
          {
            channelId: "radar01",
            assignedLayer: Layer.HEAVY_AA,
            saturationGroup: SafeInt(0),
            diminishingReturnsBp: SafeInt(10_000),
          },
          SafeInt(10_000),
        );
      }).toThrow("systems must be a non-empty array");
    });
  });

  describe("multiple systems", () => {
    it("should handle multiple systems in order", () => {
      const system1 = createAirDefenseSystemDefinition({
        systemId: "sys_001",
        layer: Layer.HEAVY_AA,
        profileEligibility: new Set(["CA"]),
        engagementChannels: new Set(["ch001"]),
      });

      const system2 = createAirDefenseSystemDefinition({
        systemId: "sys_002",
        layer: Layer.LIGHT_AA,
        profileEligibility: new Set(["DD"]),
        engagementChannels: new Set(["ch002"]),
      });

      const state = createAirDefenseState(
        "ship_001",
        "SHIP",
        [system1, system2],
        {
          channelId: "ch001",
          assignedLayer: Layer.HEAVY_AA,
          directorIndex: SafeInt(0),
          scalingBp: SafeInt(10_000),
        },
        {
          channelId: "radar01",
          assignedLayer: Layer.HEAVY_AA,
          saturationGroup: SafeInt(0),
          diminishingReturnsBp: SafeInt(10_000),
        },
        SafeInt(10_000),
      );

      expect(state.systems.length).toBe(2);
      expect(state.systems[0].systemId).toBe("sys_001");
      expect(state.systems[1].systemId).toBe("sys_002");
    });
  });

  describe("disruption records", () => {
    it("should add disruption record via addDisruptionRecord", () => {
      const system = createAirDefenseSystemDefinition({
        systemId: "sys_001",
        layer: Layer.LIGHT_AA,
        profileEligibility: new Set(["CA"]),
        engagementChannels: new Set(["ch001"]),
      });

      const state = createAirDefenseState(
        "ship_001",
        "SHIP",
        [system],
        {
          channelId: "ch001",
          assignedLayer: Layer.HEAVY_AA,
          directorIndex: SafeInt(0),
          scalingBp: SafeInt(10_000),
        },
        {
          channelId: "radar01",
          assignedLayer: Layer.HEAVY_AA,
          saturationGroup: SafeInt(0),
          diminishingReturnsBp: SafeInt(10_000),
        },
        SafeInt(10_000),
      );

      const next = addDisruptionRecord(
        state,
        DisruptionSeverity.LIGHT,
        SafeInt(9_000),
        Layer.LIGHT_AA,
      );

      expect(next.disruptionRecords.length).toBe(1);
      expect(next.disruptionRecords[0].severity).toBe(DisruptionSeverity.LIGHT);
      expect(Number(next.disruptionRecords[0].bp)).toBe(9_000);
      expect(next.disruptionRecords[0].layer).toBe(Layer.LIGHT_AA);
      expect(next.stateHash).not.toBe(state.stateHash);
    });
  });

  describe("BluewaveError reason code", () => {
    const system = createAirDefenseSystemDefinition({
      systemId: "sys_001",
      layer: Layer.HEAVY_AA,
      profileEligibility: new Set(["CA"]),
      engagementChannels: new Set(["ch001"]),
    });

    it("createAirDefenseState should throw BluewaveError with INVALID_AIR_DEFENSE_STATE for empty defenderId", () => {
      let caught: unknown;
      try {
        createAirDefenseState(
          "",
          "SHIP",
          [system],
          {
            channelId: "ch001",
            assignedLayer: Layer.HEAVY_AA,
            directorIndex: SafeInt(0),
            scalingBp: SafeInt(10_000),
          },
          {
            channelId: "radar01",
            assignedLayer: Layer.HEAVY_AA,
            saturationGroup: SafeInt(0),
            diminishingReturnsBp: SafeInt(10_000),
          },
          SafeInt(10_000),
        );
      } catch (e) {
        caught = e;
      }
      expect(isBluewaveError(caught)).toBe(true);
      expect((caught as BluewaveError).context.code).toBe(INVALID_AIR_DEFENSE_STATE);
    });

    it("createAirDefenseState should throw BluewaveError with INVALID_AIR_DEFENSE_STATE for empty systems", () => {
      let caught: unknown;
      try {
        createAirDefenseState(
          "ship_001",
          "SHIP",
          [],
          {
            channelId: "ch001",
            assignedLayer: Layer.HEAVY_AA,
            directorIndex: SafeInt(0),
            scalingBp: SafeInt(10_000),
          },
          {
            channelId: "radar01",
            assignedLayer: Layer.HEAVY_AA,
            saturationGroup: SafeInt(0),
            diminishingReturnsBp: SafeInt(10_000),
          },
          SafeInt(10_000),
        );
      } catch (e) {
        caught = e;
      }
      expect(isBluewaveError(caught)).toBe(true);
      expect((caught as BluewaveError).context.code).toBe(INVALID_AIR_DEFENSE_STATE);
    });
  });
});
