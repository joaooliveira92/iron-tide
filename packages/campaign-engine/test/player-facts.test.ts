import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { buildOpeningBriefingProjection } from "../src/opening-briefing.js";
import { derivePlayerFacts } from "../src/player-facts.js";
import { buildPrioritiesProjection } from "../src/priorities.js";
import {
  baseFor,
  fixtureCatalogue,
  fixtureConstructionProject,
  fixtureNation,
  fixtureSnapshot,
  fixtureState,
} from "./fixtures.js";

const MONTH = { month: 1, year: 1880 };

function nationWithResearchShare(shareBp: number) {
  const probe = fixtureSnapshot([fixtureNation({ id: "uk", baseResources: baseFor(1_000_000) })]);
  const revenue = derivePlayerFacts(probe, "uk")!.outlook.revenue;
  const nation = fixtureNation({
    id: "uk",
    baseResources: baseFor(1_000_000),
    treasury: SafeInt(10 * revenue),
    research: {
      ...fixtureNation({ id: "uk" }).research,
      researchBudget: SafeInt(Math.floor((revenue * shareBp) / 10_000)),
    },
  });
  return fixtureSnapshot([nation], [], {
    world: { areas: [], routes: [], ports: [], technologies: fixtureCatalogue },
  });
}

describe("derivePlayerFacts", () => {
  it("returns undefined for a nation absent from the snapshot", () => {
    expect(derivePlayerFacts(fixtureSnapshot([fixtureNation({ id: "uk" })]), "atlantis")).toBe(
      undefined,
    );
  });

  it("sums committed construction from paid work", () => {
    const nation = fixtureNation({
      id: "uk",
      constructionProjects: [
        fixtureConstructionProject({ id: "p1", paidWork: SafeInt(30) }),
        fixtureConstructionProject({ id: "p2", paidWork: SafeInt(12) }),
      ],
    });
    expect(derivePlayerFacts(fixtureSnapshot([nation]), "uk")?.constructionCommitted).toBe(42);
  });
});

describe("research concern threshold", () => {
  it("raises no research concern in the briefing or the priorities at 9% of appropriation", () => {
    const snapshot = nationWithResearchShare(900);
    const priorities = buildPrioritiesProjection(snapshot, "uk");
    const briefing = buildOpeningBriefingProjection(fixtureState(snapshot), "uk", MONTH);
    expect(priorities.some((p) => p.type === "low_research_spending")).toBe(false);
    expect(briefing?.immediateConcerns.some((c) => c.category === "low_research_spending")).toBe(
      false,
    );
  });

  it("raises the research concern in both below 8% of appropriation", () => {
    const snapshot = nationWithResearchShare(700);
    const priorities = buildPrioritiesProjection(snapshot, "uk");
    const briefing = buildOpeningBriefingProjection(fixtureState(snapshot), "uk", MONTH);
    expect(priorities.some((p) => p.type === "low_research_spending")).toBe(true);
    expect(briefing?.immediateConcerns.some((c) => c.category === "low_research_spending")).toBe(
      true,
    );
  });
});
