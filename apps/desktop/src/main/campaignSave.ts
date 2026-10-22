import { SaveStore } from "@bluewave/persistence";
import { DiagnosticCollector } from "@bluewave/diagnostics";
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
    const collector = new DiagnosticCollector();
    const state = store.load(saveDir, collector);

    if (!state) {
      const diagnostics: LoadSaveResult["diagnostics"] = [];
      for (const d of collector.all) {
        diagnostics.push({ code: d.code ?? "UNKNOWN", severity: d.severity, message: d.message });
      }
      return { success: false, diagnostics };
    }

    return {
      success: true,
      snapshot: mapsToPlainObjects(state.snapshot) as Record<string, unknown>,
      envelope: { ...state.envelope },
      rawHash: state.rawHash,
      diagnostics: [],
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      diagnostics: [{ code: "LOAD_SAVE_ERROR", severity: "error", message }],
    };
  }
}
