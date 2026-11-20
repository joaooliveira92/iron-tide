import { readFileSync } from "node:fs";

import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { decodeReplayFile, serializeReplayFile } from "../src/replay-corpus/index.js";

const fixture = readFileSync(
  new URL("../../../golden/replays/production-1880-6m-fleet-commands.replay.json", import.meta.url),
  "utf8",
);

function withTradeDuty(body: Record<string, unknown>): string {
  const file = JSON.parse(fixture);
  const template = file.months[0].commands[0];
  file.months[0].commands = [
    { ...template, commandId: "trade-duty-1", idempotencyKey: "ik-trade-duty-1", body },
  ];
  return JSON.stringify(file);
}

const validBody = {
  type: "SetTradeDuty",
  nationId: "united_kingdom",
  shipIds: ["gbr_hms_a", "gbr_hms_b"],
  duty: "TRADE_PROTECTION",
};

describe("replay format: SetTradeDuty command body", () => {
  it.each(["TRADE_PROTECTION", "RAIDER", "NONE"])("accepts the %s duty", (duty) => {
    const decoded = decodeReplayFile(withTradeDuty({ ...validBody, duty }));
    if (Result.isFailure(decoded)) throw new Error(decoded.failure.message);
    expect(decoded.success.months[0]!.commands[0]!.body).toEqual({ ...validBody, duty });
  });

  it("round-trips a recorded SetTradeDuty envelope through serialisation", () => {
    const decoded = decodeReplayFile(withTradeDuty(validBody));
    if (Result.isFailure(decoded)) throw new Error(decoded.failure.message);
    const again = decodeReplayFile(serializeReplayFile(decoded.success));
    if (Result.isFailure(again)) throw new Error(again.failure.message);
    expect(again.success).toEqual(decoded.success);
  });

  it("rejects a duty outside the three trade duties", () => {
    expect(
      Result.isFailure(decodeReplayFile(withTradeDuty({ ...validBody, duty: "PIRACY" }))),
    ).toBe(true);
  });

  it("rejects a missing duty and non-array ship ids", () => {
    const { duty: _duty, ...missing } = validBody;
    expect(Result.isFailure(decodeReplayFile(withTradeDuty(missing)))).toBe(true);
    expect(
      Result.isFailure(decodeReplayFile(withTradeDuty({ ...validBody, shipIds: "gbr_hms_a" }))),
    ).toBe(true);
  });

  it("rejects excess properties on the body", () => {
    expect(Result.isFailure(decodeReplayFile(withTradeDuty({ ...validBody, convoyId: "x" })))).toBe(
      true,
    );
  });
});
