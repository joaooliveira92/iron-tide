import { DESIGN_22_EARLY, type ClassificationRules } from "./classification.js";
import type { DesignDraft } from "./compile.js";
import { evaluateShipTypeAvailability, type ShipTypeAvailability } from "./shipTypeAvailability.js";
import { shipTypeEnvelope, type ShipTypeEnvelope } from "./shipTypeEnvelope.js";
import { shipTypeRegistryFromRecords } from "./shipTypeRegistry.js";
import { shipTypeRequirements, type ShipTypeRequirements } from "./shipTypeRequirements.js";
import { SHIP_TYPE_LIST, type ShipTypeDefinition } from "./shipTypes.js";
import { buildWorkshopView, type WorkshopEnvironment } from "./workshop.js";

export interface StarterDesign {
  readonly id: string;
  readonly name: string;
  readonly month: string;
  readonly starterFor: string;
  readonly draft: DesignDraft;
}

export interface RosterStarter {
  readonly id: string;
  readonly name: string;
  readonly legal: boolean;
  readonly costMicro: number | null;
  readonly months: number | null;
  readonly totalKg: number | null;
  readonly speedMilliKnots: number | null;
}

export type RosterLevel = 1 | 2 | 3 | 4 | 5;

export interface RosterEntry {
  readonly definition: ShipTypeDefinition;
  readonly availability: ShipTypeAvailability;
  readonly envelope: ShipTypeEnvelope;
  readonly requirements: ShipTypeRequirements;
  readonly starter: RosterStarter | null;
  readonly costLevel: RosterLevel | null;
  readonly buildTimeLevel: RosterLevel | null;
}

const LEVELS = 5;

export function quantileLevels(
  values: readonly (number | null)[],
): readonly (RosterLevel | null)[] {
  const priced = values.filter((v): v is number => v !== null);
  const n = priced.length;
  return values.map((v) => {
    if (v === null) return null;
    if (n < 2) return 3;
    const below = priced.filter((p) => p < v).length;
    return (1 + Math.min(LEVELS - 1, Math.floor((below * LEVELS) / n))) as RosterLevel;
  });
}

export function starterFor(
  type: string,
  starters: readonly StarterDesign[],
  month: string,
  nationId?: string,
): StarterDesign | null {
  let best: StarterDesign | null = null;
  for (const s of starters) {
    if (s.starterFor !== type || s.month > month) continue;
    if (nationId !== undefined && s.draft.nationId !== nationId) continue;
    if (best === null || s.month > best.month) best = s;
  }
  return best;
}

export function buildShipTypeRoster(
  env: WorkshopEnvironment,
  starters: readonly StarterDesign[],
  rules?: ClassificationRules,
  nationId?: string,
): readonly RosterEntry[] {
  const effectiveRules = rules ?? env.ctx.balance.classification ?? DESIGN_22_EARLY;
  const registry =
    env.ctx.shipTypes === undefined ? null : shipTypeRegistryFromRecords(env.ctx.shipTypes);
  const definitions = registry?.list ?? SHIP_TYPE_LIST;
  const base = definitions.map((definition) => {
    const availability = evaluateShipTypeAvailability(definition.id, {
      month: env.ctx.month,
      unlockedTechs: env.ctx.unlockedTechs,
      capabilities: env.ctx.capabilities,
      restrictedTypes: env.ctx.restrictedShipTypes,
      ...(registry === null ? {} : { definitions: registry.byId }),
    });
    const chosen = availability.available
      ? starterFor(definition.id, starters, env.ctx.month, nationId)
      : null;
    let starter: RosterStarter | null = null;
    if (chosen !== null) {
      const view = buildWorkshopView(chosen.draft, env);
      starter = {
        id: chosen.id,
        name: chosen.name,
        legal: view.valid,
        costMicro: view.valid ? view.forecast.costMicro : null,
        months: view.valid ? view.forecast.months : null,
        totalKg: view.compiled.totalKg,
        speedMilliKnots: view.compiled.machinery?.maxSpeedMilliKnots ?? null,
      };
    }
    return {
      definition,
      availability,
      envelope: shipTypeEnvelope(definition.id, effectiveRules),
      requirements: shipTypeRequirements(definition.id, effectiveRules),
      starter,
    };
  });
  const costLevels = quantileLevels(base.map((e) => e.starter?.costMicro ?? null));
  const timeLevels = quantileLevels(base.map((e) => e.starter?.months ?? null));
  return base.map((e, i) => ({
    ...e,
    costLevel: costLevels[i] ?? null,
    buildTimeLevel: timeLevels[i] ?? null,
  }));
}
