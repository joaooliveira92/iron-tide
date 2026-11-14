import { describe, expect, it } from "vite-plus/test";
import { decidePeaceProposal, decidePeaceResponse } from "../src/peaceBehaviour";

const margin = 20;

function snapshot(attackerWarScore: number, defenderWarScore: number, status = "ACTIVE") {
  return {
    wars: {
      wars: [
        {
          id: "w1",
          attackerId: "a",
          defenderId: "d",
          attackerWarScore,
          defenderWarScore,
          status,
        },
      ],
    },
    world: {
      areas: [
        { id: "home", controller: "d", cessionCost: 5 },
        { id: "far", controller: "d", cessionCost: 30 },
        { id: "near", controller: "d", cessionCost: 10 },
        { id: "unpriced", controller: "d" },
      ],
      possessions: [],
    },
    nations: new Map([["d", { homeAreaId: "home" }]]),
  } as any;
}

describe("decidePeaceProposal", () => {
  it("demands the dearest affordable non-home area when leading by the margin", () => {
    const d = decidePeaceProposal(snapshot(60, 60 - margin), "w1", "a", margin);
    expect(d).toEqual({
      term: { _tag: "CedeArea", areaId: "far" },
      reason: "PROPOSER_LEADS_BY_MARGIN",
    });
  });

  it("skips areas above its war score", () => {
    const d = decidePeaceProposal(snapshot(25, 0), "w1", "a", margin);
    expect(d.term).toEqual({ _tag: "CedeArea", areaId: "near" });
  });

  it("reports no affordable area", () => {
    const unpriced = snapshot(margin, 0);
    unpriced.world.areas = [{ id: "unpriced", controller: "d" }];
    expect(decidePeaceProposal(unpriced, "w1", "a", margin)).toEqual({
      term: undefined,
      reason: "NO_AFFORDABLE_AREA",
    });
  });

  it("offers status quo when trailing by the margin", () => {
    expect(decidePeaceProposal(snapshot(0, margin), "w1", "a", margin)).toEqual({
      term: { _tag: "StatusQuo" },
      reason: "PROPOSER_TRAILS_BY_MARGIN",
    });
  });

  it("stays silent when scores are close", () => {
    expect(decidePeaceProposal(snapshot(5, 0), "w1", "a", margin).reason).toBe(
      "SCORES_WITHIN_MARGIN",
    );
  });

  it("rejects inactive wars and outsiders", () => {
    expect(decidePeaceProposal(snapshot(50, 0, "ENDED"), "w1", "a", margin).reason).toBe(
      "WAR_NOT_ACTIVE",
    );
    expect(decidePeaceProposal(snapshot(50, 0), "w1", "x", margin).reason).toBe("NOT_A_PRINCIPAL");
  });
});

describe("decidePeaceResponse", () => {
  const cede = { _tag: "CedeArea", areaId: "far" } as const;

  it("accepts a cession when the responder trails by the margin", () => {
    expect(decidePeaceResponse(snapshot(margin, 0), "w1", "d", cede, margin)).toEqual({
      accept: true,
      reason: "PROPOSER_LEADS_BY_MARGIN",
    });
  });

  it("refuses a cession when the responder trails by less than the margin", () => {
    expect(decidePeaceResponse(snapshot(margin - 1, 0), "w1", "d", cede, margin)).toEqual({
      accept: false,
      reason: "SCORES_WITHIN_MARGIN",
    });
  });

  it("refuses status quo when the responder leads by the margin", () => {
    expect(
      decidePeaceResponse(snapshot(0, margin), "w1", "d", { _tag: "StatusQuo" }, margin),
    ).toEqual({ accept: false, reason: "PROPOSER_TRAILS_BY_MARGIN" });
    expect(
      decidePeaceResponse(snapshot(0, 0), "w1", "d", { _tag: "StatusQuo" }, margin).accept,
    ).toBe(true);
  });
});
