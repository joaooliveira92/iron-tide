import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { parseYamlSafe } from "@bluewave/content-schema";
import { ValidateStage } from "@bluewave/content-compiler";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import type { ParseOutput } from "../src/stages/parse.js";

// S-5 02 (#76, spec #73 R3): the home area is authoritative nation content, validated against the area set,
// with the same values the presentation join already carries (nothing invented).
const CONTENT = resolve(import.meta.dirname, "../../../content/production/1880");
const read = (file: string): unknown =>
  parseYamlSafe(readFileSync(resolve(CONTENT, file), "utf8"), file, new DiagnosticCollector()).data;
const load = (file: string): Record<string, unknown>[] => read(file) as Record<string, unknown>[];

function validate(countries: unknown[]): DiagnosticCollector {
  const input: ParseOutput = {
    manifest: { name: "test-pack", version: "0.1.0", type: "fixture", files: {} },
    collectionDocs: new Map<string, unknown[]>([
      ["countries", countries],
      ["areas", load("areas.yaml")],
    ]),
    sourcePaths: new Map(),
    objectDocs: new Map(),
    objectSourcePaths: new Map(),
    contentDir: ".",
  };
  const collector = new DiagnosticCollector();
  new ValidateStage().run(input, new AbortController().signal, collector);
  return collector;
}

const withHome = (id: string, homeArea: unknown): unknown[] =>
  load("countries.yaml").map((n) => {
    if (n["id"] !== id) return n;
    const { homeArea: _drop, ...rest } = n;
    return homeArea === undefined ? rest : { ...rest, homeArea };
  });

describe("nation home area", () => {
  it("equals the presentation join value for every production nation (parity)", () => {
    const presentation = read("presentation.yaml") as {
      mapJoin: { nationHomeArea: Record<string, string> };
    };
    const countries = load("countries.yaml");
    expect(countries.length).toBeGreaterThan(0);
    for (const nation of countries) {
      expect(nation["homeArea"]).toBe(presentation.mapJoin.nationHomeArea[nation["id"] as string]);
    }
  });

  it("is accepted for every production nation", () => {
    const codes = validate(load("countries.yaml")).all.map((d) => d.code as string);
    expect(codes).not.toContain("HOME_AREA_MISSING");
    expect(codes).not.toContain("HOME_AREA_UNKNOWN");
  });

  it("fails with a named diagnostic when a nation has no home area", () => {
    const d = validate(withHome("uk", undefined)).all.find((x) => x.code === "HOME_AREA_MISSING");
    expect(d?.entityId).toBe("uk");
    expect(d?.severity).toBe("error");
  });

  it("fails with a named diagnostic when the home area is not in the area set", () => {
    const d = validate(withHome("uk", "no_such_area")).all.find(
      (x) => x.code === "HOME_AREA_UNKNOWN",
    );
    expect(d?.entityId).toBe("uk");
  });

  it("rejects an excess key on a nation (strict decoding stays in force)", () => {
    const countries = load("countries.yaml").map((n) =>
      n["id"] === "uk" ? { ...n, homeAreaa: "eng_home_coast" } : n,
    );
    expect(validate(countries).hasErrors).toBe(true);
  });
});
