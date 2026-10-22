import { describe, expect, it } from "vite-plus/test";
import type { ResearchScreenProjection } from "../../../shared/research-contract.js";
import type { ResearchScreenState } from "./research-screen-state.js";
import {
  draftHighCount,
  draftIsSubmittable,
  draftToPriorities,
  seedDraft,
  setDraftWeight,
} from "./research-field-priorities.js";
import {
  initialResearchScreenState,
  researchBeginLoading,
  researchBeginSubmit,
  researchLoadFailure,
  researchLoadSuccess,
  researchSubmitRejected,
  researchSubmitSuccess,
  researchTransportFailure,
} from "./research-screen-state.js";

function fixtureProjection(
  overrides: Partial<ResearchScreenProjection> = {},
): ResearchScreenProjection {
  return {
    nationId: "uk",
    researchBudget: 60,
    annualAllocation: 720,
    researchCap: 120,
    unfundedReason: null,
    fieldPriorities: { MACHINERY: 4, GUNNERY: 2, HULL_CONSTRUCTION: 2 },
    discoveredTechIds: ["hc_wrought_iron_hull"],
    inProgressTechnologies: [
      { techId: "mac_triple_expansion", investedPoints: 30, completed: false },
    ],
    currentProjectTechId: "mac_triple_expansion",
    revision: 0,
    month: { month: 1, year: 1880 },
    ...overrides,
  };
}

function loadedState(): ResearchScreenState {
  return researchLoadSuccess(initialResearchScreenState(), fixtureProjection());
}

function submittingState(): ResearchScreenState {
  const loaded = loadedState();
  if (loaded.kind !== "loaded") throw new Error("expected loaded state");
  return researchBeginSubmit(loaded, "req-abc-1");
}

describe("research screen state", () => {
  it("starts idle and moves through the load lifecycle", () => {
    expect(initialResearchScreenState()).toEqual({ kind: "idle", revision: 0 });
    expect(researchBeginLoading(initialResearchScreenState())).toEqual({
      kind: "loading",
      revision: 0,
    });
    const loaded = researchLoadSuccess(
      researchBeginLoading(initialResearchScreenState()),
      fixtureProjection(),
    );
    expect(loaded.kind).toBe("loaded");
    if (loaded.kind !== "loaded") return;
    expect(loaded.revision).toBe(0);
    expect(loaded.projection.researchBudget).toBe(60);
    expect(loaded.notice).toBeNull();
  });

  it("seeds the draft from the projection and defaults absent fields to LOW", () => {
    const draft = seedDraft(fixtureProjection());
    expect(draft.MACHINERY).toBe(4);
    expect(draft.GUNNERY).toBe(2);
    expect(draft.HULL_CONSTRUCTION).toBe(2);
    expect(draft.SHIP_DESIGN).toBe(1);
    expect(draft.MISSILES).toBe(1);
  });

  it("load failures move to load-failed with the message and keep the revision", () => {
    const failed = researchLoadFailure(
      { kind: "loading", revision: 3 },
      "SESSION_NOT_FOUND: no session",
    );
    expect(failed).toEqual({
      kind: "load-failed",
      revision: 3,
      message: "SESSION_NOT_FOUND: no session",
    });
  });

  it("walks loaded -> submitting -> submitted with an honest queue notice", () => {
    const loaded = loadedState();
    if (loaded.kind !== "loaded") return;
    const submitting = researchBeginSubmit(loaded, "req-abc-1");
    expect(submitting.kind).toBe("submitting");
    if (submitting.kind !== "submitting") return;
    expect(submitting.pendingTransportRequestId).toBe("req-abc-1");
    expect(submitting.draft).toBe(loaded.draft);

    const submitted = researchSubmitSuccess(submitting, {
      commandId: "player-abc",
      priorities: { GUNNERY: 4 },
      appliedOnNextTurn: true,
    });
    expect(submitted.kind).toBe("submitted");
    if (submitted.kind !== "submitted") return;
    expect(submitted.notice).toContain("player-abc");
    expect(submitted.notice).toContain("next turn advance");
  });

  it("a rejection carrying a revision moves to rejected-with-revision and adopts it", () => {
    const rejected = researchSubmitRejected(submittingState(), {
      reason: "REVISION_MISMATCH",
      diagnostics: ["Expected revision 0 but session is at revision 2"],
      currentRevision: 2,
    });
    expect(rejected.kind).toBe("rejected-with-revision");
    if (rejected.kind !== "rejected-with-revision") return;
    expect(rejected.revision).toBe(2);
    expect(rejected.notice).toContain("REVISION_MISMATCH");
    expect(rejected.notice).toContain("current revision 2");
    expect(rejected.projection.researchBudget).toBe(60);
  });

  it("engine-constraint rejections without a revision stay loaded with the engine diagnostics", () => {
    const rejected = researchSubmitRejected(submittingState(), {
      reason: "RESEARCH_PRIORITY_CONSTRAINT_VIOLATED",
      diagnostics: ["invalid weight for fields: GUNNERY"],
    });
    expect(rejected.kind).toBe("loaded");
    if (rejected.kind !== "loaded") return;
    expect(rejected.notice).toContain("RESEARCH_PRIORITY_CONSTRAINT_VIOLATED");
    expect(rejected.notice).toContain("invalid weight for fields");
  });

  it("transport failures surface without an authoritative claim", () => {
    const failed = researchTransportFailure(submittingState(), "ipc disconnected");
    expect(failed.kind).toBe("loaded");
    if (failed.kind !== "loaded") return;
    expect(failed.notice).toBe("TRANSPORT_FAILURE: ipc disconnected");
  });

  it("draft edits are pure and the payload is complete in canonical order", () => {
    const draft = seedDraft(fixtureProjection());
    const next = setDraftWeight(draft, "GUNNERY", 4);
    expect(next.GUNNERY).toBe(4);
    expect(draft.GUNNERY).toBe(2);

    const payload = draftToPriorities(next);
    expect(Object.keys(payload)).toHaveLength(15);
    expect(payload.GUNNERY).toBe(4);
    expect(payload["HULL_CONSTRUCTION"]).toBe(2);

    expect(draftHighCount(next)).toBe(2);
    expect(draftIsSubmittable(next)).toBe(true);
  });

  it("a draft without any HIGH field is not submittable (mirrors the engine constraint)", () => {
    const draft = seedDraft(fixtureProjection({ fieldPriorities: { GUNNERY: 1 } }));
    const allLow = setDraftWeight(setDraftWeight(draft, "GUNNERY", 1), "MACHINERY", 1);
    expect(draftIsSubmittable(allLow)).toBe(false);
  });

  it("submitting is only reachable from a loaded/submitted state", () => {
    expect(researchBeginSubmit({ kind: "idle", revision: 0 }, "req-1")).toEqual({
      kind: "idle",
      revision: 0,
    });
    expect(researchBeginSubmit({ kind: "loading", revision: 0 }, "req-1")).toEqual({
      kind: "loading",
      revision: 0,
    });
  });
});
