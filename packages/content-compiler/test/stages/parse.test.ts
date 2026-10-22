import { describe, expect, it, vi, beforeEach } from "vite-plus/test";

vi.mock("@bluewave/content-schema", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  parseYamlSafe: vi.fn(),
}));

import { parseYamlSafe } from "@bluewave/content-schema";
import { ParseStage } from "@bluewave/content-compiler";

function inputWith(files: Record<string, string>, extra: Record<string, unknown> = {}) {
  return {
    contentDir: "/content",
    manifestPath: "manifest.yaml",
    fileContents: files,
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

describe("ParseStage", () => {
  const collector = {
    addError: vi.fn(),
    hasErrors: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses the manifest and collection documents from the input's content map", () => {
    vi.mocked(parseYamlSafe)
      .mockReturnValueOnce({
        success: true,
        data: { id: "manifest" },
      })
      .mockReturnValueOnce({
        success: true,
        data: [{ id: "country-1" }],
      });

    const stage = new ParseStage();

    const result = stage.run(
      inputWith(
        { "manifest.yaml": "manifest", "countries.yaml": "countries" },
        {
          countryFiles: ["countries.yaml"],
        },
      ) as never,
      new AbortController().signal,
      collector as never,
    );

    expect(result?.manifest).toEqual({ id: "manifest" });
    expect(result?.collectionDocs.get("countries")).toEqual([{ id: "country-1" }]);
  });

  it("returns undefined when aborted", () => {
    const controller = new AbortController();
    controller.abort();

    const stage = new ParseStage();

    const result = stage.run(
      inputWith({ "manifest.yaml": "manifest" }) as never,
      controller.signal,
      collector as never,
    );

    expect(result).toBeUndefined();
  });

  it("reports a file absent from the in-memory content map", () => {
    const stage = new ParseStage();

    stage.run(inputWith({}) as never, new AbortController().signal, collector as never);

    expect(collector.addError).toHaveBeenCalledWith(
      "FILE-READ",
      expect.stringContaining("manifest.yaml"),
      expect.any(Object),
    );
  });
});
