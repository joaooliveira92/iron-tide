import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vite-plus/test";
import type { ContentPack } from "@bluewave/content-schema";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { buildNationStates } from "../src/nationCompilation.js";
import { buildWorldState } from "../src/worldCompilation.js";
import { presenceAreaIds } from "../src/presence.js";

// S-5 02 (#76, spec #73 R3/R13): presence areas are the distinct areas of a nation's currently owned possessions.
const CONTENT = resolve(import.meta.dirname, "../../../content/production/1880");
const load = (file: string): Record<string, unknown>[] =>
  parse(readFileSync(resolve(CONTENT, file), "utf8")) as Record<string, unknown>[];

type PossessionRow = { id: string; nationId: string; areaId: string };
const loadPossessions = (): PossessionRow[] =>
  load("possessions.yaml").map((p) => ({
    id: String(p["id"]),
    nationId: String(p["nationId"]),
    areaId: String(p["areaId"]),
  }));

const poss = (id: string, nationId: string, areaId: string) => ({ id, nationId, areaId });
const START = { startYear: 1880, startMonth: 1 } as const;

describe("presenceAreaIds", () => {
  const possessions = [
    poss("p3", "uk", "med_malta"),
    poss("p1", "uk", "eng_home_coast"),
    poss("p2", "uk", "med_malta"),
    poss("p4", "france", "fra_chan_coast"),
  ];

  it("lists the distinct possession areas of the nation ordered by area id", () => {
    expect(presenceAreaIds(possessions, "uk")).toEqual(["eng_home_coast", "med_malta"]);
  });

  it("is empty for a nation that owns nothing", () => {
    expect(presenceAreaIds(possessions, "japan")).toEqual([]);
  });

  it("changes when a possession changes hands", () => {
    const ceded = possessions.map((p) => (p.id === "p3" ? { ...p, nationId: "france" } : p));
    // p2 still holds Malta for the UK: the area stays until the last possession there is gone.
    expect(presenceAreaIds(ceded, "uk")).toEqual(["eng_home_coast", "med_malta"]);
    const both = ceded.map((p) => (p.id === "p2" ? { ...p, nationId: "france" } : p));
    expect(presenceAreaIds(both, "uk")).toEqual(["eng_home_coast"]);
    expect(presenceAreaIds(both, "france")).toEqual(["fra_chan_coast", "med_malta"]);
  });
});

describe("buildWorldState possessions", () => {
  it("carries the pack possessions ordered by id", () => {
    const pack = { areas: [], possessions: loadPossessions() };
    const world = buildWorldState(pack, START);
    const ids = (world.possessions ?? []).map((p) => p.id);
    expect(ids).toHaveLength(loadPossessions().length);
    expect(ids).toEqual([...ids].sort());
  });

  it("gives every production nation its distinct possession areas as presence areas", () => {
    const possessions = loadPossessions();
    const world = buildWorldState({ areas: [], possessions }, START);
    for (const nation of load("countries.yaml")) {
      const id = nation["id"] as string;
      const expected = [
        ...new Set(possessions.filter((p) => p.nationId === id).map((p) => p.areaId)),
      ].sort();
      expect(presenceAreaIds(world.possessions ?? [], id)).toEqual(expected);
    }
  });
});

describe("buildNationStates home area", () => {
  it("carries the authored home area onto the nation state", () => {
    const pack = {
      nations: [{ id: "uk", name: "uk", tag: "GBR", isPlayable: true, homeArea: "eng_home_coast" }],
    } as ContentPack;
    const economies = [{ nationId: "uk", treasury: 10, income: 10, expenses: 1 }];
    const states = buildNationStates(
      pack,
      [],
      economies,
      [],
      [],
      [],
      "test",
      "1880-01",
      new DiagnosticCollector(),
    );
    expect(states?.get("uk")?.homeAreaId).toBe("eng_home_coast");
  });
});
