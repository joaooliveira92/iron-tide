import { applyEdit, buildWorkshopView } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import {
  batteryCards,
  batteryTitle,
  clearBatteryEdit,
  mountNameMap,
  setRoundsEdit,
  batterySymmetry,
  type BatteryCard,
  type BatteryMount,
} from "./batteryView.js";
import { loadDrawingBoardContent } from "./content.js";

const content = loadDrawingBoardContent();
const ref = content.references.find((r) => r.id === "majestic_like")!;
const view = buildWorkshopView(ref.draft, content.environmentFor(ref.month));
const cards = batteryCards(view, ref.draft);
const defOf = (id: string) => content.catalogue.find((c) => c.id === id);

describe("batteryCards", () => {
  it("groups the battleship's guns into main then secondary batteries with conventional names", () => {
    expect(cards.length).toBeGreaterThan(1);
    expect(cards[0]!.row.role).toBe("MAIN");
    expect(cards[0]!.title).toMatch(/^Main battery, \d+\.\d-inch$/);
    const main = cards[0]!;
    expect(main.mounts.length).toBe(main.row.mounts);
    const centre = main.mounts.filter((m) => m.side === "CENTRE");
    if (centre.length >= 2) {
      expect(centre[0]!.name).toBe("A");
      expect(centre.at(-1)!.name).toBe("Y");
    }
  });
  it("names every mount of every battery exactly once", () => {
    const names = mountNameMap(cards);
    const ids = cards.flatMap((c) => c.mounts.map((m) => m.instanceId));
    expect(new Set(ids).size).toBe(ids.length);
    expect(names.size).toBe(ids.length);
  });
  it("is empty for an unarmed design and deterministic", () => {
    const bare = {
      ...ref.draft,
      placements: ref.draft.placements.filter(
        (p) => !cards.some((c) => c.row.instanceIds.includes(p.instanceId)),
      ),
    };
    const bareView = buildWorkshopView(bare, content.environmentFor(ref.month));
    expect(batteryCards(bareView, bare)).toEqual([]);
    expect(batteryCards(view, ref.draft)).toEqual(cards);
  });
  it("titles torpedo tubes without a calibre", () => {
    expect(batteryTitle({ ...cards[0]!.row, role: "TORPEDO", caliberUm: 0 })).toBe("Torpedo tubes");
  });
});

describe("battery edits", () => {
  const main = cards[0]!.row;
  it("clearing a battery is one batch that removes exactly its mounts", () => {
    const e = clearBatteryEdit(main)!;
    expect(e.kind).toBe("batch");
    const next = applyEdit(ref.draft, e);
    for (const id of main.instanceIds)
      expect(next.placements.some((p) => p.instanceId === id)).toBe(false);
    expect(next.placements.length).toBe(ref.draft.placements.length - main.instanceIds.length);
    expect(clearBatteryEdit({ ...main, instanceIds: [] })).toBeNull();
  });
  it("sets rounds per gun on every mount, clamped to each mount's own range", () => {
    const e = setRoundsEdit(main, 1_000_000, ref.draft, defOf)!;
    const next = applyEdit(ref.draft, e);
    for (const id of main.instanceIds) {
      const p = next.placements.find((x) => x.instanceId === id)!;
      const max = defOf(p.componentId)!.parameters!.rounds!.max;
      expect(p.params?.rounds).toBe(max);
    }
    const low = applyEdit(ref.draft, setRoundsEdit(main, -5, ref.draft, defOf)!);
    const min = defOf(
      low.placements.find((x) => x.instanceId === main.instanceIds[0])!.componentId,
    )!.parameters!.rounds!.min;
    expect(low.placements.find((x) => x.instanceId === main.instanceIds[0])!.params?.rounds).toBe(
      min,
    );
  });
  it("makes no edit when every mount already has that value", () => {
    const e = setRoundsEdit(main, 1_000_000, ref.draft, defOf)!;
    const maxed = applyEdit(ref.draft, e);
    expect(setRoundsEdit(main, 1_000_000, maxed, defOf)).toBeNull();
  });
});

describe("batterySymmetry (#168 step 6)", () => {
  const mount = (
    instanceId: string,
    side: "CENTRE" | "PORT" | "STBD",
    componentId: string,
  ): BatteryMount => ({ instanceId, name: instanceId, side, stationPermille: 500, componentId });
  const card = (mounts: BatteryMount[]): BatteryCard => ({
    row: {
      key: "MAIN:254000",
      role: "MAIN",
      caliberUm: 254_000,
      mounts: mounts.length,
      barrels: mounts.length,
      roundsPerGun: null,
      weightKg: 0,
      instanceIds: mounts.map((m) => m.instanceId),
    },
    title: "Main battery",
    mounts,
  });

  it("has nothing to say about centreline-only batteries", () => {
    expect(batterySymmetry(card([mount("a", "CENTRE", "gun_a")]))).toBeNull();
  });
  it("is symmetric when port and starboard carry the same guns", () => {
    expect(batterySymmetry(card([mount("p", "PORT", "gun_a"), mount("s", "STBD", "gun_a")]))).toBe(
      "symmetric",
    );
  });
  it("is asymmetric when the sides carry different guns, or only one side is fitted", () => {
    expect(batterySymmetry(card([mount("p", "PORT", "gun_a"), mount("s", "STBD", "gun_b")]))).toBe(
      "asymmetric",
    );
    expect(batterySymmetry(card([mount("p", "PORT", "gun_a")]))).toBe("asymmetric");
    expect(
      batterySymmetry(
        card([
          mount("p1", "PORT", "gun_a"),
          mount("p2", "PORT", "gun_a"),
          mount("s", "STBD", "gun_a"),
        ]),
      ),
    ).toBe("asymmetric");
  });
  it("ignores centreline mounts and the order of mounts", () => {
    expect(
      batterySymmetry(
        card([
          mount("s", "STBD", "gun_b"),
          mount("c", "CENTRE", "gun_z"),
          mount("p", "PORT", "gun_b"),
        ]),
      ),
    ).toBe("symmetric");
  });
});
