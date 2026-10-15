import { describe, expect, it } from "vite-plus/test";
import { withModernExtensionApi } from "./extensionSession.js";

function makeSession() {
  const calls: string[] = [];
  const session = {
    extensions: {
      getAllExtensions(): readonly unknown[] {
        calls.push("modern.getAllExtensions");
        return ["modern"];
      },
      loadExtension(path: string): unknown {
        calls.push("modern.loadExtension");
        return `modern:${path}`;
      },
    },
    getAllExtensions(): readonly unknown[] {
      calls.push("legacy.getAllExtensions");
      return ["legacy"];
    },
    loadExtension(path: string): unknown {
      calls.push("legacy.loadExtension");
      return `legacy:${path}`;
    },
    describedBy(): boolean {
      return this === session;
    },
  };
  return { calls, session };
}

describe("withModernExtensionApi", () => {
  it("routes getAllExtensions and loadExtension to the modern API", () => {
    const { calls, session } = makeSession();
    const proxied = withModernExtensionApi(session);

    expect(proxied.getAllExtensions()).toEqual(["modern"]);
    expect(proxied.loadExtension("/ext")).toBe("modern:/ext");
    expect(calls).toEqual(["modern.getAllExtensions", "modern.loadExtension"]);
  });

  it("delegates other members, bound to the real session", () => {
    const { session } = makeSession();
    const proxied = withModernExtensionApi(session);

    expect(proxied.describedBy()).toBe(true);
  });
});
