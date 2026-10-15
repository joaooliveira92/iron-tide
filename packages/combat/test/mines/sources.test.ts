// AC-3 (INC-2): DESIGN-35 §3 mine sources + eligibility predicate. All six
// canonical source kinds lay when every axis passes; a source missing required
// technology, inventory, access, control, or mission fails with
// MINE_LAYING_SOURCE_INELIGIBLE (field-tagged) — never a silent default.
// The mine type's technology prerequisites + eligible source kinds come from
// the shipped INC-1 definitions (mineTypeDefinitionById).
import { describe, expect, it } from "vite-plus/test";
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  CANONICAL_MINE_SOURCE_KINDS,
  MINE_LAYING_SOURCE_INELIGIBLE,
  mineLayingSourceEligible,
  type EligibleMineLayingSource,
  type MineLayingAction,
  type MineSource,
} from "../../src/mines/index.js";

function validSource(overrides: Partial<MineSource> = {}): MineSource {
  return {
    sourceKind: "CONTROLLED_NAVAL_BASE",
    sourceId: "port_soroka",
    layingParticipantId: "USSR",
    technologyReadiness: true,
    availableTechnologyIds: ["magnetic_mine_technology", "acoustic_mine_technology"],
    availableMineCount: SafeInt(400),
    hasAccess: true,
    hasControl: true,
    hasMission: true,
    ...overrides,
  };
}

function validAction(overrides: Partial<MineLayingAction> = {}): MineLayingAction {
  return {
    sourceKind: "CONTROLLED_NAVAL_BASE",
    sourceId: "port_soroka",
    inventory: { kind: "DECLARED", quantity: SafeInt(120) },
    targetBelligerentIds: ["u002"],
    areaId: "white_sea_south",
    campaignMonth: SafeInt(34),
    layingPolicyId: "laying_policy_v1",
    ...overrides,
  };
}

function expectIneligibility(build: () => EligibleMineLayingSource, field: string): BluewaveError {
  let err: BluewaveError | undefined;
  try {
    build();
  } catch (e) {
    err = e as BluewaveError;
  }
  expect(err).toBeDefined();
  expect(err!.message).toBe(MINE_LAYING_SOURCE_INELIGIBLE);
  expect(err!.context.field).toBe(field);
  return err!;
}

describe("AC-3: all six canonical source kinds are accepted when eligible", () => {
  it("ships exactly the six §3 source kinds", () => {
    expect([...CANONICAL_MINE_SOURCE_KINDS].sort()).toEqual(
      [
        "CONTROLLED_NAVAL_BASE",
        "COASTAL_ARTILLERY_OR_CONTROLLED_MINE_INSTALLATION",
        "MINE_CAPABLE_SURFACE_SHIP",
        "MINELAYING_SUBMARINE",
        "SCENARIO_MINEFIELD",
        "TYPED_EVENT_MINEFIELD",
      ].sort(),
    );
  });

  it("CONTACT accepts every canonical source kind (CONTACT permits all kinds)", () => {
    for (const kind of CANONICAL_MINE_SOURCE_KINDS) {
      const source = validSource({ sourceKind: kind });
      const action = validAction({ sourceKind: kind });
      const eligible: EligibleMineLayingSource = mineLayingSourceEligible(
        source,
        action,
        "CONTACT",
      );
      expect(eligible.sourceKind).toBe(kind);
      expect(eligible.mineTypeId).toBe("CONTACT");
    }
  });

  it("MAGNETIC (magnetic prerequisite) passes for a tech-ready source holding the id", () => {
    const eligible = mineLayingSourceEligible(
      validSource({ sourceKind: "MINE_CAPABLE_SURFACE_SHIP" }),
      validAction({ sourceKind: "MINE_CAPABLE_SURFACE_SHIP" }),
      "MAGNETIC",
    );
    expect(eligible.mineTypeId).toBe("MAGNETIC");
    expect(eligible.sourceId).toBe("port_soroka");
  });

  it("SUBMARINE_LAID is laid only by a MINELAYING_SUBMARINE (INC-1 §2 matrix)", () => {
    const eligible = mineLayingSourceEligible(
      validSource({
        sourceKind: "MINELAYING_SUBMARINE",
        availableTechnologyIds: ["minelaying_submarine_technology"],
      }),
      validAction({ sourceKind: "MINELAYING_SUBMARINE" }),
      "SUBMARINE_LAID",
    );
    expect(eligible.mineTypeDefinition.eligibleLayingSourceKinds).toEqual(["MINELAYING_SUBMARINE"]);
    expect(eligible.mineTypeId).toBe("SUBMARINE_LAID");
  });

  it("SCENARIO_MINEFIELD accepts a generated canonical scenario allocation", () => {
    const eligible = mineLayingSourceEligible(
      validSource({ sourceKind: "SCENARIO_MINEFIELD" }),
      validAction({
        sourceKind: "SCENARIO_MINEFIELD",
        inventory: { kind: "SCENARIO_ALLOCATION", quantity: SafeInt(300), allocationId: "scn_a1" },
      }),
      "CONTACT",
    );
    expect(eligible.allocationKind).toBe("SCENARIO_ALLOCATION");
    expect(eligible.allocatedQuantity).toBe(SafeInt(300));
  });

  it("normalizes a DECLARED allocation to its exact quantity", () => {
    const eligible = mineLayingSourceEligible(validSource(), validAction(), "CONTACT");
    expect(eligible.allocatedQuantity).toBe(SafeInt(120));
    expect(eligible.allocationKind).toBe("DECLARED");
    expect(eligible.targetBelligerentIds).toEqual(["u002"]);
    expect(eligible.areaId).toBe("white_sea_south");
    expect(eligible.campaignMonth).toBe(SafeInt(34));
  });
});

