import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { authoredCatalogue } from "../../shared/authoredCatalogue.testing.js";
import { resolveMessage, setUiCatalogue } from "./uiCatalogue.js";

const EVENTS_PATH = resolve(
  process.cwd(),
  "../..",
  "content",
  "production",
  "1880",
  "construction-events.ts",
);

const TEMPLATE_KEYS = [
  "messages.construction.delayed.body",
  "messages.construction.overrun.body",
  "construction.cause.line.delay",
  "construction.cause.line.overrun",
  "construction.cause.fallback.delay",
  "construction.cause.fallback.overrun",
  "construction.duration.one",
  "construction.duration.other",
  "construction.unknown.month",
  "construction.unknown.amount",
  "construction.event.payment_default_delayed",
];

describe("construction cause wording lives in the ui catalogue (#584)", () => {
  afterEach(() => setUiCatalogue({ locale: "en-US", strings: {} }));

  const strings = authoredCatalogue().strings;

  it("authors a cause sentence for every catalogue event", () => {
    const keys = [...readFileSync(EVENTS_PATH, "utf8").matchAll(/causeKey: "([^"]+)"/g)].map(
      (match) => match[1] as string,
    );
    expect(keys.length).toBeGreaterThanOrEqual(6);
    for (const key of keys) expect(strings[key], `missing ${key}`).toBeTruthy();
  });

  it("authors both sentence templates and every fallback word", () => {
    for (const key of TEMPLATE_KEYS) expect(strings[key], `missing ${key}`).toBeTruthy();
  });

  it("interpolates the authored line templates", () => {
    setUiCatalogue(authoredCatalogue());
    expect(
      resolveMessage("construction.cause.line.delay", {
        when: "May 1880",
        cause: "weather damage at the yard",
        duration: "2 months",
      }),
    ).toBe("May 1880: weather damage at the yard delayed the build by 2 months");
  });
});
