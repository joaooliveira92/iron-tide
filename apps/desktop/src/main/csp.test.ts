import { describe, expect, it } from "vite-plus/test";
import {
  applyContentSecurityPolicy,
  CONTENT_SECURITY_POLICY,
  DEV_CONTENT_SECURITY_POLICY,
} from "./csp.js";

const directives = (policy: string): Map<string, string> =>
  new Map(
    policy.split(";").map((part) => {
      const [name = "", ...sources] = part.trim().split(/\s+/u);
      return [name, sources.join(" ")];
    }),
  );

describe("production content security policy", () => {
  const policy = directives(CONTENT_SECURITY_POLICY);

  it("allows no script source beyond the app itself", () => {
    expect(policy.get("script-src")).toBe("'self'");
    expect(CONTENT_SECURITY_POLICY).not.toContain("unsafe-eval");
    expect(CONTENT_SECURITY_POLICY).not.toContain("localhost");
    expect(CONTENT_SECURITY_POLICY).not.toContain("ws:");
  });

  it("confines the one inline allowance to styles", () => {
    const withInline = [...policy].filter(([, sources]) => sources.includes("'unsafe-inline'"));
    expect(withInline.map(([name]) => name)).toEqual(["style-src"]);
  });

  it("locks the directives that default-src does not cover", () => {
    expect(policy.get("object-src")).toBe("'none'");
    expect(policy.get("base-uri")).toBe("'none'");
    expect(policy.get("form-action")).toBe("'none'");
    expect(policy.get("frame-ancestors")).toBe("'none'");
  });
});

describe("development content security policy", () => {
  it("keeps the dev-server allowances and the same locked directives", () => {
    const dev = directives(DEV_CONTENT_SECURITY_POLICY);
    expect(dev.get("script-src")).toContain("http://localhost:5173");
    expect(dev.get("base-uri")).toBe("'none'");
    expect(dev.get("frame-ancestors")).toBe("'none'");
  });
});

describe("applyContentSecurityPolicy", () => {
  it("replaces any existing policy header and keeps other headers", () => {
    const headers = applyContentSecurityPolicy({ "X-Other": ["1"] });
    expect(headers["X-Other"]).toEqual(["1"]);
    expect(headers["Content-Security-Policy"]).toEqual([CONTENT_SECURITY_POLICY]);
  });

  it("selects the development policy only when asked", () => {
    expect(applyContentSecurityPolicy(undefined, true)["Content-Security-Policy"]).toEqual([
      DEV_CONTENT_SECURITY_POLICY,
    ]);
  });
});
