import { describe, expect, it } from "vite-plus/test";
import type { DiplomacyScreenProjection } from "../../../shared/diplomacy-contract.js";
import type { DiplomacyScreenState } from "./diplomacy-screen-state.js";
import {
  diplomacyBeginAction,
  diplomacyBeginPeace,
  diplomacyBeginSubmit,
  diplomacyCanSubmit,
  diplomacyClearDraft,
  diplomacyDraftToCommand,
  diplomacyLoadSuccess,
  diplomacySetBlockadeArea,
  diplomacySubmitRejected,
  diplomacySubmitSuccess,
  diplomacyTransportFailure,
  initialDiplomacyScreenState,
} from "./diplomacy-screen-state.js";

function fixtureProjection(
  overrides: Partial<DiplomacyScreenProjection> = {},
): DiplomacyScreenProjection {
  return {
    playerNationId: "uk",
    knownNations: [
      { nationId: "france", name: "France" },
      { nationId: "germany", name: "Germany" },
    ],
    relations: [
      {
        nationAId: "uk",
        nationBId: "france",
        relation: "neutral",
        tension: 5,
        nap: false,
        since: "1880-01",
        partnerNationId: "france",
        partnerName: "France",
      },
      {
        nationAId: "uk",
        nationBId: "germany",
        relation: "allied",
        tension: 1,
        nap: false,
        since: "1880-02",
        partnerNationId: "germany",
        partnerName: "Germany",
      },
    ],
    wars: [
      {
        warId: "war_uk_fra",
        attackerSideId: "side_uk",
        defenderSideId: "side_fra",
        attackerSideMembers: ["uk"],
        defenderSideMembers: ["france"],
        attackerWarScore: 3,
        defenderWarScore: 1,
        attackerId: "uk",
        defenderId: "france",
        startDate: "1880-01",
        status: "ACTIVE",
        playerSide: "attacker",
      },
    ],
    blockades: [
      {
        blockaderId: "uk",
        blockadedNationId: "france",
        areaId: "med_gibraltar",
        establishedMonth: "1880-02",
      },
    ],
    areas: [{ areaId: "med_gibraltar", name: "Gibraltar" }],
    revision: 0,
    month: { month: 1, year: 1880 },
    ...overrides,
  };
}

function loadedState(): DiplomacyScreenState {
  return diplomacyLoadSuccess(fixtureProjection());
}

