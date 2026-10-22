import {
  analyseArrangement,
  ZONE_IDS,
  type ArrangementResult,
  type ResolvedPlacement,
  type ZoneId,
} from "../arrangement.js";
import {
  armourAvailabilityFindings,
  compileArmour,
  type ArmourInput,
  type ArmourResult,
} from "../armour.js";
import type { ComponentDef } from "../component.js";
import { resolveInstalledWeapon, nationHasArmamentContent } from "../armamentContent.js";
import {
  componentAccessOf,
  mapArmamentFindings,
  toCompiledWeaponArmament,
} from "../armamentCompile.js";
import {
  cmpStr,
  f,
  num,
  WEAPON_CATEGORIES,
  type CompiledWeaponArmament,
  type DesignDraft,
  type DesignIntent,
  type HullFormData,
  type Resolved,
  type ShipBalance,
  type ShipContext,
} from "../compileShared.js";
import type { Finding } from "../findings.js";
import { about, placementTarget, type FindingTarget } from "../findings.js";
import { compileHull, type HullResult } from "../hull.js";
import { aluminiumFitting } from "../aluminium.js";
import type { AntiAircraftExpansion } from "../antiAircraft.js";
import { colonialFitting } from "../colonialService.js";
import { emptyLedger, withLine, type LedgerCategory } from "../ledger.js";
import { compileMachinery, type MachineryResult, type PropulsionPlant } from "../machinery.js";
import { compileSystems, type SystemsResult } from "../systems.js";
import {
  expandTertiary,
  NO_TERTIARY_BALANCE,
  TERTIARY_STATION_PERMILLE,
  TERTIARY_ZONE,
} from "../tertiary.js";
import { compileWeapons, type ArcObstacle, type GunMount, type WeaponsResult } from "../weapons.js";

type AmmoMount = WeaponsResult["mounts"][number];

