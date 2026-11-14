import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Effect, Layer, ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { campaignCommandShapes } from "../../shared/campaign-command-descriptors.js";
import { recordRecentPackage } from "../recentPackages.js";
import { runCommandHandler } from "../runtime/commandProgram.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { AppPaths, NativeDialog } from "../runtime/platform.js";
import { withPackageTarget } from "./packageTarget.js";

const TARGETED = ["listCampaigns", "verifyCampaign", "replayCampaign", "recoverCampaign"] as const;

describe("withPackageTarget", () => {
  let root: string;
  let dialogAnswer: string | null;
  let dialogCalls: number;
  let seenDirs: string[];

  const runtime = () =>
    ManagedRuntime.make(
      Layer.mergeAll(
        desktopMainLayer(),
        Layer.succeed(NativeDialog, {
          chooseSaveDirectory: () => Effect.succeed(null),
          choosePackageDirectory: () =>
            Effect.sync(() => {
              dialogCalls += 1;
              return dialogAnswer;
            }),
          chooseCopyDirectory: () => Effect.succeed(null),
        }),
        Layer.succeed(AppPaths, {
          supportDir: () => Effect.succeed(resolve(root, "support")),
          userDataDir: () => Effect.succeed(resolve(root, "userdata")),
          homeDir: root,
          appVersion: () => Effect.succeed("test"),
          platform: "darwin",
          arch: "arm64",
          processId: 1,
        }),
      ),
    );

  const handler = withPackageTarget((saveDir) =>
    Effect.sync(() => {
      seenDirs.push(saveDir);
      return { outcome: "success" as const, value: saveDir, diagnostics: [] };
    }),
  );

  const run = async (payload: { readonly packagePath: string } | undefined) => {
    const rt = runtime();
    try {
      return projectCommandExit(await rt.runPromiseExit(handler(payload)));
    } finally {
      await rt.dispose();
    }
  };

  const approve = (path: string) =>
    recordRecentPackage(resolve(root, "userdata"), {
      path,
      campaignIdentity: "c",
      activeRevision: 0,
      lastOpened: 1,
    });

  beforeEach(() => {
    root = mkdtempSync(resolve(tmpdir(), "bw-package-target-"));
    mkdirSync(resolve(root, "userdata"), { recursive: true });
    dialogAnswer = null;
    dialogCalls = 0;
    seenDirs = [];
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("hands an approved path to the operation without opening the dialog", async () => {
    const pkg = resolve(root, "pkg");
    mkdirSync(pkg);
    approve(pkg);

    const result = await run({ packagePath: pkg });

    expect(result.outcome).toBe("success");
    expect(seenDirs).toEqual([realpathSync(pkg)]);
    expect(dialogCalls).toBe(0);
  });

  it("refuses a path the user never approved", async () => {
    const pkg = resolve(root, "pkg");
    mkdirSync(pkg);

    const result = await run({ packagePath: pkg });

    expect(result.outcome).toBe("error");
    if (result.outcome === "error") expect(result.reason).toBe("PACKAGE_NOT_APPROVED");
    expect(seenDirs).toEqual([]);
    expect(dialogCalls).toBe(0);
  });

  it("reports an approved package that has since disappeared", async () => {
    const pkg = resolve(root, "pkg");
    mkdirSync(pkg);
    approve(pkg);
    const canonical = realpathSync(pkg);
    rmSync(pkg, { recursive: true });

    const result = await run({ packagePath: canonical });

    expect(result.outcome).toBe("error");
    if (result.outcome === "error") expect(result.reason).toBe("PACKAGE_MISSING");
    expect(seenDirs).toEqual([]);
    expect(dialogCalls).toBe(0);
  });

  it("opens the dialog exactly once when no path is given", async () => {
    dialogAnswer = resolve(root, "chosen");

    const result = await run(undefined);

    expect(result.outcome).toBe("success");
    expect(seenDirs).toEqual([dialogAnswer]);
    expect(dialogCalls).toBe(1);
  });

  it("reports a cancelled dialog without running the operation", async () => {
    const result = await run(undefined);

    expect(result.outcome).toBe("rejected");
    if (result.outcome === "rejected") expect(result.reason).toBe("PACKAGE_SELECTION_CANCELLED");
    expect(seenDirs).toEqual([]);
    expect(dialogCalls).toBe(1);
  });
});

describe("package target command payloads", () => {
  const decode = (name: (typeof TARGETED)[number], payload: unknown) => {
    const rt = ManagedRuntime.make(desktopMainLayer());
    const seen: unknown[] = [];
    return rt
      .runPromiseExit(
        runCommandHandler(
          name,
          (received: unknown) => {
            seen.push(received);
            return Effect.succeed({ outcome: "success" as const, value: null, diagnostics: [] });
          },
          payload,
        ),
      )
      .finally(() => rt.dispose())
      .then((exit) => ({ exit, seen }));
  };

  for (const name of TARGETED) {
    it(`${name} accepts no payload or a package path and rejects extra properties`, async () => {
      expect(campaignCommandShapes[name].strict).toBe(true);
      expect((await decode(name, undefined)).seen).toEqual([undefined]);
      expect((await decode(name, { packagePath: "/p" })).seen).toEqual([{ packagePath: "/p" }]);
      const extra = await decode(name, { packagePath: "/p", extra: true });
      expect(extra.exit._tag).toBe("Failure");
      expect(extra.seen).toEqual([]);
    });
  }
});
