import { describe, expect, it } from "vite-plus/test";

import {
  campaignShellMode,
  currentShellScreen,
  initialCampaignShellState,
  reduceCampaignShell,
} from "./campaign-shell-state.js";

const campaign = {
  month: { year: 1900, month: 1 },
  treasury: 50_000,
  revision: 1,
  sessionId: "ses_1",
  nationName: "United Kingdom",
  projectedSurplusDeficit: 2_000,
  activeAlertsCount: null,
  atWar: false,
  prestige: { current: 20, sackingThreshold: 16, dismissalRisk: false },
};

describe("campaign shell state", () => {
  it("opens a campaign and moves all related shell state together", () => {
    const opening = reduceCampaignShell(initialCampaignShellState(), {
      type: "campaign-opening",
    });
    const opened = reduceCampaignShell(opening, {
      type: "campaign-opened",
      campaign,
    });

    expect(opened.campaign).toEqual(campaign);
    expect(opened.loading).toBe(false);
    expect(opened.error).toBeNull();
    expect(currentShellScreen(opened)).toBe("overview");
  });

  it("carries the INC-1 header fields through the opened campaign overview", () => {
    const opened = reduceCampaignShell(initialCampaignShellState(), {
      type: "campaign-opened",
      campaign,
    });

    expect(opened.campaign).toEqual(
      expect.objectContaining({
        nationName: "United Kingdom",
        projectedSurplusDeficit: 2_000,
        activeAlertsCount: null,
        atWar: false,
      }),
    );
  });

  it("records an opening failure without leaving the shell loading", () => {
    const opening = reduceCampaignShell(initialCampaignShellState(), {
      type: "campaign-opening",
    });
    const failed = reduceCampaignShell(opening, {
      type: "campaign-open-failed",
      message: "not found",
    });

    expect(failed.loading).toBe(false);
    expect(failed.error).toBe("not found");
    expect(failed.campaign).toBeNull();
  });

  it("closes back to one clean initial shell state", () => {
    let state = reduceCampaignShell(initialCampaignShellState(), {
      type: "campaign-opened",
      campaign,
    });
    state = reduceCampaignShell(state, { type: "visit", screen: "fleet" });
    state = reduceCampaignShell(state, {
      type: "save-finished",
      message: "saved",
    });
    state = reduceCampaignShell(state, {
      type: "primary-action-changed",
      action: {
        label: "Continue",
        disabled: false,
        onTrigger: () => undefined,
      },
    });

    expect(reduceCampaignShell(state, { type: "campaign-closed" })).toEqual(
      initialCampaignShellState(),
    );
  });

  it("keeps navigation, save, and primary-action transitions behind one interface", () => {
    let state = initialCampaignShellState();
    state = reduceCampaignShell(state, {
      type: "visit",
      screen: "new-game-preferences",
    });
    state = reduceCampaignShell(state, { type: "save-started" });
    state = reduceCampaignShell(state, {
      type: "primary-action-changed",
      action: { label: "Next", disabled: true, onTrigger: () => undefined },
    });

    expect(currentShellScreen(state)).toBe("new-game-preferences");
    expect(state.saving).toBe(true);
    expect(state.primaryAction?.label).toBe("Next");
  });

  it("preserves the current shell route while campaign opening is in progress", () => {
    const preferences = reduceCampaignShell(initialCampaignShellState(), {
      type: "visit",
      screen: "new-game-preferences",
    });
    const opening = reduceCampaignShell(preferences, {
      type: "campaign-opening",
    });
    expect(opening.loading).toBe(true);
    expect(opening.error).toBeNull();
    expect(currentShellScreen(opening)).toBe("new-game-preferences");
  });

  it("preserves the attempted route when campaign opening fails", () => {
    const preferences = reduceCampaignShell(initialCampaignShellState(), {
      type: "visit",
      screen: "new-game-preferences",
    });
    const opening = reduceCampaignShell(preferences, {
      type: "campaign-opening",
    });
    const failed = reduceCampaignShell(opening, {
      type: "campaign-open-failed",
      message: "inspection failed",
    });
    expect(failed.loading).toBe(false);
    expect(failed.error).toBe("inspection failed");
    expect(failed.campaign).toBeNull();
    expect(currentShellScreen(failed)).toBe("new-game-preferences");
  });

  it("keeps save state and the registered primary action when navigation changes", () => {
    let state = reduceCampaignShell(initialCampaignShellState(), {
      type: "campaign-opened",
      campaign,
    });
    const action = {
      label: "Advance turn",
      disabled: false,
      onTrigger: () => undefined,
    };
    state = reduceCampaignShell(state, { type: "save-started" });
    state = reduceCampaignShell(state, {
      type: "primary-action-changed",
      action,
    });
    state = reduceCampaignShell(state, { type: "visit", screen: "fleet" });
    expect(currentShellScreen(state)).toBe("fleet");
    expect(state.saving).toBe(true);
    expect(state.primaryAction).toBe(action);
  });

  it("returns the unchanged state when an equivalent primary action is re-registered", () => {
    let state = initialCampaignShellState();
    const onTrigger = () => undefined;
    const action = { label: "Start Campaign", disabled: false, onTrigger };
    state = reduceCampaignShell(state, {
      type: "primary-action-changed",
      action,
    });

    const reregistered = reduceCampaignShell(state, {
      type: "primary-action-changed",
      action: { label: "Start Campaign", disabled: false, onTrigger },
    });
    expect(reregistered).toBe(state);

    const changed = reduceCampaignShell(state, {
      type: "primary-action-changed",
      action: { label: "Start Campaign", disabled: true, onTrigger },
    });
    expect(changed).not.toBe(state);
  });

  it("guards against a stale commit before the shell is open", () => {
    const started = reduceCampaignShell(initialCampaignShellState(), {
      type: "month-commit-started",
    });
    expect(started.committing).toBe(true);
    expect(started.saveMessage).toBeNull();

    const committed = reduceCampaignShell(started, {
      type: "month-committed",
      campaign: { ...campaign, revision: 2 },
    });
    expect(committed.committing).toBe(false);
    expect(committed.campaign?.revision).toBe(2);
  });

  it("reports a failed commit and leaves the shell ready to retry", () => {
    const state = reduceCampaignShell(initialCampaignShellState(), {
      type: "month-commit-failed",
      failure: { _tag: "Rejected", reason: "SIMULATION_END_REACHED", diagnostics: [] },
    });
    expect(state.committing).toBe(false);
    expect(state.commitFailure).toEqual({
      _tag: "Rejected",
      reason: "SIMULATION_END_REACHED",
      diagnostics: [],
    });
    expect(state.saveMessage).toBe("Could not advance month: SIMULATION_END_REACHED.");
  });

  it("derives explicit variants for file, new-game, opening, error, and campaign modes", () => {
    const file = initialCampaignShellState();
    expect(campaignShellMode(file)).toEqual({ kind: "file", screen: "file" });

    const preferences = reduceCampaignShell(file, {
      type: "visit",
      screen: "new-game-preferences",
    });
    expect(campaignShellMode(preferences)).toEqual({
      kind: "new-game-preferences",
      screen: "new-game-preferences",
    });

    const opening = reduceCampaignShell(preferences, {
      type: "campaign-opening",
    });
    expect(campaignShellMode(opening)).toEqual({
      kind: "opening",
      screen: "new-game-preferences",
    });

    const failed = reduceCampaignShell(opening, {
      type: "campaign-open-failed",
      message: "not found",
    });
    expect(campaignShellMode(failed)).toEqual({
      kind: "open-error",
      screen: "new-game-preferences",
      message: "not found",
    });

    const opened = reduceCampaignShell(file, {
      type: "campaign-opened",
      campaign,
    });
    expect(campaignShellMode(opened)).toEqual({
      kind: "campaign",
      screen: "overview",
      campaign,
    });
  });

  it("derives explicit variants for nation, identity, and fleet-method modes", () => {
    const nation = reduceCampaignShell(initialCampaignShellState(), {
      type: "visit",
      screen: "new-game-nation",
    });
    expect(campaignShellMode(nation)).toEqual({
      kind: "new-game-nation",
      screen: "new-game-nation",
    });

    const identity = reduceCampaignShell(initialCampaignShellState(), {
      type: "visit",
      screen: "new-game-identity",
    });
    expect(campaignShellMode(identity)).toEqual({
      kind: "new-game-identity",
      screen: "new-game-identity",
    });

    const fleetMethod = reduceCampaignShell(initialCampaignShellState(), {
      type: "visit",
      screen: "new-game-fleet-method",
    });
    expect(campaignShellMode(fleetMethod)).toEqual({
      kind: "new-game-fleet-method",
      screen: "new-game-fleet-method",
    });
  });
});

