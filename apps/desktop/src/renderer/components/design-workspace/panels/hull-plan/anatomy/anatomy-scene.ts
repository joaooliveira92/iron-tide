import type { DesignDraft, WorkshopView } from "@bluewave/ship-design";
import type { PlanModel } from "../planModel.js";
import { waterplaneShape } from "../waterplane.js";
import { clamp, finite } from "./anatomy-helpers.js";
import type { AnatomyInput, PartDraft, AnchorDraft, Reach } from "./anatomy-types.js";
import { fitProjection, iso, type Point3, type Projection } from "./iso.js";
import { profileOf, type ShipProfile } from "./ship-profile.js";

export type FunnelMetric = PlanModel["placedFunnels"][number] & {
  readonly t: number;
  readonly inHouse: boolean;
  readonly radius: number;
  readonly baseZ: number;
  readonly topZ: number;
  readonly rake: number;
};

export interface AnatomyShipScene {
  readonly draft: DesignDraft;
  readonly model: AnatomyInput["model"];
  readonly azimuth: number;
  readonly width: number;
  readonly height: number;
  readonly near: 1 | -1;
  readonly L: number;
  readonly B: number;
  readonly D: number;
  readonly T: number;
  readonly shownB: number;
  readonly shownD: number;
  readonly halfAt: (t: number) => number;
  readonly deckZ: (t: number) => number;
  readonly keelZ: (t: number) => number;
  readonly halfAtZ: (t: number, z: number) => number;
  readonly profile: ShipProfile;
  readonly era: NonNullable<AnatomyInput["model"]["look"]>["era"] | "DREADNOUGHT";
  readonly hasHouse: boolean;
  readonly houseT0: number;
  readonly houseT1: number;
  readonly houseW: number;
  readonly houseHalf: number;
  readonly houseMid: number;
  readonly lowerTop: number;
  readonly upperTop: number;
  readonly funnels: PlanModel["placedFunnels"];
  readonly funnelMetrics: readonly FunnelMetric[];
  readonly mastRise: number;
  readonly way: {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly d: number;
    readonly r: number;
  };
  readonly wayHalf: number;
  readonly wayBase: number;
  readonly P: Projection;
  readonly parts: PartDraft[];
  readonly anchors: Map<string, AnchorDraft>;
  readonly facts: Map<string, string>;
  readonly add: (part: PartDraft, anchor?: AnchorDraft) => void;
  readonly text: (x: number, y: number, z: number, anchorRad?: number) => AnchorDraft;
  readonly DECK_REACH: Reach;
  readonly WATER_REACH: Reach;
  readonly KEEL_REACH: Reach;
  readonly ring: (scale: number, zOf: (t: number) => number, reach?: Reach) => Point3[];
  readonly sidePoints: (
    from: number,
    to: number,
    zOf: (t: number) => number,
    yOf: (t: number) => number,
    steps?: number,
  ) => Point3[];
  readonly regionOf: (region: string) => DesignDraft["armour"]["regions"][number] | undefined;
  readonly compiled: ReadonlyMap<string, WorkshopView["compiled"]["components"][number]>;
  readonly visual: ReadonlyMap<string, PlanModel["visualMounts"][number]>;
  readonly drawn: Set<string>;
}

export function createAnatomyShipScene(input: AnatomyInput): AnatomyShipScene {
  const { draft, view, model, azimuth } = input;
  const width = input.width ?? 420;
  const height = input.height ?? 250;
  const near: 1 | -1 = Math.sin((azimuth * Math.PI) / 180) >= 0 ? 1 : -1;

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

  const regionOf = (region: string) => draft.armour.regions.find((r) => r.region === region);
  const compiled = new Map(
    view.compiled.components.map((component) => [component.instanceId, component]),
  );
  const visual = new Map(model.visualMounts.map((mount) => [mount.instanceId, mount]));
  const drawn = new Set<string>(funnels.map((funnel) => funnel.instanceId));

  return {
    draft,
    model,
    azimuth,
    width,
    height,
    near,
    L,
    B,
    D,
    T,
    shownB,
    shownD,
    halfAt,
    deckZ,
    keelZ,
    halfAtZ,
    profile,
    era,
    hasHouse,
    houseT0,
    houseT1,
    houseW,
    houseHalf,
    houseMid,
    lowerTop,
    upperTop,
    funnels,
    funnelMetrics,
    mastRise,
    way,
    wayHalf,
    wayBase,
    P,
    parts,
    anchors,
    facts,
    add,
    text,
    DECK_REACH,
    WATER_REACH,
    KEEL_REACH,
    ring,
    sidePoints,
    regionOf,
    compiled,
    visual,
    drawn,
  };
}
