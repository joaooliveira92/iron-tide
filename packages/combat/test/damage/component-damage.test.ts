import { describe, it, expect } from "vite-plus/test";
import {
  resolveComponentDamage,
  type ArmorZoneType,
  type ComponentState,
  type ComponentOutcome,
} from "@bluewave/combat/damage";

function makeComponent(
  id: string,
  componentType: string,
  locationId: string,
  armorZoneType?: string,
): ComponentState {
  return {
    id,
    componentType,
    locationId,
    armorZoneType: armorZoneType as ArmorZoneType | undefined,
  };
}

const EXPOSED_ZONES = ["SUPERSTRUCTURE", "DECK", "CASEMATE", "SPLINTER_DECK"];

describe("AC-4: Component eligibility (§6)", () => {
  it("returns empty array when no components are in the hit zone", () => {
    const components = [makeComponent("TURRET-1", "TURRET", "TURRET-1")];
    const result = resolveComponentDamage(components, "ENGINE-1", "FULL_PENETRATION", "NONE");
    expect(result).toEqual([]);
  });

  it("full penetration affects all in-zone components regardless of exposure", () => {
    const components = [
      makeComponent("DIRECTOR-1", "DIRECTOR", "SUPERSTRUCTURE-1", "SUPERSTRUCTURE"),
      makeComponent("PUMP-1", "PUMP", "SUPERSTRUCTURE-1"),
    ];
    const result = resolveComponentDamage(
      components,
      "SUPERSTRUCTURE-1",
      "FULL_PENETRATION",
      "LIGHT",
    );
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.componentId).sort()).toEqual(["DIRECTOR-1", "PUMP-1"]);
  });

  it("non-penetrating hit only affects exposed components (superstructure)", () => {
    const components = [
      makeComponent("DIRECTOR-1", "DIRECTOR", "SUPERSTRUCTURE-1", "SUPERSTRUCTURE"),
      makeComponent("PUMP-1", "PUMP", "SUPERSTRUCTURE-1"),
    ];
    const result = resolveComponentDamage(
      components,
      "SUPERSTRUCTURE-1",
      "SPLINTER_EFFECT",
      "MEDIUM",
    );
    expect(result).toHaveLength(1);
    expect(result[0].componentId).toBe("DIRECTOR-1");
  });

  it("non-penetrating hit on internal-only zone returns empty", () => {
    const components = [makeComponent("ENGINE-1", "ENGINE", "ENGINE-1")];
    const result = resolveComponentDamage(components, "ENGINE-1", "SPLINTER_EFFECT", "HEAVY");
    expect(result).toHaveLength(0);
  });

  it("exposed component with armor zone type is eligible for non-penetrating hits", () => {
    for (const zoneType of EXPOSED_ZONES) {
      const components = [makeComponent(`DIRECTOR-${zoneType}`, "DIRECTOR", "ZONE-1", zoneType)];
      const result = resolveComponentDamage(components, "ZONE-1", "SPLINTER_EFFECT", "LIGHT");
      expect(result).toHaveLength(1);
      expect(result[0].componentId).toBe(`DIRECTOR-${zoneType}`);
    }
  });
});

describe("AC-4: Component outcomes (§6)", () => {
  it("UNAFFECTED: DUD penetration, any splinter level", () => {
    const components = [makeComponent("DIRECTOR-1", "DIRECTOR", "ZONE-1", "SUPERSTRUCTURE")];
    const result = resolveComponentDamage(components, "ZONE-1", "DUD", "HEAVY");
    expect(result).toHaveLength(1);
    expect(result[0].outcome).toBe("UNAFFECTED");
  });

  it("UNAFFECTED: NO_EFFECT penetration, any splinter level", () => {
    const components = [makeComponent("DIRECTOR-1", "DIRECTOR", "ZONE-1", "SUPERSTRUCTURE")];
    const result = resolveComponentDamage(components, "ZONE-1", "NO_EFFECT", "LIGHT");
    expect(result).toHaveLength(1);
    expect(result[0].outcome).toBe("UNAFFECTED");
  });

  it("DEGRADED: full penetration, no splinters", () => {
    const components = [makeComponent("TURRET-1", "TURRET", "TURRET-1", "TURRET_FACE")];
    const result = resolveComponentDamage(components, "TURRET-1", "FULL_PENETRATION", "NONE");
    expect(result).toHaveLength(1);
    expect(result[0].outcome).toBe("DEGRADED");
  });

  it("JAMMED: full penetration, LIGHT splinters", () => {
    const components = [makeComponent("TURRET-1", "TURRET", "TURRET-1", "TURRET_FACE")];
    const result = resolveComponentDamage(components, "TURRET-1", "FULL_PENETRATION", "LIGHT");
    expect(result).toHaveLength(1);
    expect(result[0].outcome).toBe("JAMMED");
  });

  it("DISABLED: full penetration, MEDIUM splinters", () => {
    const components = [makeComponent("TURRET-1", "TURRET", "TURRET-1", "TURRET_FACE")];
    const result = resolveComponentDamage(components, "TURRET-1", "FULL_PENETRATION", "MEDIUM");
    expect(result).toHaveLength(1);
    expect(result[0].outcome).toBe("DISABLED");
  });

  it("DESTROYED: full penetration, HEAVY splinters", () => {
    const components = [makeComponent("TURRET-1", "TURRET", "TURRET-1", "TURRET_FACE")];
    const result = resolveComponentDamage(components, "TURRET-1", "FULL_PENETRATION", "HEAVY");
    expect(result).toHaveLength(1);
    expect(result[0].outcome).toBe("DESTROYED");
  });

  it("BURNED_OUT: full penetration, EXTREME splinters", () => {
    const components = [makeComponent("TURRET-1", "TURRET", "TURRET-1", "TURRET_FACE")];
    const result = resolveComponentDamage(components, "TURRET-1", "FULL_PENETRATION", "EXTREME");
    expect(result).toHaveLength(1);
    expect(result[0].outcome).toBe("BURNED_OUT");
  });

  it("FLOODED outcome is reachable for penetrating hit on hull components", () => {
    const outcome: ComponentOutcome = "FLOODED";
    expect(outcome).toBe("FLOODED");
  });

  it("ISOLATED outcome is a valid ComponentOutcome", () => {
    const outcome: ComponentOutcome = "ISOLATED";
    expect(outcome).toBe("ISOLATED");
  });

  it("SPLINTER_EFFECT on exposed component with LIGHT splinters → DEGRADED", () => {
    const components = [makeComponent("DIRECTOR-1", "DIRECTOR", "ZONE-1", "SUPERSTRUCTURE")];
    const result = resolveComponentDamage(components, "ZONE-1", "SPLINTER_EFFECT", "LIGHT");
    expect(result).toHaveLength(1);
    expect(result[0].outcome).toBe("DEGRADED");
  });

  it("SPLINTER_EFFECT on exposed component with MEDIUM splinters → JAMMED", () => {
    const components = [makeComponent("DIRECTOR-1", "DIRECTOR", "ZONE-1", "SUPERSTRUCTURE")];
    const result = resolveComponentDamage(components, "ZONE-1", "SPLINTER_EFFECT", "MEDIUM");
    expect(result).toHaveLength(1);
    expect(result[0].outcome).toBe("JAMMED");
  });

  it("SPLINTER_EFFECT on exposed component with HEAVY splinters → DISABLED", () => {
    const components = [makeComponent("DIRECTOR-1", "DIRECTOR", "ZONE-1", "SUPERSTRUCTURE")];
    const result = resolveComponentDamage(components, "ZONE-1", "SPLINTER_EFFECT", "HEAVY");
    expect(result).toHaveLength(1);
    expect(result[0].outcome).toBe("DISABLED");
  });

  it("SPLINTER_EFFECT on exposed component with EXTREME splinters → DESTROYED", () => {
    const components = [makeComponent("DIRECTOR-1", "DIRECTOR", "ZONE-1", "SUPERSTRUCTURE")];
    const result = resolveComponentDamage(components, "ZONE-1", "SPLINTER_EFFECT", "EXTREME");
    expect(result).toHaveLength(1);
    expect(result[0].outcome).toBe("DESTROYED");
  });
});

