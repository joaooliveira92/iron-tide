import { topsideLoad, type Finding, type Severity, type WorkshopView } from "@bluewave/ship-design";
import type { BoardFinding } from "../../../validation/boardFindings.js";
import type { PartKind } from "./anatomy-types.js";

export type PartState = "ok" | "warn" | "bad";

const WORSE: Readonly<Record<PartState, number>> = { ok: 0, warn: 1, bad: 2 };

export const worst = (a: PartState, b: PartState): PartState => (WORSE[b] > WORSE[a] ? b : a);

export const stateOfSeverity = (severity: Severity): PartState =>
  severity === "BLOCKING" || severity === "CRITICAL"
    ? "bad"
    : severity === "WARNING"
      ? "warn"
      : "ok";

const HULL_METRICS: ReadonlySet<string> = new Set([
  "displacement",
  "reserve",
  "stability",
  "stress",
  "trim",
]);

const BELT_PARTS: ReadonlySet<string> = new Set(["armour:belt", "armour:belt-upper"]);

const armourReach = (finding: Finding, partId: string): boolean => {
  switch (finding.id) {
    case "CITADEL_INCOMPLETE":
      return BELT_PARTS.has(partId) || partId === "armour:citadel";
    case "MAGAZINE_UNPROTECTED":
      return partId === "armour:citadel" || partId === "armour:deck";
    default:
      return true;
  }
};

const hullState = (view: WorkshopView): PartState => {
  const fromMetrics = view.metrics
    .filter((metric) => HULL_METRICS.has(metric.id))
    .reduce<PartState>(
      (state, metric) =>
        metric.tone === "bad"
          ? worst(state, "bad")
          : metric.tone === "warn"
            ? worst(state, "warn")
            : state,
      "ok",
    );
  return view.compiled.hull.findings.reduce<PartState>(
    (state, finding) => worst(state, stateOfSeverity(finding.severity)),
    fromMetrics,
  );
};

const deckState = (view: WorkshopView): PartState => {
  const { status } = topsideLoad(view.compiled.arrangement);
  return status === "exceeded" ? "bad" : status === "warning" ? "warn" : "ok";
};

export const reserveState = (view: WorkshopView): PartState => {
  const tone = view.metrics.find((metric) => metric.id === "reserve")?.tone;
  const overweight = view.compiled.hull.findings.some((finding) =>
    finding.id.startsWith("OVERWEIGHT_"),
  );
  return overweight || tone === "bad" ? "bad" : tone === "warn" ? "warn" : "ok";
};

export function anatomyPartStates(
  parts: readonly { readonly id: string; readonly kind: PartKind }[],
  findings: readonly BoardFinding[],
  view: WorkshopView,
): ReadonlyMap<string, PartState> {
  const fitted = new Map<string, PartState>();
  for (const { severity, entities } of findings)
    for (const entity of entities)
      if (entity.kind === "fitting")
        fitted.set(
          entity.instanceId,
          worst(fitted.get(entity.instanceId) ?? "ok", stateOfSeverity(severity)),
        );
  const armourFindings = view.compiled.armour?.findings ?? [];
  const hull = hullState(view);
  const deck = deckState(view);
  return new Map(
    parts.map((part) => {
      const own = fitted.get(part.id) ?? "ok";
      switch (part.kind) {
        case "hull":
          return [part.id, worst(own, hull)];
        case "waterline":
          return [part.id, worst(own, reserveState(view))];
        case "deck":
          return [part.id, worst(own, deck)];
        case "armour":
          return [
            part.id,
            armourFindings
              .filter((finding) => armourReach(finding, part.id))
              .reduce<PartState>(
                (state, finding) => worst(state, stateOfSeverity(finding.severity)),
                own,
              ),
          ];
        default:
          return [part.id, own];
      }
    }),
  );
}
