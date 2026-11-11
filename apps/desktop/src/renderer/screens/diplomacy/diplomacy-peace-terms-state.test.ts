import { describe, expect, it } from "vite-plus/test";
import type { DiplomacyScreenProjection } from "../../../shared/diplomacy-contract.js";
import {
  diplomacyBeginPeaceTerms,
  diplomacyDraftToCommand,
  diplomacyLoadSuccess,
} from "./diplomacy-screen-state.js";
import { describeDraft } from "./diplomacy-presentation.js";

type War = DiplomacyScreenProjection["wars"][number];

const war: War = {
  warId: "war_uk_fra",
  attackerSideId: "side_uk",
  defenderSideId: "side_fra",
  attackerSideMembers: ["uk"],
  defenderSideMembers: ["france"],
  attackerWarScore: 5,
  defenderWarScore: 1,
  attackerId: "uk",
  defenderId: "france",
  startDate: "1880-01",
  status: "ACTIVE",
  playerSide: "attacker",
};

function projection(wars: War[]): DiplomacyScreenProjection {
  return {
    playerNationId: "uk",
    knownNations: [{ nationId: "france", name: "France" }],
    relations: [],
    wars,
    blockades: [],
    areas: [{ areaId: "med_corsica", name: "Corsica" }],
    revision: 3,
    month: { month: 1, year: 1880 },
  };
}

describe("peace terms draft", () => {
  it("drafts a cede-area term against the opponent and maps it to a ProposePeace body", () => {
    const loaded = diplomacyLoadSuccess(projection([war]));
    const drafted = diplomacyBeginPeaceTerms(loaded, war, {
      _tag: "CedeArea",
      areaId: "med_corsica",
    });
    if (drafted.kind !== "loaded") throw new Error("expected loaded");
    expect(drafted.draftCommand).toEqual({
      kind: "ProposePeace",
      partnerNationId: "france",
      warId: "war_uk_fra",
      term: { _tag: "CedeArea", areaId: "med_corsica" },
    });
    expect(diplomacyDraftToCommand(drafted.draftCommand!)).toEqual({
      type: "ProposePeace",
      warId: "war_uk_fra",
      term: { _tag: "CedeArea", areaId: "med_corsica" },
    });
    expect(describeDraft(drafted.projection, drafted.draftCommand!)).toBe(
      "Peace terms with France: cede Corsica",
    );
  });

  it("drafts the status quo and names the opponent when the player defends", () => {
    const defending: War = {
      ...war,
      playerSide: "defender",
      attackerId: "france",
      defenderId: "uk",
    };
    const loaded = diplomacyLoadSuccess(projection([defending]));
    const drafted = diplomacyBeginPeaceTerms(loaded, defending, { _tag: "StatusQuo" });
    if (drafted.kind !== "loaded") throw new Error("expected loaded");
    expect(drafted.draftCommand?.partnerNationId).toBe("france");
    expect(diplomacyDraftToCommand(drafted.draftCommand!)).toEqual({
      type: "ProposePeace",
      warId: "war_uk_fra",
      term: { _tag: "StatusQuo" },
    });
    expect(describeDraft(drafted.projection, drafted.draftCommand!)).toBe(
      "Peace terms with France: status quo",
    );
  });

  it("does not draft for a war that is not active", () => {
    const loaded = diplomacyLoadSuccess(projection([war]));
    const drafted = diplomacyBeginPeaceTerms(
      loaded,
      { ...war, status: "ENDED" },
      { _tag: "StatusQuo" },
    );
    if (drafted.kind !== "loaded") throw new Error("expected loaded");
    expect(drafted.draftCommand).toBeNull();
  });
});
