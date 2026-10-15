// packages/ship-design/src/compileRules.ts
// Layout, stability and regulatory (dock/treaty/modernization) stages of the
// design-compile pipeline.
import { ZONE_IDS, type ZoneId } from "./arrangement.js";
import type { ArmourResult } from "./armour.js";
import {
  f,
  type DesignDraft,
  type HullFormData,
  type Resolved,
  type ShipBalance,
  type ShipContext,
} from "./compileShared.js";
import type { Finding } from "./findings.js";
import type { HullResult, HullSpec } from "./hull.js";
import type { MachineryResult } from "./machinery.js";
import type { WeightItem } from "./stability.js";
import type { WeaponsResult } from "./weapons.js";

type AmmoMount = WeaponsResult["mounts"][number];

export function buildStabilityLumps(args: {
  draft: DesignDraft;
  resolved: Resolved[];
  hull: HullSpec;
  formData: HullFormData;
  b: ShipBalance;
  hullRes: HullResult;
  machineryRaw: MachineryResult;
  ammoById: Map<string, AmmoMount>;
  byId: Map<string, Resolved>;
  rooms: readonly { zoneId: ZoneId; stationPermille: number; shareBp: number }[];
  roomPart: (total: number, i: number) => number;
  armour: ArmourResult;
}): WeightItem[] {
  const {
    draft,
    resolved,
    hull,
    formData,
    b,
    hullRes,
    machineryRaw,
    ammoById,
    byId,
    rooms,
    roomPart,
    armour,
  } = args;
  const lumps: WeightItem[] = [];
  const spread = (label: string, kg: number, zFracBp: number) => {
    let left = kg;
    const shares = formData.buoyancyByZoneBp;
    ZONE_IDS.forEach((zid, i) => {
      if (zid === "MISSION") return;
      const zd = formData.zones[i]!;
      const part = i === ZONE_IDS.length - 2 ? left : Math.floor((kg * shares[i]!) / 10_000);
      left -= part;
      lumps.push({
        label: `${label}:${zid}`,
        kg: part,
        zMm: Math.floor((hull.depthToMainDeck * zFracBp) / 10_000),
        stationPermille: Math.floor((zd.startPermille + zd.endPermille) / 2),
        zoneId: zid,
      });
    });
  };
  spread("hull", hullRes.ledger.hull, b.lumpZFractionBp.hull);
  spread("margin", hullRes.ledger.margin, b.lumpZFractionBp.margin);
  spread("reserve", hullRes.ledger.reserve, b.lumpZFractionBp.reserve);
  spread("crew", hullRes.ledger.crew, b.lumpZFractionBp.crew);
  for (const r of resolved) {
    lumps.push({
      label: r.spec.instanceId,
      kg: r.weightKg,
      zMm: r.zCgMm,
      stationPermille: r.spec.stationPermille,
      zoneId: r.spec.zoneId,
    });
    const am = ammoById.get(r.spec.instanceId);
    if (am && am.ammoMassKg > 0) {
      const ms = r.spec.magazineRef ? byId.get(r.spec.magazineRef) : undefined;
      lumps.push({
        label: `${r.spec.instanceId}:ammo`,
        kg: am.ammoMassKg,
        zMm: ms?.zCgMm ?? r.zCgMm,
        stationPermille: ms?.spec.stationPermille ?? r.spec.stationPermille,
        zoneId: ms?.spec.zoneId ?? r.spec.zoneId,
      });
    }
  }
  rooms.forEach((room, i) => {
    lumps.push({
      label: `plant:${i}`,
      kg: roomPart(machineryRaw.plantWeightKg, i),
      zMm: Math.floor((hull.depthToMainDeck * b.lumpZFractionBp.machinery) / 10_000),
      stationPermille: room.stationPermille,
      zoneId: room.zoneId,
    });
  });
  lumps.push({
    label: "fuel",
    kg: draft.machinery.fuelCapacityKg,
    zMm: Math.floor((hull.depthToMainDeck * b.lumpZFractionBp.fuel) / 10_000),
    stationPermille: draft.machinery.fuelStationPermille,
    zoneId: draft.machinery.fuelZoneId,
  });
  for (const [region, kg] of Object.entries(armour.weightByRegionKg)) {
    lumps.push({
      label: `armour:${region}`,
      kg,
      zMm: Math.floor((hull.depthToMainDeck * (b.armourZFractionBp[region] ?? 5_000)) / 10_000),
      stationPermille: 450,
      zoneId: "CENTRAL_MACHINERY",
    });
  }
  return lumps;
}