describe("campaign-refreshed guard", () => {
  const opened = reduceCampaignShell(initialCampaignShellState(), {
    type: "campaign-opened",
    campaign,
  });

  it("applies a refresh for the open campaign", () => {
    const next = reduceCampaignShell(opened, {
      type: "campaign-refreshed",
      campaign: { ...campaign, revision: 2 },
    });
    expect(next.campaign?.revision).toBe(2);
  });

  it("ignores a refresh that arrives after the campaign was closed", () => {
    const closed = reduceCampaignShell(opened, { type: "campaign-closed" });
    const next = reduceCampaignShell(closed, { type: "campaign-refreshed", campaign });
    expect(next.campaign).toBeNull();
  });

  it("ignores a refresh that belongs to a different session", () => {
    const next = reduceCampaignShell(opened, {
      type: "campaign-refreshed",
      campaign: { ...campaign, sessionId: "some-other-session", revision: 9 },
    });
    expect(next.campaign?.revision).toBe(campaign.revision);
  });
});

describe("month commit", () => {
  const opened = reduceCampaignShell(initialCampaignShellState(), {
    type: "campaign-opened",
    campaign,
  });
  const commit = (state: ReturnType<typeof reduceCampaignShell>, month: number) =>
    reduceCampaignShell(state, {
      type: "month-committed",
      campaign: { ...campaign, revision: month },
    });

  it("advances the campaign revision and clears the committing flag", () => {
    const started = reduceCampaignShell(opened, { type: "month-commit-started" });
    expect(started.committing).toBe(true);
    const after = commit(commit(started, 2), 3);
    expect(after.committing).toBe(false);
    expect(after.campaign?.revision).toBe(3);
  });

  it("leaves the campaign unchanged when the commit fails", () => {
    const failed = reduceCampaignShell(commit(opened, 2), {
      type: "month-commit-failed",
      failure: { _tag: "TransportFailure", message: "boom" },
    });
    expect(failed.campaign?.revision).toBe(2);
    expect(failed.committing).toBe(false);
    expect(failed.commitFailure).toEqual({ _tag: "TransportFailure", message: "boom" });
    expect(failed.saveMessage).toBe("boom");
  });
});