export function resolveDesignComponents(
  draft: DesignDraft,
  ctx: ShipContext,
  catalogue: Map<string, ComponentDef>,
  plant: PropulsionPlant,
  findings: Finding[],
): Resolved[] {
  const techCheck = (
    id: string,
    requires: readonly string[],
    fromMonth: string,
    obsoleteMonth: string | null,
    targets: readonly FindingTarget[] = [],
  ) => {
    const push = (x: Finding) => findings.push(targets.length > 0 ? about(x, ...targets) : x);
    const missing = requires.filter((t) => !ctx.unlockedTechs.has(t));
    if (missing.length > 0 || fromMonth > ctx.month) {
      push(
        f(
          "TECH_UNAVAILABLE",
          "BLOCKING",
          `${id} is not available to this nation yet.`,
          missing.length > 0
            ? `Missing technology: ${missing.join(", ")}.`
            : `Introduced ${fromMonth}; current month ${ctx.month}.`,
          "A ship cannot use equipment that does not exist for its builder.",
          [
            ["research", "Research the missing technology."],
            ["alternative", "Use an earlier component that is available."],
            ["wait", "Delay the design until the technology matures."],
          ],
        ),
      );
    } else if (obsoleteMonth !== null && obsoleteMonth <= ctx.month) {
      push(
        f(
          "COMPONENT_OBSOLETE",
          "ADVISORY",
          `${id} is obsolete.`,
          `Obsolete since ${obsoleteMonth}.`,
          "Spares and support cost more; the part is outclassed.",
          [["upgrade", "Use its upgrade-path successor."]],
        ),
      );
    }
  };
  techCheck(
    plant.id,
    plant.requires ?? [],
    plant.introduction?.fromMonth ?? "0000-00",
    plant.introduction?.obsoleteMonth ?? null,
  );

  const resolved: Resolved[] = [];
  for (const spec of [...draft.placements].sort((x, y) => cmpStr(x.instanceId, y.instanceId))) {
    const baseDef = catalogue.get(spec.componentId);
    if (!baseDef) {
      findings.push(
        about(
          f(
            "COMPONENT_UNKNOWN",
            "BLOCKING",
            `Component ${spec.componentId} does not exist.`,
            `Placement ${spec.instanceId} references an unknown id.`,
            "The design cannot be priced or weighed.",
            [
              ["replace", "Choose a catalogue component."],
              ["remove", "Remove the placement."],
              ["update", "Update the design to the current content version."],
            ],
          ),
          placementTarget(spec.instanceId),
        ),
      );
      continue;
    }
    const def: ComponentDef =
      baseDef.category === "TORPEDO_TUBE" &&
      spec.compiledTorpedo !== undefined &&
      baseDef.torpedoMount !== undefined
        ? {
            ...baseDef,
            torpedoMount: { ...baseDef.torpedoMount, compiledTorpedo: spec.compiledTorpedo },
          }
        : baseDef;
    techCheck(def.id, def.requires, def.introduction.fromMonth, def.introduction.obsoleteMonth, [
      placementTarget(spec.instanceId),
    ]);
    const params: Record<string, number> = {};
    let ok = true;
    for (const [pn, r] of Object.entries(def.parameters)) {
      const v = spec.params?.[pn] ?? r.min;
      if (v < r.min || v > r.max || (v - r.min) % r.step !== 0) {
        ok = false;
        findings.push(
          about(
            f(
              "PARAM_RANGE",
              "BLOCKING",
              `${spec.instanceId}: parameter ${pn}=${v} is not allowed.`,
              `Legal ${r.min}..${r.max} step ${r.step}.`,
              "The component does not exist in that configuration.",
              [
                ["set_min", `Set ${pn} to ${r.min}.`],
                ["set_max", `Set ${pn} to ${r.max}.`],
                ["other_component", "Choose a different component."],
              ],
            ),
            placementTarget(spec.instanceId),
          ),
        );
      }
      params[pn] = v;
    }
    if (!ok) continue;
    const vars = { ...def.constants, ...params };
    const attr: Record<string, number> = {};
    for (const [k, src] of Object.entries(def.attributes ?? {})) attr[k] = num(src, vars);
    resolved.push({
      spec,
      componentId: def.id,
      category: def.category,
      tags: def.tags,
      ...(def.fcClass === undefined ? {} : { fcClass: def.fcClass }),
      fcClasses: def.fcClasses ?? [],
      ...(def.allowedZones === undefined
        ? {}
        : { allowedZones: def.allowedZones as readonly ZoneId[] }),
      forbidsCoLocation: def.forbidsCoLocation ?? [],
      critical: def.critical ?? false,
      maintenanceMonthlyBp: def.maintenanceMonthlyBp ?? 0,
      buildWorkMicro: def.buildWorkMicro === undefined ? null : num(def.buildWorkMicro, vars),
      productionLine: def.productionLine ?? null,
      requires: def.requires,
      torpedoMount: def.torpedoMount ?? null,
      params,
      weightKg: num(def.weightKg, vars),
      volumeLitre: num(def.volumeLitre, vars),
      deckFootprintMm2: num(def.deckFootprintMm2, vars),
      heightMm: num(def.heightMm, vars),
      zCgMm: num(def.zCgMm, vars),
      powerKw: num(def.powerKw, vars),
      coolingKw: num(def.coolingKw, vars),
      crew: num(def.crew, vars),
      costMicro: num(def.costMicro, vars),
      attr,
    });
  }
  return resolved;
}

