import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { sep } from "node:path";
import { SafeInt } from "@bluewave/contracts";

const fsMocks = vi.hoisted(() => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  rmSync: vi.fn(),
}));
vi.mock("node:fs", () => fsMocks);

const detMocks = vi.hoisted(() => ({
  canonicalSerialize: vi.fn((v: any) => JSON.stringify(v)),
  sha256Hex: vi.fn((s: string) => `hash-${s.length}-${s.slice(0, 4)}`),
  createEnvelope: vi.fn((kind: string, ver: string, body: any) => ({
    algorithm: "sha256",
    artifactKind: kind,
    compatibilityVersion: ver,
    bodyHash: `bh-${JSON.stringify(body).length}`,
    bodyLength: JSON.stringify(body).length,
  })),
  verifyEnvelope: vi.fn(() => true),
}));
vi.mock("@bluewave/deterministic", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...detMocks,
}));

const compilerMock = vi.hoisted(() => ({ compile: vi.fn() }));
const contentSurfaceMocks = vi.hoisted(() => ({
  buildFullSurfaceInput: vi.fn(),
  buildContentBundleArtifact: vi.fn(),
}));
vi.mock("@bluewave/content-compiler", () => ({
  Compiler: class {
    compile = compilerMock.compile;
  },
  buildFullSurfaceInput: contentSurfaceMocks.buildFullSurfaceInput,
  buildContentBundleArtifact: contentSurfaceMocks.buildContentBundleArtifact,
}));

const campaignMocks = vi.hoisted(() => ({ compile: vi.fn() }));
vi.mock("@bluewave/campaign", async (importOriginal) => {
  const a: any = await importOriginal();
  return {
    ...a,
  };
});

vi.mock("@bluewave/campaign/compiler", () => ({
  CampaignCompiler: class {
    compile = campaignMocks.compile;
  },
}));

const saveStoreMocks = vi.hoisted(() => ({
  save: vi.fn(() => ({
    metadata: { saveId: "save-1" },
    savePath: "/saves/save-1/state.json",
    hash: "h1",
  })),
  load: vi.fn(),
  loadById: vi.fn(),
  getActiveSaveId: vi.fn<(saveDir: string) => string | null>(() => "save-1"),
  getPreviousSaveId: vi.fn<(saveDir: string) => string | null>(() => "save-0"),
}));
vi.mock("@bluewave/persistence", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  SaveStore: class {
    save = saveStoreMocks.save;
    load = saveStoreMocks.load;
    loadById = saveStoreMocks.loadById;
    getActiveSaveId = saveStoreMocks.getActiveSaveId;
    getPreviousSaveId = saveStoreMocks.getPreviousSaveId;
  },
  CURRENT_COMPATIBILITY_VERSION: "2.0.0",
}));

const phaseMocks = vi.hoisted(() => ({
  execute: vi.fn(),
  verify: vi.fn(),
}));
vi.mock("@bluewave/phase-engine", () => ({
  MonthExecutor: class {
    execute = phaseMocks.execute;
  },
  ReplayVerifier: class {
    verify = phaseMocks.verify;
  },
}));

import {
  runValidate,
  runCompile,
  runInspect,
  runVerify,
  runCompare,
  runCampaignCompile,
  runCampaignSave,
  runCampaignLoad,
  runTurnExecute,
  runReplay,
  safePath,
} from "../src/commands.js";
import { runCli } from "./runCli.js";

function stdoutSpy() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true as any);
}

const validManifest = JSON.stringify({
  files: {
    rulesets: ["r.yaml"],
    countries: ["c.yaml"],
    areas: [],
    routes: [],
    possessions: [],
    ports: [],
    technologies: [],
  },
});

const campaignSnapshot: any = {
  version: "0.1.0",
  turnNumber: SafeInt(1),
  campaignId: "c1",
  slots: [{ nationId: "GBR", type: "playable" }],
  world: { areas: [{ id: "a1" }], routes: [], ports: [] },
  nations: new Map(),
  wars: { wars: [], battles: [] },
  politics: { relations: [], shells: {} },
  intelligence: { shells: {} },
  rulesetVersion: "0.1.0",
  compatibilityVersion: "0.1.0",
};

const storableCampaignState: any = {
  snapshot: {
    version: "0.1.0",
    turnNumber: 1,
    campaignId: "c1",
    startYear: 1880,
    startMonth: 1,
    slots: [{ nationId: "GBR", type: "playable" }],
    world: { areas: [{ id: "a1" }], routes: [], ports: [] },
    nations: {},
    wars: {
      wars: [],
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    },
    politics: { relations: [], shells: {} },
    intelligence: { shells: {} },
    designs: {},
    designFamilies: {},
    strategicWeather: [],
    prestigeRules: {
      lowerBound: 0,
      upperBound: 100,
      sackingThreshold: 10,
      sackingProbabilityBp: 2500,
      rules: {
        UNPAID_FUNDS: { kind: "PROPORTIONAL_LOSS", basisPoints: 300 },
        BATTLE_LOST: { kind: "PROPORTIONAL_LOSS", basisPoints: 500 },
        BATTLE_WON: { kind: "FIXED_GAIN", amount: 1 },
      },
    },
    rulesetVersion: "0.1.0",
    compatibilityVersion: "0.1.0",
  },
  envelope: {
    algorithm: "sha256",
    artifactKind: "campaign-state",
    compatibilityVersion: "0.1.0",
    bodyHash: "bh",
    bodyLength: 2,
  },
  rawHash: "rh",
};

