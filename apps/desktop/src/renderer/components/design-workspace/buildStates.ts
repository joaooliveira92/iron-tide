import {
  SHIP_EXCEEDS_DOMESTIC_DOCK_LIMIT,
  type DockEligibility,
  type Finding,
} from "@bluewave/ship-design";
import { formatExplanation } from "../../../shared/explanation-text.js";

export type BuildStateKind =
  | "class-locked"
  | "class-mismatch"
  | "technology-unavailable"
  | "yard-too-small";

export const BUILD_STATE_LABEL: Readonly<Record<BuildStateKind, string>> = {
  "class-locked": "Class locked",
  "class-mismatch": "Design does not match class",
  "technology-unavailable": "Technology unavailable",
  "yard-too-small": "Yard too small",
};

export interface BuildState {
  readonly kind: BuildStateKind;
  readonly ruleId: string;
  readonly messageKey: string | null;
  readonly text: string;
}

const TECHNOLOGY_RULE_ID = "AVAILABILITY.SHIP_TYPE_TECHNOLOGY_REQUIRED";
const AVAILABILITY_PREFIX = "AVAILABILITY.";
const CLASSIFICATION_PREFIX = "DESIGN-22.";

const words = (id: string): string => id.replaceAll("_", " ").toLowerCase();

function findingState(f: Finding): BuildState | null {
  const ruleId = f.ruleId;
  if (ruleId === undefined) return null;
  const messageKey = f.messageKey ?? null;
  const why = formatExplanation(f.why);
  if (ruleId === TECHNOLOGY_RULE_ID) {
    const tech = f.params?.["techId"];
    return {
      kind: "technology-unavailable",
      ruleId,
      messageKey,
      text: typeof tech === "string" ? `Requires ${words(tech)}. ${why}` : why,
    };
  }
  if (ruleId.startsWith(AVAILABILITY_PREFIX))
    return { kind: "class-locked", ruleId, messageKey, text: why };
  if (ruleId.startsWith(CLASSIFICATION_PREFIX))
    return {
      kind: "class-mismatch",
      ruleId,
      messageKey,
      text: `${formatExplanation(f.what)} ${why}`,
    };
  return null;
}

function yardStates(
  dock: DockEligibility | null,
  formatMass: (kg: number) => string,
): BuildState[] {
  if (dock === null) return [];
  return dock.rejections
    .filter((r) => r.code === SHIP_EXCEEDS_DOMESTIC_DOCK_LIMIT)
    .map((r) => ({
      kind: "yard-too-small" as const,
      ruleId: r.code,
      messageKey: null,
      text:
        r.requiredKg !== undefined && r.capacityKg !== undefined
          ? `The design displaces ${formatMass(r.requiredKg)}; your largest dock builds up to ${formatMass(r.capacityKg)}.`
          : "The hull does not fit your dock's length, beam or crane limits.",
    }));
}

export function buildStates(
  findings: readonly Finding[],
  dock: DockEligibility | null,
  formatMass: (kg: number) => string,
): BuildState[] {
  const fromFindings: BuildState[] = [];
  for (const f of findings) {
    const state = findingState(f);
    if (state !== null) fromFindings.push(state);
  }
  return [...fromFindings, ...yardStates(dock, formatMass)];
}