describe("MINE_LAYING_SOURCE_INELIGIBLE axis: technology", () => {
  it("a source that is not technology-ready fails", () => {
    expectIneligibility(
      () =>
        mineLayingSourceEligible(
          validSource({ technologyReadiness: false }),
          validAction(),
          "MAGNETIC",
        ),
      "technology",
    );
  });

  it("a source lacking the mine type's technologyPrerequisiteIds fails", () => {
    expectIneligibility(
      () =>
        mineLayingSourceEligible(
          validSource({ availableTechnologyIds: [] }),
          validAction(),
          "ACOUSTIC",
        ),
      "technology",
    );
  });

  it("a base-laid CONTACT mine needs no technology prerequisite", () => {
    const eligible = mineLayingSourceEligible(
      validSource({ availableTechnologyIds: [] }),
      validAction(),
      "CONTACT",
    );
    expect(eligible.mineTypeId).toBe("CONTACT");
  });
});

describe("MINE_LAYING_SOURCE_INELIGIBLE axis: inventory", () => {
  it("a declared quantity above the on-hand count fails", () => {
    expectIneligibility(
      () =>
        mineLayingSourceEligible(
          validSource({ availableMineCount: SafeInt(50) }),
          validAction(),
          "CONTACT",
        ),
      "inventory",
    );
  });

  it("a non-positive declared quantity fails", () => {
    expectIneligibility(
      () =>
        mineLayingSourceEligible(
          validSource(),
          validAction({ inventory: { kind: "DECLARED", quantity: SafeInt(0) } }),
          "CONTACT",
        ),
      "inventory",
    );
  });

  it("a scenario allocation without an allocation id fails", () => {
    expectIneligibility(
      () =>
        mineLayingSourceEligible(
          validSource({ sourceKind: "TYPED_EVENT_MINEFIELD" }),
          validAction({
            sourceKind: "TYPED_EVENT_MINEFIELD",
            inventory: { kind: "SCENARIO_ALLOCATION", quantity: SafeInt(300), allocationId: "" },
          }),
          "CONTACT",
        ),
      "inventory",
    );
  });
});

describe("MINE_LAYING_SOURCE_INELIGIBLE axes: access / control / mission", () => {
  it("a source without access fails", () => {
    const err = expectIneligibility(
      () => mineLayingSourceEligible(validSource({ hasAccess: false }), validAction(), "CONTACT"),
      "access",
    );
    expect(err.context.sourceId).toBe("port_soroka");
  });

  it("a source without control fails", () => {
    expectIneligibility(
      () => mineLayingSourceEligible(validSource({ hasControl: false }), validAction(), "CONTACT"),
      "control",
    );
  });

  it("a source without a mission fails", () => {
    expectIneligibility(
      () => mineLayingSourceEligible(validSource({ hasMission: false }), validAction(), "CONTACT"),
      "mission",
    );
  });
});

describe("MINE_LAYING_SOURCE_INELIGIBLE: cross-cutting + never silent", () => {
  it("a source kind outside the mine type's eligible kinds fails (SUBMARINE_LAID via a base)", () => {
    expectIneligibility(
      () =>
        mineLayingSourceEligible(
          validSource({ sourceKind: "CONTROLLED_NAVAL_BASE" }),
          validAction(),
          "SUBMARINE_LAID",
        ),
      "sourceKind",
    );
  });

  it("an action whose kind does not match the source fails", () => {
    expectIneligibility(
      () =>
        mineLayingSourceEligible(
          validSource({ sourceKind: "MINELAYING_SUBMARINE" }),
          validAction({ sourceKind: "MINE_CAPABLE_SURFACE_SHIP" }),
          "CONTACT",
        ),
      "sourceKind",
    );
  });

  it("an unknown mine type still fails closed (INVALID_MINE_TYPE_DEFINITION, not a silent pass)", () => {
    let err: BluewaveError | undefined;
    try {
      mineLayingSourceEligible(validSource(), validAction(), "NUCLEAR");
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe("INVALID_MINE_TYPE_DEFINITION");
  });
});
