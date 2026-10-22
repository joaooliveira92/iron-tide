import { Result, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_APP_PREFERENCES,
  PREFERENCES_SCHEMA_VERSION,
  TEXT_SCALE_MAX,
  TEXT_SCALE_MIN,
  type AppPreferences,
} from "../../shared/preferences-contract.js";
import {
  AppPreferencesSchema,
  PreferencesFileSchema,
  WriteAppPreferencesRequestSchema,
  type AppPreferencesDecoded,
} from "./preferencesSchema.js";

function sharedToDecoded(value: AppPreferences): AppPreferencesDecoded {
  return value;
}
function decodedToShared(value: AppPreferencesDecoded): AppPreferences {
  return value;
}

const decodeApp = Schema.decodeUnknownResult(AppPreferencesSchema, {
  onExcessProperty: "error",
});
const decodeFile = Schema.decodeUnknownResult(PreferencesFileSchema, {
  onExcessProperty: "error",
});
const decodeWrite = Schema.decodeUnknownResult(WriteAppPreferencesRequestSchema, {
  onExcessProperty: "error",
});

describe("preferences schema", () => {
  it("binds the shared contract to the schema decoded type in both directions", () => {
    expect(sharedToDecoded(DEFAULT_APP_PREFERENCES)).toEqual(DEFAULT_APP_PREFERENCES);

    const decoded = decodeApp(DEFAULT_APP_PREFERENCES);
    expect(Result.isSuccess(decoded)).toBe(true);
    if (Result.isSuccess(decoded)) {
      expect(decodedToShared(decoded.success)).toEqual(DEFAULT_APP_PREFERENCES);
    }
  });

  it("decodes the frozen defaults through the file schema and deep-equals them", () => {
    const decoded = decodeFile({
      version: PREFERENCES_SCHEMA_VERSION,
      app: DEFAULT_APP_PREFERENCES,
    });
    expect(Result.isSuccess(decoded)).toBe(true);
    if (Result.isSuccess(decoded)) {
      expect(decoded.success.app).toEqual(DEFAULT_APP_PREFERENCES);
      expect(decoded.success.version).toBe(PREFERENCES_SCHEMA_VERSION);
    }
  });

  it("rejects an unknown key at the app and file level", () => {
    const app = decodeApp({ ...DEFAULT_APP_PREFERENCES, highContrast: true });
    expect(Result.isFailure(app)).toBe(true);

    const file = decodeFile({
      version: PREFERENCES_SCHEMA_VERSION,
      app: DEFAULT_APP_PREFERENCES,
      scope: "app",
    });
    expect(Result.isFailure(file)).toBe(true);

    const write = decodeWrite({ app: DEFAULT_APP_PREFERENCES, extra: 1 });
    expect(Result.isFailure(write)).toBe(true);
  });

  it("rejects an out-of-range or non-integer textScale", () => {
    expect(
      Result.isFailure(decodeApp({ ...DEFAULT_APP_PREFERENCES, textScale: TEXT_SCALE_MIN - 1 })),
    ).toBe(true);
    expect(
      Result.isFailure(decodeApp({ ...DEFAULT_APP_PREFERENCES, textScale: TEXT_SCALE_MAX + 1 })),
    ).toBe(true);
    expect(Result.isFailure(decodeApp({ ...DEFAULT_APP_PREFERENCES, textScale: 100.5 }))).toBe(
      true,
    );
    expect(Result.isFailure(decodeApp({ ...DEFAULT_APP_PREFERENCES, textScale: "large" }))).toBe(
      true,
    );
  });

  it("accepts the boundary text-scale values", () => {
    expect(
      Result.isSuccess(decodeApp({ ...DEFAULT_APP_PREFERENCES, textScale: TEXT_SCALE_MIN })),
    ).toBe(true);
    expect(
      Result.isSuccess(decodeApp({ ...DEFAULT_APP_PREFERENCES, textScale: TEXT_SCALE_MAX })),
    ).toBe(true);
  });

  it("accepts highContrast and still rejects unknown values", () => {
    expect(Result.isSuccess(decodeApp({ ...DEFAULT_APP_PREFERENCES, theme: "highContrast" }))).toBe(
      true,
    );
    expect(Result.isFailure(decodeApp({ ...DEFAULT_APP_PREFERENCES, font: "comic-sans" }))).toBe(
      true,
    );
    expect(
      Result.isFailure(decodeApp({ ...DEFAULT_APP_PREFERENCES, background: "hologram" })),
    ).toBe(true);
  });

  it("has no customCurrency in the currency-display union and no fallback-status value", () => {
    expect(
      Result.isFailure(
        decodeApp({ ...DEFAULT_APP_PREFERENCES, currencyDisplayMode: "customCurrency" }),
      ),
    ).toBe(true);
    expect(
      Result.isFailure(decodeApp({ ...DEFAULT_APP_PREFERENCES, currencyDisplayMode: "fallback" })),
    ).toBe(true);
    expect(
      Result.isSuccess(
        decodeApp({ ...DEFAULT_APP_PREFERENCES, currencyDisplayMode: "nationalHistorical" }),
      ),
    ).toBe(true);
  });

  it("rejects a non-object version and a nested measurementSelections with a non-string value", () => {
    expect(Result.isFailure(decodeFile({ version: 2, app: DEFAULT_APP_PREFERENCES }))).toBe(true);
    expect(
      Result.isFailure(
        decodeApp({
          ...DEFAULT_APP_PREFERENCES,
          measurementSelections: { speed: 12 },
        }),
      ),
    ).toBe(true);
  });
});
