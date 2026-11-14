import { describe, expect, it } from "vite-plus/test";
import { compileDesign, type StarterDesign } from "../src/index.js";
import { nationalContext, shipBuildingContent } from "./helpers/earlyContext.js";

const OPENING_MONTH = "1880-01";
const REFERENCE_NATION = "uk";

const PENDING_NATIONAL_IDENTITY: ReadonlySet<string> = new Set([
  "austria_hungary",
  "brazil",
  "france",
  "germany",
  "italy",
  "netherlands",
  "ottoman_empire",
  "portugal",
  "spain",
  "usa",
]);

const openingStarters: readonly StarterDesign[] = shipBuildingContent.starterDesigns.filter(
  (s) => s.month === OPENING_MONTH,
);

function fingerprint(s: StarterDesign): string {
  const c = compileDesign(s.draft, nationalContext(s.month, s.draft.nationId));
  const parts = c.components
    .map((k) => `${k.componentId}:${k.weightKg}:${k.costMicro}`)
    .sort()
    .join("|");
  return `${c.totalKg}/${c.componentCostMicro}/${parts}`;
}

const byCategory = new Map<string, StarterDesign[]>();
for (const s of openingStarters) {
  byCategory.set(s.starterFor, [...(byCategory.get(s.starterFor) ?? []), s]);
}

function sharingNations(starters: readonly StarterDesign[]): Set<string> {
  const owners = new Map<string, Set<string>>();
  for (const s of starters) {
    const key = fingerprint(s);
    owners.set(key, (owners.get(key) ?? new Set()).add(s.draft.nationId));
  }
  const sharing = new Set<string>();
  for (const nations of owners.values()) {
    if (nations.size > 1) for (const n of nations) sharing.add(n);
  }
  return sharing;
}

describe("national starter identity (release gate)", () => {
  it("covers every opening starter category", () => {
    expect([...byCategory.keys()].sort()).toEqual(["AMC", "B", "CA", "CL", "DD", "KE"]);
  });

  for (const [category, starters] of byCategory) {
    it(`${category}: no identified nation shares its starter with another nation`, () => {
      const shared = [...sharingNations(starters)]
        .filter((n) => n !== REFERENCE_NATION && !PENDING_NATIONAL_IDENTITY.has(n))
        .sort();
      expect(
        shared,
        `${category} starters compile identically to another nation's; give them the nation's own guns, speed or fittings`,
      ).toEqual([]);
    });
  }

  it("the pending list names only nations that still share a starter", () => {
    const sharing = new Set<string>();
    for (const starters of byCategory.values()) {
      for (const n of sharingNations(starters)) sharing.add(n);
    }
    const stale = [...PENDING_NATIONAL_IDENTITY].filter((n) => !sharing.has(n)).sort();
    expect(stale, "remove these nations from PENDING_NATIONAL_IDENTITY").toEqual([]);
  });
});
