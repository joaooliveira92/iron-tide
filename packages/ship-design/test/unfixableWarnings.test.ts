import { describe, expect, it } from "vite-plus/test";
import { compileDesign, type DesignDraft, type Finding } from "../src/index.js";
import { checkFindingShape } from "../src/findings.js";
import { earlyContext, readReferenceDesignEntries } from "./helpers/earlyContext.js";

const designs = readReferenceDesignEntries() as {
  id: string;
  month: string;
  draft: DesignDraft;
}[];
const opening = designs.filter((d) => d.month < "1893-01");
const isAccept = (id: string) => id.startsWith("accept");
const clearable = (f: Finding) => f.remedies.some((r) => !isAccept(r.id));

describe("warnings the player can clear", () => {
  it("1880 reference designs carry no FC_INCOMPATIBLE while no director is offered", () => {
    expect(opening.length).toBeGreaterThan(0);
    for (const d of opening) {
      const r = compileDesign(d.draft, earlyContext("1880-01"));
      expect(r.findings.filter((f) => f.id === "FC_INCOMPATIBLE").map(() => d.id)).toEqual([]);
    }
  });

  it("FC_INCOMPATIBLE fires again once a director is offered", () => {
    const hits = opening.filter((d) =>
      compileDesign(d.draft, {
        ...earlyContext("1893-06"),
        unlockedTechs: new Set(["fc_basic_rangefinding"]),
      }).findings.some((f) => f.id === "FC_INCOMPATIBLE"),
    );
    expect(hits.length).toBeGreaterThan(0);
  });

  it("every WARNING on every reference design has a remedy that is not an accept", () => {
    for (const d of designs) {
      const r = compileDesign(d.draft, earlyContext(d.month));
      const stuck = r.findings
        .filter((f) => f.severity === "WARNING" && !clearable(f))
        .map((f) => `${d.id}:${f.id}`);
      expect(stuck).toEqual([]);
    }
  });

  it("the finding shape rejects a WARNING whose only escape is accepting it", () => {
    const f: Finding = {
      id: "X",
      severity: "WARNING",
      what: "w",
      why: "y",
      consequence: "c",
      remedies: [
        { id: "accept", description: "a" },
        { id: "accept_risk", description: "b" },
      ],
      evidence: { formulaId: "F", inputs: {}, threshold: 0, value: 0 },
    };
    expect(checkFindingShape(f)).toContain("WARNING requires a remedy that is not an accept");
  });
});
