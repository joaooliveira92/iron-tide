import { describe, expect, it } from "vite-plus/test";
import {
  CONSTRUCTION_PROJECT_STATUSES,
  CONSTRUCTION_PROJECT_TRANSITIONS,
  ConstructionProjectTransitionError,
  TERMINAL_CONSTRUCTION_PROJECT_STATUSES,
  assertConstructionProjectTransition,
  canTransitionConstructionProject,
  isTerminalConstructionProjectStatus,
  nextConstructionProjectStatus,
  transitionConstructionProject,
  type ConstructionProjectStatus,
} from "../src/index.js";

describe("dockyard project status model (DESIGN-23 section 2)", () => {
  it("is exactly the ten documented statuses", () => {
    expect([...CONSTRUCTION_PROJECT_STATUSES]).toEqual([
      "PLANNED",
      "AUTHORIZED",
      "AWAITING_CAPACITY",
      "ACTIVE",
      "HALTED",
      "DELAYED",
      "ACCELERATED",
      "COMPLETED",
      "CANCELLED",
      "IMPOUNDED",
    ]);
  });

  it("marks COMPLETED and CANCELLED terminal; IMPOUNDED is not", () => {
    expect([...TERMINAL_CONSTRUCTION_PROJECT_STATUSES]).toEqual(["COMPLETED", "CANCELLED"]);
    expect(isTerminalConstructionProjectStatus("COMPLETED")).toBe(true);
    expect(isTerminalConstructionProjectStatus("CANCELLED")).toBe(true);
    expect(isTerminalConstructionProjectStatus("IMPOUNDED")).toBe(false);
  });

  it("a terminal status has no outgoing transition", () => {
    expect(CONSTRUCTION_PROJECT_TRANSITIONS.COMPLETED).toEqual([]);
    expect(CONSTRUCTION_PROJECT_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it("permits the engine's real lifecycle PLANNED -> ACTIVE -> COMPLETED and the steering statuses", () => {
    expect(canTransitionConstructionProject("PLANNED", "ACTIVE")).toBe(true);
    expect(canTransitionConstructionProject("ACTIVE", "HALTED")).toBe(true);
    expect(canTransitionConstructionProject("HALTED", "ACTIVE")).toBe(true);
    expect(canTransitionConstructionProject("ACTIVE", "DELAYED")).toBe(true);
    expect(canTransitionConstructionProject("ACTIVE", "ACCELERATED")).toBe(true);
    expect(canTransitionConstructionProject("ACTIVE", "COMPLETED")).toBe(true);
    expect(canTransitionConstructionProject("ACTIVE", "IMPOUNDED")).toBe(true);
    expect(canTransitionConstructionProject("IMPOUNDED", "ACTIVE")).toBe(true);
  });

  it("refuses an illegal transition and changes no state", () => {
    expect(canTransitionConstructionProject("COMPLETED", "ACTIVE")).toBe(false);
    expect(canTransitionConstructionProject("CANCELLED", "ACTIVE")).toBe(false);
    expect(canTransitionConstructionProject("PLANNED", "IMPOUNDED")).toBe(false);
    expect(() => assertConstructionProjectTransition("COMPLETED", "ACTIVE")).toThrow(
      ConstructionProjectTransitionError,
    );
    try {
      assertConstructionProjectTransition("COMPLETED", "ACTIVE");
    } catch (e) {
      expect((e as ConstructionProjectTransitionError).code).toBe(
        "INVALID_DOCKYARD_PROJECT_TRANSITION",
      );
      expect((e as ConstructionProjectTransitionError).from).toBe<ConstructionProjectStatus>(
        "COMPLETED",
      );
      expect((e as ConstructionProjectTransitionError).to).toBe<ConstructionProjectStatus>(
        "ACTIVE",
      );
    }
  });

  it("treats an equal status as a no-op, never a transition", () => {
    expect(canTransitionConstructionProject("ACTIVE", "ACTIVE")).toBe(false);
    expect(nextConstructionProjectStatus("ACTIVE", "ACTIVE")).toBeUndefined();
    const project = { id: "p1", status: "ACTIVE" as const };
    expect(transitionConstructionProject(project, "ACTIVE")).toBe(project);
    expect(transitionConstructionProject(project, "HALTED")).toEqual({
      id: "p1",
      status: "HALTED",
    });
  });

  it("throws from transitionConstructionProject on an illegal move", () => {
    expect(() =>
      transitionConstructionProject({ id: "p1", status: "COMPLETED" as const }, "ACTIVE"),
    ).toThrow(ConstructionProjectTransitionError);
  });

  it("is deterministic and pure: repeated transitions serialize identically and mutate nothing", () => {
    const project = { id: "p1", status: "ACTIVE" as const, completedWork: 7 };
    const a = transitionConstructionProject(project, "HALTED");
    const b = transitionConstructionProject(project, "HALTED");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(project.status).toBe("ACTIVE");
    expect(JSON.stringify(transitionConstructionProject(a, "ACTIVE"))).toBe(
      JSON.stringify(transitionConstructionProject(b, "ACTIVE")),
    );
  });
});
