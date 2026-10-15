import { describe, expect, it } from "vite-plus/test";
import { parseColor, resolveSettings } from "./pattern-waves.js";

describe("parseColor", () => {
  it("parses six-digit and three-digit hex into normalized rgba", () => {
    expect(parseColor("#ff0000", [0, 0, 0, 1])).toEqual([1, 0, 0, 1]);
    expect(parseColor("#0f0", [0, 0, 0, 1])).toEqual([0, 1, 0, 1]);
  });

  it("reads the alpha channel of an eight-digit hex", () => {
    expect(parseColor("#00000080", [1, 1, 1, 1])).toEqual([0, 0, 0, 128 / 255]);
  });

  it("parses rgb() and rgba() functional colors", () => {
    expect(parseColor("rgb(255, 0, 0)", [0, 0, 0, 1])).toEqual([1, 0, 0, 1]);
    expect(parseColor("rgba(0, 0, 0, 0.5)", [1, 1, 1, 1])).toEqual([0, 0, 0, 0.5]);
  });

  it("falls back for unparseable input", () => {
    expect(parseColor("not-a-color", [0.1, 0.2, 0.3, 1])).toEqual([0.1, 0.2, 0.3, 1]);
  });
});

describe("resolveSettings", () => {
  it("defaults to the silk preset", () => {
    const settings = resolveSettings({});
    expect(settings.pattern).toBe("dot");
    expect(settings.wave).toBe("silk");
    expect(settings.spacing).toBe(9);
    expect(settings.fade).toBe("edges");
    expect(settings.opacity).toBe(1);
    expect(settings.interactive).toBe(true);
    expect(settings.color).toEqual([1, 1, 1, 1]);
    expect(settings.background).toEqual([0, 0, 0, 1]);
  });

  it("lets explicit props override the preset while keeping the rest", () => {
    const settings = resolveSettings({ preset: "ocean", spacing: 42, paused: true });
    expect(settings.spacing).toBe(42);
    expect(settings.wave).toBe("swell");
    expect(settings.direction).toBe(100);
    expect(settings.paused).toBe(true);
  });

  it("ignores nullish overrides and keeps the preset value", () => {
    const settings = resolveSettings({ preset: "lines", pattern: undefined });
    expect(settings.pattern).toBe("line");
    expect(settings.markSize).toBe(0.42);
  });
});
