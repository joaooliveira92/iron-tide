import type { DesignDraft, WorkshopView } from "@bluewave/ship-design";
import { mountClassOf, type MountClass } from "@bluewave/ship-visual";
import type { PlanModel } from "../planModel.js";
import { waterplaneShape } from "../waterplane.js";
import {
  circle,
  cylinder,
  discPath,
  ellipse,
  extrude,
  fitProjection,
  iso,
  lineOf,
  loft,
  pathOf,
  roundedPlan,
  screenWidth,
  type Flat,
  type Point3,
  type SolidPaths,
  type Tone,
} from "./iso.js";

type Fill = "paper" | "face" | "ink" | "boot" | "under";

export interface AnatomySolid {
  readonly paths: SolidPaths;
  readonly tone: Tone;
  readonly crease: Tone | "none";
  readonly fill: Fill;
  readonly flat: boolean;
}

export interface AnatomyLine {
  readonly d: string;
  readonly tone: Tone | "ink";
  readonly dotted?: boolean;
  readonly heavy?: boolean;
}

export interface AnatomyDot {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly tone: Tone;
}

export interface AnatomyInk {
  readonly d: string;
  readonly tone?: "ink" | "glass" | "shadow";
}

export interface AnatomyPart {
  readonly id: string;
  readonly label: string;
  readonly solids: readonly AnatomySolid[];
  readonly inks: readonly AnatomyInk[];
  readonly lines: readonly AnatomyLine[];
  readonly dots: readonly AnatomyDot[];
  readonly halo?: string;
}

export interface AnatomyAnchor {
  readonly at: Flat;
  readonly radius: number;
}

export interface AnatomyShip {
  readonly width: number;
  readonly height: number;
  readonly label: string;
  readonly azimuth: number;
  readonly parts: readonly AnatomyPart[];
  readonly anchors: ReadonlyMap<string, AnatomyAnchor>;
  readonly facts: ReadonlyMap<string, string>;
}

export interface AnatomyInput {
  readonly draft: DesignDraft;
  readonly view: WorkshopView;
  readonly model: Pick<
    PlanModel,
    | "form"
    | "frame"
    | "superstructure"
    | "placedFunnels"
    | "visualMounts"
    | "targets"
    | "entryOf"
    | "mountNames"
    | "look"
  >;
  readonly azimuth: number;
  readonly width?: number;
  readonly height?: number;
}

interface Reach {
  readonly bow: number;
  readonly stern: number;
}

interface PartDraft {
  id: string;
  label: string;
  solids: AnatomySolid[];
  inks: AnatomyInk[];
  lines: AnatomyLine[];
  dots: AnatomyDot[];
  halo?: string;
}

interface AnchorDraft {
  at: Flat;
  radius: number;
}

const CATEGORY_LABEL: Readonly<Record<string, string>> = {
  MAIN_GUN: "Main gun",
  SECONDARY_GUN: "Secondary gun",
  TERTIARY_GUN: "Tertiary gun",
  DUAL_PURPOSE_GUN: "Dual-purpose gun",
  AA_WEAPON: "Anti-aircraft gun",
  TORPEDO_TUBE: "Torpedo tube",
  DIRECTOR: "Fire-control director",
  RANGEFINDER: "Rangefinder",
  RADAR: "Radar",
  SONAR: "Sonar",
  COMMS: "Communications",
  AIRCRAFT_FACILITY: "Aircraft facility",
  MINE_GEAR: "Mine gear",
  GENERATOR: "Generator",
  BOILER: "Boiler",
  ENGINE: "Engine",
  SHAFT_PROPELLER: "Shaft and propeller",
  FUEL_BUNKER: "Fuel bunker",
  MAGAZINE: "Magazine",
  AMMUNITION: "Ammunition",
  DAMAGE_CONTROL: "Damage control",
  ACCOMMODATION: "Accommodation",
  SPECIAL_EQUIPMENT: "Special equipment",
  MOUNT: "Mount",
};

const MOUNT_LABEL: Readonly<Record<MountClass, string>> = {
  TURRET: "turret",
  BARBETTE: "barbette",
  SHIELDED: "shielded mount",
  OPEN: "open mount",
  CASEMATE: "casemate",
};

/** What the hull form says about the ship: how many masts it carries and how many boats it hoists. */
interface ShipProfile {
  readonly name: string;
  readonly masts: 1 | 2;
  readonly boats: 0 | 1 | 2 | 4;
  readonly mastRise: number;
}

const SHIP_PROFILES: Readonly<Record<string, ShipProfile>> = {
  torpedo_boat_form: { name: "Torpedo boat", masts: 1, boats: 0, mastRise: 0.7 },
  protected_cruiser_form: { name: "Protected cruiser", masts: 2, boats: 2, mastRise: 1 },
  coast_defence_form: { name: "Coast-defence ship", masts: 1, boats: 2, mastRise: 0.8 },
  pre_dreadnought_form: { name: "Battleship", masts: 2, boats: 2, mastRise: 1 },
  merchant_liner_form: { name: "Liner", masts: 2, boats: 4, mastRise: 1.15 },
};

const profileOf = (hullFormId: string, lengthM: number): ShipProfile =>
  SHIP_PROFILES[hullFormId] ?? {
    name: "Warship",
    masts: lengthM < 70 ? 1 : 2,
    boats: lengthM < 70 ? 1 : 2,
    mastRise: 1,
  };

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

const finite = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0 ? value : fallback;

const round1 = (value: number) => Math.round(value * 10) / 10;

const wholeInches = (caliberUm: number) => Math.round(caliberUm / 25_400);

const solid = (
  paths: SolidPaths,
  tone: Tone = "hi",
  options: { readonly crease?: Tone | "none"; readonly fill?: Fill; readonly flat?: boolean } = {},
): AnatomySolid => ({
  paths,
  tone,
  crease: options.crease ?? "faint",
  fill: options.fill ?? "paper",
  flat: options.flat ?? false,
});

const ribbon = (top: readonly Flat[], bottom: readonly Flat[]): SolidPaths => {
  const fill = pathOf([...top, ...[...bottom].reverse()], true);
  return { fill, outline: fill, crease: "", top: "", shades: [] };
};