beforeEach(() => {
  vi.clearAllMocks();
  detMocks.canonicalSerialize.mockImplementation((v: any) => JSON.stringify(v));
  detMocks.sha256Hex.mockImplementation((s: string) => `hash-${s.length}-${s.slice(0, 4)}`);
  detMocks.createEnvelope.mockImplementation((k, ver, body) => ({
    algorithm: "sha256",
    artifactKind: k,
    compatibilityVersion: ver,
    bodyHash: `bh-${JSON.stringify(body).length}`,
    bodyLength: JSON.stringify(body).length,
  }));
  detMocks.verifyEnvelope.mockReturnValue(true);
  fsMocks.existsSync.mockReturnValue(true);
  fsMocks.readFileSync.mockReturnValue(validManifest);
  fsMocks.writeFileSync.mockReturnValue(undefined);
  fsMocks.mkdirSync.mockReturnValue(undefined);
  fsMocks.rmSync.mockReturnValue(undefined);
  compilerMock.compile.mockReturnValue({
    pack: { manifest: { id: "m" } },
    rawHash: "rh",
    envelopeHash: "eh",
  });
  contentSurfaceMocks.buildFullSurfaceInput.mockReturnValue({
    manifestPath: "/tmp/pack.json",
    contentDir: "/tmp/c",
  });
  contentSurfaceMocks.buildContentBundleArtifact.mockReturnValue({
    bundle: {
      generatedBy: "x",
      manifest: { name: "m" },
      rulesets: [],
      nations: [],
      areas: [],
      routes: [],
      possessions: [],
      ports: [],
      technologies: [],
      campaign: {
        fleets: [],
        economies: [],
        constructions: [],
        diplomacy: [],
        research: [],
        designs: [],
      },
    },
    envelope: { algorithm: "sha256", bodyHash: "bh" },
    manifest: { bodyHash: "bh" },
    contentVersion: "0.4.0",
    artifactJson: "",
    manifestJson: "",
  });
  campaignMocks.compile.mockReturnValue({
    state: { snapshot: campaignSnapshot, rawHash: "rh", envelope: { bodyHash: "eh" } },
    contentHash: "ch",
  } as any);
  phaseMocks.execute.mockReturnValue({
    success: true,
    finalSnapshot: campaignSnapshot,
    commandLedger: { all: [], hash: () => "cmd-h" },
    eventLedger: { hash: () => "ev-h" },
    randomLedger: { hash: () => "rand-h" },
    financialLedger: { hash: () => "fin-h" },
  });
  phaseMocks.verify.mockReturnValue({
    match: true,
    mismatches: [],
    steps: [{ match: true }],
    replayedFinalHash: "rh",
    originalFinalHash: "rh",
  });
  saveStoreMocks.load.mockReturnValue({
    snapshot: campaignSnapshot,
    envelope: { bodyHash: "eh" },
    rawHash: "rh",
  } as any);
  saveStoreMocks.loadById.mockReturnValue({
    snapshot: campaignSnapshot,
    envelope: { bodyHash: "eh" },
    rawHash: "rh",
  } as any);
  saveStoreMocks.getActiveSaveId.mockReturnValue("save-1");
  saveStoreMocks.getPreviousSaveId.mockReturnValue("save-0");
});

afterEach(() => vi.restoreAllMocks());

describe("buildInput / safePath via runValidate", () => {
  it("usage-error if manifest not found", async () => {
    fsMocks.existsSync.mockImplementation((p: string) => !String(p).includes("pack.json"));
    expect(
      await runCli(
        runValidate({
          manifest: "/tmp/pack.json",
          contentDir: "/tmp/content",
          outputDir: "/tmp/out",
          outputMode: "human",
        }),
      ),
    ).toBe("usage-error");
  });
  it("usage-error if contentDir not found", async () => {
    fsMocks.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);
    expect(
      await runCli(
        runValidate({
          manifest: "/tmp/pack.json",
          contentDir: "/missing",
          outputDir: "/tmp/out",
          outputMode: "human",
        }),
      ),
    ).toBe("usage-error");
  });
  it("usage-error if manifest JSON invalid", async () => {
    fsMocks.readFileSync.mockReturnValue("{ invalid json");
    expect(
      await runCli(
        runValidate({
          manifest: "/tmp/pack.json",
          contentDir: "/tmp/content",
          outputDir: "/tmp/out",
          outputMode: "human",
        }),
      ),
    ).toBe("usage-error");
  });
  it("throws on path traversal via safePath", () => {
    expect(() => safePath(`..${sep}evil.yaml`)).toThrow(/Path traversal/);
    expect(() => safePath(`a${sep}..${sep}b`)).toThrow(/Path traversal/);
  });
  it("throws on path traversal via buildInput", async () => {
    fsMocks.readFileSync.mockReturnValue(
      JSON.stringify({ files: { rulesets: [`..${sep}evil.yaml`] } }),
    );
    await expect(
      runCli(
        runValidate({
          manifest: "/tmp/pack.json",
          contentDir: "/tmp/content",
          outputDir: "/tmp/out",
          outputMode: "human",
        }),
      ),
    ).rejects.toThrow(/Path traversal/);
  });
  it("maps all 7 file groups with safePath normalize", async () => {
    fsMocks.readFileSync.mockReturnValue(
      JSON.stringify({
        files: {
          rulesets: ["r.yaml"],
          countries: ["c.yaml"],
          areas: ["a.yaml"],
          routes: ["rt.yaml"],
          possessions: ["p.yaml"],
          ports: ["po.yaml"],
          technologies: ["t.yaml"],
        },
      }),
    );
    compilerMock.compile.mockImplementation((input: any) => {
      expect(input.rulesetFiles[0]).toContain("r.yaml");
      expect(input.technologyFiles[0]).toContain("t.yaml");
      expect(input.manifestPath).toContain("pack.json");
      return { pack: {}, rawHash: "a", envelopeHash: "b" };
    });
    await runCli(
      runValidate({
        manifest: "/tmp/pack.json",
        contentDir: "/tmp/content",
        outputDir: "/tmp/out",
        outputMode: "human",
      }),
    );
  });
});

