import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { SaveStore } from "../src/store.js";
import { SaveMetadataSchema } from "../src/schemas.js";
import { SAVE_MIGRATIONS } from "../src/saveMigration.js";
import { Schema } from "effect";
import { minimalCampaignState } from "./campaign-state-fixture.js";
import { runExit, unwrapSuccess } from "./harness.js";

const PROVENANCE = {
  campaignSeed: "0123456789abcdef0123456789abcdef",
  dataPackVersion: "0.5.0",
} as const;

describe("save provenance metadata", () => {
  let dir: string;
  const store = new SaveStore();

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "save-provenance-"));
  });

  afterEach(() => {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  });

  it("records the campaign seed, ruleset version and data-pack version in metadata.json", () => {
    const state = minimalCampaignState();
    const result = store.save(state, dir, { provenance: PROVENANCE });

    expect(result.metadata.campaignSeed).toBe(PROVENANCE.campaignSeed);
    expect(result.metadata.dataPackVersion).toBe(PROVENANCE.dataPackVersion);
    expect(result.metadata.rulesetVersion).toBe(state.snapshot.rulesetVersion);

    const onDisk = Schema.decodeUnknownSync(SaveMetadataSchema, { onExcessProperty: "error" })(
      JSON.parse(readFileSync(join(result.savePath, "metadata.json"), "utf8")),
    );
    expect(onDisk.campaignSeed).toBe(PROVENANCE.campaignSeed);
    expect(onDisk.dataPackVersion).toBe(PROVENANCE.dataPackVersion);
    expect(onDisk.rulesetVersion).toBe(state.snapshot.rulesetVersion);
  });

  it("carries the seed and data-pack version forward when a later save omits them", () => {
    const state = minimalCampaignState();
    store.save(state, dir, { provenance: PROVENANCE });
    const second = store.save(state, dir);

    expect(second.metadata.campaignSeed).toBe(PROVENANCE.campaignSeed);
    expect(second.metadata.dataPackVersion).toBe(PROVENANCE.dataPackVersion);
  });

  it("omits seed and data-pack version when none was ever supplied", () => {
    const result = store.save(minimalCampaignState(), dir);

    expect(result.metadata.campaignSeed).toBeUndefined();
    expect(result.metadata.dataPackVersion).toBeUndefined();
    expect(result.metadata.rulesetVersion).toBe("1.0");
  });

  it("lists the provenance with each save", () => {
    store.save(minimalCampaignState(), dir, { provenance: PROVENANCE });
    const listing = unwrapSuccess(runExit(store.listEffect(dir)));

    expect(listing.saves[0]?.campaignSeed).toBe(PROVENANCE.campaignSeed);
  });

  it("lists the seed, ruleset and data-pack version of the released 5.2.0 corpus save", () => {
    const corpus = join(import.meta.dirname, "fixtures", "save-corpus", "5.2.0");
    const [released] = store.list(corpus);

    expect(released?.campaignSeed).toBe(PROVENANCE.campaignSeed);
    expect(released?.dataPackVersion).toBe(PROVENANCE.dataPackVersion);
    expect(released?.rulesetVersion).toBe("1.0");
  });

  it("keeps the offline migration registry empty so no runtime migration is registered", () => {
    expect(SAVE_MIGRATIONS).toEqual([]);
  });

  it("refuses a 5.1.0 save instead of migrating it on load", () => {
    const state = minimalCampaignState();
    const saved = store.save(state, dir);
    const campaignPath = join(saved.savePath, "campaign.json");
    writeFileSync(
      campaignPath,
      readFileSync(campaignPath, "utf8").replaceAll(state.snapshot.compatibilityVersion, "5.1.0"),
    );
    const before = readFileSync(campaignPath, "utf8");

    const loaded = runExit(store.load(dir));

    expect(loaded._tag).toBe("Failure");
    expect(readFileSync(campaignPath, "utf8")).toBe(before);
  });
});
