import { SafeInt } from "@bluewave/contracts";
import { drawUniform, RandomEngine, RandomLedger, type RandomStream } from "@bluewave/random";
import {
  compileDesign,
  type CompiledDesign,
  type DesignDraft,
  type PlacementSpec,
  type ShipContext,
} from "./compile.js";
import { computeCost, type CostBalance, type CostContext } from "./cost.js";
import { computeCve, type CveBalance, type CveWeights } from "./cve.js";
import { applyEdit, type DraftEdit } from "./edits.js";
import { bp, kg, mm } from "./units.js";
import { WEAPON_CATEGORIES } from "./compileShared.js";
import { resolvableWeaponFamilies } from "./armamentCompile.js";

export type ArchetypeId =
  | "CONSERVATIVE"
  | "BALANCED"
  | "AGGRESSIVE"
  | "LOW_COST"
  | "LONG_RANGE"
  | "UPGRADE";
export const ARCHETYPE_IDS: readonly ArchetypeId[] = [
  "CONSERVATIVE",
  "BALANCED",
  "AGGRESSIVE",
  "LOW_COST",
  "LONG_RANGE",
  "UPGRADE",
];

/** Doctrine-level objective data. The AI changes what it optimises, never the rules (spec §18.3). */
export interface ArchetypeSpec {
  readonly weights: CveWeights;
  readonly warningPenaltyBp: number;
  readonly criticalPenaltyBp: number;
  /** Penalty weight on cost / budget. */
  readonly costWeightBp: number;
  /** If set, reward growth reserve up to this share of displacement, bp. */
  readonly reserveTargetBp: number | null;
  /** Design margin the archetype starts from, bp. */
  readonly designMarginBp: number;
}

export interface AiEnvironment {
  readonly ctx: ShipContext;
  readonly costBalance: CostBalance;
  readonly costCtx: CostContext;
  readonly cveBalance: CveBalance;
  readonly archetypes: Readonly<Record<ArchetypeId, ArchetypeSpec>>;
  /** Money the nation can commit to one ship, or null for unconstrained. */
  readonly budgetMicro: number | null;
}

export interface AiRequest {
  readonly base: DesignDraft;
  readonly seed: string;
  readonly nationKey: string;
  /** How many distinct candidates to return. */
  readonly candidates: number;
  readonly compilesPerArchetype: number;
  readonly archetypes?: readonly ArchetypeId[];
}

export interface Candidate {
  readonly archetype: ArchetypeId;
  readonly draft: DesignDraft;
  readonly compiled: CompiledDesign;
  readonly costMicro: number;
  readonly objective: number;
  readonly cveBp: number;
  readonly explanation: string;
}

export interface AiResult {
  readonly candidates: readonly Candidate[];
  readonly compilesUsed: number;
  readonly ledger: RandomLedger;
}

const int = (s: RandomStream, lo: number, hi: number) =>
  hi <= lo ? lo : drawUniform(s, SafeInt(lo), SafeInt(hi));
const pick = <T>(s: RandomStream, xs: readonly T[]): T | undefined =>
  xs.length === 0 ? undefined : xs[int(s, 0, xs.length - 1)];
const scale = (v: number, pct: number) => Math.max(1, Math.floor((v * (100 + pct)) / 100));