describe("diplomacy screen state", () => {
  it("starts idle and adopts the first projection", () => {
    expect(initialDiplomacyScreenState()).toEqual({
      kind: "idle",
      revision: 0,
    });
    const loaded = diplomacyLoadSuccess(fixtureProjection());
    expect(loaded.kind).toBe("loaded");
    if (loaded.kind !== "loaded") return;
    expect(loaded.revision).toBe(0);
    expect(loaded.projection.playerNationId).toBe("uk");
    expect(loaded.draftCommand).toBeNull();
    expect(loaded.notice).toBeNull();
  });

  it("walks loaded -> submitting -> submitted with an honest queue notice", () => {
    const loaded = loadedState();
    if (loaded.kind !== "loaded") return;
    const drafted = diplomacyBeginAction(loaded, "france", "DeclareWar");
    expect(drafted.kind).toBe("loaded");
    if (drafted.kind !== "loaded") return;
    expect(drafted.draftCommand).toEqual({
      kind: "DeclareWar",
      partnerNationId: "france",
    });

    const submitting = diplomacyBeginSubmit(drafted, "req-abc-1");
    expect(submitting.kind).toBe("submitting");
    if (submitting.kind !== "submitting") return;
    expect(submitting.pendingTransportRequestId).toBe("req-abc-1");

    const submitted = diplomacySubmitSuccess(submitting, {
      commandId: "player-abc",
      bodyType: "DeclareWar",
    });
    expect(submitted.kind).toBe("submitted");
    if (submitted.kind !== "submitted") return;
    expect(submitted.notice).toContain("player-abc");
    expect(submitted.notice).toContain("next turn advance");
  });

  it("a rejection carrying a revision moves to rejected-with-revision and adopts it", () => {
    const loaded = loadedState();
    if (loaded.kind !== "loaded") return;
    const submitting = diplomacyBeginSubmit(
      diplomacyBeginAction(loaded, "france", "DeclareWar"),
      "req-1",
    );
    const rejected = diplomacySubmitRejected(submitting, {
      reason: "REVISION_MISMATCH",
      diagnostics: ["Expected revision 0 but session is at revision 2"],
      currentRevision: 2,
    });
    expect(rejected.kind).toBe("rejected-with-revision");
    if (rejected.kind !== "rejected-with-revision") return;
    expect(rejected.revision).toBe(2);
    expect(rejected.notice).toContain("REVISION_MISMATCH");
    expect(rejected.notice).toContain("current revision 2");
  });

  it("engine-constraint rejections without a revision stay loaded with the engine diagnostics", () => {
    const loaded = loadedState();
    if (loaded.kind !== "loaded") return;
    const submitting = diplomacyBeginSubmit(
      diplomacyBeginAction(loaded, "france", "DeclareWar"),
      "req-1",
    );
    const rejected = diplomacySubmitRejected(submitting, {
      reason: "DECLARE_WAR_INVALID_TARGET",
      diagnostics: ["Target nation atlantis does not exist"],
    });
    expect(rejected.kind).toBe("loaded");
    if (rejected.kind !== "loaded") return;
    expect(rejected.notice).toContain("DECLARE_WAR_INVALID_TARGET");
    expect(rejected.notice).toContain("atlantis");
  });

  it("transport failures surface without an authoritative claim", () => {
    const loaded = loadedState();
    if (loaded.kind !== "loaded") return;
    const submitting = diplomacyBeginSubmit(
      diplomacyBeginAction(loaded, "france", "DeclareWar"),
      "req-1",
    );
    const failed = diplomacyTransportFailure(submitting, "ipc disconnected");
    expect(failed.kind).toBe("loaded");
    if (failed.kind !== "loaded") return;
    expect(failed.notice).toBe("TRANSPORT_FAILURE: ipc disconnected");
  });

  it("drafts an AcceptPeace with the opposing war side and only on ACTIVE wars", () => {
    const loaded = loadedState();
    if (loaded.kind !== "loaded") return;
    const war = loaded.projection.wars[0]!;
    const peace = diplomacyBeginPeace(loaded, war);
    expect(peace.kind).toBe("loaded");
    if (peace.kind !== "loaded") return;
    expect(peace.draftCommand).toEqual({
      kind: "AcceptPeace",
      partnerNationId: "france",
      warId: "war_uk_fra",
    });

    const ended = diplomacyBeginPeace(loaded, { ...war, status: "ENDED" });
    expect(ended.kind).toBe("loaded");
    if (ended.kind !== "loaded") return;
    expect(ended.draftCommand).toBeNull();
  });

  it("DeclareBlockade drafts default the first projected area and allow changing it", () => {
    const loaded = loadedState();
    if (loaded.kind !== "loaded") return;
    const drafted = diplomacyBeginAction(loaded, "france", "DeclareBlockade");
    expect(drafted.kind).toBe("loaded");
    if (drafted.kind !== "loaded") return;
    expect(drafted.draftCommand).toEqual({
      kind: "DeclareBlockade",
      partnerNationId: "france",
      areaId: "med_gibraltar",
    });
    const changed = diplomacySetBlockadeArea(drafted, "med_malta");
    if (changed.kind !== "loaded") return;
    expect(changed.draftCommand?.areaId).toBe("med_malta");
  });

  it("draft-to-wire maps exactly onto the engine command shapes (nationId NOT on the wire)", () => {
    const loaded = loadedState();
    if (loaded.kind !== "loaded") return;
    const war = loaded.projection.wars[0]!;

    expect(
      diplomacyDraftToCommand({
        kind: "DeclareWar",
        partnerNationId: "france",
      }),
    ).toEqual({
      type: "DeclareWar",
      targetNationId: "france",
    });
    expect(
      diplomacyDraftToCommand({
        kind: "AcceptPeace",
        partnerNationId: "france",
        warId: war.warId,
      }),
    ).toEqual({ type: "AcceptPeace", warId: "war_uk_fra" });
    expect(
      diplomacyDraftToCommand({
        kind: "FormAlliance",
        partnerNationId: "germany",
      }),
    ).toEqual({
      type: "FormAlliance",
      partnerNationId: "germany",
    });
    expect(
      diplomacyDraftToCommand({
        kind: "BreakAlliance",
        partnerNationId: "germany",
      }),
    ).toEqual({
      type: "BreakAlliance",
      partnerNationId: "germany",
    });
    expect(
      diplomacyDraftToCommand({
        kind: "FormNonAggressionPact",
        partnerNationId: "germany",
      }),
    ).toEqual({ type: "FormNonAggressionPact", partnerNationId: "germany" });
    expect(
      diplomacyDraftToCommand({
        kind: "BreakNonAggressionPact",
        partnerNationId: "germany",
      }),
    ).toEqual({ type: "BreakNonAggressionPact", partnerNationId: "germany" });
    expect(
      diplomacyDraftToCommand({
        kind: "DeclareBlockade",
        partnerNationId: "france",
        areaId: "med_gibraltar",
      }),
    ).toEqual({
      type: "DeclareBlockade",
      targetNationId: "france",
      areaId: "med_gibraltar",
    });
    expect(
      diplomacyDraftToCommand({
        kind: "AcceptPeace",
        partnerNationId: "france",
      }),
    ).toBeNull();
    expect(
      diplomacyDraftToCommand({
        kind: "DeclareBlockade",
        partnerNationId: "france",
      }),
    ).toBeNull();
  });

  it("submitting is only reachable from a loaded/submitted state with a complete draft", () => {
    expect(diplomacyBeginSubmit({ kind: "idle", revision: 0 }, "req-1")).toEqual({
      kind: "idle",
      revision: 0,
    });
    const loaded = loadedState();
    if (loaded.kind !== "loaded") return;
    expect(diplomacyBeginSubmit(loaded, "req-1")).toEqual(loaded);
    expect(diplomacyCanSubmit(loaded)).toBe(false);

    const drafted = diplomacyBeginAction(loaded, "france", "DeclareWar");
    if (drafted.kind !== "loaded") return;
    expect(diplomacyCanSubmit(drafted)).toBe(true);
    const cleared = diplomacyClearDraft(drafted);
    if (cleared.kind !== "loaded") return;
    expect(cleared.draftCommand).toBeNull();
    expect(diplomacyCanSubmit(cleared)).toBe(false);
  });
});
