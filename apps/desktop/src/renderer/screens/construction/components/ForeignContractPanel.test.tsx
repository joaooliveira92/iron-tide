import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import type { ForeignConstructionPreview } from "@bluewave/phase-engine";
import { axeViolations } from "../../../lib/axe.js";
import { ForeignContractPanel } from "./ForeignContractPanel.js";

afterEach(cleanup);

const preview: ForeignConstructionPreview = {
  designVersionId: "d1",
  quantity: 2,
  designDisplacementKg: 11_880_000,
  builders: [
    {
      nationId: "france",
      name: "France",
      tag: "F",
      relation: "at_war",
      tension: 8,
      dockCeilingKg: 12_000_000,
      reservedMassKg: 23_760_000,
      availableNewConstructionMassKg: 10_000_000,
      fitsDock: true,
      capabilitySatisfied: true,
      capabilityReasons: [],
      capabilityFailureCode: null,
      impoundmentRiskBp: 8_000,
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
};

describe("ForeignContractPanel (SB3-R20/R23/R34, INC-9b)", () => {
  it("shows the dock ceiling, free capacity, tension-scaled impoundment risk and guarantee status", () => {
    render(<ForeignContractPanel preview={preview} builderNationId="france" />);
    expect(screen.getByTestId("foreign-dock-ceiling").textContent).toContain("12,000,000 kg");
    expect(screen.getByTestId("foreign-free-capacity").textContent).toContain("10,000,000 kg");
    expect(screen.getByTestId("foreign-impoundment-risk").textContent).toContain("80.0 %");
    expect(screen.getByTestId("foreign-delivery-guarantee").textContent).toBe("none");
  });

  it("renders the contract terms and payment schedule", () => {
    render(<ForeignContractPanel preview={preview} builderNationId="france" />);
    expect(screen.getByTestId("foreign-total-price").textContent).toContain("238");
    const schedule = screen.getByRole("table", { name: "Foreign payment schedule" });
    expect(schedule.querySelectorAll("tbody tr")).toHaveLength(2);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <ForeignContractPanel preview={preview} builderNationId="france" />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