/** One random neighbouring edit. Pure function of the stream and inputs. */
function propose(s: RandomStream, d: DesignDraft, ctx: ShipContext): DraftEdit | null {
  // Candidate generation must not select armament that does not resolve: filter guns to the families the
  // authoritative resolver accepts for this nation at this month, technology and access (ADR-0093 Step 3).
  const resolvable = resolvableWeaponFamilies(ctx, d.nationId);
  const available = ctx.catalogue.filter(
    (c) =>
      c.introduction.fromMonth <= ctx.month &&
      c.requires.every((t) => ctx.unlockedTechs.has(t)) &&
      c.category !== "ACCOMMODATION" &&
      (!WEAPON_CATEGORIES.includes(c.category) || resolvable === null || resolvable.has(c.id)),
  );
  const form = ctx.hullForms[d.hull.hullFormId]!;
  switch (int(s, 0, 9)) {
    case 0:
      return {
        kind: "set_machinery",
        patch: { installedKw: scale(d.machinery.installedKw, int(s, -15, 15)) },
      };
    case 1:
      return {
        kind: "set_machinery",
        patch: { fuelCapacityKg: scale(d.machinery.fuelCapacityKg, int(s, -20, 20)) },
      };
    case 2: {
      const lenMm = Math.min(
        form.form.lengthMaxMm,
        Math.max(form.form.lengthMinMm, scale(d.hull.lengthWl, int(s, -6, 6))),
      );
      return { kind: "set_hull", patch: { lengthWl: mm(lenMm) } };
    }
    case 3:
      return { kind: "set_hull", patch: { beam: mm(scale(d.hull.beam, int(s, -6, 6))) } };
    case 4:
      return {
        kind: "set_hull",
        patch: { targetDisplacementKg: kg(scale(d.hull.targetDisplacementKg, int(s, -6, 6))) },
      };
    case 5: {
      const p = pick(s, d.placements);
      if (!p) return null;
      const def = ctx.catalogue.find((c) => c.id === p.componentId);
      const names = Object.keys(def?.parameters ?? {}).sort();
      const name = pick(s, names);
      if (!name) return null;
      const r = def!.parameters[name]!;
      const cur = p.params?.[name] ?? r.min;
      const next = Math.max(r.min, Math.min(r.max, cur + (int(s, 0, 1) === 0 ? -r.step : r.step)));
      return { kind: "set_param", instanceId: p.instanceId, param: name, value: next };
    }
    case 6: {
      const def = pick(s, available);
      if (!def) return null;
      const zoneId = pick(
        s,
        (def.allowedZones as PlacementSpec["zoneId"][] | undefined) ?? form.zones.map((z) => z.id),
      );
      const z = form.zones.find((q) => q.id === zoneId);
      if (!z) return null;
      const instanceId = `ai_${def.id}_${int(s, 0, 9_999)}`;
      if (d.placements.some((p) => p.instanceId === instanceId)) return null;
      const mag = d.placements.find(
        (p) => ctx.catalogue.find((c) => c.id === p.componentId)?.category === "MAGAZINE",
      );
      return {
        kind: "add_placement",
        placement: {
          instanceId,
          componentId: def.id,
          zoneId: z.id,
          stationPermille: int(s, z.startPermille, z.endPermille),
          ...(mag ? { magazineRef: mag.instanceId } : {}),
        },
      };
    }
    case 7: {
      const p = pick(s, d.placements);
      return p ? { kind: "remove_placement", instanceId: p.instanceId } : null;
    }
    case 8: {
      const r = pick(s, d.armour.regions);
      return r
        ? {
            kind: "set_armour_region",
            region: { ...r, thicknessUm: scale(r.thicknessUm, int(s, -20, 20)) },
          }
        : null;
    }
    default: {
      const p = pick(s, d.placements);
      if (!p) return null;
      const z = form.zones.find((q) => q.id === p.zoneId);
      return z
        ? {
            kind: "move_placement",
            instanceId: p.instanceId,
            zoneId: p.zoneId,
            stationPermille: int(s, z.startPermille, z.endPermille),
          }
        : null;
    }
  }
}

function featureOf(c: Candidate): number[] {
  const k = c.compiled;
  return [
    k.totalKg,
    k.machinery?.maxSpeedMilliKnots ?? 0,
    k.machinery?.rangeNmAtCruise ?? 0,
    k.ledger.armament + k.ledger.ammunition,
    k.ledger.armour,
    c.costMicro,
    k.ledger.reserve,
  ];
}
function distance(a: number[], b: number[]): number {
  let d = 0;
  for (let i = 0; i < a.length; i++)
    d += Math.floor(
      (Math.abs(a[i]! - b[i]!) * 10_000) / Math.max(1, Math.max(Math.abs(a[i]!), Math.abs(b[i]!))),
    );
  return d;
}

/**
 * Generates meaningfully different, fully validated candidates. Uses the same compile, cost and CVE code as the player.
 * Threshold-accepting hill climb per archetype; a final farthest-first pass picks diverse valid candidates.
 */
