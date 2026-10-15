//packages/combat/test/damage/terminal-seam.test.ts
// INC-5 — Terminal seam SINKING / FOUNDERED detection (DESIGN-41 §29-32).
// Proves: SINKING formula, FOUNDERED conditions, boundary values.
import { describe, it, expect } from "vite-plus/test";
import {
  evaluateTerminalSeam,
  computeSinkingDuration,
  type TerminalInput,
} from "../../src/damage/index.js";
import { SHIP_SINKING, SHIP_FOUNDERED } from "../../src/damage/reasonCodes.js";

// ---------------------------------------------------------------------------
// Helpers

function baseTerminalInput(overrides: Partial<TerminalInput> = {}): TerminalInput {
  return {
    flotationReserveAfter: 10_000,
    structuralIntegrityAfter: 50_000,
    progressiveFloodingTotal: 0,
    catastrophicBreakup: false,
    capsizeRisk: false,
    currentTerminalStatus: "NORMAL",
    flotationPct: 2_000, // 20% residual flotation
    stabilityPct: 8_000, // 80% residual stability
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// SINKING formula

describe("AC-5: SINKING formula (§31)", () => {
  it("computes sinking duration from flotation and stability percentages", () => {
    // flotationPct=2000, stabilityPct=8000
    // raw = floor(120 * 2000 * 8000 / 10_000^2) = floor(120 * 16_000_000 / 100_000_000)
    // = floor(120 * 0.16) = floor(19.2) = 19
    // clamp(10, 360, 19) = 19
    const duration = computeSinkingDuration(2_000, 8_000);
    expect(duration).toBe(19);
  });

  it("clamps to minimum 10 minutes", () => {
    // Extremely low percentages: flotationPct=1, stabilityPct=1
    // raw = floor(120 * 1 * 1 / 100_000_000) = floor(0.0000012) = 0
    // clamp(10, 360, 0) = 10
    const duration = computeSinkingDuration(1, 1);
    expect(duration).toBe(10);
  });

  it("clamps to maximum 360 minutes", () => {
    // Very high percentages: flotationPct=10_000, stabilityPct=10_000
    // raw = floor(120 * 10000 * 10000 / 100_000_000) = floor(120 * 1) = 120
    // clamp(10, 360, 120) = 120
    const duration = computeSinkingDuration(10_000, 10_000);
    expect(duration).toBe(120);
  });

  it("handles zero percentages", () => {
    const duration = computeSinkingDuration(0, 0);
    expect(duration).toBe(10); // clamped to minimum
  });

  it("handles one zero percentage", () => {
    const duration = computeSinkingDuration(5_000, 0);
    expect(duration).toBe(10); // clamped to minimum
  });

  it("produces different durations for different flotation levels", () => {
    const fullFloat = computeSinkingDuration(10_000, 10_000);
    const halfFloat = computeSinkingDuration(5_000, 10_000);
    const quarterFloat = computeSinkingDuration(2_500, 10_000);

    expect(fullFloat).toBeGreaterThan(halfFloat);
    expect(halfFloat).toBeGreaterThan(quarterFloat);
  });
});

// ---------------------------------------------------------------------------
// SINKING transition

describe("AC-5: SINKING transition", () => {
  it("transitions to SINKING when flotation reserve reaches 0 and no foundering conditions", () => {
    const result = evaluateTerminalSeam(
      baseTerminalInput({
        flotationReserveAfter: 0,
        structuralIntegrityAfter: 50_000,
        catastrophicBreakup: false,
        capsizeRisk: false,
      }),
    );
    expect(result.transition).toBe("SINKING");
    expect(result.reasonCode).toBe(SHIP_SINKING);
    expect(result.sinkingDurationMinutes).toBeDefined();
    expect(result.sinkingDurationMinutes).toBeGreaterThanOrEqual(10);
  });

  it("does not transition when flotation reserve is positive", () => {
    const result = evaluateTerminalSeam(
      baseTerminalInput({
        flotationReserveAfter: 1,
      }),
    );
    expect(result.transition).toBe("NONE");
    expect(result.reasonCode).toBe("NONE");
  });

  it("does not transition if already SINKING", () => {
    const result = evaluateTerminalSeam(
      baseTerminalInput({
        flotationReserveAfter: 0,
        currentTerminalStatus: "SINKING",
      }),
    );
    expect(result.transition).toBe("NONE");
  });

  it("does not transition if already FOUNDERED", () => {
    const result = evaluateTerminalSeam(
      baseTerminalInput({
        flotationReserveAfter: 0,
        currentTerminalStatus: "FOUNDERED",
      }),
    );
    expect(result.transition).toBe("NONE");
  });
});

// ---------------------------------------------------------------------------
// FOUNDERED transition

describe("AC-5: FOUNDERED conditions (§32)", () => {
  it("transitions to FOUNDERED on catastrophicBreakup", () => {
    const result = evaluateTerminalSeam(
      baseTerminalInput({
        catastrophicBreakup: true,
      }),
    );
    expect(result.transition).toBe("FOUNDERED");
    expect(result.reasonCode).toBe(SHIP_FOUNDERED);
  });

  it("transitions to FOUNDERED when both flotation and structural integrity are 0", () => {
    const result = evaluateTerminalSeam(
      baseTerminalInput({
        flotationReserveAfter: 0,
        structuralIntegrityAfter: 0,
      }),
    );
    expect(result.transition).toBe("FOUNDERED");
    expect(result.reasonCode).toBe(SHIP_FOUNDERED);
  });

  it("transitions to FOUNDERED on capsizeRisk", () => {
    const result = evaluateTerminalSeam(
      baseTerminalInput({
        capsizeRisk: true,
      }),
    );
    expect(result.transition).toBe("FOUNDERED");
    expect(result.reasonCode).toBe(SHIP_FOUNDERED);
  });

  it("FOUNDERED takes precedence over SINKING when both conditions apply", () => {
    // flotation=0 (SINKING) + catastrophicBreakup=true (FOUNDERED) → FOUNDERED
    const result = evaluateTerminalSeam(
      baseTerminalInput({
        flotationReserveAfter: 0,
        catastrophicBreakup: true,
      }),
    );
    expect(result.transition).toBe("FOUNDERED");
  });

  it("FOUNDERED transitions with multiple triggering conditions", () => {
    const result = evaluateTerminalSeam(
      baseTerminalInput({
        flotationReserveAfter: 0,
        structuralIntegrityAfter: 0,
        capsizeRisk: true,
      }),
    );
    expect(result.transition).toBe("FOUNDERED");
  });
});

// ---------------------------------------------------------------------------
// No transition

describe("AC-5: No transition cases", () => {
  it("returns NONE when ship is in NORMAL state with positive flotation", () => {
    const result = evaluateTerminalSeam(
      baseTerminalInput({
        flotationReserveAfter: 50_000,
        structuralIntegrityAfter: 100_000,
      }),
    );
    expect(result.transition).toBe("NONE");
    expect(result.reasonCode).toBe("NONE");
  });

  it("returns NONE when ship is already SINKING with positive values", () => {
    const result = evaluateTerminalSeam(
      baseTerminalInput({
        flotationReserveAfter: 50_000,
        currentTerminalStatus: "SINKING",
      }),
    );
    expect(result.transition).toBe("NONE");
  });
});

// ---------------------------------------------------------------------------
// Boundary values

describe("AC-5: Boundary values", () => {
  it("flotationReserveAfter = 0 triggers SINKING (not FOUNDERED)", () => {
    const result = evaluateTerminalSeam(
      baseTerminalInput({
        flotationReserveAfter: 0,
        structuralIntegrityAfter: 1,
      }),
    );
    expect(result.transition).toBe("SINKING");
  });

  it("flotationReserveAfter = -1 triggers SINKING (treated as exhausted)", () => {
    const result = evaluateTerminalSeam(
      baseTerminalInput({
        flotationReserveAfter: -1,
      }),
    );
    // -1 <= 0 so yes
    expect(result.transition).toBe("SINKING");
  });

  it("edge: flotationReserveAfter = 0, structuralIntegrityAfter = 1 → SINKING", () => {
    const result = evaluateTerminalSeam(
      baseTerminalInput({
        flotationReserveAfter: 0,
        structuralIntegrityAfter: 1,
        catastrophicBreakup: false,
        capsizeRisk: false,
      }),
    );
    expect(result.transition).toBe("SINKING");
  });
});
