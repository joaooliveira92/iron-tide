import {
  findingKey,
  type DesignDraft,
  type Finding,
  type FindingTarget,
  type SettingGroup,
  type Severity,
  type WorkshopView,
} from "@bluewave/ship-design";
import type { BatteryCard } from "../batteryView.js";
import { formatExplanation } from "../../../lib/presentation-format/index.js";
import { SECTION_IDS, SECTIONS } from "../panels/hull-plan/sections.js";
import { entityKey, sameEntity, type ShipEntity } from "../selection/store.js";
import { inferEntities } from "./legacyInference.js";
import { SEVERITY_ORDER, severityRank } from "./severity.js";

export type Association = "structured" | "inferred" | "none";

export interface BoardFinding {
  readonly key: string;
  readonly finding: Finding;
  readonly severity: Severity;
  readonly rule: string;
  readonly title: string;
  readonly explanation: string;
  readonly entities: readonly ShipEntity[];
  readonly association: Association;
  readonly settings: SettingGroup | undefined;
  readonly value: number;
  readonly limit: number;
  readonly bound: "min" | "max" | undefined;
  readonly unit: string | undefined;
}

function entitiesOf(
  t: FindingTarget,
  draft: DesignDraft,
  batteries: readonly BatteryCard[],
): ShipEntity[] {
  switch (t.kind) {
    case "ship":
      return [{ kind: "ship" }];
    case "zone": {
      const id = SECTION_IDS.find((s) => SECTIONS[s].zoneId === t.zoneId);
      return id ? [{ kind: "section", id }] : [];
    }
    case "placement":
      return draft.placements.some((p) => p.instanceId === t.instanceId)
        ? [{ kind: "fitting", instanceId: t.instanceId }]
        : [];
    case "battery":
      return (batteries.find((b) => b.row.key === t.key)?.mounts ?? []).map((m) => ({
        kind: "fitting",
        instanceId: m.instanceId,
      }));
    case "machinery-room":
      return [{ kind: "machinery-room", index: t.index }];
  }
}

export function boardFindings(
  view: WorkshopView,
  draft: DesignDraft,
  batteries: readonly BatteryCard[],
): BoardFinding[] {
  const seen = new Map<string, number>();
  return SEVERITY_ORDER.flatMap((s) => view.findingsBySeverity[s]).map((f) => {
    const base = findingKey(f);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    const targets = f.subject?.targets ?? [];
    const structured = targets.flatMap((t) => entitiesOf(t, draft, batteries));
    const inferred = targets.length === 0 ? inferEntities(f, draft) : [];
    return {
      key: n === 0 ? base : `${base}#${n}`,
      finding: f,
      severity: f.severity,
      rule: f.id,
      title: formatExplanation(f.what),
      explanation: formatExplanation(f.why),
      entities: targets.length > 0 ? structured : inferred,
      association: targets.length > 0 ? "structured" : inferred.length > 0 ? "inferred" : "none",
      settings: f.subject?.settings,
      value: f.evidence.value,
      limit: f.evidence.threshold,
      bound: f.subject?.bound,
      unit: f.subject?.unit,
    };
  });
}

export function findingsFor(
  entity: ShipEntity,
  findings: readonly BoardFinding[],
): readonly BoardFinding[] {
  return findings
    .filter((f) => f.entities.some((e) => sameEntity(e, entity)))
    .sort(
      (a, b) =>
        severityRank(a.severity) - severityRank(b.severity) ||
        (a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0),
    );
}

export function entityWarns(entity: ShipEntity, findings: readonly BoardFinding[]): boolean {
  return findings.some(
    (f) => f.severity !== "ADVISORY" && f.entities.some((e) => sameEntity(e, entity)),
  );
}
