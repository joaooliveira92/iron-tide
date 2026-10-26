import { describe, expect, it } from "vite-plus/test";

import {
  CAPABILITY_KINDS,
  CapabilitiesSchema,
  FlattenedPartSchema,
  PART_FAMILIES,
  PART_INTERFACES,
  decodeStrict,
} from "../src/index.js";
import { decodeIssue } from "./decode-helpers.js";

const provenance = {
  sourceStatus: "VERIFIED",
  confidence: "HIGH",
  kind: "historical_fact" as const,
  sources: [{ title: "test source" }],
};

const envelope = (id: string, family: string, provides: string) => ({
  id,
  family,
  provides,
  name: id,
  lifecycle: { availableFrom: "1940-01" },
  spec: {},
  quantities: [{ id: "mass", kind: "massKg", value: 100, basis: "PER_PART_UNIT" }],
  revisions: [],
  origin: { sourceFile: "ship-building/parts/sensor.yaml" },
  provenance,
});

const PARTS = {
  radar: {
    ...envelope("radar_type_284", "radar", "radar"),
    capabilities: [
      { kind: "fire_control_radar", level: 3 },
      { kind: "search_radar", level: 2 },
    ],
  },
  sonar: {
    ...envelope("sonar_type_144", "sonar", "sonar"),
    capabilities: [{ kind: "sonar_detection", level: 2 }],
  },
  asw_weapon: {
    ...envelope("hedgehog", "asw_weapon", "asw_weapon"),
    capabilities: [{ kind: "asw_attack", level: 3 }],
  },
  aa_weapon: {
    ...envelope("aa_40mm_bofors", "aa_weapon", "aa_weapon"),
    spec: { calibreUm: 40_000 },
    capabilities: [{ kind: "aa_engagement", level: 2 }],
  },
  missile_launcher: {
    ...envelope("ssm_launcher_twin", "missile_launcher", "missile_launcher"),
    capabilities: [{ kind: "missile_launch", missileClass: "heavy_ssm" }],
  },
  hangar: {
    ...envelope("helicopter_hangar", "hangar", "hangar"),
    capabilities: [{ kind: "aircraft_hangar", capacity: 2 }],
  },
} as const;

describe("E-1 part families", () => {
  it("declares the new families and interfaces", () => {
    for (const family of [
      "radar",
      "sonar",
      "asw_weapon",
      "aa_weapon",
      "missile_launcher",
      "hangar",
    ] as const) {
      expect(PART_FAMILIES).toContain(family);
      expect(PART_INTERFACES).toContain(family);
    }
    for (const kind of [
      "search_radar",
      "fire_control_radar",
      "sonar_detection",
      "asw_attack",
      "aa_engagement",
      "missile_launch",
      "aircraft_hangar",
    ] as const) {
      expect(CAPABILITY_KINDS).toContain(kind);
    }
  });

  it("round-trips a strict flattened part for every new family", () => {
    for (const part of Object.values(PARTS)) {
      expect(decodeStrict(FlattenedPartSchema, part)).toEqual(part);
    }
  });

  it("decodes the new capability kinds", () => {
    const list = [
      { kind: "aa_engagement", level: 1 },
      { kind: "aircraft_hangar", capacity: 2 },
      { kind: "asw_attack", level: 1 },
      { kind: "fire_control_radar", level: 3 },
      { kind: "missile_launch", missileClass: "sam" },
      { kind: "search_radar", level: 2 },
      { kind: "sonar_detection", level: 1 },
    ];
    expect(decodeStrict(CapabilitiesSchema, list)).toEqual(list);
  });

  it("rejects a level outside 1..3 and an unknown missile class", () => {
    expect(decodeIssue(CapabilitiesSchema, [{ kind: "search_radar", level: 0 }])).not.toBe("");
    expect(decodeIssue(CapabilitiesSchema, [{ kind: "fire_control_radar", level: 4 }])).not.toBe(
      "",
    );
    expect(
      decodeIssue(CapabilitiesSchema, [{ kind: "missile_launch", missileClass: "orbital" }]),
    ).not.toBe("");
  });

  it("rejects an excess key on a new family part", () => {
    expect(decodeIssue(FlattenedPartSchema, { ...PARTS.hangar, unexpected: true })).not.toBe("");
  });
});
