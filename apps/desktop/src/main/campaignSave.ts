import { SaveStore } from "@bluewave/persistence";
import { Effect, Result } from "effect";
import type { LoadSaveResult } from "./campaignSaveSchema.js";

function mapsToPlainObjects(value: unknown): unknown {
  if (value instanceof Map) {
    const obj: Record<string, unknown> = {};
    for (const [key, entry] of value) {
      obj[key] = mapsToPlainObjects(entry);
    }
    return obj;
  }
  if (Array.isArray(value)) {
    return value.map((item) => mapsToPlainObjects(item));
  }
  if (value !== null && typeof value === "object") {
    const obj: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      obj[key] = mapsToPlainObjects(entry);
    }
    return obj;
  }
  return value;
}

export function loadCampaignSave(saveDir: string): LoadSaveResult {
  try {
    const store = new SaveStore();
    const loaded = Effect.runSync(Effect.result(store.load(saveDir)));

    if (Result.isFailure(loaded)) {
      const diagnostic = loaded.failure.toDiagnostic();
      return {
        success: false,
        diagnostics: [
          {
            code: diagnostic.code ?? "UNKNOWN",
            severity: diagnostic.severity,
            message: diagnostic.message,
          },
        ],
      };
    }

    return {
      success: true,
      snapshot: mapsToPlainObjects(loaded.success.state.snapshot) as Record<string, unknown>,
      envelope: { ...loaded.success.state.envelope },
      rawHash: loaded.success.state.rawHash,
      diagnostics: loaded.success.warnings.map((d) => ({
        code: d.code ?? "UNKNOWN",
        severity: d.severity,
        message: d.message,
      })),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      diagnostics: [{ code: "LOAD_SAVE_ERROR", severity: "error", message }],
    };
  }
}
