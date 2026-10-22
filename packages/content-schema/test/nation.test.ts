import { describe, it, expect } from "vite-plus/test";
import {
  type Nation,
  type NationId,
  NATION_IDS,
  NationIdSchema,
  NationSchema,
  decodeStrict,
  decodeStrictResult,
} from "../src/index.js";
import { fixtureNations } from "./nation-fixtures.js";
import { decodeOk } from "./decode-helpers.js";

const EXPECTED_TAGS: Record<NationId, string> = {
  uk: "GBR",
  germany: "GER",
  usa: "USA",
  japan: "JPN",
  france: "FRA",
  italy: "ITA",
  russia: "RUS",
  austria_hungary: "AUT",
  spain: "ESP",
  qing: "CHI",
  ottoman_empire: "OTT",
  egypt: "EGY",
  netherlands: "NLD",
  belgium: "BEL",
  denmark: "DEN",
  sweden_norway: "SWE",
  portugal: "POR",
  greece: "GRC",
  brazil: "BRA",
  chile: "CHL",
  argentina: "ARG",
  korea: "KOR",
  persia: "PRS",
  siam: "SIA",
};

function corpusNations(): Nation[] {
  return fixtureNations();
}

describe("NationSchema", () => {
  it("exports a 24-member lowercase NationId enum", () => {
    expect(NATION_IDS).toHaveLength(24);
    expect(decodeOk(NationIdSchema, NATION_IDS[0])).toBe(true);
    for (const id of NATION_IDS) {
      expect(id).toMatch(/^[a-z_]+$/);
    }
  });

  it("accepted ids exactly cover the research canon ids", () => {
    const enumIds = new Set(NATION_IDS);
    const corpusIds = new Set(corpusNations().map((n) => n.id));
    expect([...enumIds].sort()).toEqual([...corpusIds].sort());
  });

  it("parses all 24 research canon objects", () => {
    const nations = corpusNations();
    expect(nations).toHaveLength(24);
    for (const nation of nations) {
      const result = decodeStrictResult(NationSchema, nation);
      expect(
        result._tag,
        `nations/${nation.id} failed: ${result._tag === "Failure" ? JSON.stringify(result.failure.issue) : ""}`,
      ).toBe("Success");
    }
  });

  it("locks the uppercase 3-letter tag for every canon nation", () => {
    for (const nation of corpusNations()) {
      expect(nation.tag).toBe(EXPECTED_TAGS[nation.id]);
      expect(nation.tag).toMatch(/^[A-Z]{3}$/);
    }
  });

  it("is strict and rejects unknown keys", () => {
    const nation = corpusNations()[0]!;
    expect(decodeOk(NationSchema, { ...nation, unknownField: "x" })).toBe(false);
  });

  it("rejects an id outside the canonical 24-member enum", () => {
    const nation = { ...corpusNations()[0]!, id: "atlantis" };
    expect(decodeOk(NationSchema, nation)).toBe(false);
  });

  it("rejects a lowercase or non-3-letter tag", () => {
    const base = corpusNations()[0]!;
    expect(decodeOk(NationSchema, { ...base, tag: "gbr" })).toBe(false);
    expect(decodeOk(NationSchema, { ...base, tag: "GB" })).toBe(false);
  });

  it("rejects non-hex presentation colors", () => {
    const base = corpusNations()[0]!;
    expect(
      decodeOk(NationSchema, {
        ...base,
        presentation: { colorBg: "red", colorFg: "#FFFFFF" },
      }),
    ).toBe(false);
  });

  it("requires the rich canon fields", () => {
    const base = corpusNations()[0]!;
    const { identity: _identity, ...withoutIdentity } = base;
    expect(decodeOk(NationSchema, withoutIdentity)).toBe(false);
  });

  it("requires slot.id", () => {
    const base = corpusNations()[0]!;
    const { slot: _slot, ...rest } = base;
    expect(
      decodeOk(NationSchema, {
        ...rest,
        slot: { order: 1, participation: "active" as const },
      }),
    ).toBe(false);
  });

  it("treats military as optional", () => {
    const nation = corpusNations()[0]!;
    if (nation.military === undefined) {
      return;
    }
    const { military: _military, ...withoutMilitary } = nation;
    expect(decodeOk(NationSchema, withoutMilitary)).toBe(true);
  });

  it("decodes a valid nation through the throwing helper", () => {
    const nation = corpusNations()[0]!;
    expect(() => decodeStrict(NationSchema, nation)).not.toThrow();
  });
});