describe("runValidate", () => {
  it("success", async () => {
    const spy = stdoutSpy();
    expect(
      await runCli(
        runValidate({
          manifest: "/tmp/pack.json",
          contentDir: "/tmp/content",
          outputDir: "/tmp/out",
          outputMode: "human",
        }),
      ),
    ).toBe("success");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("Validation passed"));
  });
  it("validation-error when collector hasErrors after compile", async () => {
    compilerMock.compile.mockImplementation((_: any, __: any, c: any) => {
      c.addError("SCHEMA", "dup");
      return undefined;
    });
    expect(
      await runCli(
        runValidate({
          manifest: "/tmp/pack.json",
          contentDir: "/tmp/content",
          outputDir: "/tmp/out",
          outputMode: "json",
        }),
      ),
    ).toBe("validation-error");
  });
  it("compile-error when output undefined no errors", async () => {
    compilerMock.compile.mockReturnValue(undefined);
    expect(
      await runCli(
        runValidate({
          manifest: "/tmp/pack.json",
          contentDir: "/tmp/content",
          outputDir: "/tmp/out",
          outputMode: "human",
        }),
      ),
    ).toBe("compile-error");
  });
  it("json mode prints diagnostics via collector.toJSON", async () => {
    const spy = stdoutSpy();
    compilerMock.compile.mockReturnValue({ pack: {}, rawHash: "x", envelopeHash: "y" });
    await runCli(
      runValidate({
        manifest: "/tmp/pack.json",
        contentDir: "/tmp/content",
        outputDir: "/tmp/out",
        outputMode: "json",
      }),
    );
    expect(spy).toHaveBeenCalled();
  });
});

describe("runCompile", () => {
  it("success human prints artifact+envelope", async () => {
    const spy = stdoutSpy();
    expect(
      await runCli(
        runCompile({
          manifest: "/tmp/pack.json",
          contentDir: "/tmp/content",
          outputDir: "/tmp/out",
          outputMode: "human",
        }),
      ),
    ).toBe("success");
    expect(fsMocks.mkdirSync).toHaveBeenCalledWith(expect.stringContaining("out"), {
      recursive: true,
    });
    expect(fsMocks.writeFileSync).toHaveBeenCalledTimes(4);
    expect(fsMocks.rmSync).toHaveBeenCalledWith(expect.stringContaining(".tmp"), { force: true });
    expect(detMocks.createEnvelope).toHaveBeenCalledWith(
      "content-pack",
      "0.1.0",
      expect.anything(),
    );
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("Compiled successfully"));
  });
  it("success json prints artifactHash", async () => {
    const spy = stdoutSpy();
    await runCli(
      runCompile({
        manifest: "/tmp/pack.json",
        contentDir: "/tmp/content",
        outputDir: "/tmp/out",
        outputMode: "json",
      }),
    );
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("artifactHash"));
  });
  it("validation-error", async () => {
    compilerMock.compile.mockImplementation((_: any, __: any, c: any) => {
      c.addError("REF", "bad");
      return undefined;
    });
    expect(
      await runCli(
        runCompile({
          manifest: "/tmp/pack.json",
          contentDir: "/tmp/content",
          outputDir: "/tmp/out",
          outputMode: "human",
        }),
      ),
    ).toBe("validation-error");
  });
  it("cleans temp even on write throw", async () => {
    fsMocks.writeFileSync.mockImplementationOnce(() => {
      throw new Error("disk");
    });
    await expect(
      runCli(
        runCompile({
          manifest: "/tmp/pack.json",
          contentDir: "/tmp/content",
          outputDir: "/tmp/out",
          outputMode: "human",
        }),
      ),
    ).rejects.toThrow("disk");
    expect(fsMocks.rmSync).toHaveBeenCalled();
  });
});

