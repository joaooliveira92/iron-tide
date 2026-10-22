import type { CompiledDesign, DesignDraft } from "./compile.js";
import type { ExplanationText } from "./explanation.js";
import { quantity } from "./explanation.js";
import type { Finding } from "./findings.js";
import { yardFits, type Yard, type YardDemand } from "./yards.js";

export interface RebuildBalance {
  readonly maxDisplacementIncreaseBp: number;
  readonly maxSpeedIncreaseMilliKnots: number;
  readonly maxLengthChangeBp: number;
  readonly maxBeamChangeBp: number;
}

export function checkRebuildBalance(b: RebuildBalance): string[] {
  const problems: string[] = [];
  for (const [name, value] of Object.entries(b))
    if (!Number.isSafeInteger(value) || value < 0)
      problems.push(`${name} must be a non-negative integer, got ${String(value)}`);
  return problems;
}

export interface RebuildFacts {
  readonly displacementKg: number;
  readonly speedMilliKnots: number;
  readonly lengthMm: number;
  readonly beamMm: number;
  readonly hullFormId: string;
}

export function rebuildFactsOf(compiled: CompiledDesign, draft: DesignDraft): RebuildFacts {
  return {
    displacementKg: compiled.totalKg,
    speedMilliKnots: compiled.machinery?.maxSpeedMilliKnots ?? 0,
    lengthMm: draft.hull.lengthWl,
    beamMm: draft.hull.beam,
    hullFormId: draft.hull.hullFormId,
  };
}

export interface RebuildMeasures {
  readonly displacementChangeBp: number;
  readonly speedChangeMilliKnots: number;
  readonly lengthChangeBp: number;
  readonly beamChangeBp: number;
}

export interface RebuildReport {
  readonly legal: boolean;
  readonly findings: readonly Finding[];
  readonly measures: RebuildMeasures;
}

const BP = 10_000n;
function changeBp(from: number, to: number): number {
  if (from <= 0) return 0;
  return Number(((BigInt(to) - BigInt(from)) * BP) / BigInt(from));
}
const exceeds = (from: number, to: number, limitBp: number): boolean =>
  BigInt(to) * BP > BigInt(from) * (BP + BigInt(limitBp));
const differsBeyond = (from: number, to: number, limitBp: number): boolean =>
  (BigInt(to) - BigInt(from) < 0n ? BigInt(from) - BigInt(to) : BigInt(to) - BigInt(from)) * BP >
  BigInt(from) * BigInt(limitBp);

const finding = (
  id: string,
  what: ExplanationText,
  why: ExplanationText,
  consequence: ExplanationText,
  remedies: readonly (readonly [string, ExplanationText])[],
  formulaId: string,
  inputs: Record<string, number>,
  threshold: number,
  value: number,
): Finding => ({
  id,
  severity: "BLOCKING",
  what,
  why,
  consequence,
  remedies: remedies.map(([rid, description]) => ({ id: rid, description })),
  evidence: { formulaId, inputs, threshold, value },
});

const pctChange = (bp: number) => quantity(bp, 100, 1, "percentSpaced");
const knotsChange = (milli: number) => quantity(milli, 1000, 1, "knots");