export function collectDockTreatyModernizationFindings(args: {
  draft: DesignDraft;
  ctx: ShipContext;
  resolved: Resolved[];
  total: number;
  reserveKg: number;
  findings: Finding[];
}): void {
  const { draft, ctx, resolved, total, reserveKg, findings } = args;
  const hull = draft.hull;
  const b = ctx.balance;

  const heaviest = Math.max(0, ...resolved.map((r) => r.weightKg));
  if (
    !ctx.facilities.some(
      (x) =>
        x.maxLengthMm >= hull.lengthWl &&
        x.maxBeamMm >= hull.beam &&
        x.maxDisplacementKg >= total &&
        x.craneLiftKg >= heaviest,
    )
  ) {
    findings.push(
      f(
        "NO_FACILITY_FITS",
        "BLOCKING",
        "No available shipyard can build this ship.",
        `Needs length ${hull.lengthWl} mm, beam ${hull.beam} mm, ${total} kg, crane lift ${heaviest} kg.`,
        "The design cannot be laid down anywhere you own or can use.",
        [
          ["smaller_hull", "Reduce length, beam or displacement."],
          ["lighter_items", "Use components within the crane limit."],
          ["build_dock", "Invest in a larger slipway."],
        ],
        "SB-DOCK",
      ),
    );
  }
  const t = ctx.treaty;
  if (t) {
    if (t.maxDisplacementKg !== undefined && total > t.maxDisplacementKg) {
      findings.push(
        f(
          "TREATY_LIMIT_DISPLACEMENT",
          "BLOCKING",
          "The design exceeds the treaty displacement limit.",
          `${total} kg vs limit ${t.maxDisplacementKg} kg.`,
          "Building it violates the treaty.",
          [
            ["cut_weight", "Reduce displacement below the limit."],
            ["leave_treaty", "Withdraw from the treaty (diplomatic consequences)."],
            ["other_category", "Design a category the treaty does not limit."],
          ],
          "SB-TREATY",
        ),
      );
    }
    if (t.maxMainGunCaliberUm !== undefined) {
      const over = resolved.filter(
        (r) => r.def.category === "MAIN_GUN" && (r.attr.caliberUm ?? 0) > t.maxMainGunCaliberUm!,
      );
      if (over.length > 0)
        findings.push(
          f(
            "TREATY_LIMIT_CALIBRE",
            "BLOCKING",
            "A main gun exceeds the treaty calibre limit.",
            `${over.map((o) => o.spec.instanceId).join(", ")} over ${t.maxMainGunCaliberUm} µm.`,
            "Building it violates the treaty.",
            [
              ["smaller_gun", "Use a smaller calibre."],
              ["leave_treaty", "Withdraw from the treaty."],
              ["reclassify", "Redesign as a category without the limit."],
            ],
            "SB-TREATY",
          ),
        );
    }
    if (t.forbiddenCategories?.includes(draft.requirement.category)) {
      findings.push(
        f(
          "TREATY_LIMIT_CATEGORY",
          "BLOCKING",
          "This ship category is forbidden by treaty.",
          `Category ${draft.requirement.category}.`,
          "It cannot be built while the treaty is in force.",
          [
            ["other_category", "Choose another category."],
            ["leave_treaty", "Withdraw from the treaty."],
            ["wait", "Wait for the treaty to expire."],
          ],
          "SB-TREATY",
        ),
      );
    }
  }
  const reserveBp = total === 0 ? 0 : Math.floor((reserveKg * 10_000) / total);
  const minReserve = b.minReserveBpByExpectation[draft.requirement.modernizationExpectation];
  if (reserveBp < minReserve) {
    findings.push(
      f(
        "MODERNIZATION_MARGIN_LOW",
        "ADVISORY",
        "The design has little room to grow.",
        `Growth reserve ${reserveBp} bp; the requirement expects at least ${minReserve} bp.`,
        "Later refits will be limited or impossible without removing equipment.",
        [
          ["raise_reserve", "Raise the growth reserve (costs capability now)."],
          ["accept", "Accept a hull that cannot be modernized."],
        ],
        "F-H5",
      ),
    );
  }
}
