import { describe, expect, it } from "vite-plus/test";
import type { Finding, Severity } from "@bluewave/ship-design";
import { loadDrawingBoardContent } from "../../components/design-workspace/index.js";
import type { BoardFinding } from "../../components/design-workspace/validation/boardFindings.js";
import type { ShipEntity } from "../../components/design-workspace/selection/store.js";
import { flawQueue, viewForEntity } from "./flaw.js";

const content = loadDrawingBoardContent();
const draft = content.references[0]!.draft;
const gun = draft.placements.find((p) => p.componentId.includes("gun"))!;

const finding = (
  severity: Severity,
  over: Partial<BoardFinding> = {},
  key = `${severity}-${over.rule ?? "rule"}`,
): BoardFinding => {
  const raw: Finding = {
    id: "TEST_RULE",
    severity,
    what: `${severity} title`,
    why: "because",
    consequence: "consequence",
    remedies: [],
    evidence: { formulaId: "X", inputs: {}, threshold: 0, value: 1 },
  };
  return {
    key,
    finding: raw,
    severity,
    rule: raw.id,
    title: `${severity} title`,
    explanation: "because",
    entities: [{ kind: "ship" }],
    association: "structured",
    settings: undefined,
    value: 1,
    limit: 0,
    bound: undefined,
    unit: undefined,
    ...over,
  };
};

describe("flawQueue", () => {
  it("keeps blocking, critical and warning findings in the order given, and leaves advisories out", () => {
    const queue = flawQueue(
      [finding("BLOCKING"), finding("CRITICAL"), finding("WARNING"), finding("ADVISORY")],
      { draft, content },
    );
    expect(queue.map((f) => f.tier)).toEqual(["blocking", "critical", "warning"]);
  });

  it("says in plain words whether a flaw stops the ship being built", () => {
    const [blocking, critical, warning] = flawQueue(
      [finding("BLOCKING"), finding("CRITICAL"), finding("WARNING")],
      { draft, content },
    );
    expect(blocking!.verdict).toBe("Blocks submission");
    expect(critical!.verdict).toMatch(/can still be built/);
    expect(warning!.verdict).toMatch(/trade-off/);
  });

  it("routes a fix by the finding's settings group", () => {
    const [hull, machinery, armour, brief] = flawQueue(
      [
        finding("BLOCKING", { settings: "hull" }),
        finding("BLOCKING", { settings: "machinery" }),
        finding("WARNING", { settings: "armour" }),
        finding("WARNING", { settings: "brief" }),
      ],
      { draft, content },
    );
    expect(hull!.fix).toEqual({
      place: { section: "hull", tab: "dimensions" },
      label: "Fix in Hull",
    });
    expect(machinery!.fix?.label).toBe("Fix in Machinery");
    expect(armour!.fix?.place).toEqual({ section: "protection", tab: "armour" });
    expect(brief!.fix?.label).toBe("Fix in Overview");
  });

  it("routes an arrangement finding to the section of the fitting it names", () => {
    const [flaw] = flawQueue(
      [
        finding("WARNING", {
          settings: "arrangement",
          entities: [{ kind: "fitting", instanceId: gun.instanceId }],
        }),
      ],
      { draft, content },
    );
    expect(flaw!.fix?.label).toBe("Fix in Armament");
    expect(flaw!.showOn).toEqual({ kind: "fitting", instanceId: gun.instanceId });
  });

  it("offers no fix, but still shows the ship, for a ship-wide finding with no settings", () => {
    const [flaw] = flawQueue([finding("WARNING")], { draft, content });
    expect(flaw!.fix).toBeNull();
    expect(flaw!.showOn).toEqual({ kind: "ship" });
  });

  it("offers neither a fix nor a place on the ship when the finding names nothing", () => {
    const [flaw] = flawQueue([finding("WARNING", { entities: [] })], { draft, content });
    expect(flaw!.fix).toBeNull();
    expect(flaw!.showOn).toBeNull();
  });
});

describe("viewForEntity", () => {
  const fitting: ShipEntity = { kind: "fitting", instanceId: "a" };
  it("keeps the isometric and top drawings for a fitting, and leaves the side drawing for the top", () => {
    expect(viewForEntity(fitting, "top")).toBe("top");
    expect(viewForEntity(fitting, "iso")).toBe("iso");
    expect(viewForEntity(fitting, "side")).toBe("top");
  });

  it("shows sections and machinery rooms on the plan, where they are drawn", () => {
    expect(viewForEntity({ kind: "section", id: "forecastle" }, "iso")).toBe("top");
    expect(viewForEntity({ kind: "machinery-room", index: 0 }, "side")).toBe("top");
  });

  it("leaves the drawing alone for the ship as a whole", () => {
    expect(viewForEntity({ kind: "ship" }, "side")).toBe("side");
  });
});