export function buildPlacementsAndArrangement(args: {
  draft: DesignIntent;
  aa: AntiAircraftExpansion;
  resolved: readonly Resolved[];
  plant: PropulsionPlant;
  machineryRaw: MachineryResult;
  formData: HullFormData;
  b: ShipBalance;
  findings: Finding[];
  ammoById: Map<string, AmmoMount>;
}): {
  arrangement: ArrangementResult;
  rooms: readonly { zoneId: ZoneId; stationPermille: number; shareBp: number }[];
  roomPart: (total: number, i: number) => number;
} {
  const { draft, aa, resolved, plant, machineryRaw, formData, b, ammoById } = args;
  const hull = draft.hull;

  const resolvedPlacements: ResolvedPlacement[] = resolved.map((r) => ({
    instanceId: r.spec.instanceId,
    componentId: r.componentId,
    category: r.category,
    zoneId: r.spec.zoneId,
    stationPermille: r.spec.stationPermille,
    weightKg: r.weightKg,
    volumeLitre: r.volumeLitre,
    deckFootprintMm2: r.deckFootprintMm2,
    heightMm: r.heightMm,
    zCgMm: r.zCgMm,
    allowedZones: r.allowedZones ?? [...ZONE_IDS],
    forbidsCoLocation: r.forbidsCoLocation,
    critical: r.critical,
    ...(r.category === "MAGAZINE" ? { magazineLitre: r.attr.magazineLitre ?? 0 } : {}),
    ...(ammoById.has(r.spec.instanceId)
      ? { ammoVolumeLitre: ammoById.get(r.spec.instanceId)!.ammoVolumeLitre }
      : {}),
    ...(r.spec.magazineRef ? { magazineRef: r.spec.magazineRef } : {}),
    ...(r.attr.maxFeedPermille !== undefined ? { maxFeedPermille: r.attr.maxFeedPermille } : {}),
  }));
  const dm = draft.machinery;
  const rooms = dm.rooms ?? [
    { zoneId: dm.zoneId, stationPermille: dm.stationPermille, shareBp: 10_000 },
  ];
  if (rooms.reduce((a, r) => a + r.shareBp, 0) !== 10_000 || rooms.some((r) => r.shareBp <= 0)) {
    throw new Error("machinery room shares must be positive and sum to 10000");
  }
  const roomPart = (total: number, i: number) =>
    i === rooms.length - 1
      ? total - rooms.slice(0, i).reduce((a, r) => a + Math.floor((total * r.shareBp) / 10_000), 0)
      : Math.floor((total * rooms[i]!.shareBp) / 10_000);
  rooms.forEach((room, i) => {
    resolvedPlacements.push({
      instanceId: `~plant${rooms.length === 1 ? "" : `:${i}`}`,
      componentId: plant.id,
      category: "ENGINE",
      zoneId: room.zoneId,
      stationPermille: room.stationPermille,
      weightKg: roomPart(machineryRaw.plantWeightKg, i),
      volumeLitre: roomPart(machineryRaw.plantVolumeLitre, i),
      deckFootprintMm2: 0,
      heightMm: 0,
      zCgMm: Math.floor((hull.depthToMainDeck * b.lumpZFractionBp.machinery) / 10_000),
      allowedZones: [...ZONE_IDS],
      forbidsCoLocation: [],
      critical: true,
    });
  });
  resolvedPlacements.push({
    instanceId: "~bunkers",
    componentId: "bunkers",
    category: "FUEL_BUNKER",
    zoneId: dm.fuelZoneId,
    stationPermille: dm.fuelStationPermille,
    weightKg: dm.fuelCapacityKg,
    volumeLitre: machineryRaw.bunkerVolumeLitre,
    deckFootprintMm2: 0,
    heightMm: 0,
    zCgMm: Math.floor((hull.depthToMainDeck * b.lumpZFractionBp.fuel) / 10_000),
    allowedZones: [...ZONE_IDS],
    forbidsCoLocation: [],
    critical: false,
  });
  const tertiary = expandTertiary(draft.tertiary, b.tertiary ?? NO_TERTIARY_BALANCE);
  if (tertiary.guns > 0) {
    resolvedPlacements.push({
      instanceId: "~tertiary",
      componentId: "tertiary_battery",
      category: "TERTIARY_GUN",
      zoneId: TERTIARY_ZONE,
      stationPermille: TERTIARY_STATION_PERMILLE,
      weightKg: tertiary.weightKg,
      volumeLitre: 0,
      deckFootprintMm2: tertiary.footprintMm2,
      heightMm: 0,
      zCgMm: hull.depthToMainDeck,
      allowedZones: [...ZONE_IDS],
      forbidsCoLocation: [],
      critical: false,
    });
  }
  if (aa.weightKg > 0 || aa.footprintMm2 > 0) {
    resolvedPlacements.push({
      instanceId: "~aa",
      componentId: "anti_aircraft_fit",
      category: "AA_WEAPON",
      zoneId: TERTIARY_ZONE,
      stationPermille: TERTIARY_STATION_PERMILLE,
      weightKg: aa.weightKg,
      volumeLitre: 0,
      deckFootprintMm2: aa.footprintMm2,
      heightMm: 0,
      zCgMm: hull.depthToMainDeck,
      allowedZones: [...ZONE_IDS],
      forbidsCoLocation: [],
      critical: false,
    });
  }
  const arrangement = analyseArrangement(
    resolvedPlacements,
    formData.zones,
    {
      lengthMm: hull.lengthWl,
      beamMm: hull.beam,
      depthMm: hull.depthToMainDeck,
      volumeFullnessBp: formData.volumeFullnessBp,
      deckFullnessBp: formData.deckFullnessBp,
    },
    b.arrangement,
  );
  args.findings.push(...arrangement.findings);
  return { arrangement, rooms, roomPart };
}

