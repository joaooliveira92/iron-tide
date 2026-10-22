import { describe, it, expect } from "vite-plus/test";
import {
  evaluateTerminalSeam,
  computeSinkingDuration,
  type TerminalInput,
} from "@bluewave/combat/damage";
import { SHIP_SINKING, SHIP_FOUNDERED } from "@bluewave/combat/damage";

function baseTerminalInput(overrides: Partial<TerminalInput> = {}): TerminalInput {
  return {
    flotationReserveAfter: 10_000,
    structuralIntegrityAfter: 50_000,
    progressiveFloodingTotal: 0,
    catastrophicBreakup: false,
    capsizeRisk: false,
    currentTerminalStatus: "NORMAL",
    flotationPct: 2_000,
    stabilityPct: 8_000,
    ...overrides,
  };
}

describe("AC-5: SINKING formula (§31)", () => {
  it("computes sinking duration from flotation and stability percentages", () => {
    const duration = computeSinkingDuration(2_000, 8_000);
    expect(duration).toBe(19);
  });

  it("clamps to minimum 10 minutes", () => {
    const duration = computeSinkingDuration(1, 1);
    expect(duration).toBe(10);
  });

  it("clamps to maximum 360 minutes", () => {
    const duration = computeSinkingDuration(10_000, 10_000);
    expect(duration).toBe(120);
  });

  it("handles zero percentages", () => {
    const duration = computeSinkingDuration(0, 0);
    expect(duration).toBe(10);
  });

  it("handles one zero percentage", () => {
    const duration = computeSinkingDuration(5_000, 0);
    expect(duration).toBe(10);
  });

  it("produces different durations for different flotation levels", () => {
    const fullFloat = computeSinkingDuration(10_000, 10_000);
    const halfFloat = computeSinkingDuration(5_000, 10_000);
    const quarterFloat = computeSinkingDuration(2_500, 10_000);

    expect(fullFloat).toBeGreaterThan(halfFloat);
    expect(halfFloat).toBeGreaterThan(quarterFloat);
  });
});

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
