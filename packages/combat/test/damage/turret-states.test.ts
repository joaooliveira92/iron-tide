//packages/combat/test/damage/turret-states.test.ts
// INC-4 — Turret states (DESIGN-41 §7).
// Proves: 5 states, jam duration, no elapsed-time restoration.
import { describe, it, expect } from "vite-plus/test";
import { applyTurretDamage, type TurretComponent } from "../../src/damage/index.js";
import { type ComponentOutcome } from "../../src/damage/index.js";

// ---------------------------------------------------------------------------
// Helpers

function operational(id = "TURRET-1"): TurretComponent {
  return { id, state: "OPERATIONAL" };
}

function jammed(id = "TURRET-1"): TurretComponent {
  return { id, state: "JAMMED", jamDurationMinutes: 5 };
}

function disabled(id = "TURRET-1"): TurretComponent {
  return { id, state: "DISABLED" };
}

function destroyed(id = "TURRET-1"): TurretComponent {
  return { id, state: "DESTROYED" };
}

function burnedOut(id = "TURRET-1"): TurretComponent {
  return { id, state: "BURNED_OUT" };
}

// ---------------------------------------------------------------------------
// §7 — Five turret states

describe("AC-4: Five turret states (§7)", () => {
  it("OPERATIONAL: UNAFFECTED outcome keeps turret operational", () => {
    const result = applyTurretDamage(operational(), "UNAFFECTED");
    expect(result.state).toBe("OPERATIONAL");
  });

  it("OPERATIONAL: DEGRADED outcome keeps turret operational (degraded accuracy)", () => {
    const result = applyTurretDamage(operational(), "DEGRADED");
    expect(result.state).toBe("OPERATIONAL");
  });

  it("JAMMED: JAMMED outcome transitions to JAMMED with default 5 min duration", () => {
    const result = applyTurretDamage(operational(), "JAMMED");
    expect(result.state).toBe("JAMMED");
    expect(result.jamDurationMinutes).toBe(5);
  });

  it("DISABLED: DISABLED outcome transitions to DISABLED", () => {
    const result = applyTurretDamage(operational(), "DISABLED");
    expect(result.state).toBe("DISABLED");
  });

  it("DESTROYED: DESTROYED outcome transitions to DESTROYED", () => {
    const result = applyTurretDamage(operational(), "DESTROYED");
    expect(result.state).toBe("DESTROYED");
  });

  it("BURNED_OUT: BURNED_OUT outcome transitions to BURNED_OUT", () => {
    const result = applyTurretDamage(operational(), "BURNED_OUT");
    expect(result.state).toBe("BURNED_OUT");
  });
});

// ---------------------------------------------------------------------------
// §7 — Jam duration

describe("AC-4: Jam duration (§7)", () => {
  it("JAMMED sets jamDurationMinutes to 5 by default", () => {
    const result = applyTurretDamage(operational(), "JAMMED");
    expect(result.jamDurationMinutes).toBe(5);
  });

  it("JAMMED always resets jamDurationMinutes to 5 (new jam event)", () => {
    const turret: TurretComponent = { id: "TURRET-1", state: "OPERATIONAL", jamDurationMinutes: 3 };
    const result = applyTurretDamage(turret, "JAMMED");
    // New jam event resets to default 5
    expect(result.jamDurationMinutes).toBe(5);
  });

  it("non-JAMMED states have no jamDurationMinutes", () => {
    const result = applyTurretDamage(operational(), "DISABLED");
    expect(result.jamDurationMinutes).toBeUndefined();
  });

  it("DESTROYED outcome has no jamDurationMinutes", () => {
    const result = applyTurretDamage(operational(), "DESTROYED");
    expect(result.jamDurationMinutes).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// §7 — No elapsed-time restoration (AC-6)

describe("AC-4: No elapsed-time restoration (§7, AC-6)", () => {
  it("FLOODED maps to DISABLED (no auto-restoration)", () => {
    const result = applyTurretDamage(operational(), "FLOODED");
    expect(result.state).toBe("DISABLED");
    expect(result.jamDurationMinutes).toBeUndefined();
  });

  it("ISOLATED maps to DISABLED (no auto-restoration)", () => {
    const result = applyTurretDamage(operational(), "ISOLATED");
    expect(result.state).toBe("DISABLED");
    expect(result.jamDurationMinutes).toBeUndefined();
  });

  it("a turret already in DISABLED stays DISABLED when hit by JAMMED (no downgrade)", () => {
    const result = applyTurretDamage(disabled(), "JAMMED");
    expect(result.state).toBe("DISABLED");
  });

  it("a turret already in DESTROYED stays DESTROYED when hit by JAMMED", () => {
    const result = applyTurretDamage(destroyed(), "JAMMED");
    expect(result.state).toBe("DESTROYED");
  });

  it("a turret already in BURNED_OUT stays BURNED_OUT when hit by DISABLED", () => {
    const result = applyTurretDamage(burnedOut(), "DISABLED");
    expect(result.state).toBe("BURNED_OUT");
  });

  it("a turret already in DESTROYED stays DESTROYED when hit by DISABLED", () => {
    const result = applyTurretDamage(destroyed(), "DISABLED");
    expect(result.state).toBe("DESTROYED");
  });

  it("a turret already in JAMMED stays JAMMED when hit by DEGRADED (no downgrade)", () => {
    const result = applyTurretDamage(jammed(), "DEGRADED");
    expect(result.state).toBe("JAMMED");
  });

  it("a turret already in JAMMED can escalate to DISABLED", () => {
    const result = applyTurretDamage(jammed(), "DISABLED");
    expect(result.state).toBe("DISABLED");
  });

  it("a turret already in DISABLED can escalate to DESTROYED", () => {
    const result = applyTurretDamage(disabled(), "DESTROYED");
    expect(result.state).toBe("DESTROYED");
  });

  it("a turret already in DISABLED can escalate to BURNED_OUT", () => {
    const result = applyTurretDamage(disabled(), "BURNED_OUT");
    expect(result.state).toBe("BURNED_OUT");
  });
});

// ---------------------------------------------------------------------------
// Edge cases

describe("AC-4: Edge cases", () => {
  it("turret id is preserved through transitions", () => {
    const result = applyTurretDamage(operational("TURRET-A"), "DESTROYED");
    expect(result.id).toBe("TURRET-A");
  });

  it("all component outcomes have a defined mapping", () => {
    const outcomes: ComponentOutcome[] = [
      "UNAFFECTED",
      "DEGRADED",
      "JAMMED",
      "DISABLED",
      "DESTROYED",
      "BURNED_OUT",
      "FLOODED",
      "ISOLATED",
    ];
    for (const outcome of outcomes) {
      const result = applyTurretDamage(operational(), outcome);
      expect(result.state).toBeDefined();
    }
  });
});