describe("runInspect / runVerify", () => {
  it("usage-error missing artifact", async () => {
    fsMocks.existsSync.mockReturnValueOnce(false);
    expect(
      await runCli(
        runInspect({
          manifest: "/p",
          contentDir: "/c",
          outputDir: "/tmp/out",
          outputMode: "human",
        }),
      ),
    ).toBe("usage-error");
  });
  it("usage-error missing envelope", async () => {
    fsMocks.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);
    expect(
      await runCli(
        runInspect({
          manifest: "/p",
          contentDir: "/c",
          outputDir: "/tmp/out",
          outputMode: "human",
        }),
      ),
    ).toBe("usage-error");
  });
  it("valid -> success human VALID", async () => {
    const artifact = '{"a":1}';
    detMocks.sha256Hex.mockImplementation((s: string) => `hash-${s}`);
    const hash = `hash-${artifact}`;
    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockImplementation((p: string) => {
      if (String(p).includes("artifact.sig.json"))
        return JSON.stringify({
          algorithm: "sha256",
          artifactKind: "content-pack",
          compatibilityVersion: "0.1.0",
          bodyHash: hash,
          bodyLength: 7,
        });
      if (String(p).includes("artifact.json")) return artifact;
      return validManifest;
    });
    const spy = stdoutSpy();
    expect(
      await runCli(
        runInspect({
          manifest: "/p",
          contentDir: "/c",
          outputDir: "/tmp/out",
          outputMode: "human",
        }),
      ),
    ).toBe("success");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("VALID"));
  });
  it("invalid -> validation-error", async () => {
    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockImplementation((p: string) => {
      if (String(p).includes("artifact.json")) return '{"a":1}';
      if (String(p).includes("artifact.sig.json")) return JSON.stringify({ bodyHash: "different" });
      return validManifest;
    });
    expect(
      await runCli(
        runInspect({
          manifest: "/p",
          contentDir: "/c",
          outputDir: "/tmp/out",
          outputMode: "human",
        }),
      ),
    ).toBe("validation-error");
  });
  it("json mode prints valid payload", async () => {
    const artifact = "{}";
    detMocks.sha256Hex.mockImplementation((s: string) => `hash-${s}`);
    const hash = `hash-${artifact}`;
    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockImplementation((p: string) => {
      if (String(p).includes("artifact.json")) return artifact;
      if (String(p).includes("artifact.sig.json")) return JSON.stringify({ bodyHash: hash });
      return validManifest;
    });
    const spy = stdoutSpy();
    await runCli(
      runInspect({ manifest: "/p", contentDir: "/c", outputDir: "/tmp/out", outputMode: "json" }),
    );
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("valid"));
  });
  it("internal-error on read throw", async () => {
    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockImplementation(() => {
      throw new Error("io");
    });
    expect(
      await runCli(
        runInspect({
          manifest: "/p",
          contentDir: "/c",
          outputDir: "/tmp/out",
          outputMode: "human",
        }),
      ),
    ).toBe("internal-error");
  });
  it("runVerify delegates", async () => {
    const artifact = "{}";
    detMocks.sha256Hex.mockImplementation((s: string) => `hash-${s}`);
    const hash = `hash-${artifact}`;
    const impl = (p: string) => {
      if (String(p).includes("artifact.sig.json")) return JSON.stringify({ bodyHash: hash });
      if (String(p).includes("artifact.json")) return artifact;
      return validManifest;
    };
    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockImplementation(impl as any);
    const opts = {
      manifest: "/p",
      contentDir: "/c",
      outputDir: "/tmp/out",
      outputMode: "human",
    } as any;
    const v1 = await runCli(runVerify(opts));
    fsMocks.readFileSync.mockImplementation(impl as any);
    const v2 = await runCli(runInspect(opts));
    expect(v1).toBe(v2);
    expect(v1).toBe("success");
  });
});

describe("runCompare", () => {
  it("usage-error missing artifact", async () => {
    fsMocks.existsSync.mockReturnValue(false);
    expect(
      await runCli(
        runCompare({
          manifest: "/p",
          contentDir: "/c",
          outputDir: "/tmp/out",
          outputMode: "human",
        }),
      ),
    ).toBe("usage-error");
  });
  it("success when verifyEnvelope true", async () => {
    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockImplementation((p: string) => {
      if (String(p).includes("artifact.json")) return '{"x":1}';
      if (String(p).includes("artifact.sig.json")) return '{"bodyHash":"h"}';
      return validManifest;
    });
    detMocks.verifyEnvelope.mockReturnValue(true);
    const spy = stdoutSpy();
    expect(
      await runCli(
        runCompare({
          manifest: "/p",
          contentDir: "/c",
          outputDir: "/tmp/out",
          outputMode: "human",
        }),
      ),
    ).toBe("success");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("YES"));
  });
  it("validation-error when verify false + hashMatch false json", async () => {
    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockImplementation((p: string) => {
      if (String(p).includes("artifact.json")) return '{"x":1}';
      if (String(p).includes("artifact.sig.json")) return '{"bodyHash":"wrong"}';
      return validManifest;
    });
    detMocks.verifyEnvelope.mockReturnValue(false);
    detMocks.sha256Hex.mockReturnValue("other");
    const spy = stdoutSpy();
    expect(
      await runCli(
        runCompare({ manifest: "/p", contentDir: "/c", outputDir: "/tmp/out", outputMode: "json" }),
      ),
    ).toBe("validation-error");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("envelopeValid"));
  });
  it("internal-error on parse fail", async () => {
    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockReturnValue("not-json");
    expect(
      await runCli(
        runCompare({
          manifest: "/p",
          contentDir: "/c",
          outputDir: "/tmp/out",
          outputMode: "human",
        }),
      ),
    ).toBe("internal-error");
  });
});

