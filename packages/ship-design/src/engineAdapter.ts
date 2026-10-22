import type { CompiledDesign, DesignDraft } from "./compile.js";
import type { CompiledWeaponArmament } from "./compileShared.js";
import type { CompiledTorpedo } from "@bluewave/armament";
import { UM_PER_KNOT } from "./units.js";

export interface EngineDesignFields {
  readonly designVersionId: string;
  readonly designFamilyId: string;
  readonly className: string;
  readonly nationId: string;
  readonly hullType: string;
  readonly normalizedDisplacementKg: number;
  readonly normalizedSpeedUms: number;
  readonly normalizedArmorUm: number;
  readonly hitPoints: number;
  readonly mainGunsCaliber: number;
  readonly mainGunsCount: number;
  readonly machineryType: string;
  readonly crewComplement: number;
  readonly contentVersion: string;
  readonly compiledHash: string;
  readonly armament?: readonly CompiledWeaponArmament[];
  readonly torpedoArmament?: readonly {
    mountType: string;
    tubeCount: number;
    torpedoModelId: string;
    compiledTorpedo?: CompiledTorpedo;
  }[];
}

export interface EngineAdapterOptions {
  readonly designVersionId: string;
  readonly designFamilyId: string;
  readonly className: string;
  readonly hullType: string;
  readonly machineryType: string;
  readonly contentVersion: string;
  readonly kgPerHitPoint: number;
}

export class EngineAdapterError extends Error {
  readonly _tag = "EngineAdapterError";
  constructor(message: string) {
    super(message);
    this.name = "EngineAdapterError";
  }
}

export function toEngineDesign(
  c: CompiledDesign,
  d: DesignDraft,
  o: EngineAdapterOptions,
): EngineDesignFields {
  if (!c.valid)
    throw new EngineAdapterError("invalid design (BLOCKING findings) cannot enter the engine");
  if (o.kgPerHitPoint <= 0) throw new EngineAdapterError("kgPerHitPoint must be > 0");

  const vertical = c.armour
    ? d.armour.regions.filter(
        (r) => r.region === "BELT_MAIN" || r.region === "BELT_UPPER" || r.region === "BELT_ENDS",
      )
    : [];
  const armorUm = vertical.reduce((m, r) => Math.max(m, r.thicknessUm), 0);

  const guns = c.components.filter((k) => k.category === "MAIN_GUN");
  const pool = guns.length > 0 ? guns : c.components.filter((k) => k.category === "SECONDARY_GUN");
  const caliber = pool.reduce((m, k) => Math.max(m, k.attr.caliberUm ?? 0), 0);
  const count = pool
    .filter((k) => (k.attr.caliberUm ?? 0) === caliber)
    .reduce((a, k) => a + (k.params.barrels ?? 1), 0);

  const mounts = new Map<
    string,
    {
      mountType: string;
      tubeCount: number;
      torpedoModelId: string;
      compiledTorpedo?: CompiledTorpedo;
    }
  >();
  for (const k of c.components) {
    if (k.category !== "TORPEDO_TUBE" || !k.torpedoMount) continue;
    const key = `${k.torpedoMount.mountType}|${k.torpedoMount.torpedoModelId}`;
    const cur = mounts.get(key);
    const tubes = k.params.tubes ?? 1;
    mounts.set(
      key,
      cur
        ? {
            ...cur,
            tubeCount: cur.tubeCount + tubes,
            ...(cur.compiledTorpedo === undefined && k.torpedoMount.compiledTorpedo !== undefined
              ? { compiledTorpedo: k.torpedoMount.compiledTorpedo }
              : {}),
          }
        : { ...k.torpedoMount, tubeCount: tubes },
    );
  }
  const torpedoArmament = [...mounts.entries()]
    .sort((x, y) => (x[0] < y[0] ? -1 : 1))
    .map(([, v]) => v);

  const armament = c.components
    .map((k) => k.armament)
    .filter((a): a is CompiledWeaponArmament => a !== undefined)
    .sort((x, y) => (x.instanceId < y.instanceId ? -1 : x.instanceId > y.instanceId ? 1 : 0));

  return {
    designVersionId: o.designVersionId,
    designFamilyId: o.designFamilyId,
    className: o.className,
    nationId: d.nationId,
    hullType: o.hullType,
    normalizedDisplacementKg: c.totalKg,
    normalizedSpeedUms: Math.floor(((c.machinery?.maxSpeedMilliKnots ?? 0) * UM_PER_KNOT) / 1000),
    normalizedArmorUm: armorUm,
    hitPoints: Math.max(1, Math.floor(c.totalKg / o.kgPerHitPoint)),
    mainGunsCaliber: caliber,
    mainGunsCount: count,
    machineryType: o.machineryType,
    crewComplement: c.systems?.crewRequired ?? 0,
    contentVersion: o.contentVersion,
    compiledHash: c.hash,
    ...(armament.length > 0 ? { armament } : {}),
    ...(torpedoArmament.length > 0 ? { torpedoArmament } : {}),
  };
}
