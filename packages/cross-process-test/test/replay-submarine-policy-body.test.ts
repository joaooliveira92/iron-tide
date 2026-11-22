import { readFileSync } from "node:fs";

import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { decodeReplayFile, serializeReplayFile } from "../src/replay-corpus/index.js";

const fixture = readFileSync(
  new URL("../../../golden/replays/production-1880-6m-fleet-commands.replay.json", import.meta.url),
  "utf8",
);

function withBody(body: Record<string, unknown>): string {
  const file = JSON.parse(fixture);
  const template = file.months[0].commands[0];
  file.months[0].commands = [
    { ...template, commandId: "sub-policy-1", idempotencyKey: "ik-sub-policy-1", body },
  ];
  return JSON.stringify(file);
}

const validBody = {
  type: "SetSubmarinePolicy",
  nationId: "united_kingdom",
  policy: "UNRESTRICTED",
};

describe("replay format: SetSubmarinePolicy command body", () => {
  it.each(["PRIZE_RULES", "UNRESTRICTED"])("accepts the %s policy", (policy) => {
    const decoded = decodeReplayFile(withBody({ ...validBody, policy }));
    if (Result.isFailure(decoded)) throw new Error(decoded.failure.message);
    expect(decoded.success.months[0]!.commands[0]!.body).toEqual({ ...validBody, policy });
  });

  it("round-trips through serialisation", () => {
    const decoded = decodeReplayFile(withBody(validBody));
    if (Result.isFailure(decoded)) throw new Error(decoded.failure.message);
    const again = decodeReplayFile(serializeReplayFile(decoded.success));
    if (Result.isFailure(again)) throw new Error(again.failure.message);
    expect(again.success).toEqual(decoded.success);
  });

  it("rejects an unknown policy, a missing policy and excess properties", () => {
    expect(
      Result.isFailure(decodeReplayFile(withBody({ ...validBody, policy: "FLEET_SUPPORT" }))),
    ).toBe(true);
    const { policy: _policy, ...missing } = validBody;
    expect(Result.isFailure(decodeReplayFile(withBody(missing)))).toBe(true);
    expect(Result.isFailure(decodeReplayFile(withBody({ ...validBody, extra: 1 })))).toBe(true);
  });
});