describe("Campaign", () => {
  it("runCampaignCompile success", async () => {
    const spy = stdoutSpy();
    expect(
      await runCli(
        runCampaignCompile({
          manifest: "/tmp/pack.json",
          contentDir: "/tmp/c",
          outputDir: "/tmp/out",
          outputMode: "human",
          saveDir: "/tmp/saves",
          seed: "s1",
        }),
      ),
    ).toBe("success");
    expect(campaignMocks.compile).toHaveBeenCalledWith(
      expect.objectContaining({ rulesetVersion: "1.0.0" }),
      expect.anything(),
      expect.anything(),
    );
    const request = campaignMocks.compile.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(request["contentBundle"]).toBeDefined();
    expect("campaignFiles" in request).toBe(false);
    expect("compilerInput" in request).toBe(false);
    expect(fsMocks.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining("campaign-state.json"),
      expect.anything(),
      "utf8",
    );
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("Campaign compiled"));
  });
  it("runCampaignCompile json", async () => {
    const spy = stdoutSpy();
    await runCli(
      runCampaignCompile({
        manifest: "/tmp/pack.json",
        contentDir: "/tmp/c",
        outputDir: "/tmp/out",
        outputMode: "json",
        saveDir: "/s",
        seed: "s",
      }),
    );
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("contentHash"));
  });
  it("runCampaignSave usage-error no state", async () => {
    fsMocks.existsSync.mockReturnValue(false);
    expect(
      await runCli(
        runCampaignSave(
          {
            manifest: "/p",
            contentDir: "/c",
            outputDir: "/tmp/out",
            outputMode: "human",
            saveDir: "/s",
            seed: "s",
          },
          "/s",
        ),
      ),
    ).toBe("usage-error");
  });
  it("runCampaignSave internal-error parse fail", async () => {
    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockReturnValue("bad-json");
    expect(
      await runCli(
        runCampaignSave(
          {
            manifest: "/p",
            contentDir: "/c",
            outputDir: "/tmp/out",
            outputMode: "human",
            saveDir: "/s",
            seed: "s",
          },
          "/s",
        ),
      ),
    ).toBe("internal-error");
  });
  it("runCampaignSave success json/human", async () => {
    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockReturnValue(JSON.stringify(storableCampaignState));
    const spy = stdoutSpy();
    expect(
      await runCli(
        runCampaignSave(
          {
            manifest: "/p",
            contentDir: "/c",
            outputDir: "/tmp/out",
            outputMode: "human",
            saveDir: "/s",
            seed: "s",
          },
          "/s",
        ),
      ),
    ).toBe("success");
    expect(saveStoreMocks.save).toHaveBeenCalled();
    spy.mockClear();
    await runCli(
      runCampaignSave(
        {
          manifest: "/p",
          contentDir: "/c",
          outputDir: "/tmp/out",
          outputMode: "json",
          saveDir: "/s",
          seed: "s",
        },
        "/s",
      ),
    );
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("saveId"));
  });
  it("runCampaignSave internal-error on save throw", async () => {
    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockReturnValue(JSON.stringify(storableCampaignState));
    saveStoreMocks.save.mockImplementationOnce(() => {
      throw new Error("disk full");
    });
    expect(
      await runCli(
        runCampaignSave(
          {
            manifest: "/p",
            contentDir: "/c",
            outputDir: "/tmp/out",
            outputMode: "human",
            saveDir: "/s",
            seed: "s",
          },
          "/s",
        ),
      ),
    ).toBe("internal-error");
  });
  it("runCampaignLoad validation-error", async () => {
    saveStoreMocks.load.mockReturnValue(undefined);
    expect(
      await runCli(
        runCampaignLoad(
          {
            manifest: "/p",
            contentDir: "/c",
            outputDir: "/tmp/out",
            outputMode: "human",
            saveDir: "/s",
            seed: "s",
          },
          "/s",
        ),
      ),
    ).toBe("validation-error");
  });
  it("runCampaignLoad success json/human", async () => {
    const spy = stdoutSpy();
    expect(
      await runCli(
        runCampaignLoad(
          {
            manifest: "/p",
            contentDir: "/c",
            outputDir: "/tmp/out",
            outputMode: "human",
            saveDir: "/s",
            seed: "s",
          },
          "/s",
        ),
      ),
    ).toBe("success");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("Campaign loaded"));
    spy.mockClear();
    expect(
      await runCli(
        runCampaignLoad(
          {
            manifest: "/p",
            contentDir: "/c",
            outputDir: "/tmp/out",
            outputMode: "json",
            saveDir: "/s",
            seed: "s",
          },
          "/s",
        ),
      ),
    ).toBe("success");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("rawHash"));
  });
});

