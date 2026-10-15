import type { StrategicPriority } from "@bluewave/campaign-engine";
import { describe, expect, it } from "vite-plus/test";
import {
  SEVERITY_LABELS,
  SEVERITY_VARIANT,
  countActiveAlerts,
  destinationLabel,
} from "./priorities.js";

const priority = (severity: StrategicPriority["severity"]): StrategicPriority => ({
  id: severity,
  type: "monthly_deficit",
  severity,
  title: "t",
  summary: "s",
  reason: "r",
  destination: "treasury" as never,
  fingerprint: severity,
});

describe("countActiveAlerts", () => {
  it("counts warnings and criticals, not advisories or information", () => {
    expect(
      countActiveAlerts([
        priority("critical"),
        priority("warning"),
        priority("warning"),
        priority("advisory"),
        priority("information"),
      ]),
    ).toBe(3);
  });

  it("is zero for no priorities", () => {
    expect(countActiveAlerts([])).toBe(0);
  });
});

describe("severity presentation", () => {
  it("labels and styles every severity the engine can emit", () => {
    for (const severity of ["critical", "warning", "advisory", "information"] as const) {
      expect(SEVERITY_LABELS[severity]).toBeTruthy();
      expect(SEVERITY_VARIANT[severity]).toBeTruthy();
    }
    expect(SEVERITY_VARIANT.critical).toBe("destructive");
  });

  it("names destinations the way the sidebar does", () => {
    expect(destinationLabel("diplomacy")).toBe("Diplomacy & War");
    expect(destinationLabel("fleet")).toBe("Fleet");
  });
});
