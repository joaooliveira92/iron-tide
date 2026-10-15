// The ship-type selection screen's data: every registered type with its availability, its player-facing envelope
// and, where a starter design exists, the forecast of that design, all from the same rules the compile uses.
import { DESIGN_22_EARLY, type ClassificationRules } from "./classification.js";
import type { DesignDraft } from "./compile.js";
import { evaluateShipTypeAvailability, type ShipTypeAvailability } from "./shipTypeAvailability.js";
import { shipTypeEnvelope, type ShipTypeEnvelope } from "./shipTypeEnvelope.js";
import { shipTypeRegistryFromRecords } from "./shipTypeRegistry.js";
import { SHIP_TYPE_LIST, type ShipTypeDefinition } from "./shipTypes.js";
import { buildWorkshopView, type WorkshopEnvironment } from "./workshop.js";

/** A design offered as the starting point of a ship type. */
export interface StarterDesign {
  readonly id: string;
  readonly name: string;
  /** First campaign month the design is legal (YYYY-MM). */
  readonly month: string;
  readonly starterFor: string;
  readonly draft: DesignDraft;
}

export interface RosterStarter {
  readonly id: string;
  readonly name: string;
  /** The starter compiled under the campaign month: whether it is legal there and what it would cost. */
  readonly legal: boolean;
  readonly costMicro: number | null;
  readonly months: number | null;
  readonly totalKg: number | null;
  readonly speedMilliKnots: number | null;
}

export interface RosterEntry {
  readonly definition: ShipTypeDefinition;
  readonly availability: ShipTypeAvailability;
  readonly envelope: ShipTypeEnvelope;
  /** Null when no starter design exists at the campaign month: the type is available but has no ready template. */
  readonly starter: RosterStarter | null;
}

/**
 * The starter for a type at a month: the newest design whose month is not after the campaign month; declaration
 * order breaks a tie, so the choice is deterministic. Never reaches into the future. When `nationId` is given,
 * only that nation's starter designs are considered (national identity); omitting it keeps the nation-neutral choice.
 */
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
  // The envelope follows the ruleset actually in force for this scenario (`balance.classification`), so the
  // roster, the Brief panel and the validator cannot disagree (ADR-0116).
  const effectiveRules = rules ?? env.ctx.balance.classification ?? DESIGN_22_EARLY;
  // When the context carries compiled ship-type records, the roster (definitions and availability
  // facts) is content-authored; absent, the code registry stands in (the 12a regression pins them equal).
  const registry =
    env.ctx.shipTypes === undefined ? null : shipTypeRegistryFromRecords(env.ctx.shipTypes);
  const definitions = registry?.list ?? SHIP_TYPE_LIST;
  return definitions.map((definition) => {
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
      starter,
    };
  });
}