describe("runTurnExecute", () => {
  it("validation-error if load fails", async () => {
    saveStoreMocks.load.mockReturnValue(undefined);
    expect(
      await runCli(
        runTurnExecute(
          {
            manifest: "/p",
            contentDir: "/c",
            outputDir: "/tmp/out",
            outputMode: "human",
            saveDir: "/s",
            seed: "myseed",
          },
          "/s",
        ),
      ),
    ).toBe("validation-error");
  });
  it("compile-error if collector hasErrors", async () => {
    phaseMocks.execute.mockImplementation((_: any, __: any, ___: any, c: any) => {
      c.addError("EXEC", "fail");
      return {
        success: true,
        finalSnapshot: campaignSnapshot,
        commandLedger: { all: [], hash: () => "h" },
        eventLedger: { hash: () => "h" },
        randomLedger: { hash: () => "h" },
        financialLedger: { hash: () => "h" },
      };
    });
    expect(
      await runCli(
        runTurnExecute(
          {
            manifest: "/p",
            contentDir: "/c",
            outputDir: "/tmp/out",
            outputMode: "human",
            saveDir: "/s",
            seed: "s",
          },
          "/s",
        ),
      ),
    ).toBe("compile-error");
  });
  it("compile-error if result.success false", async () => {
    phaseMocks.execute.mockReturnValue({
      success: false,
      finalSnapshot: campaignSnapshot,
      commandLedger: { all: [], hash: () => "h" },
      eventLedger: { hash: () => "h" },
      randomLedger: { hash: () => "h" },
      financialLedger: { hash: () => "h" },
    } as any);
    expect(
      await runCli(
        runTurnExecute(
          {
            manifest: "/p",
            contentDir: "/c",
            outputDir: "/tmp/out",
            outputMode: "human",
            saveDir: "/s",
            seed: "s",
          },
          "/s",
        ),
      ),
    ).toBe("compile-error");
  });
  it("success writes ledger+finalHash and commands only if present", async () => {
    phaseMocks.execute.mockReturnValue({
      success: true,
      finalSnapshot: campaignSnapshot,
      commandLedger: { all: [{ id: "1" }], hash: () => "ch" },
      eventLedger: { hash: () => "eh" },
      randomLedger: { hash: () => "rh" },
      financialLedger: { hash: () => "fh" },
    } as any);
    const spy = stdoutSpy();
    const cmds = [{ commandId: "cmd-1", body: { type: "budget_project" } }] as any;
    expect(
      await runCli(
        runTurnExecute(
          {
            manifest: "/p",
            contentDir: "/c",
            outputDir: "/tmp/out",
            outputMode: "human",
            saveDir: "/s",
            seed: "seed123",
          },
          "/s",
          cmds,
        ),
      ),
    ).toBe("success");
    expect(detMocks.createEnvelope).toHaveBeenCalledWith(
      "campaign-snapshot",
      expect.anything(),
      expect.objectContaining({
        ...campaignSnapshot,
        nations: {},
        designs: {},
        designFamilies: {},
      }),
    );
    expect(fsMocks.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining("command-ledger.json"),
      expect.anything(),
      "utf8",
    );
    expect(fsMocks.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining("final-hash.json"),
      expect.anything(),
      "utf8",
    );
    expect(fsMocks.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining("commands.json"),
      expect.anything(),
      "utf8",
    );
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("Turn executed"));
  });
  it("no commands.json when empty list", async () => {
    phaseMocks.execute.mockReturnValue({
      success: true,
      finalSnapshot: campaignSnapshot,
      commandLedger: { all: [], hash: () => "ch" },
      eventLedger: { hash: () => "eh" },
      randomLedger: { hash: () => "rh" },
      financialLedger: { hash: () => "fh" },
    } as any);
    await runCli(
      runTurnExecute(
        {
          manifest: "/p",
          contentDir: "/c",
          outputDir: "/tmp/out",
          outputMode: "human",
          saveDir: "/s",
          seed: "",
        },
        "/s",
        [],
      ),
    );
    const writes = fsMocks.writeFileSync.mock.calls.map((c) => String(c[0]));
    expect(writes.some((w) => w.includes("commands.json"))).toBe(false);
  });
  it("uses default-seed if seed empty", async () => {
    phaseMocks.execute.mockClear();
    saveStoreMocks.load.mockReturnValue({
      snapshot: campaignSnapshot,
      envelope: { bodyHash: "eh" },
      rawHash: "rh",
    } as any);
    await runCli(
      runTurnExecute(
        {
          manifest: "/p",
          contentDir: "/c",
          outputDir: "/tmp/out",
          outputMode: "json",
          saveDir: "/s",
          seed: "",
        },
        "/s",
        [],
      ),
    );
    expect(phaseMocks.execute).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "default-seed",
      expect.anything(),
    );
  });
  it("prints a battle summary (human) when the turn produced a battle", async () => {
    const snapshotWithBattle = {
      ...campaignSnapshot,
      wars: {
        wars: [],
        battles: [
          {
            id: "battle-1",
            phase: "resolved",
            attackerId: "GBR",
            defenderId: "FRA",
            areaId: "area1",
            attackerFleetIds: [],
            defenderFleetIds: [],
            result: {
              winnerId: "GBR",
              loserId: "FRA",
              attackerLosses: [],
              defenderLosses: ["fra_bb1"],
              damageReport: { fra_bb1: SafeInt(42) },
              explanation: ["GBR overwhelming strength"],
            },
          },
        ],
        battleManifests: [{ battleId: "battle-1" }],
      },
    };
    phaseMocks.execute.mockReturnValue({
      success: true,
      finalSnapshot: snapshotWithBattle,
      commandLedger: { all: [], hash: () => "ch" },
      eventLedger: { hash: () => "eh" },
      randomLedger: { hash: () => "rh" },
      financialLedger: { hash: () => "fh" },
    } as any);
    const spy = stdoutSpy();
    expect(
      await runCli(
        runTurnExecute(
          {
            manifest: "/p",
            contentDir: "/c",
            outputDir: "/tmp/out",
            outputMode: "human",
            saveDir: "/s",
            seed: "s",
          },
          "/s",
        ),
      ),
    ).toBe("success");
    const output = spy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("Battles:");
    expect(output).toContain("Generated manifests: 1");
    expect(output).toContain("battle-1 (GBR vs FRA @ area1): GBR defeated FRA");
    expect(output).toContain("defender: fra_bb1");
    expect(output).toContain("fra_bb1=42");
  });
  it("emits a battles key with generation/outcome data in --json mode", async () => {
    const snapshotWithBattle = {
      ...campaignSnapshot,
      wars: {
        wars: [],
        battles: [
          {
            id: "battle-1",
            phase: "resolved",
            attackerId: "GBR",
            defenderId: "FRA",
            areaId: "area1",
            attackerFleetIds: [],
            defenderFleetIds: [],
            result: {
              winnerId: "GBR",
              loserId: "FRA",
              attackerLosses: [],
              defenderLosses: ["fra_bb1"],
              damageReport: { fra_bb1: SafeInt(42) },
              explanation: [],
            },
          },
        ],
        battleManifests: [{ battleId: "battle-1" }],
      },
    };
    phaseMocks.execute.mockReturnValue({
      success: true,
      finalSnapshot: snapshotWithBattle,
      commandLedger: { all: [], hash: () => "ch" },
      eventLedger: { hash: () => "eh" },
      randomLedger: { hash: () => "rh" },
      financialLedger: { hash: () => "fh" },
    } as any);
    const spy = stdoutSpy();
    await runCli(
      runTurnExecute(
        {
          manifest: "/p",
          contentDir: "/c",
          outputDir: "/tmp/out",
          outputMode: "json",
          saveDir: "/s",
          seed: "s",
        },
        "/s",
      ),
    );
    const output = spy.mock.calls.map((c) => c[0]).join("");
    const jsonLine = output.split("\n").find((line) => line.includes("battles"));
    const parsed = JSON.parse(jsonLine!);
    expect(parsed.battles.manifests).toHaveLength(1);
    expect(parsed.battles.battles[0].result.winnerId).toBe("GBR");
  });
  it("omits the battles section entirely when no battles occurred", async () => {
    phaseMocks.execute.mockReturnValue({
      success: true,
      finalSnapshot: campaignSnapshot,
      commandLedger: { all: [], hash: () => "ch" },
      eventLedger: { hash: () => "eh" },
      randomLedger: { hash: () => "rh" },
      financialLedger: { hash: () => "fh" },
    } as any);
    const spy = stdoutSpy();
    await runCli(
      runTurnExecute(
        {
          manifest: "/p",
          contentDir: "/c",
          outputDir: "/tmp/out",
          outputMode: "human",
          saveDir: "/s",
          seed: "s",
        },
        "/s",
      ),
    );
    const output = spy.mock.calls.map((c) => c[0]).join("");
    expect(output).not.toContain("Battles:");
  });
});

