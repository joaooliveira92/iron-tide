import { describe, expect, it } from "vite-plus/test";
import { hasOwnContent, supportedPlayerSlotIds } from "../src/configuration.js";
import {
  fixtureConstructionProject,
  fixtureDesign,
  fixtureNation,
  fixtureSnapshot,
} from "./fixtures.js";

describe("hasOwnContent", () => {
  it("is true when the nation has at least one construction project", () => {
    const snapshot = fixtureSnapshot([
      fixtureNation({ id: "uk", constructionProjects: [fixtureConstructionProject()] }),
    ]);
    expect(hasOwnContent(snapshot, "uk")).toBe(true);
  });

  it("is true when the nation has at least one ship design", () => {
    const snapshot = fixtureSnapshot(
      [fixtureNation({ id: "uk" })],
      [fixtureDesign("uk", "design-1")],
    );
    expect(hasOwnContent(snapshot, "uk")).toBe(true);
  });

  it("is false when the nation has neither designs nor construction projects", () => {
    const snapshot = fixtureSnapshot([fixtureNation({ id: "spain" })]);
    expect(hasOwnContent(snapshot, "spain")).toBe(false);
  });

  it("ignores designs belonging to other nations", () => {
    const snapshot = fixtureSnapshot(
      [fixtureNation({ id: "spain" }), fixtureNation({ id: "uk" })],
      [fixtureDesign("uk", "design-1")],
    );
    expect(hasOwnContent(snapshot, "spain")).toBe(false);
  });

  it("is false for a nation id absent from the snapshot", () => {
    const snapshot = fixtureSnapshot([fixtureNation({ id: "uk" })]);
    expect(hasOwnContent(snapshot, "atlantis")).toBe(false);
  });
});

describe("supportedPlayerSlotIds", () => {
  it("excludes playable nations with zero designs and zero construction (empty-nation-content-gap)", () => {
    const snapshot = fixtureSnapshot(
      [
        fixtureNation({
          id: "uk",
          isPlayable: true,
          constructionProjects: [fixtureConstructionProject()],
        }),
        fixtureNation({ id: "spain", isPlayable: true }),
      ],
      [],
    );
    expect(supportedPlayerSlotIds(snapshot)).toEqual(["uk"]);
  });

  it("excludes non-playable nations even when they have content", () => {
    const snapshot = fixtureSnapshot(
      [fixtureNation({ id: "france", isPlayable: false })],
      [fixtureDesign("france", "design-1")],
    );
    expect(supportedPlayerSlotIds(snapshot)).toEqual([]);
  });

  it("returns a deterministically sorted list", () => {
    const snapshot = fixtureSnapshot(
      [
        fixtureNation({
          id: "usa",
          isPlayable: true,
          constructionProjects: [fixtureConstructionProject()],
        }),
        fixtureNation({
          id: "germany",
          isPlayable: true,
          constructionProjects: [fixtureConstructionProject()],
        }),
      ],
      [],
    );
    expect(supportedPlayerSlotIds(snapshot)).toEqual(["germany", "usa"]);
  });
});
