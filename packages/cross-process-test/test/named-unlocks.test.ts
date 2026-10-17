import { describe, it, expect } from "vite-plus/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildContentBundleArtifact, buildFullSurfaceInput } from "@bluewave/content-compiler";
import {
  ContentBundleSchema,
  validateAgainstSchema,
  type CompiledContentBundle,
} from "@bluewave/content-schema";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { shiftMonth } from "@bluewave/ship-design";

import {
  NAMED_UNLOCKS,
  NamedUnlockError,
  assertNamedUnlocks,
  inspectNamedUnlocks,
} from "../src/designer-unlocks.js";
import { buildProgressionLedger } from "../src/progression-ledger.js";

const thisDir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(thisDir, "..", "..", "..");
const PRODUCTION_PACK = resolve(REPO_ROOT, "content", "production", "1880");

function compileProductionBundle(): CompiledContentBundle {
  const collector = new DiagnosticCollector();
  const input = buildFullSurfaceInput(
    resolve(PRODUCTION_PACK, "pack.json"),
    PRODUCTION_PACK,
    collector,
  );
  const artifact = input
    ? buildContentBundleArtifact(input, new AbortController().signal, collector)
    : undefined;
  if (!artifact || collector.hasErrors) {
    throw new Error(
      `Production pack compilation failed: ${collector.all.map((d) => d.message).join("; ")}`,
    );
  }
  const decoded = validateAgainstSchema(
    artifact.bundle,
    ContentBundleSchema,
    "ContentBundle",
    "content-artifact.json",
    collector,
  );
  if (decoded === undefined) {
    throw new Error(
      `Production pack bundle is invalid: ${collector.all.map((d) => d.message).join("; ")}`,
    );
  }
  return decoded;
}

describe("N-3 named unlocks in the designer", () => {
  const bundle = compileProductionBundle();
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

  it("names the id and both months when the ledger disagrees with the designer", () => {
    const forged = {
      ...ledger,
      events: ledger.events.map((event) =>
        event.id === "whitehead_14in_1886" ? { ...event, month: "1881-01" } : event,
      ),
    };
    let thrown: unknown;
    try {
      assertNamedUnlocks(bundle, forged);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(NamedUnlockError);
    expect((thrown as NamedUnlockError).unlockId).toBe("whitehead_14in_1886");
    expect((thrown as NamedUnlockError).message).toContain("1881-01");
    expect((thrown as NamedUnlockError).message).toContain("1880-01");
  });
});