export function compileWeaponSet(args: {
  draft: DesignIntent;
  ctx: ShipContext;
  resolved: readonly Resolved[];
  byId: Map<string, Resolved>;
  b: ShipBalance;
  findings: Finding[];
}): {
  weapons: WeaponsResult;
  ammoById: Map<string, AmmoMount>;
  gunRes: readonly Resolved[];
  armaments: Map<string, CompiledWeaponArmament>;
} {
  const { draft, ctx, resolved, byId, b, findings } = args;
  const station = (id: string | undefined) => (id ? byId.get(id)?.spec.stationPermille : undefined);

  const gunRes = resolved.filter((r) => WEAPON_CATEGORIES.includes(r.category));
  const armaments = new Map<string, CompiledWeaponArmament>();
  const access = componentAccessOf(ctx.navalProfile);
  const armamentContent = ctx.armamentContent ?? null;
  const useArmament =
    armamentContent !== null && nationHasArmamentContent(armamentContent, draft.nationId);
  const mounts: GunMount[] = gunRes.map((r) => {
    const magSt = station(r.spec.magazineRef);
    const legacy: GunMount = {
      instanceId: r.spec.instanceId,
      stationPermille: r.spec.stationPermille,
      side: r.spec.side ?? "CENTRE",
      barrels: r.params.barrels ?? 1,
      roundsPerBarrel: r.params.rounds ?? 0,
      shellMassG: r.attr.shellMassG ?? 0,
      chargeBp: r.attr.chargeBp ?? 0,
      roundVolumeMl: r.attr.roundVolumeMl ?? 0,
      rofBaseX100: r.attr.rofBaseX100 ?? 0,
      beamArcDeg: r.attr.beamArcDeg ?? 0,
      feedDistancePermille: magSt === undefined ? 0 : Math.abs(r.spec.stationPermille - magSt),
    };
    if (!useArmament) return legacy;
    const resolution = resolveInstalledWeapon({
      content: armamentContent!,
      components: ctx.catalogue,
      nationId: draft.nationId,
      familyId: r.componentId,
      gunCount: legacy.barrels,
      month: ctx.month,
      unlockedTechnologyIds: ctx.unlockedTechs,
      componentAccess: access,
    });
    findings.push(...mapArmamentFindings(resolution.findings, r.spec.instanceId));
    if (resolution.resolved === null) {
      return legacy;
    }
    const a = resolution.resolved;
    armaments.set(
      r.spec.instanceId,
      toCompiledWeaponArmament(a, resolution.mountType, r.spec.instanceId),
    );
    return {
      ...legacy,
      barrels: a.gunCount,
      shellMassG: a.shellMassG ?? legacy.shellMassG,
      chargeBp: a.propellantChargeBp ?? legacy.chargeBp,
      roundVolumeMl: a.ammunitionUnitVolumeMl ?? legacy.roundVolumeMl,
      rofBaseX100: a.mechanicalRateOfFireRoundsPerMinuteX100 ?? legacy.rofBaseX100,
      beamArcDeg: a.firingArcDeg ?? legacy.beamArcDeg,
    };
  });
  const obstacles: ArcObstacle[] = resolved
    .filter((r) => (r.attr.arcBlockedDeg ?? 0) > 0)
    .map((r) => ({
      id: r.spec.instanceId,
      fromPermille: r.spec.stationPermille,
      toPermille: r.spec.stationPermille,
      reachPermille: r.attr.arcReachPermille ?? 0,
      blockedDeg: r.attr.arcBlockedDeg!,
    }));
  const gunsOnly = compileWeapons(mounts, obstacles, draft.requirement.crewQualityBp, b.weapons);
  const tertiary = expandTertiary(draft.tertiary, b.tertiary ?? NO_TERTIARY_BALANCE);
  const weapons: WeaponsResult = {
    ...gunsOnly,
    broadsidePortKg: gunsOnly.broadsidePortKg + tertiary.broadsideKg,
    broadsideStbdKg: gunsOnly.broadsideStbdKg + tertiary.broadsideKg,
  };
  findings.push(...weapons.findings);
  const ammoById = new Map(weapons.mounts.map((m) => [m.instanceId, m]));
  return { weapons, ammoById, gunRes, armaments };
}

