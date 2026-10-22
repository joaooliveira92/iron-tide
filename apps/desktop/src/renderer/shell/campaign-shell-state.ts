import type {
  InterruptionRequestDto,
  PendingTurnDto,
} from "../../shared/campaign-command-contract.js";
import type { PrimaryAction } from "./primary-action.js";
import type { NavigationHistory } from "./navigation-history.js";
import { currentEntry, initialHistory, visit } from "./navigation-history.js";
import type { Screen } from "./campaign-screen-registry.js";

/** The active turn interruption the player must resolve before advancing. */
export interface ShellInterruption {
  readonly request: InterruptionRequestDto | null;
  readonly pending: PendingTurnDto | null;
  /** True when a stored pending turn could not be trusted (resumption declined). */
  readonly unavailable: boolean;
}

/**
 * Why a month commit — or an interruption answer that resolves the turn — failed.
 * A tagged value the shell stores and the UI switches on, so presentation never
 * has to string-match a prose message to decide what to show.
 */
export type MonthCommitFailure =
  | {
      readonly _tag: "Rejected";
      readonly reason: string;
      readonly diagnostics: readonly string[];
    }
  | { readonly _tag: "TransportFailure"; readonly message: string };

/** Appends the engine's diagnostics, if any, to a rejection line. */
export function diagnosticsSuffix(diagnostics: readonly string[]): string {
  return diagnostics.length > 0 ? ` ${diagnostics.join("; ")}` : "";
}

/** The human line a failure presents, derived from the tagged failure. */
export function describeMonthCommitFailure(failure: MonthCommitFailure): string {
  switch (failure._tag) {
    case "Rejected":
      return `Could not advance month: ${failure.reason}.${diagnosticsSuffix(failure.diagnostics)}`;
    case "TransportFailure":
      return failure.message;
  }
}

export interface CampaignOverview {
  readonly month: { readonly year: number; readonly month: number };
  readonly treasury: number;
  /** The snapshot's optimistic-concurrency revision (turn number). */
  readonly revision: number;
  readonly sessionId: string;
  /** The player nation's name — INC-1's `PlayerProjection.nationName`. */
  readonly nationName: string;
  /**
   * The player nation's id — INC-1's `PlayerProjection.playerNationId`. Optional
   * so pre-existing shell fixtures stay valid; production always stamps it. Used
   * by presentation to resolve the active nation (e.g. currency availability)
   * without guessing from the display name.
   */
  readonly playerNationId?: string;
  /**
   * Projected monthly surplus/deficit — INC-1's
   * `PlayerProjection.projectedSurplusDeficit`. After a month commit the
   * `CommitMonthResponse` carries no projection surface, so the shell keeps
   * the last-known value until the next `inspectCampaign` refreshes it.
   */
  readonly projectedSurplusDeficit: number;
  /**
   * Active-alerts count slot, forward-wired to the INC-2 priorities
   * projection: `null` until INC-2 lands, so the header renders an explicit
   * placeholder rather than a fabricated count.
   */
  readonly activeAlertsCount: number | null;
  /**
   * True when the player nation is at war with at least one nation
   * (`PlayerProjection.knownEnemyNations` is non-empty); drives the header
   * status. Refreshed from `inspectCampaign` after every month advance.
   */
  readonly atWar: boolean;
}

export interface CampaignShellState {
  readonly campaign: CampaignOverview | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly history: NavigationHistory<Screen>;
  readonly saving: boolean;
  readonly saveMessage: string | null;
  readonly primaryAction: PrimaryAction | null;
  readonly committing: boolean;
  /** The active interruption (decision/battle/recovery), or null when advancing is unblocked. */
  readonly interruption: ShellInterruption | null;
  /** The tagged failure of the last month commit, or null when none is outstanding. */
  readonly commitFailure: MonthCommitFailure | null;
}

export type CampaignShellMode =
  | { readonly kind: "file"; readonly screen: "file" }
  | { readonly kind: "new-game-nation"; readonly screen: "new-game-nation" }
  | {
      readonly kind: "new-game-preferences";
      readonly screen: "new-game-preferences";
    }
  | {
      readonly kind: "new-game-archetype";
      readonly screen: "new-game-archetype";
    }
  | {
      readonly kind: "new-game-identity";
      readonly screen: "new-game-identity";
    }
  | {
      readonly kind: "new-game-fleet-method";
      readonly screen: "new-game-fleet-method";
    }
  | {
      readonly kind: "new-game-review";
      readonly screen: "new-game-review";
    }
  | {
      readonly kind: "new-game-launching";
      readonly screen: "new-game-launching";
    }
  | { readonly kind: "opening-briefing"; readonly screen: "opening-briefing" }
  | { readonly kind: "opening"; readonly screen: Screen }
  | {
      readonly kind: "open-error";
      readonly screen: Screen;
      readonly message: string;
    }
  | {
      readonly kind: "campaign";
      readonly screen: Screen;
      readonly campaign: CampaignOverview;
    };

