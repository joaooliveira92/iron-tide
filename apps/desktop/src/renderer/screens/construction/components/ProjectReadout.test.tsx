import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import type { ProjectRow } from "../project-progress.js";
import { ProjectReadout } from "./ProjectReadout.js";

afterEach(cleanup);

const row = (over: Partial<ProjectRow> = {}): ProjectRow => ({
  projectId: "project-1",
  className: "Havock class",
  shipType: "destroyer",
  status: "ACTIVE",
  percent: 45,
  yard: null,
  packages: [],
  holdUntilMonth: null,
  isForeign: false,
  revisable: false,
  readout: {
    totalCostUnits: 640,
    monthlyInstalmentUnits: 120,
    remainingMonths: 6,
    launchMonth: "1880-07",
    scheduleBasis: "YARD_CAPACITY",
    scheduleUnavailableReason: null,
    haltedCarryingCostUnits: null,
  },
  ...over,
});

describe("ProjectReadout", () => {
  it("renders the compiled instalment, months left, total cost and launch month", () => {
    render(<ProjectReadout row={row()} />);
    expect(screen.getByText("Instalment")).toBeTruthy();
    expect(screen.getByText("120 NC/mo")).toBeTruthy();
    expect(screen.getByText("Months left")).toBeTruthy();
    expect(screen.getByText("6")).toBeTruthy();
    expect(screen.getByText("Total cost")).toBeTruthy();
    expect(screen.getByText("640 NC")).toBeTruthy();
    expect(screen.getByText("Launch")).toBeTruthy();
    expect(screen.getByText("1880-07")).toBeTruthy();
    expect(screen.queryByText("Carrying cost")).toBeNull();
  });

  it("shows the half-mothball carrying cost and the hold, not a misleading instalment, on a halted row", () => {
    render(
      <ProjectReadout
        row={row({
          status: "HALTED",
          readout: {
            totalCostUnits: 640,
            monthlyInstalmentUnits: 0,
            remainingMonths: 0,
            launchMonth: null,
            scheduleBasis: "UNAVAILABLE",
            scheduleUnavailableReason: "HALTED",
            haltedCarryingCostUnits: 3,
          },
        })}
      />,
    );
    expect(screen.getByText("not building (halted)")).toBeTruthy();
    expect(screen.getByText("Carrying cost")).toBeTruthy();
    expect(screen.getByText("3 NC/mo")).toBeTruthy();
    expect(screen.queryByText("Instalment")).toBeNull();
    expect(screen.queryByText("Launch")).toBeNull();
    expect(screen.queryByText("complete")).toBeNull();
  });

  it("shows a delayed row's hold instead of a completion", () => {
    render(
      <ProjectReadout
        row={row({
          status: "DELAYED",
          readout: {
            totalCostUnits: 640,
            monthlyInstalmentUnits: 0,
            remainingMonths: 0,
            launchMonth: null,
            scheduleBasis: "UNAVAILABLE",
            scheduleUnavailableReason: "DELAYED",
            haltedCarryingCostUnits: null,
          },
        })}
      />,
    );
    expect(screen.getByText("not building (delayed)")).toBeTruthy();
    expect(screen.queryByText("complete")).toBeNull();
  });

  it("shows the payment-default reason for a foreign contract in default (INC-9b)", () => {
    render(
      <ProjectReadout
        row={row({
          status: "DELAYED",
          isForeign: true,
          readout: {
            totalCostUnits: 640,
            monthlyInstalmentUnits: 0,
            remainingMonths: 0,
            launchMonth: null,
            scheduleBasis: "UNAVAILABLE",
            scheduleUnavailableReason: "DELAYED",
            delayReasonCode: "PAYMENT_DEFAULT_DELAYED",
            haltedCarryingCostUnits: null,
          },
        })}
      />,
    );
    expect(screen.getByText("not building (payment default)")).toBeTruthy();
  });

  it("renders the contract schedule a foreign row's readout carries", () => {
    render(
      <ProjectReadout
        row={row({
          isForeign: true,
          readout: {
            totalCostUnits: 600,
            monthlyInstalmentUnits: 100,
            remainingMonths: 5,
            launchMonth: "1880-08",
            scheduleBasis: "FOREIGN_CONTRACT",
            scheduleUnavailableReason: null,
            haltedCarryingCostUnits: null,
          },
        })}
      />,
    );
    expect(screen.getByText("100 NC/mo")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText("1880-08")).toBeTruthy();
  });

  it('labels the readout by role and name, and says "complete" when there is no launch month', () => {
    render(
      <ProjectReadout
        row={row({
          readout: {
            totalCostUnits: 100,
            monthlyInstalmentUnits: 0,
            remainingMonths: 0,
            launchMonth: null,
            scheduleBasis: "YARD_CAPACITY",
            scheduleUnavailableReason: null,
            haltedCarryingCostUnits: null,
          },
        })}
      />,
    );
    const readout = screen.getByRole("list", { name: "Havock class cost and schedule" });
    expect(readout).toBeTruthy();
    expect(screen.getByText("complete")).toBeTruthy();
  });

  it("says the schedule is unavailable instead of fabricating a zero or a completion (no readout)", () => {
    render(<ProjectReadout row={row({ readout: null })} />);
    expect(screen.getByText("unavailable")).toBeTruthy();
    expect(screen.queryByText("Instalment")).toBeNull();
    expect(screen.queryByText("complete")).toBeNull();
  });
});