export function compileSystemsAndMachinery(args: {
  draft: DesignIntent;
  ctx: ShipContext;
  resolved: readonly Resolved[];
  gunRes: readonly Resolved[];
  plant: PropulsionPlant;
  b: ShipBalance;
  findings: Finding[];
}): { systems: SystemsResult; machineryRaw: MachineryResult } {
  const { draft, resolved, gunRes, plant, b, findings } = args;
  const hull = draft.hull;

  const accommodationVolume = resolved
    .filter((r) => r.category === "ACCOMMODATION")
    .reduce((a, r) => a + r.volumeLitre, 0);
  const systemsItems = resolved.map((r) => ({
    instanceId: r.spec.instanceId,
    category: r.category,
    powerKw: r.powerKw,
    coolingKw: r.coolingKw,
    crew: r.crew,
  }));
  const generators = resolved
    .filter((r) => r.category === "GENERATOR")
    .map((r) => ({ instanceId: r.spec.instanceId, kw: r.attr.genKw ?? 0, zoneId: r.spec.zoneId }));
  const directors = resolved
    .filter((r) => r.category === "DIRECTOR" || r.category === "RANGEFINDER")
    .map((r) => ({
      instanceId: r.spec.instanceId,
      supportedClasses: r.fcClasses,
      accuracyBonusBp: r.attr.accuracyBonusBp ?? 0,
      capacity: r.attr.capacity ?? 0,
      stationPermille: r.spec.stationPermille,
    }));
  const guns = gunRes
    .filter((r) => r.fcClass !== undefined)
    .map((r) => ({ instanceId: r.spec.instanceId, fcClass: r.fcClass! }));
  const funnels = resolved
    .filter((r) => r.tags.includes("funnel"))
    .map((r) => r.spec.stationPermille);
  const systems = compileSystems(
    {
      items: systemsItems,
      generators,
      coolingSupplyKw: resolved.reduce((a, r) => a + (r.attr.coolingSupplyKw ?? 0), 0),
      displacementKg: hull.targetDisplacementKg,
      fireControlPositions: draft.fireControl?.positions ?? 0,
      accommodationStandard: draft.requirement.accommodationStandard,
      accommodationVolumeLitre: accommodationVolume,
      guns,
      directors,
      funnelStationsPermille: funnels,
    },
    b.systems,
  );
  findings.push(...systems.findings);

  const machineryRaw = compileMachinery(
    {
      plant,
      installedKw: draft.machinery.installedKw,
      hullFormId: hull.hullFormId,
      lengthWlMm: hull.lengthWl,
      displacementKg: hull.targetDisplacementKg,
      foulingBp: draft.machinery.foulingBp,
      ...(draft.machinery.enginePriorityBp !== undefined
        ? { enginePriorityBp: draft.machinery.enginePriorityBp }
        : {}),
      fuelCapacityKg: draft.machinery.fuelCapacityKg,
      cruiseSpeedMilliKnots: draft.requirement.cruiseSpeedMilliKnots,
      requiredSpeedMilliKnots: draft.requirement.requiredSpeedMilliKnots,
      requiredRangeNm: draft.requirement.requiredRangeNm,
    },
    b.machinery,
  );
  findings.push(...machineryRaw.findings);
  return { systems, machineryRaw };
}

