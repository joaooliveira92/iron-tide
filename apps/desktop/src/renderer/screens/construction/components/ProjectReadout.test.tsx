import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import type { ProjectRow } from "../project-progress.js";
import { setUiCatalogue } from "../../../content/uiCatalogue.js";
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
    expect(screen.getByText("July 1880")).toBeTruthy();
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

  it("names a construction event's cause in words from the ui catalogue, never the raw code (#584)", () => {
    setUiCatalogue({
      locale: "en-US",
      strings: {
        "construction.event.steel_plate_shortage": "a steel plate shortage at the supplier",
      },
    });
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
            delayReasonCode: "STEEL_PLATE_SHORTAGE",
            haltedCarryingCostUnits: null,
          },
        })}
      />,
    );
    expect(screen.getByText("not building (a steel plate shortage at the supplier)")).toBeTruthy();
    expect(screen.queryByText(/STEEL_PLATE_SHORTAGE/)).toBeNull();
  });

  describe("cost overruns (#584)", () => {
    const CAUSES: Readonly<Record<string, string>> = {
      DESIGN_CHANGE_REWORK: "rework after a design change",
      YARD_LABOUR_SHORTAGE: "a shortage of skilled yard labour",
    };
    const withOverrun = (reasonCode: string, costUnits: number) =>
      row({
        readout: {
          totalCostUnits: 640,
          monthlyInstalmentUnits: 120,
          remainingMonths: 6,
          launchMonth: "1880-07",
          scheduleBasis: "YARD_CAPACITY",
          scheduleUnavailableReason: null,
          haltedCarryingCostUnits: null,
          overruns: [{ month: "1880-03", reasonCode, costUnits }],
        },
      });
    const catalogue = () =>
      setUiCatalogue({
        locale: "en-US",
        strings: Object.fromEntries(
          Object.entries(CAUSES).map(([code, words]) => [
            `construction.event.${code.toLowerCase()}`,
            words,
          ]),
        ),
      });

    for (const [code, words] of Object.entries(CAUSES))
      it(`names ${code} in plain words with the amount, never the raw code or month key`, () => {
        catalogue();
        render(<ProjectReadout row={withOverrun(code, 45)} />);
        expect(screen.getByText(`March 1880: ${words} added 45 NC to the cost`)).toBeTruthy();
        expect(screen.queryByText(new RegExp(code))).toBeNull();
        expect(screen.queryByText(/\d{4}-\d{2}/)).toBeNull();
      });

    it("lists every delay and overrun, newest first, with the amount", () => {
      catalogue();
      const base = withOverrun("DESIGN_CHANGE_REWORK", 45);
      render(
        <ProjectReadout
          row={{
            ...base,
            readout: {
              ...base.readout!,
              delays: [
                { month: "1880-05", reasonCode: "DESIGN_CHANGE_REWORK", months: 1 },
                { month: "1880-02", reasonCode: "YARD_LABOUR_SHORTAGE", months: 3 },
              ],
              overruns: [
                { month: "1880-04", reasonCode: "YARD_LABOUR_SHORTAGE", costUnits: 20 },
                { month: "1880-03", reasonCode: "DESIGN_CHANGE_REWORK", costUnits: 45 },
              ],
            },
          }}
        />,
      );
      const items = within(screen.getByRole("list", { name: "Havock class causes" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent);
      expect(items).toEqual([
        "May 1880: rework after a design change delayed the build by 1 month",
        "April 1880: a shortage of skilled yard labour added 20 NC to the cost",
        "March 1880: rework after a design change added 45 NC to the cost",
        "February 1880: a shortage of skilled yard labour delayed the build by 3 months",
      ]);
      for (const text of items) {
        expect(text).not.toMatch(/\d{4}-\d{2}/);
        expect(text).not.toMatch(/[A-Z]{2,}_[A-Z]/);
      }
    });

    it("falls back to plain words when the cause has no authored text", () => {
      setUiCatalogue({ locale: "en-US", strings: {} });
      render(<ProjectReadout row={withOverrun("UNKNOWN_CAUSE", 45)} />);
      expect(screen.getByText("March 1880: a cost overrun added 45 NC to the cost")).toBeTruthy();
      expect(screen.queryByText(/UNKNOWN_CAUSE/)).toBeNull();
    });

    it("adds no causes list when nothing has hit the project", () => {
      render(<ProjectReadout row={row()} />);
      expect(screen.queryByRole("list", { name: "Havock class causes" })).toBeNull();
    });
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
    expect(screen.getByText("August 1880")).toBeTruthy();
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