export function validateRebuild(
  source: RebuildFacts,
  target: RebuildFacts,
  balance: RebuildBalance,
  dock?: { readonly demand: YardDemand; readonly yards: readonly Yard[] },
): RebuildReport {
  const measures: RebuildMeasures = {
    displacementChangeBp: changeBp(source.displacementKg, target.displacementKg),
    speedChangeMilliKnots: target.speedMilliKnots - source.speedMilliKnots,
    lengthChangeBp: changeBp(source.lengthMm, target.lengthMm),
    beamChangeBp: changeBp(source.beamMm, target.beamMm),
  };
  const findings: Finding[] = [];

  if (source.hullFormId !== target.hullFormId)
    findings.push(
      finding(
        "REBUILD_HULL_FORM_CHANGED",
        "A rebuild cannot change the hull form.",
        `The ship is a ${source.hullFormId.replaceAll("_", " ")}; the new design is a ${target.hullFormId.replaceAll("_", " ")}.`,
        "A broad hull-category conversion needs a conversion technology and policy that do not exist yet; the rebuild is refused.",
        [
          ["keep_form", "Keep the ship's hull form in the new design."],
          ["new_construction", "Build the new design as a new ship instead."],
          ["conversion", "Wait for a conversion technology to convert the hull category."],
        ],
        "DESIGN-23-21-hull-form",
        {},
        0,
        1,
      ),
    );

  if (exceeds(source.displacementKg, target.displacementKg, balance.maxDisplacementIncreaseBp))
    findings.push(
      finding(
        "REBUILD_DISPLACEMENT_LIMIT",
        "The rebuilt ship would be too much heavier than the ship it replaces.",
        [
          "Displacement rises ",
          pctChange(measures.displacementChangeBp),
          "; a rebuild may add at most ",
          pctChange(balance.maxDisplacementIncreaseBp),
          ".",
        ],
        "The retained hull cannot carry that much more; the rebuild is refused.",
        [
          [
            "reduce_weight",
            "Remove weight (guns, armour, machinery) until the increase is within the limit.",
          ],
          ["smaller_changes", "Change less in this rebuild and do the rest in a later one."],
          ["new_construction", "Build the new design as a new ship instead."],
        ],
        "DESIGN-23-21-displacement",
        { currentKg: source.displacementKg, newKg: target.displacementKg },
        balance.maxDisplacementIncreaseBp,
        measures.displacementChangeBp,
      ),
    );

  if (target.speedMilliKnots - source.speedMilliKnots > balance.maxSpeedIncreaseMilliKnots)
    findings.push(
      finding(
        "REBUILD_SPEED_LIMIT",
        "The rebuilt ship would be too much faster than the ship it replaces.",
        [
          "Speed rises ",
          knotsChange(measures.speedChangeMilliKnots),
          "; a rebuild may add at most ",
          knotsChange(balance.maxSpeedIncreaseMilliKnots),
          ".",
        ],
        "The retained hull lines cannot take that much more power; the rebuild is refused.",
        [
          ["reduce_power", "Install less power so the speed gain is within the limit."],
          ["smaller_changes", "Change less in this rebuild and do the rest in a later one."],
          ["new_construction", "Build the new design as a new ship instead."],
        ],
        "DESIGN-23-21-speed",
        { currentMilliKnots: source.speedMilliKnots, newMilliKnots: target.speedMilliKnots },
        balance.maxSpeedIncreaseMilliKnots,
        measures.speedChangeMilliKnots,
      ),
    );

  for (const [id, label, from, to, limit, change] of [
    [
      "REBUILD_LENGTH_LIMIT",
      "length",
      source.lengthMm,
      target.lengthMm,
      balance.maxLengthChangeBp,
      measures.lengthChangeBp,
    ],
    [
      "REBUILD_BEAM_LIMIT",
      "beam",
      source.beamMm,
      target.beamMm,
      balance.maxBeamChangeBp,
      measures.beamChangeBp,
    ],
  ] as const) {
    if (differsBeyond(from, to, limit))
      findings.push(
        finding(
          id,
          `The rebuilt ship's ${label} would change too much.`,
          [
            `The ${label} changes `,
            pctChange(change),
            "; a rebuild may change it by at most ",
            pctChange(limit),
            " either way.",
          ],
          `The retained hull structure cannot be reshaped that far; the rebuild is refused.`,
          [
            ["keep_dimensions", `Keep the ${label} within the limit of the current hull.`],
            ["smaller_changes", "Change less in this rebuild and do the rest in a later one."],
            ["new_construction", "Build the new design as a new ship instead."],
          ],
          `DESIGN-23-21-${label}`,
          { current: from, proposed: to },
          limit,
          Math.abs(change),
        ),
      );
  }

  if (dock !== undefined && !dock.yards.some((y) => yardFits(y.facility, dock.demand)))
    findings.push(
      finding(
        "REBUILD_NO_DOCK",
        "No yard can hold the rebuilt ship.",
        "The rebuilt hull exceeds the length, beam, displacement or crane limit of every yard.",
        "The rebuild has nowhere to be done; it is refused.",
        [
          ["smaller_changes", "Change less so the rebuilt ship fits a yard."],
          ["reduce_weight", "Remove weight so the heaviest fitting and the displacement fit."],
          ["wait", "Wait for a larger yard."],
        ],
        "DESIGN-23-21-dock",
        {},
        0,
        1,
      ),
    );

  return { legal: findings.length === 0, findings, measures };
}

const RETAINED_KINDS: readonly string[] = ["HULL", "LAUNCH"];

export function rebuildPackages<
  P extends {
    readonly id: string;
    readonly kind: string;
    readonly totalWork: number;
    readonly dependsOn: readonly string[];
  },
>(packages: readonly P[]): P[] {
  const dropped = new Set(packages.filter((p) => RETAINED_KINDS.includes(p.kind)).map((p) => p.id));
  const kept = packages
    .filter((p) => !dropped.has(p.id))
    .map((p) => ({ ...p, dependsOn: p.dependsOn.filter((d) => !dropped.has(d)) }));
  if (kept.length === 0 || kept.some((p) => p.totalWork > 0)) return kept;
  const last = kept.length - 1;
  return kept.map((p, i) => (i === last ? { ...p, totalWork: 1 } : p));
}
