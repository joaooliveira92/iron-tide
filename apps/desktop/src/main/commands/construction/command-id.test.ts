import { describe, expect, it } from "vite-plus/test";
import { deriveConstructionCommandId } from "./command-id.js";

describe("deriveConstructionCommandId", () => {
  it("is deterministic for the same transportRequestId, design and revision", () => {
    expect(deriveConstructionCommandId("tx-1", "des_gbr_inflexible", 0)).toBe(
      deriveConstructionCommandId("tx-1", "des_gbr_inflexible", 0),
    );
  });

  it("formats as cmd-<transportRequestId>-<8 hex fingerprint>", () => {
    expect(deriveConstructionCommandId("tx-1", "des_gbr_inflexible", 0)).toMatch(
      /^cmd-tx-1-[0-9a-f]{8}$/,
    );
  });

  it("changes when the designId changes, so a reused requestId conflicts instead of silently re-serving", () => {
    expect(deriveConstructionCommandId("tx-1", "des_a", 0)).not.toBe(
      deriveConstructionCommandId("tx-1", "des_b", 0),
    );
  });

  it("changes when the expectedRevision changes", () => {
    expect(deriveConstructionCommandId("tx-1", "des_a", 0)).not.toBe(
      deriveConstructionCommandId("tx-1", "des_a", 1),
    );
  });
});