describe("runReplay", () => {
  beforeEach(() => {
    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockImplementation((p: string) => {
      if (String(p).includes("commands.json")) {
        return JSON.stringify([
          {
            commandId: "cmd-1",
            version: "0.1.0",
            expectedSnapshotHash: "rh",
            idempotencyKey: "idem-1",
            timestamp: "1880-01",
            body: { type: "budget_project", nationId: "GBR", projectId: "p1", budget: 1 },
          },
        ]);
      }
      if (String(p).includes("command-ledger.json")) return JSON.stringify([{ hash: "h1" }]);
      if (String(p).includes("final-hash.json")) return JSON.stringify({ finalSnapshotHash: "rh" });
      return "{}";
    });
    saveStoreMocks.getActiveSaveId.mockReturnValue("save-1");
  });
  it("validation-error no active save", async () => {
    saveStoreMocks.getActiveSaveId.mockReturnValue(null);
    expect(
      await runCli(
        runReplay(
          {
            manifest: "/p",
            contentDir: "/c",
            outputDir: "/tmp/out",
            outputMode: "human",
            saveDir: "/s",
            seed: "s",
          },
          "/s",
        ),
      ),
    ).toBe("validation-error");
  });
  it("validation-error no previous save (nothing to replay from)", async () => {
    saveStoreMocks.getPreviousSaveId.mockReturnValue(null);
    expect(
      await runCli(
        runReplay(
          {
            manifest: "/p",
            contentDir: "/c",
            outputDir: "/tmp/out",
            outputMode: "human",
            saveDir: "/s",
            seed: "s",
          },
          "/s",
        ),
      ),
    ).toBe("validation-error");
    expect(saveStoreMocks.loadById).not.toHaveBeenCalled();
  });
  it("replays from the previous save via loadById, not the active save", async () => {
    phaseMocks.verify.mockReturnValue({
      match: true,
      mismatches: [],
      steps: [{ match: true }],
      replayedFinalHash: "rh",
      originalFinalHash: "rh",
    });
    await runCli(
      runReplay(
        {
          manifest: "/p",
          contentDir: "/c",
          outputDir: "/tmp/out",
          outputMode: "human",
          saveDir: "/s",
          seed: "s",
        },
        "/s",
      ),
    );
    expect(saveStoreMocks.loadById).toHaveBeenCalledWith("/s", "save-0", expect.anything());
    expect(saveStoreMocks.load).not.toHaveBeenCalled();
  });
  it("validation-error no commands file", async () => {
    fsMocks.existsSync.mockImplementation((p: string) => !String(p).includes("commands.json"));
    expect(
      await runCli(
        runReplay(
          {
            manifest: "/p",
            contentDir: "/c",
            outputDir: "/tmp/out",
            outputMode: "human",
            saveDir: "/s",
            seed: "s",
          },
          "/s",
        ),
      ),
    ).toBe("validation-error");
  });
  it("internal-error parse commands fail", async () => {
    fsMocks.readFileSync.mockImplementation(() => {
      throw new Error("io");
    });
    expect(
      await runCli(
        runReplay(
          {
            manifest: "/p",
            contentDir: "/c",
            outputDir: "/tmp/out",
            outputMode: "human",
            saveDir: "/s",
            seed: "s",
          },
          "/s",
        ),
      ),
    ).toBe("internal-error");
  });
  it("success match -> success", async () => {
    phaseMocks.verify.mockReturnValue({
      match: true,
      mismatches: [],
      steps: [{ match: true }],
      replayedFinalHash: "rh",
      originalFinalHash: "rh",
    });
    expect(
      await runCli(
        runReplay(
          {
            manifest: "/p",
            contentDir: "/c",
            outputDir: "/tmp/out",
            outputMode: "human",
            saveDir: "/s",
            seed: "s",
          },
          "/s",
        ),
      ),
    ).toBe("success");
  });
  it("mismatch -> validation-error", async () => {
    phaseMocks.verify.mockReturnValue({
      match: false,
      mismatches: [
        {
          stepIndex: 0,
          commandId: "cmd-1",
          expectedHash: "a",
          actualHash: "b",
          diagnostic: "diff",
        },
      ],
      steps: [{ match: false }],
      replayedFinalHash: "a",
      originalFinalHash: "b",
    });
    const spy = stdoutSpy();
    expect(
      await runCli(
        runReplay(
          {
            manifest: "/p",
            contentDir: "/c",
            outputDir: "/tmp/out",
            outputMode: "human",
            saveDir: "/s",
            seed: "s",
          },
          "/s",
        ),
      ),
    ).toBe("validation-error");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("FAILED"));
  });
  it("internal-error ledger parse fail", async () => {
    fsMocks.readFileSync.mockImplementation((p: string) => {
      if (String(p).includes("ledger")) return "not-json";
      if (String(p).includes("commands")) return "[]";
      if (String(p).includes("final-hash")) return JSON.stringify({ finalSnapshotHash: "rh" });
      return "{}";
    });
    expect(
      await runCli(
        runReplay(
          {
            manifest: "/p",
            contentDir: "/c",
            outputDir: "/tmp/out",
            outputMode: "human",
            saveDir: "/s",
            seed: "s",
          },
          "/s",
        ),
      ),
    ).toBe("internal-error");
  });
  it("json mode prints stringified replayResult", async () => {
    phaseMocks.verify.mockReturnValue({
      match: true,
      mismatches: [],
      steps: [],
      replayedFinalHash: "rh",
      originalFinalHash: "rh",
    });
    const spy = stdoutSpy();
    await runCli(
      runReplay(
        {
          manifest: "/p",
          contentDir: "/c",
          outputDir: "/tmp/out",
          outputMode: "json",
          saveDir: "/s",
          seed: "s",
        },
        "/s",
      ),
    );
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("replayedFinalHash"));
  });
  it("validation-error if collector hasErrors after verify", async () => {
    phaseMocks.verify.mockImplementation((...args: any[]) => {
      const collector = args[5];
      collector.addError("REPLAY", "mismatch");
      return {
        match: true,
        mismatches: [],
        steps: [],
        replayedFinalHash: "rh",
        originalFinalHash: "rh",
      };
    });
    expect(
      await runCli(
        runReplay(
          {
            manifest: "/p",
            contentDir: "/c",
            outputDir: "/tmp/out",
            outputMode: "human",
            saveDir: "/s",
            seed: "s",
          },
          "/s",
        ),
      ),
    ).toBe("validation-error");
  });
  it("prints a battle summary (human) when the replayed snapshot carries a battle", async () => {
    phaseMocks.verify.mockReturnValue({
      match: true,
      mismatches: [],
      steps: [],
      replayedFinalHash: "rh",
      originalFinalHash: "rh",
      replayedCommandLedgerHash: "cl",
      originalCommandLedgerHash: "cl",
      finalSnapshot: {
        ...campaignSnapshot,
        wars: {
          wars: [],
          battles: [
            {
              id: "battle-1",
              phase: "resolved",
              attackerId: "GBR",
              defenderId: "FRA",
              areaId: "area1",
              attackerFleetIds: [],
              defenderFleetIds: [],
              result: {
                winnerId: "FRA",
                loserId: "GBR",
                attackerLosses: ["gb_bb1"],
                defenderLosses: [],
                damageReport: { gb_bb1: SafeInt(7) },
                explanation: [],
              },
            },
          ],
          battleManifests: [{ battleId: "battle-1" }],
        },
      },
    });
    const spy = stdoutSpy();
    await runCli(
      runReplay(
        {
          manifest: "/p",
          contentDir: "/c",
          outputDir: "/tmp/out",
          outputMode: "human",
          saveDir: "/s",
          seed: "s",
        },
        "/s",
      ),
    );
    const output = spy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("Battles:");
    expect(output).toContain("battle-1 (GBR vs FRA @ area1): FRA defeated GBR");
  });
  it("emits a battles key in --json mode without dumping the raw finalSnapshot", async () => {
    phaseMocks.verify.mockReturnValue({
      match: true,
      mismatches: [],
      steps: [],
      replayedFinalHash: "rh",
      originalFinalHash: "rh",
      replayedCommandLedgerHash: "cl",
      originalCommandLedgerHash: "cl",
      finalSnapshot: {
        ...campaignSnapshot,
        wars: {
          wars: [],
          battles: [
            {
              id: "battle-1",
              phase: "resolved",
              attackerId: "GBR",
              defenderId: "FRA",
              areaId: "area1",
              attackerFleetIds: [],
              defenderFleetIds: [],
              result: {
                winnerId: "GBR",
                loserId: "FRA",
                attackerLosses: [],
                defenderLosses: [],
                damageReport: {},
                explanation: [],
              },
            },
          ],
          battleManifests: [{ battleId: "battle-1" }],
        },
      },
    });
    const spy = stdoutSpy();
    await runCli(
      runReplay(
        {
          manifest: "/p",
          contentDir: "/c",
          outputDir: "/tmp/out",
          outputMode: "json",
          saveDir: "/s",
          seed: "s",
        },
        "/s",
      ),
    );
    const output = spy.mock.calls.map((c) => c[0]).join("");
    expect(output).not.toContain("finalSnapshot");
    const parsed = JSON.parse(output.slice(output.indexOf("{")));
    expect(parsed.battles.battles[0].result.winnerId).toBe("GBR");
    expect(parsed.replayedFinalHash).toBe("rh");
  });
  it("omits the battles section when the mocked verify result has no finalSnapshot", async () => {
    phaseMocks.verify.mockReturnValue({
      match: true,
      mismatches: [],
      steps: [],
      replayedFinalHash: "rh",
      originalFinalHash: "rh",
    });
    const spy = stdoutSpy();
    await runCli(
      runReplay(
        {
          manifest: "/p",
          contentDir: "/c",
          outputDir: "/tmp/out",
          outputMode: "human",
          saveDir: "/s",
          seed: "s",
        },
        "/s",
      ),
    );
    const output = spy.mock.calls.map((c) => c[0]).join("");
    expect(output).not.toContain("Battles:");
  });
});

describe("persistedStateHash", () => {
  it("hashes {snapshot, envelope} so a save round-trips through SaveStore's self-check", async () => {
    const { canonicalSerialize: realCanon } = await vi.importActual<any>("@bluewave/deterministic");
    detMocks.canonicalSerialize.mockImplementation((v: any) => realCanon(v));
    detMocks.sha256Hex.mockImplementation((s: string) => `sha-${s.length}`);
    await runCli(
      runTurnExecute(
        {
          manifest: "/p",
          contentDir: "/c",
          outputDir: "/tmp/out",
          outputMode: "human",
          saveDir: "/s",
          seed: "s",
        } as any,
        "/s",
        [],
      ),
    );
    const rawHashCall = detMocks.canonicalSerialize.mock.calls.find(
      ([a]: any) => a && a.snapshot && a.envelope,
    );
    expect(rawHashCall).toBeDefined();
    expect(rawHashCall![0].snapshot.nations).toBeDefined();
    expect(rawHashCall![0].envelope).toBeDefined();
  });
});
