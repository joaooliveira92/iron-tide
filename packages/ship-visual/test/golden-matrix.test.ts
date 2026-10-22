import { describe, expect, it } from "vite-plus/test";
import {
  MOUNT_CLASSES,
  NATION_STYLES,
  PART_CATALOG,
  SIZE_BANDS,
  VISUAL_ERAS,
  placeMounts,
  resolveMount,
  type MountPart,
} from "../src/index.js";

const GUNS = [1, 2, 3, 4] as const;

function resolutionMatrix(): string {
  const lines: string[] = [];
  for (const style of NATION_STYLES)
    for (const era of VISUAL_ERAS)
      for (const size of SIZE_BANDS)
        for (const mountClass of MOUNT_CLASSES)
          for (const guns of GUNS) {
            const r = resolveMount(PART_CATALOG, { style, era, size, mountClass, guns });
            lines.push(
              `${style} ${era} ${size} ${mountClass} ${guns} -> ${r ? `${r.part.id} @${r.step}` : "NONE"}`,
            );
          }
  return `${lines.join("\n")}\n`;
}

function placementMatrix(): string {
  const caliberOf = { SMALL: 101_600, MEDIUM: 203_200, LARGE: 304_800 } as const;
  const mountTypeOf = {
    TURRET: "TURRET",
    BARBETTE: "BARBETTE",
    SHIELDED: "DECK_SHIELDED",
    OPEN: "DECK_OPEN",
    CASEMATE: "CASEMATE",
  } as const;
  const lines = PART_CATALOG.mounts.flatMap((part: MountPart) =>
    part.key.sizes.map((size) => placementLine(part, size)),
  );
  return `${lines.join("\n")}\n`;

  function placementLine(part: MountPart, size: MountPart["key"]["sizes"][number]): string {
    const { placed } = placeMounts(
      { mounts: [part], masts: [] },
      [
        {
          instanceId: part.id,
          stationPermille: 250,
          side: "CENTRE",
          category: "MAIN_GUN",
          mountType: mountTypeOf[part.key.mountClass],
          gunCount: part.key.guns ?? 2,
          caliberUm: caliberOf[size],
        },
      ],
      { style: part.key.style, era: part.key.era },
      { x: (p) => p, deckY: () => 100, houseTopY: () => undefined, pxPerM: 4 },
    );
    const m = placed[0]!;
    const symbols = m.symbols.map((s) => `(${s.x},${s.y})x${s.scale}`).join(" ");
    return `${part.id} ${size}: guns ${m.guns} facing ${m.facing} ${symbols}`;
  }
}

describe("golden matrix (SV-R13)", () => {
  it("pins how every key resolves (update with -u after a deliberate catalog change)", async () => {
    await expect(resolutionMatrix()).toMatchFileSnapshot("./golden/resolution-matrix.txt");
  });

  it("pins how every catalog entry is placed at fixed dimensions", async () => {
    await expect(placementMatrix()).toMatchFileSnapshot("./golden/placement-matrix.txt");
  });
});

describe("EARLY-band coverage (INC-2)", () => {
  it("draws every EARLY key (V and P) without falling back to the dreadnought era", () => {
    const fellBack: string[] = [];
    for (const style of NATION_STYLES)
      for (const era of ["VICTORIAN", "PRE_DREADNOUGHT"] as const)
        for (const size of SIZE_BANDS)
          for (const mountClass of MOUNT_CLASSES) {
            const r = resolveMount(PART_CATALOG, { style, era, size, mountClass, guns: 2 });
            if (r === null || r.step > 2) fellBack.push(`${style} ${era} ${size} ${mountClass}`);
          }
    expect(fellBack).toEqual([]);
  });

  it("gives every manual nation its own Victorian or pre-dreadnought look somewhere", () => {
    const withOwnLook = new Set(
      PART_CATALOG.mounts
        .filter((p) => p.key.era === "VICTORIAN" || p.key.era === "PRE_DREADNOUGHT")
        .map((p) => p.key.style),
    );
    expect(NATION_STYLES.filter((s) => s !== "X" && !withOwnLook.has(s))).toEqual([]);
  });

  it("styles a British pre-dreadnought 12-inch turret and an 1885 French barbette by nation", () => {
    const large = { size: "LARGE", guns: 2 } as const;
    expect(
      resolveMount(PART_CATALOG, {
        ...large,
        style: "B",
        era: "PRE_DREADNOUGHT",
        mountClass: "TURRET",
      }),
    ).toMatchObject({ part: { id: "b-pre-dreadnought-turret" }, step: 1 });
    expect(
      resolveMount(PART_CATALOG, {
        ...large,
        style: "F",
        era: "VICTORIAN",
        mountClass: "BARBETTE",
      }),
    ).toMatchObject({ part: { id: "f-victorian-barbette" }, step: 1 });
    expect(
      resolveMount(PART_CATALOG, {
        ...large,
        style: "F",
        era: "VICTORIAN",
        mountClass: "CASEMATE",
      }),
    ).toMatchObject({ part: { id: "x-victorian-casemate" }, step: 2 });
  });
});