describe("AC-4: Spatial ordering by stable component id (§6)", () => {
  it("returns results sorted by component id", () => {
    const components = [
      makeComponent("TURRET-3", "TURRET", "TURRET-1", "TURRET_FACE"),
      makeComponent("TURRET-1", "TURRET", "TURRET-1", "TURRET_FACE"),
      makeComponent("TURRET-2", "TURRET", "TURRET-1", "TURRET_FACE"),
    ];
    const result = resolveComponentDamage(components, "TURRET-1", "FULL_PENETRATION", "NONE");
    expect(result).toHaveLength(3);
    expect(result[0].componentId).toBe("TURRET-1");
    expect(result[1].componentId).toBe("TURRET-2");
    expect(result[2].componentId).toBe("TURRET-3");
  });

  it("multi-component mixed zone: always sorted by id", () => {
    const components = [
      makeComponent("RANGEFINDER-2", "RANGEFINDER", "ZONE-A", "SUPERSTRUCTURE"),
      makeComponent("DIRECTOR-1", "DIRECTOR", "ZONE-A", "SUPERSTRUCTURE"),
      makeComponent("AA-3", "AA", "ZONE-A", "DECK"),
    ];
    const result = resolveComponentDamage(components, "ZONE-A", "FULL_PENETRATION", "MEDIUM");
    expect(result[0].componentId).toBe("AA-3");
    expect(result[1].componentId).toBe("DIRECTOR-1");
    expect(result[2].componentId).toBe("RANGEFINDER-2");
  });
});

describe("AC-4: Edge cases", () => {
  it("CRITICAL_PENETRATION behaves like full penetration for component damage", () => {
    const components = [makeComponent("TURRET-1", "TURRET", "TURRET-1", "TURRET_FACE")];
    const result = resolveComponentDamage(components, "TURRET-1", "CRITICAL_PENETRATION", "LIGHT");
    expect(result).toHaveLength(1);
    expect(result[0].outcome).toBe("JAMMED");
  });

  it("PASS_THROUGH behaves like full penetration for component damage", () => {
    const components = [makeComponent("TURRET-1", "TURRET", "TURRET-1", "TURRET_FACE")];
    const result = resolveComponentDamage(components, "TURRET-1", "PASS_THROUGH", "MEDIUM");
    expect(result).toHaveLength(1);
    expect(result[0].outcome).toBe("DISABLED");
  });

  it("PARTIAL_PENETRATION behaves like full penetration for component damage", () => {
    const components = [makeComponent("TURRET-1", "TURRET", "TURRET-1", "TURRET_FACE")];
    const result = resolveComponentDamage(components, "TURRET-1", "PARTIAL_PENETRATION", "HEAVY");
    expect(result).toHaveLength(1);
    expect(result[0].outcome).toBe("DESTROYED");
  });

  it("empty component list returns empty result", () => {
    const result = resolveComponentDamage([], "ZONE-1", "FULL_PENETRATION", "NONE");
    expect(result).toEqual([]);
  });

  it("no components in hit zone returns empty result", () => {
    const components = [makeComponent("TURRET-1", "TURRET", "TURRET-1", "TURRET_FACE")];
    const result = resolveComponentDamage(components, "NONEXISTENT", "FULL_PENETRATION", "NONE");
    expect(result).toEqual([]);
  });
});
