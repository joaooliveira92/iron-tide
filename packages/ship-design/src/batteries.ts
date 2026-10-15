import type { ComponentSummary, PlacementSpec } from "./compileShared.js";

/** Which battery a gun or tube belongs to, by component category. */
export type BatteryRole = "MAIN" | "SECONDARY" | "TORPEDO";

const ROLE_OF: Readonly<Partial<Record<ComponentSummary["category"], BatteryRole>>> = {
  MAIN_GUN: "MAIN",
  SECONDARY_GUN: "SECONDARY",
  DUAL_PURPOSE_GUN: "SECONDARY",
  TORPEDO_TUBE: "TORPEDO",
};

export interface BatteryRow {
  /** Stable key: role and calibre (0 for tubes). */
  readonly key: string;
  readonly role: BatteryRole;
  /** Calibre, micrometres; 0 for torpedo tubes. */
  readonly caliberUm: number;
  readonly mounts: number;
  /** Total barrels (guns) or tubes across the mounts. */
  readonly barrels: number;
  /** Rounds per gun when every mount carries the same amount; null when they differ or the battery has none. */
  readonly roundsPerGun: number | null;
  readonly weightKg: number;
  /** Instance ids in station order (bow first), ties by id. */
  readonly instanceIds: readonly string[];
}

const ROLE_ORDER: Readonly<Record<BatteryRole, number>> = { MAIN: 0, SECONDARY: 1, TORPEDO: 2 };

/**
 * The guns and tubes of a design grouped into batteries: main and secondary guns by calibre, torpedo tubes together.
 * Pure and ordered (main, then secondary, then torpedo; largest calibre first), so the same design always reads the same.
 * `placements` supplies the stations used to order the instances.
 */
export function batterySummary(
  components: readonly ComponentSummary[],
  placements: readonly Pick<PlacementSpec, "instanceId" | "stationPermille">[],
): BatteryRow[] {
  const station = new Map(placements.map((p) => [p.instanceId, p.stationPermille]));
  const groups = new Map<string, ComponentSummary[]>();
  for (const c of components) {
    const role = ROLE_OF[c.category];
    if (role === undefined) continue;
    const caliber = role === "TORPEDO" ? 0 : (c.attr.caliberUm ?? 0);
    const key = `${role}:${caliber}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const rows = [...groups.entries()].map(([key, members]): BatteryRow => {
    const first = members[0]!;
    const role = ROLE_OF[first.category]!;
    const rounds = new Set(members.map((m) => m.params.rounds));
    const onlyRounds = rounds.size === 1 ? [...rounds][0] : undefined;
    return {
      key,
      role,
      caliberUm: role === "TORPEDO" ? 0 : (first.attr.caliberUm ?? 0),
      mounts: members.length,
      barrels: members.reduce(
        (a, m) => a + (role === "TORPEDO" ? (m.params.tubes ?? 1) : (m.params.barrels ?? 1)),
        0,
      ),
      roundsPerGun: onlyRounds === undefined ? null : onlyRounds,
      weightKg: members.reduce((a, m) => a + m.weightKg, 0),
      instanceIds: members
        .map((m) => m.instanceId)
        .sort(
          (a, b) => (station.get(a) ?? 0) - (station.get(b) ?? 0) || (a < b ? -1 : a > b ? 1 : 0),
        ),
    };
  });
  return rows.sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || b.caliberUm - a.caliberUm);
}

const FORE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const AFT_LETTERS = "YXWVUTSRQPONMLKJIHGFEDCBAZ";

/**
 * Conventional turret names for the centreline mounts of a battery, bow to stern: the forward half is A, B, C, ... and the
 * after half counts back from the stern as Y, X, W, ... (the Royal Navy convention: A and B forward, X and Y aft). Wing mounts
 * are named by side and order ("Port 1", "Starboard 2"). Pure; `mounts` are the battery's placements.
 */
export function mountNames(
  mounts: readonly Pick<PlacementSpec, "instanceId" | "stationPermille" | "side">[],
): Map<string, string> {
  const names = new Map<string, string>();
  const order = (a: (typeof mounts)[number], b: (typeof mounts)[number]) =>
    a.stationPermille - b.stationPermille || (a.instanceId < b.instanceId ? -1 : 1);
  const centre = mounts.filter((m) => (m.side ?? "CENTRE") === "CENTRE").sort(order);
  const fore = Math.ceil(centre.length / 2);
  centre.forEach((m, i) => {
    const name = i < fore ? FORE_LETTERS[i] : AFT_LETTERS[centre.length - 1 - i];
    names.set(m.instanceId, name ?? `#${i + 1}`);
  });
  for (const side of ["PORT", "STBD"] as const) {
    mounts
      .filter((m) => m.side === side)
      .sort(order)
      .forEach((m, i) =>
        names.set(m.instanceId, `${side === "PORT" ? "Port" : "Starboard"} ${i + 1}`),
      );
  }
  return names;
}
