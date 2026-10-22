import type {
  FleetDivisionView,
  FleetOverBaseShip,
  FleetShipView,
  PlayerProjectionPresence,
} from "../../../../shared/fleet-contract.js";
import { hasAuthoredMessage, translate } from "../../../lib/strings.js";

/**
 * Presentation state for the Fleet screen's foreign-station section (S-5 09). Everything is derived from the engine's
 * projection: the screen never decides whether a ship is eligible, how much presence is required, or whether a ship is
 * over its base limit. Every code is paired with a text label so no state rests on colour alone.
 */

/** Substitutes `{name}` placeholders in a catalogue message. */
export function format(key: string, vars: Readonly<Record<string, string | number>> = {}): string {
  return Object.entries(vars).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    translate(key),
  );
}

export interface StationFlag {
  readonly code: "c" | "a" | "S";
  readonly label: string;
}

export interface StationRow {
  readonly shipId: string;
  readonly name: string;
  readonly areaName: string;
  /** The manual's status code: AF, RF, MB, WU, FS, or the repair month count. */
  readonly statusCode: string;
  readonly statusLabel: string;
  readonly overBase: boolean;
  readonly overBaseLabel: string;
  readonly flags: readonly StationFlag[];
}

const READINESS_CODE: Readonly<Record<string, "AF" | "RF" | "MB" | "WU">> = {
  ACTIVE: "AF",
  RESERVE: "RF",
  MOTHBALLED: "MB",
  WORKING_UP: "WU",
};

function statusOf(ship: FleetShipView): { code: string; label: string } {
  if (ship.readiness === "REPAIR" && ship.repairMonthsRemaining !== undefined) {
    const n = ship.repairMonthsRemaining;
    return {
      code: String(n),
      label: format(n === 1 ? "fleet.status.repair.one" : "fleet.status.repair.many", { n }),
    };
  }
  if (ship.stationCode === "FS") return { code: "FS", label: format("fleet.status.FS") };
  const code = READINESS_CODE[ship.readiness] ?? "AF";
  return { code, label: format(`fleet.status.${code}`) };
}

function flagsOf(ship: FleetShipView): StationFlag[] {
  const flags: StationFlag[] = [];
  if (ship.colonialCode === "c") flags.push({ code: "c", label: format("fleet.flag.c") });
  if (ship.crampedCode === "a") flags.push({ code: "a", label: format("fleet.flag.a") });
  if (ship.rangeCode === "S") flags.push({ code: "S", label: format("fleet.flag.S") });
  return flags;
}

/** One row per ship of every division, in the projection's order. */
export function stationRows(
  divisions: readonly FleetDivisionView[],
  areaName: (areaId: string) => string,
): StationRow[] {
  return divisions.flatMap((division) =>
    division.ships.map((ship) => {
      const status = statusOf(ship);
      return {
        shipId: ship.shipId,
        name: ship.name,
        areaName: areaName(division.areaId),
        statusCode: status.code,
        statusLabel: status.label,
        overBase: ship.overBaseCode === "*",
        overBaseLabel: format("fleet.status.overBase"),
        flags: flagsOf(ship),
      };
    }),
  );
}

/** Adds the ship if absent, removes it if present; insertion order is kept. */
export function toggleSelection(selected: readonly string[], shipId: string): string[] {
  return selected.includes(shipId) ? selected.filter((id) => id !== shipId) : [...selected, shipId];
}

/** Drops ids that no longer exist after a refresh. */
export function pruneSelection(selected: readonly string[], rows: readonly StationRow[]): string[] {
  const known = new Set(rows.map((row) => row.shipId));
  return selected.filter((id) => known.has(id));
}

/**
 * Turns the engine's rejection diagnostic (`... rejected: <shipId>=<REASON>, ...`) into one text line per ship, led by a
 * headline. Anything unparseable is shown verbatim, never hidden.
 */
export function explainStationRejection(
  intent: "assign" | "clear",
  diagnostics: readonly string[],
  rows: readonly StationRow[],
): string[] {
  const names = new Map(rows.map((row) => [row.shipId, row.name]));
  const lines: string[] = [];
  for (const diagnostic of diagnostics) {
    const detail = diagnostic.includes(": ")
      ? diagnostic.slice(diagnostic.indexOf(": ") + 2)
      : diagnostic;
    const pairs = detail.split(", ").map((part) => part.split("="));
    if (pairs.every((pair) => pair.length === 2 && pair[0] !== "" && /^[A-Z_]+$/.test(pair[1]!))) {
      for (const [id, code] of pairs as [string, string][]) {
        const reasonKey = `fleet.station.reason.${code}`;
        const subject = id === "<batch>" ? "" : (names.get(id) ?? id);
        const reason = hasAuthoredMessage(reasonKey)
          ? translate(reasonKey)
          : format("fleet.station.reason.unknown", { code });
        lines.push(subject === "" ? reason : `${subject} ${reason}`);
      }
    } else {
      lines.push(diagnostic);
    }
  }
  return [format(`fleet.station.rejected.${intent}`), ...lines];
}

export interface PresenceRowView {
  readonly areaId: string;
  readonly areaName: string;
  readonly required: string;
  readonly present: string;
  readonly shortfall: string;
  readonly short: boolean;
}

export type PresenceReadoutView =
  | { readonly kind: "not-configured"; readonly overBase: readonly string[] }
  | {
      readonly kind: "configured";
      readonly exempt: boolean;
      readonly rows: readonly PresenceRowView[];
      readonly overBase: readonly string[];
    };

const tons = (n: number) => format("fleet.presence.tons", { n });

/** The presence readout, worded from the projection alone (no value is computed or defaulted here). */
export function presenceReadout(
  presence: PlayerProjectionPresence,
  overBaseShips: readonly FleetOverBaseShip[],
  areaName: (areaId: string) => string,
): PresenceReadoutView {
  const overBase = overBaseShips.map((ship) =>
    format("fleet.overBase.item", {
      ship: ship.name,
      area: areaName(ship.areaId),
    }),
  );
  if (!presence.configured) return { kind: "not-configured", overBase };
  return {
    kind: "configured",
    exempt: presence.exempt,
    rows: presence.areas.map((row) => ({
      areaId: row.areaId,
      areaName: areaName(row.areaId),
      required: tons(row.requiredTons),
      present: tons(row.presentTons),
      shortfall:
        row.shortfallTons > 0
          ? tons(row.shortfallTons)
          : format(presence.exempt ? "fleet.presence.suspended" : "fleet.presence.met"),
      short: row.shortfallTons > 0,
    })),
    overBase,
  };
}
