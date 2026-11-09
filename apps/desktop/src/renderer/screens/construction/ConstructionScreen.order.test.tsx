import { createCompiledDesignVersion } from "@bluewave/campaign-engine";
import type { ForeignBuilderCandidate } from "@bluewave/phase-engine";
import {
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type {
  ConstructionScreenProjection,
  ConstructionStudyEntry,
  PreviewConstructionBatchCommandPayload,
} from "../../../shared/construction-contract.js";
import { usePresentationFormat } from "../../shell/usePresentationFormat.js";
import { ConstructionScreen } from "./ConstructionScreen.js";

const mocks = vi.hoisted(() => {
  const execute = vi.fn();
  return { execute, bridge: { campaign: { execute } } };
});
vi.mock("../../shell/CampaignShellContext.js", async (original) => ({
  ...(await original<typeof import("../../shell/CampaignShellContext.js")>()),
  useReviseProject: () => vi.fn(),
}));
vi.mock("../../lib/bridge-context.js", () => ({
  useBridge: () => mocks.bridge,
}));

afterEach(() => {
  cleanup();
  mocks.execute.mockReset();
});

const TREASURY = 10_000;
const HOME_UNIT = 500;
const FRANCE_UNIT = 700;

const design = createCompiledDesignVersion("d1", {
  className: "Inflexible",
  shipType: "battleship",
  nationId: "uk",
  year: 1880,
  available: true,
  mass: 11_880,
  speed: 14,
  machineryType: "steam_turbine",
  requiredTechnologyIds: [],
  projectedCost: HOME_UNIT,
  projectedCapacityUnits: 12,
  costBasis: "displacement_formula",
});

const study: ConstructionStudyEntry = {
  designStudyId: "study_d2",
  designVersionId: "d2",
  className: "Dreadnought",
  monthsRemaining: 3,
  costRemaining: 3_000,
  readyMonth: "1880-04",
};

const projection = (
  over: Partial<ConstructionScreenProjection> = {},
): ConstructionScreenProjection => ({
  revision: 3,
  month: { month: 1, year: 1880 },
  economy: {
    treasury: TREASURY,
    monthlyAppropriation: 0,
    shipyardCapacity: 2,
    dockMaxBuildDisplacementKg: 13_000_000,
    maxConcurrentConstructionMassKg: 39_000_000,
    committedNewConstructionMassKg: 0,
    exemptNewConstructionMassKg: 0,
    dockExpansionDurationMonths: 12,
    dockExpansionNextStepKg: 1_000_000,
    dockExpansionReadyMonth: "1880-12",
    dockPossessions: [],
  },
  designs: [design],
  studies: [],
  projects: [],
  steering: {},
  workspace: { commands: [], treasuryReserved: 0, capacityReserved: 0 },
  ...over,
});

const france = (quantity: number): ForeignBuilderCandidate => ({
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
    totalPriceUnits: FRANCE_UNIT * quantity,
    firstInstalmentUnits: 70 * quantity,
    firstInstalmentMonth: "1880-02",
    plannedDeliveryMonth: "1881-06",
    months: 17,
  },
});

interface Served {
  readonly orders: number;
}

const serve = (screenProjection: ConstructionScreenProjection): Served => {
  mocks.execute.mockImplementation(async (command: string, payload: unknown) => {
    if (command === "inspectConstructionScreen")
      return { outcome: "success", value: screenProjection, diagnostics: [] };
    if (command === "previewConstructionBatchCommand") {
      const { quantity } = payload as PreviewConstructionBatchCommandPayload;
      return {
        outcome: "success",
        diagnostics: [],
        value: {
          ok: true,
          preview: {
            designVersionId: "d1",
            quantity,
            names: [],
            namePoolExhausted: false,
            dockCeilingKg: 13_000_000,
            designDisplacementKg: 11_880_000,
            fitsDock: true,
            yardId: "yard-1",
            quote: {
              unitPrice: HOME_UNIT,
              totalPrice: HOME_UNIT * quantity,
              buildMonths: 12,
              monthlyInstalment: 40 * quantity,
              deliveryMonth: "1881-01",
            },
          },
        },
      };
    }
    if (command === "previewForeignConstructionCommand") {
      const { quantity } = payload as PreviewConstructionBatchCommandPayload;
      return {
        outcome: "success",
        diagnostics: [],
        value: {
          ok: true,
          preview: {
            designVersionId: "d1",
            quantity,
            designDisplacementKg: 11_880_000,
            builders: [france(quantity)],
            contract: null,
          },
        },
      };
    }
    if (
      command === "orderConstructionBatchCommand" ||
      command === "placeForeignConstructionCommand"
    )
      return {
        outcome: "success",
        diagnostics: [],
        value: { commandId: "cmd-1", bodyType: command, appliedOnNextTurn: true },
      };
    return { outcome: "failure", reason: "UNEXPECTED", diagnostics: [command] };
  });
  return { orders: 0 };
};

const callsTo = (command: string) => mocks.execute.mock.calls.filter((call) => call[0] === command);

const money = (value: number): string => {
  const { result } = renderHook(() => usePresentationFormat());
  return result.current.money(value);
};