export function compileStructure(args: {
  draft: DesignIntent;
  aa: AntiAircraftExpansion;
  ctx: ShipContext;
  resolved: readonly Resolved[];
  plant: PropulsionPlant;
  formData: HullFormData;
  b: ShipBalance;
  weapons: WeaponsResult;
  systems: SystemsResult;
  machineryRaw: MachineryResult;
  findings: Finding[];
}): { hullRes: HullResult; armour: ArmourResult } {
  const { draft, aa, ctx, resolved, plant, formData, b, weapons, systems, machineryRaw, findings } =
    args;
  const hull = draft.hull;

  const armourInput = (
    reserveBuoyancyBp: number,
    magazines: ArmourInput["magazines"],
  ): ArmourInput => ({
    regions: draft.armour.regions,
    threats: ctx.threats,
    designThreatId: draft.requirement.designThreatId,
    citadelLengthMm: draft.armour.citadelLengthMm,
    magazines,
    torpedoWarheadKg: draft.armour.torpedoWarheadKg,
    bunkerProtectionBp: draft.armour.bunkerProtectionBp,
    subdivisionGrade: hull.subdivisionGrade,
    reserveBuoyancyBp,
    damageControlBp: resolved.reduce((a, r) => a + (r.attr.damageControlBp ?? 0), 0),
    flammableBp:
      resolved.reduce((a, r) => a + (r.attr.flammableBp ?? 0), 0) +
      (plant.fuelType === "OIL" ? 1_000 : 0),
  });
  findings.push(
    ...armourAvailabilityFindings(draft.armour.regions, b.armour, ctx.month, ctx.unlockedTechs),
  );
  const armourPre = compileArmour(armourInput(0, []), b.armour);
  const mag = (region: string, threatId: string) => armourPre.marginBp[region]?.[threatId] ?? null;
  const designThreat = draft.requirement.designThreatId;
  const magazines = resolved
    .filter((r) => r.category === "MAGAZINE")
    .map((r) => {
      const near = (cat: Parameters<(typeof WEAPON_CATEGORIES)["includes"]>[0]) =>
        resolved.some((o) => o.category === cat && o.spec.zoneId === r.spec.zoneId);
      return {
        magazineId: r.spec.instanceId,
        beltMarginBp: mag("BELT_MAIN", designThreat),
        deckMarginBp: mag("DECK_MAIN", designThreat),
        boxMarginBp: mag("MAGAZINE_BOX", designThreat),
        adjacentBoilers: near("BOILER") || near("ENGINE"),
        adjacentTorpedoTubes: near("TORPEDO_TUBE"),
        flashProtectionBp: r.attr.flashProtectionBp ?? 0,
      };
    });

  const sumBy = (cat: LedgerCategory, extra = 0) =>
    resolved
      .filter((r) => b.ledgerCategoryOf[r.category] === cat)
      .reduce((a, r) => a + r.weightKg, extra);
  const crewKg = systems.crewRequired * b.crewKgPerHead;
  let others = emptyLedger();
  others = withLine(
    others,
    "machinery",
    (machineryRaw.plantWeightKg + sumBy("machinery")) as never,
  );
  others = withLine(others, "fuel", (draft.machinery.fuelCapacityKg + sumBy("fuel")) as never);
  others = withLine(
    others,
    "armament",
    (sumBy("armament") +
      expandTertiary(draft.tertiary, b.tertiary ?? NO_TERTIARY_BALANCE).weightKg +
      aa.weightKg) as never,
  );
  others = withLine(others, "ammunition", (weapons.ammoMassKg + sumBy("ammunition")) as never);
  others = withLine(others, "sensors", sumBy("sensors") as never);
  others = withLine(others, "mission", sumBy("mission") as never);
  others = withLine(others, "crew", crewKg as never);
  others = withLine(
    others,
    "auxiliary",
    (sumBy("auxiliary") + (colonialFitting(draft, ctx)?.displacementKg ?? 0)) as never,
  );
  others = withLine(others, "armour", (armourPre.totalWeightKg + sumBy("armour")) as never);
  const hullRes = compileHull(
    hull,
    formData.form,
    b.hull,
    others,
    aluminiumFitting(draft, b.aluminiumSuperstructure, ctx.month)?.savingBp ?? 0,
  );
  findings.push(...hullRes.findings);
  const armour = compileArmour(armourInput(hullRes.reserveBuoyancyBp, magazines), b.armour);
  findings.push(...armour.findings);
  return { hullRes, armour };
}
