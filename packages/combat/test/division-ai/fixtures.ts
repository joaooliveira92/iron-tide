import type { DivisionRole } from "@bluewave/campaign";
import {
  DIVISION_AI_VIEW_VERSION,
  type DivisionAiContact,
  type DivisionAiDivision,
  type DivisionAiView,
} from "@bluewave/combat/division-ai";

export function division(
  divisionId: string,
  role: DivisionRole,
  x: number,
  y: number,
  overrides: Partial<DivisionAiDivision> = {},
): DivisionAiDivision {
  return {
    divisionId,
    role,
    formation: "LINE_AHEAD",
    control: "AI",
    shipTypes: ["DD", "DD"],
    position: { xMetres: x, yMetres: y },
    headingDeg: 0,
    speedKnots: 18,
    maxSpeedKnots: 32,
    signalingBp: 10_000,
    searchCapable: true,
    salvosLeft: 2,
    track: [],
    ...overrides,
  };
}

export function lead(overrides: Partial<DivisionAiDivision> = {}): DivisionAiDivision {
  return division("LEAD", "INDEPENDENT", 0, 0, {
    control: "PLAYER",
    shipTypes: ["BB", "BB", "BB", "BB"],
    maxSpeedKnots: 24,
    track: [
      { xMetres: -6_000, yMetres: 0 },
      { xMetres: -3_000, yMetres: 0 },
    ],
    ...overrides,
  });
}

export function contact(
  contactId: string,
  kind: DivisionAiContact["kind"],
  x: number,
  y: number,
  headingDeg = 180,
  speedKnots = 0,
): DivisionAiContact {
  return {
    contactId,
    kind,
    position: { xMetres: x, yMetres: y },
    headingDeg,
    speedKnots,
  };
}

export function view(
  divisions: readonly DivisionAiDivision[],
  overrides: Partial<DivisionAiView> = {},
): DivisionAiView {
  return {
    version: DIVISION_AI_VIEW_VERSION,
    minute: 10,
    leadDivisionId: "LEAD",
    divisions,
    contacts: [],
    moraleBp: 6_000,
    flotillaAttackIssuedAtMinute: null,
    objective: null,
    ...overrides,
  };
}

export function fullForce(overrides: Partial<DivisionAiView> = {}): DivisionAiView {
  return view(
    [
      lead(),
      division("C-CORE", "CORE", -4_000, 0, { shipTypes: ["BB", "BB"] }),
      division("D-SUPPORT", "SUPPORT", -3_000, 2_500),
      division("E-SCOUT", "SCOUT", 8_000, 0, { shipTypes: ["CL", "CL"] }),
      division("F-SCREEN", "SCREEN", 3_000, 0),
      division("G-PATROL", "PATROL", 20_000, 20_000),
      division("H-INDEP", "INDEPENDENT", 2_000, -3_000, { shipTypes: ["CA"] }),
    ],
    overrides,
  );
}
