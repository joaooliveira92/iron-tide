import type {
  ConstructionBatchPreview,
  ForeignBuilderCandidate,
  ForeignConstructionPreview,
} from "@bluewave/phase-engine";
import { describe, expect, it } from "vite-plus/test";
import type {
  ConstructionBatchPreviewOutcome,
  ConstructionStudyEntry,
  ForeignConstructionPreviewOutcome,
} from "../../../../shared/construction-contract.js";
import { orderViewModel } from "./order-view-model.js";

const home = (over: Partial<ConstructionBatchPreview> = {}): ConstructionBatchPreviewOutcome => ({
  ok: true,
  preview: {
    designVersionId: "d1",
    quantity: 2,
    names: [],
    namePoolExhausted: false,
    dockCeilingKg: 20_000_000,
    designDisplacementKg: 10_000_000,
    fitsDock: true,
    yardId: "yard-1",
    quote: {
      unitPrice: 500,
      totalPrice: 1_000,
      buildMonths: 12,
      monthlyInstalment: 80,
      deliveryMonth: "1881-01",
    },
    ...over,
  },
});

const builder = (over: Partial<ForeignBuilderCandidate> = {}): ForeignBuilderCandidate => ({
  nationId: "fra",
  name: "France",
  tag: "FRA",
  relation: "allied",
  tension: 0,
  dockCeilingKg: 30_000_000,
  reservedMassKg: 0,
  availableNewConstructionMassKg: 30_000_000,
  fitsDock: true,
  capabilitySatisfied: true,
  capabilityReasons: [],
  capabilityFailureCode: null,
  impoundmentRiskBp: 0,
  deliveryGuarantee: false,
  quote: {
    totalPriceUnits: 1_400,
    firstInstalmentUnits: 140,
    firstInstalmentMonth: "1880-02",
    plannedDeliveryMonth: "1881-06",
    months: 17,
  },
  ...over,
});

const foreign = (
  builders: readonly ForeignBuilderCandidate[],
  contract: ForeignConstructionPreview["contract"] = null,
): ForeignConstructionPreviewOutcome => ({
  ok: true,
  preview: {
    designVersionId: "d1",
    quantity: 2,
    designDisplacementKg: 10_000_000,
    builders,
    contract,
  },
});

const study: ConstructionStudyEntry = {
  designStudyId: "study_d2",
  designVersionId: "d2",
  className: "Dreadnought",
  monthsRemaining: 3,
  costRemaining: 3_000,
  readyMonth: "1880-04",
};

describe("orderViewModel", () => {
  it("is loading until the home preview arrives", () => {
    expect(
      orderViewModel({
        study: null,
        home: null,
        foreign: null,
        builderNationId: null,
        freeTreasury: 5_000,
      }).status,
    ).toBe("loading");
  });

  it("summarises the home yard from the engine quote", () => {
    const model = orderViewModel({
      study: null,
      home: home(),
      foreign: foreign([builder()]),
      builderNationId: null,
      freeTreasury: 5_000,
    });
    expect(model.status).toBe("ready");
    expect(model.summary).toEqual({
      builderLabel: "Home yard",
      totalPrice: 1_000,
      months: 12,
      instalment: 80,
      deliveryMonth: "1881-01",
      treasuryAfter: 4_000,
    });
    expect(model.builders.map((option) => option.id)).toEqual([null, "fra"]);
  });

  it("switching builder swaps price and months to that builder's quote", () => {
    const model = orderViewModel({
      study: null,
      home: home(),
      foreign: foreign([builder()]),
      builderNationId: "fra",
      freeTreasury: 5_000,
    });
    expect(model.status).toBe("ready");
    expect(model.summary).toEqual({
      builderLabel: "France",
      totalPrice: 1_400,
      months: 17,
      instalment: 140,
      deliveryMonth: "1881-06",
      treasuryAfter: 3_600,
    });
  });

  it("blocks a foreign builder that cannot build the hull and says why", () => {
    const model = orderViewModel({
      study: null,
      home: home(),
      foreign: foreign([
        builder({ capabilitySatisfied: false, capabilityFailureCode: "DOCK_TOO_SMALL" }),
      ]),
      builderNationId: "fra",
      freeTreasury: 5_000,
    });
    expect(model.status).toBe("blocked");
    expect(model.reason).toBe("DOCK_TOO_SMALL");
  });

  it("blocks the home yard with the engine's refusal reason", () => {
    const model = orderViewModel({
      study: null,
      home: { ok: false, reason: "SHIP_EXCEEDS_DOMESTIC_DOCK_LIMIT", diagnostics: [] },
      foreign: null,
      builderNationId: null,
      freeTreasury: 5_000,
    });
    expect(model.status).toBe("blocked");
    expect(model.reason).toBe("SHIP_EXCEEDS_DOMESTIC_DOCK_LIMIT");
    expect(model.summary).toBeNull();
  });

  it("blocks a design still in study with its ready month, ignoring previews", () => {
    const model = orderViewModel({
      study,
      home: null,
      foreign: null,
      builderNationId: null,
      freeTreasury: 5_000,
    });
    expect(model.status).toBe("study");
    expect(model.reason).toContain("1880-04");
    expect(model.summary).toBeNull();
  });
});
