import { describe, expect, it } from "vite-plus/test";

import { canonicalContentPath } from "../src/contentPath.js";
import { safePath } from "../src/index.js";

describe("canonical content paths", () => {
  it("renders a Windows-style relative path with forward slashes", () => {
    expect(safePath(String.raw`ship-building\reference-designs\uk\starters.yaml`)).toBe(
      "ship-building/reference-designs/uk/starters.yaml",
    );
  });

  it("strips a Windows-style content root from an absolute source path", () => {
    const contentDir = String.raw`C:\Users\runner\AppData\Local\Temp\bw-pack`;
    const file = String.raw`C:\Users\runner\AppData\Local\Temp\bw-pack\ship-building\reference-designs\uk\starters.yaml`;

    expect(canonicalContentPath(contentDir, file)).toBe(
      "ship-building/reference-designs/uk/starters.yaml",
    );
  });

  it("leaves a content-relative path unchanged", () => {
    expect(
      canonicalContentPath(
        "/home/runner/work/iron-tide/iron-tide/content/production/1880",
        "ship-building/components.yaml",
      ),
    ).toBe("ship-building/components.yaml");
  });
});