describe("ProjectReadout explanation", () => {
  it("shows the months-left explanation from the schedule readout", () => {
    render(
      <ProjectReadout
        row={row({
          readout: {
            totalCostUnits: 640,
            monthlyInstalmentUnits: 120,
            remainingMonths: 6,
            launchMonth: "1880-07",
            scheduleBasis: "YARD_CAPACITY",
            scheduleUnavailableReason: null,
            haltedCarryingCostUnits: null,
            scheduleExplanation: {
              formulaId: "construction_schedule",
              formulaVersion: "construction_v1",
              inputs: {},
              intermediate: { remainingWork: 700 },
              result: 6,
              unit: "months",
              children: [
                {
                  formulaId: "construction_schedule.remainingWork",
                  formulaVersion: "construction_v1",
                  inputs: { amount: 700 },
                  intermediate: {},
                  result: 700,
                  unit: "nc",
                },
                {
                  formulaId: "construction_schedule.instalment",
                  formulaVersion: "construction_v1",
                  inputs: { amount: 120 },
                  intermediate: {},
                  result: 120,
                  unit: "nc",
                },
              ],
            },
          },
        })}
      />,
    );
    expect(screen.getByText("Ready in 6 months")).toBeTruthy();
    expect(screen.getByText("Work remaining")).toBeTruthy();
    expect(screen.getByText("Work per month")).toBeTruthy();
  });

  it("shows the instalment line split and the package cost split when supplied", () => {
    render(
      <ProjectReadout
        row={row({
          readout: {
            totalCostUnits: 640,
            monthlyInstalmentUnits: 120,
            remainingMonths: 6,
            launchMonth: "1880-07",
            scheduleBasis: "YARD_CAPACITY",
            scheduleUnavailableReason: null,
            haltedCarryingCostUnits: null,
            instalmentExplanation: {
              formulaId: "construction_instalment",
              formulaVersion: "construction_v1",
              inputs: { remainingWork: 640 },
              intermediate: {},
              result: 120,
              unit: "nc",
              children: [
                {
                  formulaId: "construction_instalment.slipway",
                  formulaVersion: "construction_v1",
                  inputs: { amount: 70 },
                  intermediate: {},
                  result: 70,
                  unit: "nc",
                },
                {
                  formulaId: "construction_instalment.machinery",
                  formulaVersion: "construction_v1",
                  inputs: { amount: 50 },
                  intermediate: {},
                  result: 50,
                  unit: "nc",
                },
              ],
            },
            costExplanation: {
              formulaId: "construction_cost",
              formulaVersion: "construction_v1",
              inputs: {},
              intermediate: { packageCount: 2 },
              result: 640,
              unit: "nc",
              children: [
                {
                  formulaId: "construction_cost.slipway",
                  formulaVersion: "construction_v1",
                  inputs: { amount: 600 },
                  intermediate: {},
                  result: 600,
                  unit: "nc",
                },
                {
                  formulaId: "construction_cost.machinery",
                  formulaVersion: "construction_v1",
                  inputs: { amount: 40 },
                  intermediate: {},
                  result: 40,
                  unit: "nc",
                },
              ],
            },
          },
        })}
      />,
    );
    expect(screen.getByText("Work this month 120")).toBeTruthy();
    expect(screen.getByText("Slipway work")).toBeTruthy();
    expect(screen.getByText("Machinery work")).toBeTruthy();
    expect(screen.getByText("Total cost 640")).toBeTruthy();
    expect(screen.getByText("Hull and launch")).toBeTruthy();
  });
});
