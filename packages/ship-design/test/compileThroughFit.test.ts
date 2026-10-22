import { describe, expect, it } from "vite-plus/test";
import {
  compileDesignThroughFit,
  compileThroughFit,
  type DesignDraft,
  type FitResult,
  type ShipContext,
} from "../src/index.js";

const fit = (status: FitResult["status"]): FitResult => ({
  status,
  platform: "p",
  month: "1885-06",
  findings:
    status === "REJECTED"
      ? [
          {
            code: "FIT_COUNT_EXCEEDED",
            path: "entries/deck.funnel/funnel_a#1",
            slot: "deck.funnel",
            part: "funnel_a",
            detail: { total: 5, max: 4 },
            message: "too many",
          },
        ]
      : [],
  dataIssues:
    status === "NOT_EVALUABLE"
      ? [
          {
            code: "FIT_DATA_UNKNOWN_PLATFORM",
            path: "platform",
            detail: {},
            message: "no platform",
          },
        ]
      : [],
  waivers: [],
  unresolved: [],
});

describe("compileDesignThroughFit", () => {
  const draft = {} as DesignDraft;
  const ctx = {} as ShipContext;

  it("does not derive anything for a rejected loadout", () => {
    let derived = false;
    const out = compileDesignThroughFit(
      draft,
      ctx,
      () => fit("REJECTED"),
      () => {
        derived = true;
        throw new Error("must not derive");
      },
    );
    expect(derived).toBe(false);
    expect(out.status).toBe("REJECTED");
    if (out.status === "ACCEPTED") throw new Error("unreachable");
    expect(out.findings.map((f) => f.id)).toEqual(["FIT_COUNT_EXCEEDED"]);
    expect(out.findings[0]?.severity).toBe("BLOCKING");
    expect("compiled" in out).toBe(false);
  });

  it("reports data issues as blocking findings and still derives nothing", () => {
    const out = compileDesignThroughFit(
      draft,
      ctx,
      () => fit("NOT_EVALUABLE"),
      () => {
        throw new Error("must not derive");
      },
    );
    expect(out.status).toBe("NOT_EVALUABLE");
    if (out.status === "ACCEPTED") throw new Error("unreachable");
    expect(out.findings.map((f) => f.id)).toEqual(["FIT_DATA_UNKNOWN_PLATFORM"]);
  });

  it("derives once for an accepted loadout", () => {
    const out = compileDesignThroughFit(
      draft,
      ctx,
      () => fit("ACCEPTED"),
      () =>
        ({
          marker: 1,
        }) as never,
    );
    expect(out.status).toBe("ACCEPTED");
  });
});

describe("compileThroughFit", () => {
  it("fits a loadout with no draft and derives only when accepted", () => {
    let derived = 0;
    const rejected = compileThroughFit(
      () => fit("REJECTED"),
      () => {
        derived += 1;
        throw new Error("must not derive");
      },
    );
    expect(rejected.status).toBe("REJECTED");
    expect(derived).toBe(0);
    const accepted = compileThroughFit(
      () => fit("ACCEPTED"),
      () => {
        derived += 1;
        return { marker: 1 } as never;
      },
    );
    expect(accepted.status).toBe("ACCEPTED");
    expect(derived).toBe(1);
  });
});