export type CampaignShellEvent =
  | { readonly type: "campaign-opening" }
  | { readonly type: "campaign-opened"; readonly campaign: CampaignOverview }
  | { readonly type: "campaign-open-failed"; readonly message: string }
  | { readonly type: "campaign-closed" }
  | { readonly type: "visit"; readonly screen: Screen }
  | {
      readonly type: "history-replaced";
      readonly history: NavigationHistory<Screen>;
    }
  | { readonly type: "save-started" }
  | { readonly type: "save-finished"; readonly message: string | null }
  | { readonly type: "save-message-cleared" }
  | {
      readonly type: "primary-action-changed";
      readonly action: PrimaryAction | null;
    }
  | { readonly type: "month-commit-started" }
  | {
      readonly type: "month-committed";
      readonly campaign: CampaignOverview;
    }
  | { readonly type: "campaign-refreshed"; readonly campaign: CampaignOverview }
  | { readonly type: "month-commit-failed"; readonly failure: MonthCommitFailure }
  | { readonly type: "interruption-set"; readonly interruption: ShellInterruption }
  | { readonly type: "interruption-cleared" };

export function initialCampaignShellState(): CampaignShellState {
  return {
    campaign: null,
    loading: false,
    error: null,
    history: initialHistory<Screen>("file"),
    saving: false,
    saveMessage: null,
    primaryAction: null,
    committing: false,
    interruption: null,
    commitFailure: null,
  };
}

/**
 * One state transition interface for the campaign shell. Related invariants
 * move together: opening a campaign clears errors and enters Overview; closing
 * it clears campaign-specific navigation, notices, and primary actions.
 */
export function reduceCampaignShell(
  state: CampaignShellState,
  event: CampaignShellEvent,
): CampaignShellState {
  switch (event.type) {
    case "campaign-opening":
      return { ...state, loading: true, error: null };
    case "campaign-opened":
      return {
        ...state,
        campaign: event.campaign,
        loading: false,
        error: null,
        history: visit(state.history, "overview"),
      };
    case "campaign-open-failed":
      return { ...state, loading: false, error: event.message };
    case "campaign-closed":
      return initialCampaignShellState();
    case "visit":
      return { ...state, history: visit(state.history, event.screen) };
    case "history-replaced":
      return { ...state, history: event.history };
    case "save-started":
      return { ...state, saving: true, saveMessage: null };
    case "save-finished":
      return { ...state, saving: false, saveMessage: event.message };
    case "save-message-cleared":
      return { ...state, saveMessage: null, commitFailure: null };
    case "primary-action-changed": {
      const current = state.primaryAction;
      const next = event.action;
      if (
        current !== null &&
        next !== null &&
        current.label === next.label &&
        current.disabled === next.disabled &&
        current.onTrigger === next.onTrigger
      ) {
        return state;
      }
      return { ...state, primaryAction: next };
    }
    case "month-commit-started":
      return { ...state, committing: true, saveMessage: null, commitFailure: null };
    case "month-committed":
      return {
        ...state,
        committing: false,
        campaign: event.campaign,
        commitFailure: null,
      };
    case "campaign-refreshed":
      // A late refresh must not resurrect a closed campaign or replace a different one.
      if (state.campaign === null || state.campaign.sessionId !== event.campaign.sessionId) {
        return state;
      }
      return { ...state, campaign: event.campaign };
    case "month-commit-failed":
      return {
        ...state,
        committing: false,
        commitFailure: event.failure,
        saveMessage: describeMonthCommitFailure(event.failure),
      };
    case "interruption-set":
      return { ...state, committing: false, interruption: event.interruption };
    case "interruption-cleared":
      return { ...state, interruption: null };
  }
}

export function currentShellScreen(state: CampaignShellState): Screen {
  return currentEntry(state.history);
}

/**
 * Collapses the shell's related fields into one explicit UI variant. Consumers
 * switch on `kind` instead of interpreting combinations of campaign, loading,
 * error, and route state independently.
 */
export function campaignShellMode(state: CampaignShellState): CampaignShellMode {
  const screen = currentShellScreen(state);
  if (state.loading) return { kind: "opening", screen };
  if (state.error !== null) {
    return { kind: "open-error", screen, message: state.error };
  }
  if (state.campaign !== null) {
    return { kind: "campaign", screen, campaign: state.campaign };
  }
  if (screen === "new-game-nation") {
    return { kind: "new-game-nation", screen };
  }
  if (screen === "new-game-preferences") {
    return { kind: "new-game-preferences", screen };
  }
  if (screen === "new-game-archetype") {
    return { kind: "new-game-archetype", screen };
  }
  if (screen === "new-game-identity") {
    return { kind: "new-game-identity", screen };
  }
  if (screen === "new-game-fleet-method") {
    return { kind: "new-game-fleet-method", screen };
  }
  if (screen === "new-game-review") {
    return { kind: "new-game-review", screen };
  }
  if (screen === "new-game-launching") {
    return { kind: "new-game-launching", screen };
  }
  if (screen === "opening-briefing") {
    return { kind: "opening-briefing", screen };
  }
  return { kind: "file", screen: "file" };
}
