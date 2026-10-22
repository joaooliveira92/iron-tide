import { canonicalSerialize, compareCodePoints } from "@bluewave/deterministic";
import { computeCost } from "./cost.js";
import type { CostBalance } from "./cost.js";
import { planConstruction } from "./construction.js";
import type { ConstructionBalance } from "./construction.js";
import type { CompiledDesign, DesignDraft } from "./compileShared.js";
import { toEngineDesign } from "./engineAdapter.js";
import type { EngineAdapterOptions } from "./engineAdapter.js";

export type MetricValue = number | string | boolean | null;
export type MetricMap = Readonly<Record<string, MetricValue>>;

export interface MetricInputs {
  readonly compiled: CompiledDesign;
  readonly draft: DesignDraft;
  readonly costBalance: CostBalance;
  readonly constructionBalance: ConstructionBalance;
  readonly engine: Omit<EngineAdapterOptions, "designVersionId" | "designFamilyId">;
}

const hasInstanceId = (v: unknown): v is { instanceId: string } =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as { instanceId?: unknown }).instanceId === "string";

function flatten(value: unknown, path: string, out: Record<string, MetricValue>): void {
  if (value === undefined) return;
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    out[path] = value;
  } else if (typeof value === "number") {
    out[path] = value;
  } else if (typeof value === "bigint") {
    out[path] = value.toString();
  } else if (Array.isArray(value)) {
    const keyed = value.length > 0 && value.every(hasInstanceId);
    if (value.length === 0) out[`${path}.length`] = 0;
    value.forEach((item, i) =>
      flatten(item, `${path}[${keyed ? (item as { instanceId: string }).instanceId : i}]`, out),
    );
  } else if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      compareCodePoints(a, b),
    );
    if (entries.length === 0) out[`${path}.keys`] = 0;
    for (const [key, item] of entries) flatten(item, path === "" ? key : `${path}.${key}`, out);
  } else {
    out[path] = canonicalSerialize(value);
  }
}

function findingMetrics(findings: readonly unknown[], out: Record<string, MetricValue>): void {
  const keys = findings.map((f) => canonicalSerialize(f));
  const counts = new Map<string, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  for (const [k, n] of counts) out[`findings.multiset[${k}]`] = n;
  out["findings.count"] = findings.length;
  out["findings.order"] = keys.join("\n");
}

export const UNORDERED_METRIC_PATHS: readonly string[] = ["findings.order"];

export function deriveMetrics(input: MetricInputs): MetricMap {
  const { compiled: c, draft } = input;
  const out: Record<string, MetricValue> = {};
  flatten(c.ledger, "displacement.ledger", out);
  flatten(c.totalKg, "displacement.totalKg", out);
  flatten(c.hull, "hull", out);
  flatten(c.naturalClass, "classification.naturalClass", out);
  flatten(c.machinery, "machinery", out);
  flatten(c.arrangement, "arrangement", out);
  flatten(c.weapons, "weapons", out);
  flatten(c.armour, "protection", out);
  flatten(c.stability, "stability", out);
  flatten(c.systems, "systems", out);
  flatten(c.components, "components", out);
  flatten(c.componentCostMicro, "cost.componentCostMicro", out);
  flatten(c.valid, "valid", out);
  findingMetrics(c.findings, out);

  const cost = computeCost(c, draft, input.costBalance, {
    maturityBpByTech: {},
    firstOfClass: false,
  });
  flatten(cost, "cost.breakdown", out);
  flatten(
    planConstruction(c, draft, cost, input.constructionBalance, false),
    "construction.plan",
    out,
  );
  if (c.valid) {
    flatten(
      toEngineDesign(c, draft, {
        ...input.engine,
        designVersionId: "equivalence",
        designFamilyId: "equivalence",
      }),
      "engine",
      out,
    );
  } else {
    out["engine.available"] = false;
  }
  return sortMap(out);
}

export function sortMap(map: Readonly<Record<string, MetricValue>>): MetricMap {
  const out: Record<string, MetricValue> = {};
  for (const key of Object.keys(map).sort(compareCodePoints)) out[key] = map[key] as MetricValue;
  return out;
}
