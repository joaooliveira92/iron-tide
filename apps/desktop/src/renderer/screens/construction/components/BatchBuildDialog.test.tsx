import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { CompiledDesignVersion } from "@bluewave/campaign-engine";
import { axeViolations } from "../../../lib/axe.js";
import type { ConstructionBatchPreviewOutcome } from "../../../../shared/construction-contract.js";
import type { ForeignConstructionPreviewOutcome } from "../../../../shared/construction-contract.js";
import { BatchBuildDialog, type BatchBuildDialogProps } from "./BatchBuildDialog.js";

afterEach(cleanup);

function design(designId: string, className: string): CompiledDesignVersion {
  return {
    designId,
    className,
    shipType: "Battleship",
    nationId: "uk",
    year: 1880,
    available: true,
    mass: 11_880,
    speed: 8,
    machineryType: "reciprocating_compound",
    requiredTechnologyIds: [],
    projectedCost: 119,
    projectedCapacityUnits: 1,
    costBasis: "displacement_formula",
  };
}

const designs = [design("d1", "Inflexible"), design("d2", "Dreadnought")];

const okPreview: ConstructionBatchPreviewOutcome = {
  ok: true,
  preview: {
    designVersionId: "d1",
    quantity: 2,
    names: [
      { name: "Devastation", pool: "name_pool:uk:B", ordinal: 1 },
      { name: "Thunderer", pool: "name_pool:uk:B", ordinal: 2 },
    ],
    namePoolExhausted: false,
    dockCeilingKg: 13_000_000,
    designDisplacementKg: 11_880_000,
    fitsDock: true,
    yardId: "yard-uk-1",
  },
};

const props = (over: Partial<BatchBuildDialogProps> = {}): BatchBuildDialogProps => ({
  designs,
  selectedDesignId: "d1",
  onSelectDesign: () => {},
  quantity: 2,
  onQuantityChange: () => {},
  preview: okPreview,
  foreignPreview: null,
  builderNationId: null,
  onSelectBuilder: () => {},
  busy: false,
  notice: null,
  onConfirm: () => {},
  onCancel: () => {},
  ...over,
});