const openDialog = async () => {
  render(<ConstructionScreen sessionId="ses_1" />);
  fireEvent.click(await screen.findByRole("button", { name: /Design catalog/ }));
  await screen.findByRole("radio", { name: /Inflexible/ });
  fireEvent.click(screen.getByRole("button", { name: "Order" }));
  const dialog = await screen.findByRole("dialog", { name: "Order ships" });
  await waitFor(() =>
    expect(
      within(dialog).getByRole("button", { name: "Place order" }).hasAttribute("disabled"),
    ).toBe(false),
  );
  return dialog;
};

const summaryOf = (dialog: HTMLElement) =>
  within(within(dialog).getByRole("region", { name: "Order summary" }));

describe("order dialog", () => {
  it("shows the home quote in the summary and the treasury left after it", async () => {
    serve(projection());
    const dialog = await openDialog();

    const summary = summaryOf(dialog);
    expect(summary.getByText(money(HOME_UNIT))).toBeTruthy();
    expect(summary.getByText("12 months")).toBeTruthy();
    expect(summary.getByText(money(40))).toBeTruthy();
    expect(summary.getByText("1881-01")).toBeTruthy();
    expect(summary.getByText(money(TREASURY - HOME_UNIT))).toBeTruthy();
  });

  it("switches price and months when another builder is chosen", async () => {
    serve(projection());
    const dialog = await openDialog();

    fireEvent.click(within(dialog).getByRole("radio", { name: /France/ }));

    const summary = summaryOf(dialog);
    await waitFor(() => expect(summary.getByText(money(FRANCE_UNIT))).toBeTruthy());
    expect(summary.getByText("17 months")).toBeTruthy();
    expect(summary.getByText("1881-06")).toBeTruthy();
    expect(summary.getByText(money(TREASURY - FRANCE_UNIT))).toBeTruthy();
  });

  it("keeps the quantity between 1 and 12", async () => {
    serve(projection());
    const dialog = await openDialog();
    const decrease = within(dialog).getByRole("button", { name: "Decrease quantity" });
    const increase = within(dialog).getByRole("button", { name: "Increase quantity" });

    expect(decrease.hasAttribute("disabled")).toBe(true);
    for (let i = 0; i < 14; i += 1) {
      if (!increase.hasAttribute("disabled")) fireEvent.click(increase);
    }

    expect(increase.hasAttribute("disabled")).toBe(true);
    expect(within(dialog).getByLabelText("Quantity").textContent).toBe("12");
    await waitFor(() => expect(summaryOf(dialog).getByText(money(HOME_UNIT * 12))).toBeTruthy());
    const quantities = callsTo("previewConstructionBatchCommand").map(
      (call) => (call[1] as PreviewConstructionBatchCommandPayload).quantity,
    );
    expect(quantities.length).toBeGreaterThan(1);
    expect(Math.min(...quantities)).toBe(1);
    expect(Math.max(...quantities)).toBe(12);
  });

  it("sends nothing when the dialog is cancelled", async () => {
    serve(projection());
    const dialog = await openDialog();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Order ships" })).toBeNull());
    expect(callsTo("orderConstructionBatchCommand")).toHaveLength(0);
    expect(callsTo("placeForeignConstructionCommand")).toHaveLength(0);
  });

  it("places one home batch order for the chosen quantity", async () => {
    serve(projection());
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Increase quantity" }));
    await waitFor(() => expect(summaryOf(dialog).getByText(money(HOME_UNIT * 2))).toBeTruthy());

    fireEvent.click(within(dialog).getByRole("button", { name: "Place order" }));

    await waitFor(() => expect(callsTo("orderConstructionBatchCommand")).toHaveLength(1));
    expect(callsTo("orderConstructionBatchCommand")[0]?.[1]).toMatchObject({
      designVersionId: "d1",
      quantity: 2,
    });
    expect(callsTo("placeForeignConstructionCommand")).toHaveLength(0);
  });

  it("places one foreign contract with the chosen builder", async () => {
    serve(projection());
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole("radio", { name: /France/ }));
    await waitFor(() => expect(summaryOf(dialog).getByText(money(FRANCE_UNIT))).toBeTruthy());

    fireEvent.click(within(dialog).getByRole("button", { name: "Place order" }));

    await waitFor(() => expect(callsTo("placeForeignConstructionCommand")).toHaveLength(1));
    expect(callsTo("placeForeignConstructionCommand")[0]?.[1]).toMatchObject({
      designVersionId: "d1",
      builderNationId: "fra",
      quantity: 1,
    });
    expect(callsTo("orderConstructionBatchCommand")).toHaveLength(0);
  });

  it("blocks ordering a design still in study and says when it will be ready", async () => {
    serve(projection({ designs: [], studies: [study] }));
    render(<ConstructionScreen sessionId="ses_1" />);
    fireEvent.click(await screen.findByRole("button", { name: /Design catalog/ }));

    fireEvent.click(await screen.findByRole("button", { name: /Dreadnought.*in design study/ }));

    const dialog = await screen.findByRole("dialog", { name: "Order ships" });
    expect(
      within(dialog).getByRole("button", { name: "Place order" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(within(dialog).getByText(/still in design study.*1880-04/)).toBeTruthy();
    expect(callsTo("previewConstructionBatchCommand")).toHaveLength(0);
    expect(callsTo("previewForeignConstructionCommand")).toHaveLength(0);
  });
});
