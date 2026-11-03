import { describe, expect, it, vi, beforeEach } from "vite-plus/test";

import { ParseStage } from "@bluewave/content-compiler";

function inputWith(
  files: Record<string, string>,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    contentDir: "/content",
    manifestPath: "manifest.json",
    fileContents: { "manifest.json": "{}", ...files },
    countryFiles: [],
    rulesetFiles: [],
    areaFiles: [],
    routeFiles: [],
    possessionFiles: [],
    portFiles: [],
    technologyFiles: [],
    ...extra,
  };
}

const collect = (errors: string[][]) => ({
  addError: vi.fn((code: string, message: string) => errors.push([code, message])),
  hasErrors: false,
});

describe("ParseStage", () => {
  let errors: string[][] = [];
  let collector = collect(errors);

  beforeEach(() => {
    errors = [];
    collector = collect(errors);
  });

  it("parses the manifest and collection documents from the input's content map", () => {
    const stage = new ParseStage();

    const result = stage.run(
      inputWith(
        {
          "manifest.json": JSON.stringify({ id: "manifest" }),
          "countries.json": JSON.stringify([{ id: "country-1" }]),
        },
        { countryFiles: ["countries.json"] },
      ) as never,
      new AbortController().signal,
      collector as never,
    );

    expect(errors).toEqual([]);
    expect(result?.manifest).toEqual({ id: "manifest" });
    expect(result?.collectionDocs.get("countries")).toEqual([{ id: "country-1" }]);
  });

  it("prefers a loaded content module over any text for the same file", () => {
    const stage = new ParseStage();

    const result = stage.run(
      {
        ...inputWith({ "countries.ts": "ignored" }, { countryFiles: ["countries.ts"] }),
        documents: { "countries.ts": [{ id: "from-module" }] },
      } as never,
      new AbortController().signal,
      collector as never,
    );

    expect(errors).toEqual([]);
    expect(result?.collectionDocs.get("countries")).toEqual([{ id: "from-module" }]);
  });

  it("rejects YAML outside the internationalization catalogue", () => {
    const stage = new ParseStage();

    stage.run(
      inputWith({ "countries.yaml": "- id: uk" }, { countryFiles: ["countries.yaml"] }) as never,
      new AbortController().signal,
      collector as never,
    );

    expect(errors.map(([code]) => code)).toEqual(["YAML-NOT-ALLOWED"]);
    expect(errors[0]?.[1]).toContain("internationalization");
  });

  it("parses the localization catalogue through the dedicated loader", () => {
    const stage = new ParseStage();

    const result = stage.run(
      inputWith(
        {
          "ui/en-US.json": `
{
  "locale": "en-US",
  "strings": {
    "greeting": "Hello"
  }
}
`,
        },
        { uiFiles: ["ui/en-US.json"] },
      ) as never,
      new AbortController().signal,
      collector as never,
    );

    expect(errors).toEqual([]);
    expect(result?.objectDocs.get("ui")).toEqual({
      locale: "en-US",
      strings: { greeting: "Hello" },
    });
  });

  it("reports malformed JSON instead of reading it as a document", () => {
    const stage = new ParseStage();

    stage.run(
      inputWith({ "countries.json": "{" }, { countryFiles: ["countries.json"] }) as never,
      new AbortController().signal,
      collector as never,
    );

    expect(errors.map(([code]) => code)).toEqual(["JSON-PARSE"]);
  });

  it("rejects a file that is neither a loaded module, JSON nor the catalogue", () => {
    const stage = new ParseStage();

    stage.run(
      inputWith({ "countries.txt": "uk" }, { countryFiles: ["countries.txt"] }) as never,
      new AbortController().signal,
      collector as never,
    );

    expect(errors.map(([code]) => code)).toEqual(["FILE-FORMAT"]);
  });

  it("returns undefined when aborted", () => {
    const controller = new AbortController();
    controller.abort();

    const stage = new ParseStage();

    const result = stage.run(
      inputWith({ "manifest.json": "{}" }) as never,
      controller.signal,
      collector as never,
    );

    expect(result).toBeUndefined();
  });

  it("reports a file absent from the in-memory content map", () => {
    const stage = new ParseStage();

    const input = inputWith({}, { countryFiles: ["countries.json"] });
    stage.run(input as never, new AbortController().signal, collector as never);

    expect(errors[0]?.[0]).toBe("FILE-READ");
    expect(errors[0]?.[1]).toContain("countries.json");
    expect(errors[0]?.[1]).toContain("absent from the compiler input");
  });

  it("reports the cause of a file that could not be read instead of calling it absent", () => {
    const stage = new ParseStage();

    const input = inputWith(
      {},
      {
        countryFiles: ["countries.json"],
        fileReadFailures: { "countries.json": "EACCES: permission denied" },
      },
    );
    stage.run(input as never, new AbortController().signal, collector as never);

    expect(errors[0]?.[0]).toBe("FILE-READ");
    expect(errors[0]?.[1]).toContain("countries.json");
    expect(errors[0]?.[1]).toContain("EACCES: permission denied");
    expect(errors[0]?.[1]).not.toContain("absent from the compiler input");
  });
});