export function generateCandidates(env: AiEnvironment, req: AiRequest): AiResult {
  const engine = new RandomEngine(req.seed);
  const ledger = new RandomLedger();
  const plant = env.ctx.plants.find((p) => p.id === req.base.machinery.plantId);
  if (!plant) throw new Error(`unknown plant '${req.base.machinery.plantId}'`);
  let compiles = 0;
  const pool: Candidate[] = [];

  const evaluate = (arch: ArchetypeId, d: DesignDraft): Candidate => {
    compiles++;
    const spec = env.archetypes[arch];
    const compiled = compileDesign(d, env.ctx);
    const cost = computeCost(compiled, d, env.costBalance, env.costCtx).total;
    const cveBal: CveBalance = {
      ...env.cveBalance,
      weightsByCategory: {
        ...env.cveBalance.weightsByCategory,
        [d.requirement.category]: spec.weights,
      },
    };
    const cve = computeCve(
      compiled,
      d,
      compiled.machinery?.reliabilityBp ?? plant.reliabilityBp,
      cveBal,
    );
    const count = (s: string) => compiled.findings.filter((f) => f.severity === s).length;
    let obj =
      cve.cveBp -
      count("WARNING") * spec.warningPenaltyBp -
      count("CRITICAL") * spec.criticalPenaltyBp;
    const blocks = count("BLOCKING");
    if (blocks > 0) obj -= 20_000 + 2_000 * blocks;
    if (env.budgetMicro !== null) {
      obj -= Math.floor(
        (spec.costWeightBp * Math.min(cost, env.budgetMicro * 4)) / env.budgetMicro,
      );
      if (cost > env.budgetMicro) obj -= 15_000;
    }
    if (spec.reserveTargetBp !== null && compiled.totalKg > 0) {
      const reserveBp = Math.floor((compiled.ledger.reserve * 10_000) / compiled.totalKg);
      obj += Math.floor(
        (2_000 * Math.min(reserveBp, spec.reserveTargetBp)) / Math.max(1, spec.reserveTargetBp),
      );
    }
    return {
      archetype: arch,
      draft: d,
      compiled,
      costMicro: cost,
      objective: obj,
      cveBp: cve.cveBp,
      explanation: "",
    };
  };

  for (const arch of req.archetypes ?? ARCHETYPE_IDS) {
    const spec = env.archetypes[arch];
    const stream = engine.stream(`shipbuilding.ai:${req.nationKey}:${arch}`);
    let cur = evaluate(arch, {
      ...req.base,
      hull: { ...req.base.hull, designMarginBp: bp(spec.designMarginBp) },
    });
    let best = cur;
    const steps = req.compilesPerArchetype;
    for (let k = 0; k < steps; k++) {
      const e = propose(stream, cur.draft, env.ctx);
      if (!e) continue;
      let next: DesignDraft;
      try {
        next = applyEdit(cur.draft, e);
      } catch {
        continue;
      }
      let cand: Candidate;
      try {
        cand = evaluate(arch, next);
      } catch {
        continue; // unusable edit (e.g. unknown id after a removal); never an illegal ship
      }
      const threshold = Math.floor((1_500 * (steps - k)) / steps);
      if (cand.objective >= cur.objective - threshold) cur = cand;
      if (cand.objective > best.objective) best = cand;
    }
    ledger.record({
      streamId: stream.id,
      entityKey: req.nationKey,
      phase: "AI_DESIGN",
      rulesetVersion: "1",
      inputHash: best.compiled.hash,
      draw: best.objective,
      outcome: best.compiled.valid ? "valid" : "invalid",
      reasonCode: `AI_${arch}`,
    });
    const fb = best.compiled.findings.filter((f) => f.severity !== "ADVISORY").length;
    pool.push({
      ...best,
      explanation: `${arch}: objective ${best.objective}, CVE ${best.cveBp} bp (development metric), ${fb} non-advisory findings, ${best.compiled.totalKg} kg, cost ${best.costMicro}.`,
    });
  }

  // Never return an illegal ship: only candidates with zero BLOCKING findings are eligible.
  const valid = pool.filter((c) => c.compiled.valid);
  const chosen: Candidate[] = [];
  const rest = [...valid].sort(
    (a, b) => b.objective - a.objective || (a.archetype < b.archetype ? -1 : 1),
  );
  while (chosen.length < req.candidates && rest.length > 0) {
    let bestIdx = 0;
    let bestScore = -1;
    rest.forEach((c, i) => {
      const dmin =
        chosen.length === 0
          ? 10_000_000 - i
          : Math.min(...chosen.map((o) => distance(featureOf(c), featureOf(o))));
      if (dmin > bestScore) {
        bestScore = dmin;
        bestIdx = i;
      }
    });
    chosen.push(rest.splice(bestIdx, 1)[0]!);
  }
  return { candidates: chosen, compilesUsed: compiles, ledger };
}
