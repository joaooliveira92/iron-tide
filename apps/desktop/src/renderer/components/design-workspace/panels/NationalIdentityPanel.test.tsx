import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { NationalIdentityPanel } from "./NationalIdentityPanel.js";
import type { NationProfileBrief } from "@bluewave/ship-design";

const brief: NationProfileBrief = {
  nationId: "uk",
  doctrineSummary: "Global battle-fleet power with wide station commitments.",
  postures: ["battle_fleet_concentration", "colonial_presence"],
  industrialStrengths: ["Shipbuilding runs 7% faster than the 1894 norm."],
  industrialLimitations: ["Machinery is experimental; faults and delays are accepted."],
  globalObligations: ["Wide foreign-station and coaling-station commitments."],
  importedOrLicensed: ["armour_plate (imported)"],
  preferredComponents: ["BL 12-in/25 Mk I/II (Colossus, Collingwood)"],
  starterPhilosophy:
    "The AI lays down new ships in the order CL, B, CA, DD, KE, AMC, led by cruisers.",
  namingConvention: ["Classical, admiralty, royal and national names."],
};

describe("NationalIdentityPanel", () => {
  it("renders the doctrine, strengths, limitations and obligations from the brief", () => {
    render(<NationalIdentityPanel brief={brief} />);
    expect(screen.getByText("National identity")).toBeTruthy();
    expect(screen.getByText(brief.doctrineSummary)).toBeTruthy();
    expect(
      screen.getByText("Posture: Battle fleet concentration, Colonial presence."),
    ).toBeTruthy();
    expect(screen.getByText(brief.industrialStrengths[0]!)).toBeTruthy();
    expect(screen.getByText(brief.importedOrLicensed[0]!)).toBeTruthy();
    expect(screen.getByText(brief.starterPhilosophy)).toBeTruthy();
  });
});
