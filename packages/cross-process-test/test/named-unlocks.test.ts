import { describe, it, expect } from "vite-plus/test";
import { shiftMonth } from "@bluewave/ship-design";

import {
  NAMED_UNLOCKS,
  NamedUnlockError,
  assertNamedUnlocks,
  inspectNamedUnlocks,
} from "../src/designer-unlocks.js";
import { buildProgressionLedger } from "../src/progression-ledger.js";
import { compileProductionBundle } from "../src/production-pack.js";

describe("N-3 named unlocks in the designer", () => {
  const { bundle } = compileProductionBundle();
  const ledger = buildProgressionLedger(bundle);

  it("makes each named unlock unavailable before its declared month and available at it", () => {
    const states = inspectNamedUnlocks(bundle, ledger);
    expect(states.map((state) => state.unlock.id)).toEqual(
      NAMED_UNLOCKS.map((unlock) => unlock.id),
    );
    for (const state of states) {
      expect(state.ledgerMonth, `${state.unlock.label} ledger month`).toBe(state.designerMonth);
      expect(state.beforeMonth).toBe(shiftMonth(state.ledgerMonth, -1));
      expect(
        state.availableBefore,
        `${state.unlock.label} (${state.unlock.id}) is available at ${state.beforeMonth}, before ${state.ledgerMonth}`,
      ).toBe(false);
      expect(
        state.availableAt,
        `${state.unlock.label} (${state.unlock.id}) is unavailable at ${state.ledgerMonth}`,
      ).toBe(true);
    }
    expect(assertNamedUnlocks(bundle, ledger)).toBeUndefined();
  });

  it("lists every declared QF/light gun component introduction at its declared month", () => {
    const components = bundle.shipBuilding?.components ?? [];
    const qfGuns = components.filter((component) => {
      const year = Number(component.introduction.fromMonth.slice(0, 4));
      return year >= 1880 && year <= 1889 && /(^|_)(qf|hotchkiss|nordenfelt)/.test(component.id);
    });
    expect(qfGuns.length).toBeGreaterThan(0);
    for (const component of qfGuns) {
      const event = ledger.events.find(
        (candidate) => candidate.id === component.id && candidate.kind === "component",
      );
      expect(event, `${component.id} is missing from the ledger`).toBeDefined();
      expect(event?.month, `${component.id} declared introduction`).toBe(
        component.introduction.fromMonth,
      );
    }
  });

  it("names the id and both months when the ledger disagrees with the designer", () => {
    const forged = {
      ...ledger,
      events: ledger.events.map((event) =>
        event.id === "whitehead_14in_1886" ? { ...event, month: "1881-01" } : event,
      ),
    };
    expect(() => assertNamedUnlocks(bundle, forged)).toThrow(NamedUnlockError);
    expect(() => assertNamedUnlocks(bundle, forged)).toThrow(
      /whitehead_14in_1886.*1881-01.*1880-01/,
    );
  });
});
