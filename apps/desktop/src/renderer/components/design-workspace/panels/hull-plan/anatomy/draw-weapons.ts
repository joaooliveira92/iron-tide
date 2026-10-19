import {
  circle,
  cylinder,
  discPath,
  ellipse,
  extrude,
  iso,
  lineOf,
  pathOf,
  roundedPlan,
  screenWidth,
} from "./iso.js";
import type { Flat, Point3, SolidPaths } from "./iso.js";
import { clamp, wholeInches, solid, ribbon } from "./anatomy-helpers.js";
import type { PartDraft } from "./anatomy-types.js";
import type { AnatomyShipScene } from "./anatomy-scene.js";
import { mountClassOf } from "@bluewave/ship-visual";
import { CATEGORY_LABEL, MOUNT_LABEL } from "./ship-profile.js";

/** Weapons and torpedo tubes from the compiled placements. */
export function drawWeapons(scene: AnatomyShipScene): void {
  const {
    draft,
    model,
    near,
    L,
    B,
    D,
    T,
    halfAt,
    deckZ,
    halfAtZ,
    hasHouse,
    houseT0,
    houseT1,
    lowerTop,
    upperTop,
    mastRise,
    P,
    facts,
    add,
    text,
    regionOf,
    compiled,
    visual,
    drawn,
  } = scene;
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
}