describe("BatchBuildDialog (SB3-R30/R33)", () => {
  it("shows the engine's names, the yard fit and the dock ceiling", () => {
    render(<BatchBuildDialog {...props()} />);
    const names = screen.getByRole("list", { name: "Previewed ship names" });
    expect(names.textContent).toContain("Devastation");
    expect(names.textContent).toContain("Thunderer");
    const fit = screen.getByTestId("batch-fit");
    expect(fit.textContent).toContain("yard-uk-1");
    expect(fit.textContent).toContain("11,880,000 kg");
    expect(fit.textContent).toContain("13,000,000 kg dock ceiling");
    expect(fit.textContent).toContain("fits");
  });

  it("renders the design select and quantity input with their accessible names", () => {
    render(<BatchBuildDialog {...props()} />);
    const select = screen.getByRole("combobox", { name: "Batch design" });
    expect(select.querySelectorAll("option")).toHaveLength(2);
    const input = screen.getByRole("spinbutton", { name: "Batch quantity" });
    expect(input.getAttribute("min")).toBe("1");
    expect(input.getAttribute("max")).toBe("12");
  });

  it("reports a design as not fitting when it exceeds the dock", () => {
    const over: ConstructionBatchPreviewOutcome = {
      ok: true,
      preview: { ...okPreview.preview, designDisplacementKg: 13_000_001, fitsDock: false },
    };
    render(<BatchBuildDialog {...props({ preview: over })} />);
    expect(screen.getByTestId("batch-fit").textContent).toContain("does not fit");
  });

  it("warns when the name pool is exhausted", () => {
    const exhausted: ConstructionBatchPreviewOutcome = {
      ok: true,
      preview: { ...okPreview.preview, namePoolExhausted: true },
    };
    render(<BatchBuildDialog {...props({ preview: exhausted })} />);
    expect(screen.getByRole("status").textContent).toMatch(/name pool is exhausted/i);
  });

  it("shows the engine's own reason code when the preview refuses more than twelve", () => {
    const refused: ConstructionBatchPreviewOutcome = {
      ok: false,
      reason: "CONSTRUCTION_BATCH_LIMIT_EXCEEDED",
      diagnostics: ["A class order is 1..12 ships; got 13."],
    };
    render(<BatchBuildDialog {...props({ quantity: 13, preview: refused })} />);
    expect(screen.getByRole("alert").textContent).toContain("CONSTRUCTION_BATCH_LIMIT_EXCEEDED");
    expect(screen.getByRole("button", { name: "Confirm batch" })).toHaveProperty("disabled", true);
  });

  it("disables Confirm for an out-of-range quantity, a pending preview or a missing preview", () => {
    const confirm = () => screen.getByRole("button", { name: "Confirm batch" });
    const { rerender } = render(<BatchBuildDialog {...props({ quantity: 0 })} />);
    expect(confirm()).toHaveProperty("disabled", true);
    rerender(<BatchBuildDialog {...props({ quantity: 13 })} />);
    expect(confirm()).toHaveProperty("disabled", true);
    rerender(<BatchBuildDialog {...props({ preview: null })} />);
    expect(confirm()).toHaveProperty("disabled", true);
    rerender(<BatchBuildDialog {...props({ busy: true })} />);
    expect(confirm()).toHaveProperty("disabled", true);
    rerender(<BatchBuildDialog {...props()} />);
    expect(confirm()).toHaveProperty("disabled", false);
  });

  it("issues the confirm and reports the design selection and quantity changes", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const onSelectDesign = vi.fn();
    const onQuantityChange = vi.fn();
    render(
      <BatchBuildDialog {...props({ onConfirm, onCancel, onSelectDesign, onQuantityChange })} />,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Batch design" }), {
      target: { value: "d2" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Batch quantity" }), {
      target: { value: "5" },
    });
    expect(onSelectDesign).toHaveBeenCalledWith("d2");
    expect(onQuantityChange).toHaveBeenCalledWith(5);
    screen.getByRole("button", { name: "Confirm batch" }).click();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    screen.getByRole("button", { name: "Back to catalog" }).click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<BatchBuildDialog {...props()} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});

const foreignPreview: ForeignConstructionPreviewOutcome = {
  ok: true,
  preview: {
    designVersionId: "d1",
    quantity: 2,
    designDisplacementKg: 11_880_000,
    builders: [
      {
        nationId: "france",
        name: "France",
        tag: "F",
        relation: "neutral",
        tension: 0,
        dockCeilingKg: 12_000_000,
        reservedMassKg: 23_760_000,
        availableNewConstructionMassKg: 10_000_000,
        fitsDock: true,
        capabilitySatisfied: true,
        capabilityReasons: [],
        capabilityFailureCode: null,
        impoundmentRiskBp: 0,
        deliveryGuarantee: false,
      },
    ],
    contract: {
      quantity: 2,
      totalWorkPerUnit: 119,
      totalPriceUnits: 238,
      paymentSchedule: [
        { dueMonth: "1880-01", amountUnits: 119, workShareBp: 5_000 },
        { dueMonth: "1880-02", amountUnits: 119, workShareBp: 5_000 },
      ],
      capacityReservationSchedule: [
        { month: "1880-01", reservedMassKg: 23_760_000, pool: "NEW_CONSTRUCTION" },
      ],
      paymentGraceMonths: 1,
      plannedKeelMonth: "1880-01",
      plannedDeliveryMonth: "1880-06",
      reservedMassKg: 23_760_000,
      capabilitySatisfied: true,
      capabilityReasons: [],
      capabilityFailureCode: null,
    },
  },
};

describe("BatchBuildDialog foreign builder (SB3-R20/R34, INC-9b)", () => {
  it("offers the nation's yards and the candidate foreign builders", () => {
    render(<BatchBuildDialog {...props({ foreignPreview })} />);
    const builder = screen.getByRole("combobox", { name: "Builder" }) as HTMLSelectElement;
    const labels = [...builder.querySelectorAll("option")].map((o) => o.textContent ?? "");
    expect(labels).toContain("Your own yards");
    expect(labels.some((l) => l.startsWith("France"))).toBe(true);
  });

  it("renders the contract panel and routes confirm to the foreign order", () => {
    const onConfirm = vi.fn();
    render(
      <BatchBuildDialog {...props({ foreignPreview, builderNationId: "france", onConfirm })} />,
    );
    const panel = screen.getByTestId("foreign-contract-panel");
    expect(panel.textContent).toContain("France");
    expect(screen.getByTestId("foreign-total-price").textContent).toContain("238");
    expect(screen.getByRole("table", { name: "Foreign payment schedule" })).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "Order from foreign yard" });
    expect(confirm).toHaveProperty("disabled", false);
    confirm.click();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables confirm and shows the engine refusal when the builder is incapable", () => {
    const incapable: ForeignConstructionPreviewOutcome = {
      ok: true,
      preview: {
        ...foreignPreview.preview,
        builders: [
          {
            ...foreignPreview.preview.builders[0]!,
            capabilitySatisfied: false,
            capabilityReasons: ["DOCK: The hull exceeds the builder's dock."],
            capabilityFailureCode: "FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT",
          },
        ],
        contract: {
          ...foreignPreview.preview.contract!,
          capabilitySatisfied: false,
          capabilityReasons: ["DOCK: The hull exceeds the builder's dock."],
          capabilityFailureCode: "FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT",
        },
      },
    };
    render(
      <BatchBuildDialog {...props({ foreignPreview: incapable, builderNationId: "france" })} />,
    );
    expect(screen.getByTestId("foreign-refusal").textContent).toContain(
      "FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT",
    );
    expect(screen.getByRole("button", { name: "Order from foreign yard" })).toHaveProperty(
      "disabled",
      true,
    );
  });
});