export function buildAnatomyShip(input: AnatomyInput): AnatomyShip {
  const { draft, view, model, azimuth } = input;
  const width = input.width ?? 420;
  const height = input.height ?? 250;
  const near = Math.sin((azimuth * Math.PI) / 180) >= 0 ? 1 : -1;

  const rawL = Number(draft.hull.lengthWl) / 1000;
  const rawB = Number(draft.hull.beam) / 1000;
  const rawD = Number(draft.hull.depthToMainDeck) / 1000;
  const rawT = Number(draft.hull.draught) / 1000;
  const L = finite(rawL, 120);
  const shownB = finite(rawB, L * 0.11);
  const shownD = finite(rawD, L * 0.07);
  const shownT = finite(rawT, shownD * 0.55);
  const B = clamp(shownB, L * 0.04, L * 0.24);
  const D = clamp(shownD, L * 0.025, L * 0.18);
  const T = clamp(shownT, D * 0.12, D * 0.92);
  const zScale = clamp(150 / L, 1.15, 1.7);

  const shape = waterplaneShape({
    waterplaneCoeffBp: model.form?.waterplaneCoeffBp ?? 7200,
    lcbPermille: model.form?.lcbPermille ?? 500,
    bow: model.frame.bow,
    stern: model.frame.stern,
  });
  const halfAt = (t: number) => (B / 2) * shape(clamp(t, 0, 1));
  const sheerRise = (Math.max(0, (model.form?.sheerBp ?? 10_000) - 10_000) / 10_000) * D * 0.45;
  const deckZ = (t: number) => D + sheerRise * Math.abs(2 * clamp(t, 0, 1) - 1) ** 2;
  const keelZ = (t: number) => 0.055 * D * Math.abs(2 * clamp(t, 0, 1) - 1) ** 2.4;
  const halfAtZ = (t: number, z: number) => {
    const deck = deckZ(t);
    if (z <= T) return halfAt(t) * (0.5 + 0.46 * clamp(z / Math.max(T, 0.001), 0, 1));
    return halfAt(t) * (0.96 + 0.04 * clamp((z - T) / Math.max(deck - T, 0.001), 0, 1));
  };

  const profile = profileOf(draft.hull.hullFormId, L);
  const era = model.look?.era ?? "DREADNOUGHT";
  const zone = model.superstructure;
  const houseStart = clamp(zone?.startPermille ?? 0, 50, 950);
  const houseEnd = clamp(zone?.endPermille ?? 0, 50, 950);
  const hasHouse = zone !== undefined && houseEnd - houseStart >= 10;
  const houseT0 = hasHouse ? houseStart / 1000 : 0.38;
  const houseT1 = hasHouse ? houseEnd / 1000 : 0.62;
  const houseW = (houseT1 - houseT0) * L;
  const houseHalf = hasHouse
    ? Math.min(B * 0.31, ((halfAt(houseT0) + halfAt(houseT1)) / 2) * 0.64)
    : 0;
  const houseMid = (houseT0 + houseT1) / 2;
  const lowerTop = deckZ(houseMid) + 0.22 * D;
  const upperTop = lowerTop + 0.14 * D;

  const funnels = [...model.placedFunnels].sort(
    (a, b) => a.stationPermille - b.stationPermille || a.instanceId.localeCompare(b.instanceId),
  );
  const funnelMetrics = funnels.map((funnel) => {
    const t = clamp(funnel.stationPermille / 1000, 0, 1);
    const inHouse = hasHouse && t >= houseT0 && t <= houseT1;
    const radius = clamp(L * 0.017, 0.75, B * 0.16);
    const baseZ = inHouse ? lowerTop : deckZ(t);
    const rise = Math.max(0.58 * D, 4);
    return {
      ...funnel,
      t,
      inHouse,
      radius,
      baseZ,
      topZ: baseZ + rise,
      rake: radius * 0.14,
    };
  });
  const funnelTop = funnelMetrics.reduce((most, funnel) => Math.max(most, funnel.topZ), 0);

  const mastBase = hasHouse ? upperTop : 0;
  const mastRise =
    Math.max(0.9 * D, 7, 0.085 * L) * profile.mastRise * (era === "VICTORIAN" ? 1.15 : 1);
  const mastTop = hasHouse ? mastBase + mastRise : 0;

  const maxTop = Math.max(
    deckZ(0.5) + 0.8 * D,
    funnelTop,
    mastTop,
    hasHouse ? upperTop + 0.2 * D : 0,
  );

  const wayHalf = Math.max(B * 0.88, halfAt(0.5) * 1.35);
  const wayBase = -0.22 * D;
  const way = {
    x: -0.07 * L,
    y: -wayHalf,
    w: 1.14 * L,
    d: wayHalf * 2,
    r: Math.min(0.02 * L, wayHalf),
  };

  const fitPoints: Point3[] = [
    [way.x, way.y, wayBase],
    [way.x + way.w, way.y, wayBase],
    [way.x, way.y + way.d, wayBase],
    [way.x + way.w, way.y + way.d, wayBase],
    [-0.035 * L, 0, 0.6 * T],
    [L, 0, 0],
    [0, 0, 0],
    [0, -B / 2, 0],
    [0, B / 2, 0],
    [L, -B / 2, 0],
    [L, B / 2, 0],
    [0, 0, maxTop],
    [L, 0, maxTop],
    [L * 0.5, -B * 0.8, maxTop],
    [L * 0.5, B * 0.8, maxTop],
  ];
  const P = fitProjection(fitPoints, width, height, {
    pad: 12,
    azimuth,
    elevation: 27,
    zScale,
  });

  const parts: PartDraft[] = [];
  const anchors = new Map<string, AnchorDraft>();
  const facts = new Map<string, string>();
  const add = (part: PartDraft, anchor?: AnchorDraft) => {
    parts.push(part);
    if (anchor) anchors.set(part.id, anchor);
  };
  const text = (x: number, y: number, z: number, anchorRad = 12): AnchorDraft => ({
    at: iso([x, y, z], P),
    radius: anchorRad,
  });

  // How far a level's outline reaches past the waterline ends: the stem rakes forward at the deck and falls
  // back at the forefoot, and the stern overhangs by its style. Positive reaches go outboard along x.
  const bowRake = model.frame.bow === "plumb" ? 0.008 : model.frame.bow === "spoon" ? 0.03 : 0.014;
  const sternRake =
    model.frame.stern === "counter" ? 0.034 : model.frame.stern === "round" ? 0.026 : 0.01;
  const DECK_REACH: Reach = { bow: bowRake * L, stern: sternRake * L };
  const WATER_REACH: Reach = { bow: 0, stern: sternRake * 0.35 * L };
  const KEEL_REACH: Reach = { bow: -0.032 * L, stern: 0 };
  const ring = (
    scale: number,
    zOf: (t: number) => number,
    reach: Reach = WATER_REACH,
  ): Point3[] => {
    const steps = 30;
    const stemX = (t: number) => t * L - reach.bow * Math.max(0, 1 - t / 0.08) ** 2;
    const points: Point3[] = [[stemX(0), 0, zOf(0)]];
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      points.push([stemX(t), halfAt(t) * scale, zOf(t)]);
    }
    // The stern closes in a rounded arc, so a counter or round stern is no longer a flat cut-off.
    const half = halfAt(1) * scale;
    const arc = 6;
    for (let step = 1; step < arc; step++) {
      const u = 1 - (2 * step) / arc;
      points.push([L + reach.stern * Math.sqrt(1 - u * u), half * u, zOf(1)]);
    }
    points.push([L, -half, zOf(1)]);
    for (let step = steps - 1; step >= 1; step--) {
      const t = step / steps;
      points.push([stemX(t), -halfAt(t) * scale, zOf(t)]);
    }
    return points;
  };

  const sidePoints = (
    from: number,
    to: number,
    zOf: (t: number) => number,
    yOf: (t: number) => number,
    steps = 18,
  ): Point3[] =>
    Array.from({ length: steps + 1 }, (_, index) => {
      const t = from + ((to - from) * index) / steps;
      return [t * L, yOf(t), zOf(t)] as Point3;
    });

  // --- The slipway: a low base, keel blocks, two shores, a rule strip and a label plate.
  {
    const part: PartDraft = {
      id: "slipway",
      label: "Building slip",
      solids: [],
      inks: [],
      lines: [],
      dots: [],
    };
    part.halo = pathOf(
      roundedPlan(way, 8).map(([x, y]) => iso([x, y, wayBase], P)),
      true,
    );
    part.solids.push(
      solid(extrude(roundedPlan(way, 8), wayBase, 0.075 * D, P), "lo", { crease: "faint" }),
    );
    part.lines.push({
      d: lineOf(
        roundedPlan(
          {
            ...way,
            x: way.x + 0.01 * L,
            y: way.y + 0.01 * L,
            w: way.w - 0.02 * L,
            d: way.d - 0.02 * L,
          },
          8,
        ).map(([x, y]) => [x, y, wayBase + 0.075 * D] as Point3),
        P,
        true,
      ),
      tone: "faint",
    });
    const top = wayBase + 0.075 * D;
    part.inks.push({
      d: lineOf(
        ring(0.92, () => top).map(([x, y, z]): Point3 => [x + 0.012 * L, y - near * 0.05 * B, z]),
        P,
        true,
      ),
      tone: "shadow",
    });
    for (const t of [0.13, 0.3, 0.5, 0.7, 0.87]) {
      const bw = 0.052 * L;
      const bd = 0.15 * B;
      const bx = t * L;
      const blockZ = Math.min(keelZ(t) - 0.004 * D, top + 0.11 * D);
      part.solids.push(
        solid(
          extrude(
            roundedPlan({ x: bx - bw / 2, y: -bd / 2, w: bw, d: bd, r: 0.008 * L }, 3),
            top,
            Math.max(0.01, blockZ - top),
            P,
          ),
          "mid",
        ),
      );
      part.lines.push({
        d: lineOf(
          [
            [bx - bw * 0.4, -bd * 0.4, blockZ],
            [bx + bw * 0.4, bd * 0.4, blockZ],
          ],
          P,
        ),
        tone: "faint",
      });
    }
    for (const t of [0.32, 0.68]) {
      const sx = t * L;
      const sy = near * halfAt(t) * 0.63;
      const shore = {
        x: sx - 0.008 * L,
        y: sy - 0.012 * B,
        w: 0.016 * L,
        d: 0.024 * B,
        r: 0.004 * L,
      };
      part.solids.push(
        solid(extrude(roundedPlan(shore, 3), top, Math.max(0.01, 0.48 * D - top), P), "mid"),
      );
      const [shoreX, shoreY] = iso([sx, sy, 0.48 * D], P);
      part.dots.push({ x: shoreX, y: shoreY, r: 0.8, tone: "lo" });
    }
    const strip = {
      x: 0.06 * L,
      y: near * (wayHalf * 0.84) - 0.028 * B,
      w: 0.88 * L,
      d: 0.056 * B,
      r: 0.004 * L,
    };
    part.solids.push(
      solid(extrude(roundedPlan(strip, 3), top, 0.008 * D, P), "lo", { crease: "none" }),
    );
    const minor: Point3[] = [];
    const major: Point3[] = [];
    const count = 26;
    for (let index = 1; index < count; index++) {
      const x = strip.x + (strip.w * index) / count;
      const long = index % 5 === 0;
      const length = long ? 0.042 * B : 0.024 * B;
      const y0 = strip.y + (near > 0 ? strip.d - 0.004 * B : 0.004 * B);
      const y1 = y0 - near * length;
      (long ? major : minor).push([x, y0, top + 0.008 * D], [x, y1, top + 0.008 * D]);
    }
    part.lines.push({ d: lineOf(minor, P), tone: "lo" });
    part.lines.push({ d: lineOf(major, P), tone: "mid" });
    const plate = {
      x: 0.7 * L,
      y: near * (wayHalf * 0.5) - 0.06 * B,
      w: 0.16 * L,
      d: 0.1 * B,
      r: 0.006 * L,
    };
    part.solids.push(
      solid(extrude(roundedPlan(plate, 3), top, 0.012 * D, P), "lo", { crease: "none" }),
    );
    for (let index = 0; index < 3; index++) {
      const y = plate.y + plate.d * (0.28 + index * 0.2);
      part.lines.push({
        d: lineOf(
          [
            [plate.x + plate.w * 0.12, y, top + 0.012 * D],
            [plate.x + plate.w * (index === 2 ? 0.55 : 0.86), y, top + 0.012 * D],
          ],
          P,
        ),
        tone: "lo",
        dotted: index === 2,
      });
    }
    part.dots.push(
      ...[
        [plate.x + plate.w * 0.1, plate.y + plate.d * 0.15, top + 0.012 * D],
        [plate.x + plate.w * 0.9, plate.y + plate.d * 0.15, top + 0.012 * D],
      ].map(([x, y, z]) => {
        const [px, py] = iso([x!, y!, z!], P);
        return { x: px, y: py, r: 0.75, tone: "mid" as Tone };
      }),
    );
    add(part);
  }

  // --- Hull: shaped shell, waterline, boot topping, plating seams, portholes, stern gear.
  {
    const part: PartDraft = {
      id: "hull",
      label: "Hull",
      solids: [],
      inks: [],
      lines: [],
      dots: [],
    };
    part.solids.push(
      solid(
        loft(
          ring(0.96, () => T),
          ring(0.5, keelZ, KEEL_REACH),
          P,
        ),
        "hi",
        { crease: "none", fill: "under" },
      ),
      solid(
        loft(
          ring(1, deckZ, DECK_REACH),
          ring(0.96, () => T),
          P,
        ),
        "hi",
        { crease: "faint" },
      ),
      solid(
        ribbon(
          sidePoints(
            0.01,
            0.99,
            () => T + 0.026 * D,
            (t) => near * halfAtZ(t, T + 0.026 * D),
            30,
          ).map(([x, y, z]) => iso([x!, y!, z!], P)),
          sidePoints(
            0.01,
            0.99,
            () => T - 0.026 * D,
            (t) => near * halfAtZ(t, T - 0.026 * D),
            30,
          ).map(([x, y, z]) => iso([x!, y!, z!], P)),
        ),
        "lo",
        { crease: "none", fill: "boot", flat: true },
      ),
    );
    part.lines.push({
      d: lineOf(
        sidePoints(
          0.02,
          0.98,
          () => T,
          (t) => near * halfAtZ(t, T),
        ),
        P,
      ),
      tone: "lo",
      heavy: true,
    });
    for (let t = 0.06; t < 0.95; t += 0.055) {
      part.lines.push({
        d: lineOf(
          [
            [t * L, near * halfAtZ(t, T + 0.026 * D) * 0.997, T + 0.026 * D],
            [t * L, near * halfAtZ(t, deckZ(t) - 0.02 * D) * 0.998, deckZ(t) - 0.02 * D],
          ],
          P,
        ),
        tone: "faint",
      });
    }
    for (let t = 0.11; t < 0.91; t += 0.044) {
      const [px, py] = iso(
        [t * L, near * halfAtZ(t, deckZ(t) - 0.16 * D) * 0.995, deckZ(t) - 0.16 * D],
        P,
      );
      part.dots.push({ x: px, y: py, r: 0.9, tone: "lo" });
    }
    const hawseZ = deckZ(0.045) - 0.13 * D;
    const hawse: Flat[] = ellipse(0, 0, 1, 1, 14).map(([ex, ey]) => {
      const [px, py] = iso(
        [0.045 * L + ex * 0.006 * L, near * halfAtZ(0.045, hawseZ) + ey * 0.01 * B, hawseZ],
        P,
      );
      return [px, py];
    });
    part.inks.push({ d: pathOf(hawse, true) });
    part.lines.push({
      d: lineOf(
        [
          [0.045 * L, near * halfAtZ(0.045, hawseZ) - 0.008 * B, hawseZ],
          [0.075 * L, near * halfAt(0.075) * 0.9, deckZ(0.075) + 0.015 * D],
        ],
        P,
      ),
      tone: "lo",
      dotted: true,
    });
    for (let index = 0; index < 6; index++) {
      const t = 0.045 + index * 0.006;
      const z = hawseZ - 0.012 * D * index;
      const [px, py] = iso([t * L, near * (halfAtZ(t, z) + 0.008 * B), z], P);
      part.dots.push({ x: px, y: py, r: 0.7, tone: "mid" });
    }
    if (model.frame.bow === "ram") {
      const bowHalf = Math.max(0.018 * B, halfAt(0.012));
      const ramTop: Point3[] = [
        [-0.002 * L, 0, 0.74 * T],
        [0.024 * L, bowHalf, 0.74 * T],
        [0.024 * L, -bowHalf, 0.74 * T],
      ];
      const ramBottom: Point3[] = [
        [-0.026 * L, 0, 0.5 * T],
        [0.02 * L, bowHalf, 0.5 * T],
        [0.02 * L, -bowHalf, 0.5 * T],
      ];
      part.solids.push(solid(loft(ramTop, ramBottom, P), "hi", { crease: "mid" }));
    }
    const shaftZ = 0.28 * T;
    part.solids.push(
      solid(
        extrude(
          roundedPlan({ x: 0.965 * L, y: -0.012 * B, w: 0.022 * L, d: 0.024 * B, r: 0.004 * L }, 3),
          0.12 * T,
          0.36 * T,
          P,
        ),
        "mid",
      ),
    );
    part.lines.push({
      d: lineOf(
        [
          [0.94 * L, 0, shaftZ],
          [0.985 * L, 0, shaftZ],
        ],
        P,
      ),
      tone: "mid",
    });
    const propAt = iso([0.988 * L, 0, shaftZ], P);
    const propR = Math.max(3, Math.min(9, 0.02 * L * P.scale));
    for (let blade = 0; blade < 3; blade++) {
      const angle = (blade / 3) * Math.PI * 2 + 0.4;
      part.lines.push({
        d: pathOf([
          [propAt[0], propAt[1]],
          [propAt[0] + Math.cos(angle) * propR, propAt[1] + Math.sin(angle) * propR],
        ]),
        tone: "lo",
      });
    }
    part.dots.push({ x: propAt[0], y: propAt[1], r: 1.1, tone: "mid" });
    add(part, text(L / 2, 0, D * 0.55, 40));
    facts.set("hull", `${round1(L)} m · ${round1(shownB)} m beam · ${round1(shownD)} m depth`);
  }

  // --- Deck: margin, planking, hatches, breakwater, capstans and bollards.
  {
    const part: PartDraft = {
      id: "deck",
      label: "Deck",
      solids: [],
      inks: [],
      lines: [],
      dots: [],
    };
    part.lines.push({
      d: lineOf(
        ring(0.975, (t) => deckZ(t) + 0.006 * D, {
          bow: DECK_REACH.bow * 0.97,
          stern: DECK_REACH.stern * 0.97,
        }),
        P,
        true,
      ),
      tone: "mid",
    });
    part.lines.push({
      d: lineOf(
        [
          [0, 0, deckZ(0) + 0.008 * D],
          [L, 0, deckZ(1) + 0.008 * D],
        ],
        P,
      ),
      tone: "faint",
    });
    for (let t = 0.05; t < 0.96; t += 0.038) {
      const y = halfAt(t) * 0.97;
      part.lines.push({
        d: lineOf(
          [
            [t * L, -y, deckZ(t) + 0.006 * D],
            [t * L, y, deckZ(t) + 0.006 * D],
          ],
          P,
        ),
        tone: "faint",
      });
    }
    for (const t of [0.2, 0.72]) {
      const plan = { x: t * L - 0.028 * L, y: -0.11 * B, w: 0.056 * L, d: 0.22 * B, r: 0.012 * L };
      part.solids.push(
        solid(extrude(roundedPlan(plan, 4), deckZ(t), 0.018 * D, P), "mid", { crease: "lo" }),
      );
      part.lines.push({
        d: lineOf(
          roundedPlan(
            {
              x: plan.x + 0.006 * L,
              y: plan.y + 0.02 * B,
              w: plan.w - 0.012 * L,
              d: plan.d - 0.04 * B,
              r: 0.006 * L,
            },
            4,
          ).map(([x, y]) => [x, y, deckZ(t) + 0.018 * D] as Point3),
          P,
          true,
        ),
        tone: "faint",
      });
      for (const dx of [-0.018, 0.018]) {
        for (const dy of [-0.07, 0.07]) {
          const [px, py] = iso([t * L + dx * L, dy * B, deckZ(t) + 0.018 * D], P);
          part.dots.push({ x: px, y: py, r: 0.65, tone: "mid" });
        }
      }
    }
    part.lines.push({
      d: lineOf(
        [
          [0.12 * L, 0, deckZ(0.12) + 0.02 * D],
          [0.075 * L, -halfAt(0.075) * 0.55, deckZ(0.075) + 0.02 * D],
          [0.12 * L, 0, deckZ(0.12) + 0.02 * D],
          [0.075 * L, halfAt(0.075) * 0.55, deckZ(0.075) + 0.02 * D],
        ],
        P,
      ),
      tone: "mid",
    });
    for (const t of [0.06, 0.94]) {
      for (const side of [-1, 1]) {
        if (Math.abs(side - near) > 0 && t < 0.5) continue;
        const x = t * L;
        const y = side * halfAt(t) * 0.6;
        const cap = cylinder(x, y, 0.032 * B, deckZ(t), 0.035 * D, P, 16);
        part.solids.push(solid(cap, "mid"));
        const [px, py] = iso([x, y, deckZ(t) + 0.035 * D], P);
        part.dots.push({ x: px, y: py, r: 0.7, tone: "lo" });
      }
    }
    for (let index = 1; index < 10; index++) {
      const t = index / 10;
      const [px, py] = iso([t * L, near * halfAt(t) * 0.9, deckZ(t) + 0.012 * D], P);
      part.dots.push({ x: px, y: py, r: 1, tone: "lo" });
    }
    add(part);
  }

  // --- Masts: the ship type sets how many, the era sets the rig (yards, fighting top or tripod).
  if (hasHouse) {
    const span = houseT1 - houseT0;
    const stations =
      profile.masts === 1 ? [houseT0 + span * 0.3] : [houseT0 + span * 0.22, houseT1 - span * 0.08];
    stations.forEach((t, index) => {
      const baseZ = index === 0 ? upperTop : lowerTop;
      const topZ = baseZ + mastRise;
      const x = t * L;
      const radius = clamp(0.0013 * L, 0.12, 0.24);
      const part: PartDraft = {
        id: index === 0 ? "mast:fore" : "mast:main",
        label: index === 0 ? "Foremast" : "Mainmast",
        solids: [],
        inks: [],
        lines: [],
        dots: [],
      };
      const tripod = era === "DREADNOUGHT" || era === "LATE_DREADNOUGHT";
      part.solids.push(
        solid(
          cylinder(
            x,
            0,
            tripod ? radius * 1.6 : radius,
            baseZ - 0.04 * D,
            mastRise + 0.04 * D,
            P,
            12,
          ),
          "mid",
          { crease: "none" },
        ),
      );
      if (tripod) {
        // Legs rake aft and out to the deck, bracing the tall tower mast.
        for (const side of [-1, 1]) {
          part.lines.push({
            d: lineOf(
              [
                [x, 0, baseZ + mastRise * 0.72],
                [x + 0.018 * L, side * B * 0.1, baseZ],
              ],
              P,
            ),
            tone: "mid",
            heavy: true,
          });
        }
      }
      const nestZ = baseZ + mastRise * (tripod ? 0.72 : 0.58);
      const nestR = radius * (era === "PRE_DREADNOUGHT" ? 4.6 : tripod ? 4 : 3.2);
      part.solids.push(
        solid(cylinder(x, 0, nestR, nestZ, 0.025 * D, P, 16), "mid", { crease: "faint" }),
      );
      if (tripod) {
        // Fire-control top above the platform.
        part.solids.push(
          solid(cylinder(x, 0, nestR * 0.6, nestZ + 0.05 * D, 0.04 * D, P, 12), "hi", {
            crease: "lo",
          }),
        );
      }
      part.lines.push({
        d: pathOf([iso([x, 0, topZ], P), iso([x, 0, topZ + 0.06 * D], P)]),
        tone: "hi",
      });
      const yards: readonly (readonly [number, number])[] =
        era === "VICTORIAN"
          ? [
              [0.45, 0.47],
              [0.72, 0.34],
              [0.88, 0.22],
            ]
          : era === "PRE_DREADNOUGHT"
            ? [[0.8, 0.3]]
            : [[0.86, 0.16]];
      for (const [share, yardSpan] of yards) {
        const z = baseZ + mastRise * share;
        part.lines.push({
          d: lineOf(
            [
              [x, -B * yardSpan, z],
              [x, B * yardSpan, z],
            ],
            P,
          ),
          tone: "mid",
          heavy: true,
        });
        for (const side of [-1, 1]) {
          const [px, py] = iso([x, side * B * yardSpan, z], P);
          part.dots.push({ x: px, y: py, r: 0.75, tone: "mid" });
        }
      }
      // Standing rigging: full stays in the sailing era, a single light stay once steam took over.
      const stays = era === "VICTORIAN" ? [0.02, 0.98] : index === 0 ? [0.02] : [0.98];
      for (const end of stays) {
        part.lines.push({
          d: lineOf(
            [
              [x, 0, topZ],
              [end * L, 0, deckZ(end) + 0.02 * D],
            ],
            P,
          ),
          tone: "faint",
        });
      }
      add(part, text(x, 0, baseZ + mastRise * 0.5, 10));
    });
  }

  // --- Armour: main belt, armoured deck and citadel bounds.
  const regionOf = (region: string) => draft.armour.regions.find((r) => r.region === region);
  const belt = regionOf("BELT_MAIN");
  const beltLengthMm = draft.armour.regions
    .filter((r) => r.region === "BELT_MAIN")
    .reduce((total, r) => total + r.lengthMm, 0);
  if (belt && beltLengthMm > 0) {
    const permille = clamp(
      (beltLengthMm / Math.max(1, Number(draft.hull.lengthWl))) * 1000,
      20,
      980,
    );
    const from = (1000 - permille) / 2000;
    const to = (1000 + permille) / 2000;
    const heightM = clamp(belt.heightMm / 1000, 0.14 * D, 0.62 * D);
    const beltMm = Math.round(belt.thicknessUm / 1000);
    const z0 = T * 0.48;
    const z1 = Math.min(deckZ((from + to) / 2), z0 + heightM);
    const top = sidePoints(
      from,
      to,
      () => z1,
      (t) => near * halfAtZ(t, z1),
      24,
    ).map(([x, y, z]) => iso([x!, y!, z!], P));
    const bottom = sidePoints(
      from,
      to,
      () => z0,
      (t) => near * halfAtZ(t, z0),
      24,
    ).map(([x, y, z]) => iso([x!, y!, z!], P));
    const part: PartDraft = {
      id: "armour:belt",
      label: "Main belt",
      solids: [
        solid(ribbon(top, bottom), beltMm >= 250 ? "mid" : "hi", {
          crease: "none",
          fill: "face",
          flat: true,
        }),
      ],
      inks: [],
      lines: [],
      dots: [],
    };
    part.lines.push({ d: pathOf(top, false), tone: "mid", heavy: true });
    // A thick belt reads as a second, lower edge: one extra rule per 100 mm beyond 150 mm, up to three.
    for (let rule = 1; rule <= clamp(Math.floor((beltMm - 150) / 100), 0, 3); rule++) {
      const zr = z0 + ((z1 - z0) * rule) / 5;
      part.lines.push({
        d: pathOf(
          sidePoints(
            from,
            to,
            () => zr,
            (t) => near * halfAtZ(t, zr),
            24,
          ).map(([x, y, z]) => iso([x!, y!, z!], P)),
          false,
        ),
        tone: "lo",
      });
    }
    for (let index = 1; index < 9; index++) {
      const t = from + ((to - from) * index) / 9;
      part.lines.push({
        d: lineOf(
          [
            [t * L, near * halfAtZ(t, z0), z0],
            [t * L, near * halfAtZ(t, z1), z1],
          ],
          P,
        ),
        tone: "faint",
      });
      const [px, py] = iso([t * L, near * halfAtZ(t, (z0 + z1) / 2), (z0 + z1) / 2], P);
      part.dots.push({ x: px, y: py, r: 0.6, tone: "lo" });
    }
    add(part, text(((from + to) / 2) * L, near * halfAt((from + to) / 2) * 0.98, z1, 24));
    facts.set(
      "armour:belt",
      `Main belt ${Math.round(belt.thicknessUm / 1000)} mm · ${round1(beltLengthMm / 1000)} m · ${round1(heightM)} m high`,
    );
  }

  const upperBelt = regionOf("BELT_UPPER");
  if (upperBelt && belt && beltLengthMm > 0) {
    const permille = clamp(
      (Math.min(upperBelt.lengthMm, beltLengthMm) / Math.max(1, Number(draft.hull.lengthWl))) *
        1000,
      20,
      980,
    );
    const from = (1000 - permille) / 2000;
    const to = (1000 + permille) / 2000;
    const z0 = Math.min(
      deckZ(0.5) - 0.02 * D,
      T * 0.48 + clamp(belt.heightMm / 1000, 0.14 * D, 0.62 * D),
    );
    const z1 = Math.min(
      deckZ((from + to) / 2),
      z0 + clamp(upperBelt.heightMm / 1000, 0.08 * D, 0.3 * D),
    );
    if (z1 > z0) {
      const edge = (z: number) =>
        sidePoints(
          from,
          to,
          () => z,
          (t) => near * halfAtZ(t, z),
          24,
        ).map(([x, y, zz]) => iso([x!, y!, zz!], P));
      const part: PartDraft = {
        id: "armour:belt-upper",
        label: "Upper belt",
        solids: [
          solid(ribbon(edge(z1), edge(z0)), "mid", { crease: "none", fill: "face", flat: true }),
        ],
        inks: [],
        lines: [{ d: pathOf(edge(z1), false), tone: "mid", heavy: true }],
        dots: [],
      };
      add(part, text(((from + to) / 2) * L, near * halfAt((from + to) / 2) * 0.98, z1, 20));
      facts.set("armour:belt-upper", `Upper belt ${Math.round(upperBelt.thicknessUm / 1000)} mm`);
    }
  }

  const deckArmour = regionOf("DECK_MAIN") ?? regionOf("DECK_SLOPE");
  if (deckArmour && beltLengthMm > 0) {
    const permille = clamp(
      (beltLengthMm / Math.max(1, Number(draft.hull.lengthWl))) * 1000,
      20,
      980,
    );
    const from = (1000 - permille) / 2000;
    const to = (1000 + permille) / 2000;
    const plan = {
      x: from * L,
      y: -halfAt((from + to) / 2) * 0.58,
      w: (to - from) * L,
      d: halfAt((from + to) / 2) * 1.16,
      r: 0.012 * L,
    };
    const part: PartDraft = {
      id: "armour:deck",
      label: "Armoured deck",
      solids: [
        solid(extrude(roundedPlan(plan, 4), deckZ((from + to) / 2), 0.011 * D, P), "mid", {
          crease: "lo",
          fill: "face",
        }),
      ],
      inks: [],
      lines: [],
      dots: [],
    };
    for (let index = 1; index < 6; index++) {
      const x = plan.x + (plan.w * index) / 6;
      part.lines.push({
        d: lineOf(
          [
            [x, plan.y, deckZ((from + to) / 2) + 0.011 * D],
            [x, plan.y + plan.d, deckZ((from + to) / 2) + 0.011 * D],
          ],
          P,
        ),
        tone: "faint",
      });
    }
    add(part, text((from + to) * 0.5 * L, 0, deckZ(0.5) + 0.02 * D, 18));
    facts.set("armour:deck", `Armoured deck ${Math.round(deckArmour.thicknessUm / 1000)} mm`);
  }

  const citadelLengthMm = Math.max(0, draft.armour.citadelLengthMm);
  if (citadelLengthMm > 0) {
    const permille = clamp(
      (citadelLengthMm / Math.max(1, Number(draft.hull.lengthWl))) * 1000,
      20,
      980,
    );
    const from = (1000 - permille) / 2000;
    const to = (1000 + permille) / 2000;
    const mid = (from + to) / 2;
    const plan = {
      x: from * L,
      y: -halfAt(mid) * 0.66,
      w: (to - from) * L,
      d: halfAt(mid) * 1.32,
      r: 0.008 * L,
    };
    const part: PartDraft = {
      id: "armour:citadel",
      label: "Armoured citadel",
      solids: [
        solid(extrude(roundedPlan(plan, 4), deckZ(mid), 0.008 * D, P), "mid", {
          crease: "lo",
          fill: "face",
        }),
      ],
      inks: [],
      lines: [],
      dots: [],
    };
    for (const t of [from, to]) {
      part.lines.push({
        d: lineOf(
          [
            [t * L, near * halfAtZ(t, deckZ(t)), deckZ(t)],
            [t * L, near * halfAtZ(t, T), T],
          ],
          P,
        ),
        tone: "mid",
        dotted: true,
      });
    }
    for (let index = 1; index < 4; index++) {
      const x = plan.x + (plan.w * index) / 4;
      part.lines.push({
        d: lineOf(
          [
            [x, plan.y, deckZ(mid) + 0.008 * D],
            [x, plan.y + plan.d, deckZ(mid) + 0.008 * D],
          ],
          P,
        ),
        tone: "faint",
      });
    }
    add(part, text(mid * L, 0, deckZ(mid) + 0.02 * D, 20));
    facts.set("armour:citadel", `Armoured citadel ${round1(citadelLengthMm / 1000)} m long`);
  }

  // --- Superstructure: stepped deckhouse, bridge platform, windows, rails and ladders.
  if (hasHouse) {
    const house: PartDraft = {
      id: "superstructure",
      label: "Superstructure",
      solids: [],
      inks: [],
      lines: [],
      dots: [],
    };
    const lowerPlan = {
      x: houseT0 * L,
      y: -houseHalf,
      w: houseW,
      d: houseHalf * 2,
      r: 0.05 * houseW,
    };
    house.solids.push(
      solid(
        extrude(roundedPlan(lowerPlan, 5), deckZ(houseMid) - 0.05 * D, 0.22 * D + 0.05 * D, P),
        "mid",
        { crease: "lo" },
      ),
    );
    const upperPlan = {
      x: lowerPlan.x + houseW * 0.18,
      y: -houseHalf * 0.7,
      w: houseW * 0.44,
      d: houseHalf * 1.4,
      r: 0.04 * houseW,
    };
    house.solids.push(
      solid(
        extrude(roundedPlan(upperPlan, 5), lowerTop - 0.01 * D, 0.14 * D + 0.01 * D, P),
        "mid",
        { crease: "lo" },
      ),
    );
    const bridgePlan = {
      x: upperPlan.x - houseW * 0.03,
      y: -houseHalf * 0.82,
      w: upperPlan.w + houseW * 0.06,
      d: houseHalf * 1.64,
      r: 0.03 * houseW,
    };
    house.solids.push(
      solid(extrude(roundedPlan(bridgePlan, 5), upperTop, 0.022 * D, P), "hi", { crease: "mid" }),
    );
    const windowY = near * (houseHalf + 0.006 * B);
    const lowerWindows: string[] = [];
    for (let index = 0; index < 7; index++) {
      const x0 = lowerPlan.x + houseW * (0.08 + index * 0.12);
      const x1 = x0 + houseW * 0.065;
      const z0 = lowerTop - 0.095 * D;
      const z1 = lowerTop - 0.052 * D;
      lowerWindows.push(
        pathOf(
          [
            iso([x0, windowY, z0], P),
            iso([x1, windowY, z0], P),
            iso([x1, windowY, z1], P),
            iso([x0, windowY, z1], P),
          ],
          true,
        ),
      );
    }
    house.inks.push({ d: lowerWindows.join(""), tone: "glass" });
    const upperWindows: string[] = [];
    for (let index = 0; index < 4; index++) {
      const x0 = upperPlan.x + upperPlan.w * (0.1 + index * 0.21);
      const x1 = x0 + upperPlan.w * 0.12;
      const z0 = upperTop - 0.07 * D;
      const z1 = upperTop - 0.03 * D;
      upperWindows.push(
        pathOf(
          [
            iso([x0, windowY * 0.7, z0], P),
            iso([x1, windowY * 0.7, z0], P),
            iso([x1, windowY * 0.7, z1], P),
            iso([x0, windowY * 0.7, z1], P),
          ],
          true,
        ),
      );
    }
    house.inks.push({ d: upperWindows.join(""), tone: "glass" });
    for (const xShare of [0.48, 0.54]) {
      const x0 = lowerPlan.x + houseW * xShare;
      house.inks.push({
        tone: "glass",
        d: pathOf(
          [
            iso([x0, windowY, deckZ(houseMid) + 0.01 * D], P),
            iso([x0 + houseW * 0.03, windowY, deckZ(houseMid) + 0.01 * D], P),
            iso([x0 + houseW * 0.03, windowY, lowerTop - 0.03 * D], P),
            iso([x0, windowY, lowerTop - 0.03 * D], P),
          ],
          true,
        ),
      });
    }
    house.lines.push({
      d: lineOf(
        roundedPlan(
          {
            x: bridgePlan.x + 0.01 * houseW,
            y: bridgePlan.y + 0.02 * houseHalf,
            w: bridgePlan.w - 0.02 * houseW,
            d: bridgePlan.d - 0.04 * houseHalf,
            r: 0.02 * houseW,
          },
          5,
        ).map(([x, y]) => [x, y, upperTop + 0.022 * D] as Point3),
        P,
        true,
      ),
      tone: "faint",
    });
    const railY = bridgePlan.y + (near > 0 ? bridgePlan.d : 0);
    for (let index = 0; index <= 6; index++) {
      const railX = bridgePlan.x + (bridgePlan.w * index) / 6;
      const [rx, ry] = iso([railX, railY, upperTop + 0.024 * D], P);
      house.dots.push({ x: rx, y: ry, r: 0.6, tone: "lo" });
    }
    for (const t of [houseT0 + 0.12 * (houseT1 - houseT0), houseT0 + 0.74 * (houseT1 - houseT0)]) {
      house.lines.push({
        d: lineOf(
          [
            [t * L, near * houseHalf, deckZ(t) + 0.04 * D],
            [t * L, near * houseHalf, lowerTop - 0.02 * D],
          ],
          P,
        ),
        tone: "faint",
        dotted: true,
      });
      for (let index = 0; index < 4; index++) {
        const [px, py] = iso([t * L, near * houseHalf, deckZ(t) + (0.04 + index * 0.05) * D], P);
        house.dots.push({ x: px, y: py, r: 0.55, tone: "lo" });
      }
    }
    add(house, text(houseMid * L, 0, upperTop + 0.05 * D, 26));
    facts.set("superstructure", `${round1(houseW)} m deckhouse`);
  }

  // --- Funnels: tapered, raked, banded, with a dark mouth and a steam pipe.
  for (const funnel of funnelMetrics) {
    const part: PartDraft = {
      id: funnel.instanceId,
      label: "Funnel",
      solids: [],
      inks: [],
      lines: [],
      dots: [],
    };
    const { t, radius, baseZ, topZ, rake } = funnel;
    const x = t * L;
    const topRadius = radius * 0.82;
    part.solids.push(
      solid(cylinder(x, 0, radius * 1.16, baseZ, 0.035 * D, P, 20), "mid"),
      solid(
        loft(
          circle(x + rake, 0, topRadius, 24).map(([px, py]) => [px, py, topZ] as Point3),
          circle(x, 0, radius, 24).map(([px, py]) => [px, py, baseZ] as Point3),
          P,
        ),
        "hi",
        { crease: "lo" },
      ),
    );
    const cap = discPath(x + rake, 0, topRadius * 0.78, topZ + 0.002 * D, P, 24);
    part.inks.push({ d: cap });
    part.lines.push({
      d: lineOf(
        circle(x + rake, 0, topRadius, 24).map(([px, py]) => [px, py, topZ] as Point3),
        P,
        true,
      ),
      tone: "mid",
    });
    for (const share of [0.32, 0.64]) {
      const cx = x + rake * share;
      const r = radius + (topRadius - radius) * share;
      part.lines.push({
        d: lineOf(
          circle(cx, 0, r, 20).map(
            ([px, py]) => [px, py, baseZ + (topZ - baseZ) * share] as Point3,
          ),
          P,
          true,
        ),
        tone: "lo",
      });
    }
    const pipeX = x - radius * 0.2;
    const pipeY = near * radius * 1.02;
    part.solids.push(
      solid(cylinder(pipeX, pipeY, radius * 0.12, baseZ, (topZ - baseZ) * 0.84, P, 10), "mid", {
        crease: "none",
      }),
    );
    const [sx, sy] = iso([pipeX, pipeY, baseZ + (topZ - baseZ) * 0.86], P);
    part.dots.push({ x: sx, y: sy, r: 0.8, tone: "mid" });
    const [wx, wy] = iso([x + rake * 0.5, near * radius * 0.9, baseZ + (topZ - baseZ) * 0.72], P);
    part.dots.push({ x: wx, y: wy, r: 1.1, tone: "hi" });
    add(part, text(x, 0, baseZ + (topZ - baseZ) * 0.55, Math.max(14, radius * P.scale * 1.8)));
    facts.set(funnel.instanceId, `Funnel · ${Math.round(t * 1000)}‰ from the bow`);
  }

  // --- Boats on the deckhouse: the ship type sets how many clinker hulls ride the cradles.
  if (hasHouse && profile.boats > 0) {
    const shares: readonly number[] =
      profile.boats === 4 ? [0.2, 0.4, 0.6, 0.8] : profile.boats === 2 ? [0.34, 0.68] : [0.5];
    for (const [index, share] of shares.entries()) {
      const t = houseT0 + (houseT1 - houseT0) * share;
      const boatHalf = 0.012 * L;
      const x = t * L;
      const y = near * (houseHalf + boatHalf * 1.2);
      const z = lowerTop + 0.03 * D;
      const part: PartDraft = {
        id: `boat:${index + 1}`,
        label: "Ship's boat",
        solids: [],
        inks: [],
        lines: [],
        dots: [],
      };
      part.solids.push(
        solid(
          loft(
            ellipse(x, y, 0.045 * L, boatHalf, 18).map(
              ([px, py]) => [px, py, z + 0.055 * D] as Point3,
            ),
            ellipse(x, y, 0.036 * L, boatHalf * 0.62, 18).map(([px, py]) => [px, py, z] as Point3),
            P,
          ),
          "mid",
          { crease: "lo" },
        ),
      );
      part.lines.push({
        d: lineOf(
          ellipse(x, y, 0.036 * L, boatHalf * 0.74, 14).map(
            ([px, py]) => [px, py, z + 0.047 * D] as Point3,
          ),
          P,
          true,
        ),
        tone: "faint",
      });
      for (const dx of [-0.02, 0.012]) {
        part.lines.push({
          d: lineOf(
            [
              [x + dx * L, y - boatHalf * 0.55, z + 0.048 * D],
              [x + dx * L, y + boatHalf * 0.55, z + 0.048 * D],
            ],
            P,
          ),
          tone: "lo",
        });
      }
      add(part);
    }
  }

  // --- Weapons and torpedo tubes from the compiled placements.
  const compiled = new Map(
    view.compiled.components.map((component) => [component.instanceId, component]),
  );
  const visual = new Map(model.visualMounts.map((mount) => [mount.instanceId, mount]));
  const drawn = new Set<string>(funnels.map((funnel) => funnel.instanceId));

  const inkBarrel = (
    from: Point3,
    to: Point3,
    radius: number,
  ): { readonly body: SolidPaths; readonly muzzle: Flat } => {
    const a = iso(from, P);
    const b = iso(to, P);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const w = Math.max(1.1, screenWidth(radius * 2, P));
    const px = (-dy / len) * (w / 2);
    const py = (dx / len) * (w / 2);
    const quad: Flat[] = [
      [a[0] + px, a[1] + py],
      [b[0] + px, b[1] + py],
      [b[0] - px, b[1] - py],
      [a[0] - px, a[1] - py],
    ];
    return { body: ribbon(quad, []), muzzle: b };
  };

  for (const placement of draft.placements) {
    if (drawn.has(placement.instanceId)) continue;
    const mount = visual.get(placement.instanceId);
    const component = compiled.get(placement.instanceId);
    if (mount === undefined || component === undefined) continue;
    const category = mount.category;
    const mountClass = mountClassOf(category, mount.mountType);
    const entry = model.entryOf(placement.componentId);
    const name =
      model.targets.get(placement.instanceId)?.name ?? entry?.displayName ?? placement.componentId;
    const t = clamp(placement.stationPermille / 1000, 0.02, 0.98);
    const x = t * L;
    const side = placement.side ?? "CENTRE";
    // A centreline secondary would sit inside the main turret; nudge it to the near side like the plan does.
    const y =
      side === "PORT"
        ? -halfAt(t) * 0.62
        : side === "STBD"
          ? halfAt(t) * 0.62
          : category === "MAIN_GUN"
            ? 0
            : near * halfAt(t) * 0.32;
    const caliberM = (mount.caliberUm ?? 0) / 1_000_000;
    const radius = clamp(caliberM * 12, 0.7, B * 0.22);
    const barrels = clamp(Math.round(mount.gunCount), 1, 4);
    const inHouseNow = hasHouse && t >= houseT0 && t <= houseT1;
    const gunArmour =
      mountClass === "TURRET" || mountClass === "BARBETTE"
        ? regionOf("TURRET")
        : mountClass === "SHIELDED" || mountClass === "CASEMATE"
          ? regionOf("SECONDARY_GUN")
          : undefined;
    const gunArmourMm = gunArmour ? Math.round(gunArmour.thicknessUm / 1000) : 0;
    const lightweight = category === "AA_WEAPON" || category === "DUAL_PURPOSE_GUN";
    const deck = (inHouseNow && lightweight ? lowerTop : deckZ(t)) + 0.005 * D;

    const factsFor = (extra?: string) => {
      const parts = [CATEGORY_LABEL[category] ?? category];
      if (mountClass) {
        parts.push(MOUNT_LABEL[mountClass]);
        if (caliberM > 0) parts.push(`${wholeInches(mount.caliberUm ?? 0)} in`);
        parts.push(`${barrels} barrel${barrels === 1 ? "" : "s"}`);
        if (gunArmourMm > 0) parts.push(`${gunArmourMm} mm armour`);
      }
      if (extra) parts.push(extra);
      return parts.join(" · ");
    };

    if (category === "TORPEDO_TUBE") {
      const part: PartDraft = {
        id: placement.instanceId,
        label: "Torpedo tube",
        solids: [],
        inks: [],
        lines: [],
        dots: [],
      };
      const submerged = mount.mountType === "SUBMERGED_TUBE";
      const z = submerged ? T * 0.55 : deckZ(t);
      const tubeY = submerged ? near * halfAtZ(t, z) : near * halfAt(t) * 0.36;
      if (submerged) {
        const opening: Flat[] = ellipse(0, 0, 1, 1, 12).map(([ex, ey]) => {
          const [px, py] = iso(
            [x + ex * 0.008 * L, tubeY - near * 0.01 * B + ey * 0.014 * B, z],
            P,
          );
          return [px, py];
        });
        part.inks.push({ d: pathOf(opening, true) });
        part.lines.push({
          d: lineOf(
            [
              [x - 0.008 * L, tubeY, z],
              [x + 0.008 * L, tubeY, z],
            ],
            P,
          ),
          tone: "mid",
        });
      } else {
        part.solids.push(
          solid(
            extrude(
              roundedPlan(
                {
                  x: x - 0.018 * L,
                  y: tubeY - 0.012 * B,
                  w: 0.036 * L,
                  d: 0.024 * B,
                  r: 0.004 * L,
                },
                3,
              ),
              z,
              0.018 * D,
              P,
            ),
            "mid",
          ),
        );
        for (const offset of [-0.006, 0.006]) {
          const barrel = inkBarrel(
            [x - 0.012 * L, tubeY + offset * B, z + 0.012 * D],
            [x + 0.02 * L, tubeY + offset * B, z + 0.012 * D],
            0.16,
          );
          part.solids.push(solid(barrel.body, "hi", { crease: "none", fill: "face", flat: true }));
          part.dots.push({ x: barrel.muzzle[0], y: barrel.muzzle[1], r: 0.9, tone: "hi" });
        }
      }
      add(part, text(x, tubeY, z + 0.02 * D, 14));
      facts.set(placement.instanceId, factsFor(submerged ? "submerged" : "above water"));
      drawn.add(placement.instanceId);
      continue;
    }

    if (mountClass === null) {
      const part: PartDraft = {
        id: placement.instanceId,
        label: name,
        solids: [],
        inks: [],
        lines: [],
        dots: [],
      };
      const fittingZ = deck + 0.01 * D;
      const fittingY = side === "PORT" ? -halfAt(t) * 0.48 : side === "STBD" ? halfAt(t) * 0.48 : 0;
      if (category === "RADAR") {
        const mastX = hasHouse ? houseT0 + (houseT1 - houseT0) * 0.22 : 0.5;
        const z = hasHouse ? upperTop + mastRise * 0.9 : deck + 0.6 * D;
        for (const angle of [-0.5, 0, 0.5]) {
          part.lines.push({
            d: lineOf(
              [
                [mastX * L - Math.cos(angle) * 0.03 * L, 0, z],
                [mastX * L + Math.cos(angle) * 0.03 * L, 0, z + 0.04 * D],
              ],
              P,
            ),
            tone: "mid",
          });
        }
      } else if (category === "SONAR") {
        const z = 0.16 * D;
        part.solids.push(
          solid(cylinder(x, 0, 0.018 * L, -0.005 * D, z + 0.005 * D, P, 16), "mid", {
            crease: "lo",
          }),
        );
      } else if (category === "AIRCRAFT_FACILITY") {
        part.solids.push(
          solid(
            extrude(
              roundedPlan(
                { x: x - 0.04 * L, y: -0.09 * B, w: 0.08 * L, d: 0.18 * B, r: 0.008 * L },
                3,
              ),
              fittingZ,
              0.09 * D,
              P,
            ),
            "mid",
          ),
        );
        part.lines.push({
          d: lineOf(
            [
              [x - 0.035 * L, 0, fittingZ + 0.09 * D],
              [x + 0.035 * L, 0, fittingZ + 0.09 * D],
            ],
            P,
          ),
          tone: "lo",
        });
      } else {
        const plan = {
          x: x - 0.018 * L,
          y: fittingY - 0.06 * B,
          w: 0.036 * L,
          d: 0.12 * B,
          r: 0.005 * L,
        };
        part.solids.push(
          solid(extrude(roundedPlan(plan, 3), fittingZ, 0.022 * D, P), "mid", { crease: "lo" }),
        );
        part.lines.push({
          d: lineOf(
            roundedPlan(
              {
                ...plan,
                x: plan.x + 0.005 * L,
                y: plan.y + 0.015 * B,
                w: plan.w - 0.01 * L,
                d: plan.d - 0.03 * B,
                r: 0.003 * L,
              },
              3,
            ).map(([px, py]) => [px, py, fittingZ + 0.022 * D] as Point3),
            P,
            true,
          ),
          tone: "faint",
        });
      }
      add(part, text(x, fittingY, fittingZ + 0.03 * D, 12));
      facts.set(placement.instanceId, factsFor());
      drawn.add(placement.instanceId);
      continue;
    }

    const part: PartDraft = {
      id: placement.instanceId,
      label: name,
      solids: [],
      inks: [],
      lines: [],
      dots: [],
    };
    const outward = side === "CENTRE" ? near : side === "PORT" ? -1 : 1;
    const alongY = mountClass === "CASEMATE" || (side !== "CENTRE" && category !== "MAIN_GUN");
    const aft = t >= 0.5;
    const baseZ = mountClass === "CASEMATE" ? deckZ(t) - 0.34 * D : deck;
    const gunY = mountClass === "CASEMATE" ? near * (halfAtZ(t, baseZ) - 0.01 * B) : y;

    if (mountClass === "TURRET" || mountClass === "BARBETTE") {
      const drumR = radius * (1.28 + clamp(gunArmourMm, 0, 400) / 2500);
      part.solids.push(
        solid(
          cylinder(
            x,
            gunY,
            drumR,
            baseZ - 0.03 * D,
            (mountClass === "BARBETTE" ? 0.3 : 0.2) * D,
            P,
            24,
          ),
          "mid",
          { crease: "lo" },
        ),
      );
      if (mountClass === "BARBETTE") {
        part.inks.push({ d: discPath(x, gunY, drumR * 0.8, baseZ + 0.27 * D, P, 24) });
        part.lines.push({
          d: lineOf(
            circle(x, gunY, drumR, 24).map(([px, py]) => [px, py, baseZ + 0.27 * D] as Point3),
            P,
            true,
          ),
          tone: "mid",
        });
      } else {
        part.solids.push(
          solid(cylinder(x, gunY, radius, baseZ + 0.17 * D, 0.24 * D, P, 28), "hi", {
            crease: "lo",
          }),
        );
        part.solids.push(
          solid(cylinder(x, gunY, radius * 0.42, baseZ + 0.41 * D, 0.045 * D, P, 18), "mid"),
        );
        part.lines.push({
          d: lineOf(
            circle(x, gunY, radius * 0.98, 24).map(
              ([px, py]) => [px, py, baseZ + 0.41 * D] as Point3,
            ),
            P,
            true,
          ),
          tone: "faint",
        });
        part.lines.push({
          d: lineOf(
            [
              [x - radius * 1.06, gunY, baseZ + 0.32 * D],
              [x + radius * 1.06, gunY, baseZ + 0.32 * D],
            ],
            P,
          ),
          tone: "mid",
        });
        for (const side of [-1, 1]) {
          const [ex, ey] = iso([x + side * radius * 1.06, gunY, baseZ + 0.32 * D], P);
          part.dots.push({ x: ex, y: ey, r: 0.9, tone: "mid" });
        }
      }
    } else if (mountClass === "SHIELDED") {
      part.solids.push(
        solid(cylinder(x, gunY, radius * 0.58, baseZ, 0.09 * D, P, 16), "mid"),
        solid(cylinder(x, gunY, radius * 0.98, baseZ + 0.09 * D, 0.13 * D, P, 20), "mid", {
          crease: "lo",
        }),
      );
    } else if (mountClass === "OPEN") {
      part.solids.push(solid(cylinder(x, gunY, radius * 0.58, baseZ, 0.12 * D, P, 16), "mid"));
    } else {
      const plan = {
        x: x - radius * 1.2,
        y: gunY - near * radius * 0.5,
        w: radius * 2.4,
        d: radius,
        r: radius * 0.25,
      };
      part.solids.push(
        solid(extrude(roundedPlan(plan, 4), baseZ, 0.12 * D, P), "mid", { crease: "lo" }),
      );
    }

    const barrelZ =
      mountClass === "TURRET"
        ? baseZ + 0.32 * D
        : mountClass === "BARBETTE"
          ? baseZ + 0.25 * D
          : mountClass === "CASEMATE"
            ? baseZ + 0.075 * D
            : baseZ + 0.13 * D;
    const barrelLength = clamp(caliberM * 19, 2.2, 0.085 * L);
    const spacing = radius * 0.9;
    for (let index = 0; index < barrels; index++) {
      const offset = (index - (barrels - 1) / 2) * spacing;
      const from: Point3 = alongY
        ? [x + offset, gunY, barrelZ]
        : [x + (aft ? radius * 0.6 : -radius * 0.6), gunY + offset, barrelZ];
      const to: Point3 = alongY
        ? [
            x + offset,
            gunY + outward * barrelLength,
            barrelZ + (category === "AA_WEAPON" ? 0.05 * D : 0),
          ]
        : [
            x + (aft ? radius * 0.6 + barrelLength : -radius * 0.6 - barrelLength),
            gunY + offset,
            barrelZ,
          ];
      const barrel = inkBarrel(from, to, Math.max(0.12, radius * 0.17));
      const bright = mountClass === "TURRET" || mountClass === "BARBETTE";
      part.solids.push(
        solid(barrel.body, bright ? "hi" : "mid", { crease: "none", fill: "face", flat: true }),
      );
      part.dots.push({
        x: barrel.muzzle[0],
        y: barrel.muzzle[1],
        r: Math.max(1, screenWidth(radius * 0.18, P)),
        tone: bright ? "hi" : "mid",
      });
    }
    add(part, text(x, gunY, baseZ + 0.22 * D, Math.max(14, radius * P.scale * 2)));
    facts.set(placement.instanceId, factsFor(`${Math.round(t * 1000)}‰ · ${side.toLowerCase()}`));
    drawn.add(placement.instanceId);
  }

  // --- Anything still placed and not drawn as a weapon or deckhouse: a truthful deck fitting.
  for (const placement of draft.placements) {
    if (drawn.has(placement.instanceId)) continue;
    const component = compiled.get(placement.instanceId);
    if (component === undefined) continue;
    const t = clamp(placement.stationPermille / 1000, 0.02, 0.98);
    const x = t * L;
    const side = placement.side ?? "CENTRE";
    const y = side === "PORT" ? -halfAt(t) * 0.52 : side === "STBD" ? halfAt(t) * 0.52 : 0;
    const inHouseNow = hasHouse && t >= houseT0 && t <= houseT1;
    const z = inHouseNow ? lowerTop + 0.01 * D : deckZ(t) + 0.005 * D;
    const name = model.targets.get(placement.instanceId)?.name ?? component.componentId;
    const part: PartDraft = {
      id: placement.instanceId,
      label: name,
      solids: [],
      inks: [],
      lines: [],
      dots: [],
    };
    const plan = {
      x: x - 0.016 * L,
      y: y - 0.05 * B,
      w: 0.032 * L,
      d: 0.1 * B,
      r: 0.004 * L,
    };
    part.solids.push(solid(extrude(roundedPlan(plan, 3), z, 0.02 * D, P), "mid", { crease: "lo" }));
    part.lines.push({
      d: lineOf(
        [
          [plan.x + 0.005 * L, plan.y + plan.d * 0.25, z + 0.02 * D],
          [plan.x + plan.w - 0.005 * L, plan.y + plan.d * 0.25, z + 0.02 * D],
        ],
        P,
      ),
      tone: "faint",
    });
    const [px, py] = iso([x, y, z + 0.02 * D], P);
    part.dots.push({ x: px, y: py, r: 0.7, tone: "lo" });
    add(part, text(x, y, z + 0.03 * D, 12));
    facts.set(
      placement.instanceId,
      `${CATEGORY_LABEL[component.category] ?? component.category} · ${Math.round(t * 1000)}‰`,
    );
  }

  // --- Armoured conning tower, the citadel's forward eye.
  const conning = regionOf("CONNING_TOWER");
  if (conning && hasHouse) {
    const x = houseT0 * L + houseW * 0.2;
    const baseZ = upperTop + 0.022 * D;
    const heightM = clamp(conning.heightMm / 1000, 0.08 * D, 0.2 * D);
    const radius = clamp(0.012 * L, 0.7, B * 0.09);
    const part: PartDraft = {
      id: "armour:conning",
      label: "Conning tower",
      solids: [
        solid(cylinder(x, 0, radius, baseZ, heightM, P, 20), "hi", { crease: "lo" }),
        solid(cylinder(x, 0, radius * 0.72, baseZ + heightM, 0.016 * D, P, 16), "mid"),
      ],
      inks: [],
      lines: [],
      dots: [],
    };
    part.lines.push({
      d: lineOf(
        [
          [x - radius * 0.5, 0, baseZ + heightM * 0.62],
          [x + radius * 0.5, 0, baseZ + heightM * 0.62],
        ],
        P,
      ),
      tone: "ink",
      heavy: true,
    });
    add(part, text(x, 0, baseZ + heightM * 0.5, 14));
    facts.set("armour:conning", `Conning tower ${Math.round(conning.thicknessUm / 1000)} mm`);
  }

  facts.set(
    "ship",
    `${profile.name} · ${round1(L)} m · ${round1(B)} m beam · ${draft.placements.length} fittings`,
  );

  return {
    width,
    height,
    label: `Isometric ship anatomy of a ${profile.name.toLowerCase()}: ${round1(L)} metres long, ${round1(shownB)} metres in the beam, with ${funnels.length} funnel${funnels.length === 1 ? "" : "s"} and ${draft.placements.length} fitted part${draft.placements.length === 1 ? "" : "s"}.`,
    azimuth,
    parts,
    anchors,
    facts,
  };
}
