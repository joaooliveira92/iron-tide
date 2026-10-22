import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { parse } from "yaml";
import type { PresentationContentDto } from "../shared/content-contract.js";
import { dispatchCampaignCommand } from "./campaignBridge.js";

const REPO_ROOT = resolve(process.cwd(), "../..");
const PRESENTATION_PATH = resolve(REPO_ROOT, "content", "production", "1880", "presentation.yaml");

interface AuthoredPresentation {
  nations: Array<{
    countryId: string;
    nationId: string;
    code: string;
    coordinates: unknown;
    flavor: unknown;
    dossier: unknown;
  }>;
  regions: { regions: Array<{ id: string; label: string }>; areaRegion: Record<string, string> };
  mapJoin: {
    campaignAreaToFixture: Record<string, string>;
    nationHue: Record<string, number>;
    nationLabel: Record<string, string>;
    nationHomeArea: Record<string, string>;
  };
}

const authored = parse(readFileSync(PRESENTATION_PATH, "utf8")) as AuthoredPresentation;

describe("presentation content over the content IPC (CAH-PRES-3)", () => {
  it("serves the authored presentation corpus as a data-only DTO", async () => {
    const result = await dispatchCampaignCommand("inspectPresentationContent", undefined);
    expect(result.outcome).toBe("success");
    const dto = (result as { value: PresentationContentDto }).value;

    const servedNations = new Map(dto.nations.map((nation) => [nation.countryId, nation]));
    expect(servedNations.size).toBe(authored.nations.length);
    for (const nation of authored.nations) {
      const served = servedNations.get(nation.countryId)!;
      expect(served.nationId).toBe(nation.nationId);
      expect(served.code).toBe(nation.code);
      expect(served.coordinates).toEqual(nation.coordinates);
      expect(served.flavor).toEqual(nation.flavor);
      expect(served.dossier).toEqual(nation.dossier);
    }

    expect(dto.regions.regions).toEqual(authored.regions.regions);
    expect(dto.regions.areaRegion).toEqual(authored.regions.areaRegion);
    expect(dto.mapJoin).toEqual(authored.mapJoin);

    const first = dto.nations[0]!;
    expect(typeof first.coordinates.lat).toBe("number");
    expect(typeof first.flavor.name).toBe("string");
    expect(dto).not.toHaveProperty("manifestPath");
  });
});
