import { type ArchetypeSelection } from "@bluewave/campaign-engine";
import { useCallback, useMemo, useState } from "react";
import type { BluewaveDesktopBridge } from "../../preload/index.js";
import type { NewGameOptions } from "../../shared/new-game-contract.js";
import {
  ADMIRAL_PRESET_VALUES,
  RECOMMENDED_FLEET_METHOD_ID,
} from "../screens/new-game/admiral-preset.js";
import type { FleetMethodDraft } from "../screens/new-game/new-game-fleet-method-screen-state.js";
import type { CampaignIdentityDraft } from "../screens/new-game/new-game-identity-screen-state.js";
import type { DraftPreferences } from "../screens/new-game/new-game-preferences-screen-state.js";
import { COSMETIC_MINIMUM_DURATION_MS } from "../screens/new-game/world-generation-presentation.js";
import type { Screen } from "./campaign-screen-registry.js";
import { compileNewGame, isLaunchableDraft } from "./new-game-compile.js";
import { draftWithNation, type NewGameDraft } from "./new-game-draft.js";

export type { NewGameDraft } from "./new-game-draft.js";

type NewGameBridge = Pick<BluewaveDesktopBridge, "campaign">;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface NewGameNavigation {
  readonly openCampaign: (sessionId: string) => Promise<void>;
  readonly selectScreen: (screen: Screen) => void;
}

export interface NewGameFlow {
  readonly state: {
    readonly draft: NewGameDraft | null;
    readonly status: "ready" | "launching";
    readonly error: string | null;
    readonly briefingSessionId: string | null;
  };
  readonly actions: {
    readonly start: () => void;
    readonly cancel: () => void;
    readonly confirmNation: (nationId: string) => void;
    readonly applyRecommendedSetup: (nationId: string) => void;
    readonly backToNation: () => void;
    readonly acceptPreferences: (preferences: DraftPreferences, options: NewGameOptions) => void;
    readonly backToPreferences: () => void;
    readonly acceptArchetype: (archetype: ArchetypeSelection) => void;
    readonly backToArchetype: () => void;
    readonly acceptIdentity: (identity: CampaignIdentityDraft) => void;
    readonly backToIdentity: () => void;
    readonly acceptFleetMethod: (fleetMethod: FleetMethodDraft) => void;
    readonly backToFleetMethod: () => void;
    readonly launch: () => Promise<void>;
    readonly backToReviewFromLaunch: () => void;
    readonly takeCommand: () => Promise<void>;
  };
}

export function useNewGameFlow(
  bridge: NewGameBridge | undefined,
  navigation: NewGameNavigation,
): NewGameFlow {
  const [draft, setDraft] = useState<NewGameDraft | null>(null);
  const [status, setStatus] = useState<"ready" | "launching">("ready");
  const [error, setError] = useState<string | null>(null);
  const [briefingSessionId, setBriefingSessionId] = useState<string | null>(null);

  const start = useCallback(() => {
    setDraft(null);
    setError(null);
    setBriefingSessionId(null);
    navigation.selectScreen("new-game-nation");
  }, [navigation]);

  const cancel = useCallback(() => {
    navigation.selectScreen("file");
  }, [navigation]);

  const confirmNation = useCallback(
    (nationId: string) => {
      setDraft((current) => draftWithNation(current, nationId));
      navigation.selectScreen("new-game-preferences");
    },
    [navigation],
  );

  const applyRecommendedSetup = useCallback((nationId: string) => {
    setDraft((current) => ({
      ...draftWithNation(current, nationId),
      fleetMethod: { legacyFleetModeId: RECOMMENDED_FLEET_METHOD_ID },
      recommendedPreset: ADMIRAL_PRESET_VALUES,
    }));
  }, []);

  const backToNation = useCallback(() => {
    navigation.selectScreen("new-game-nation");
  }, [navigation]);

  const acceptPreferences = useCallback(
    (preferences: DraftPreferences, options: NewGameOptions) => {
      setDraft((current) => (current === null ? null : { ...current, preferences, options }));
      navigation.selectScreen("new-game-archetype");
    },
    [navigation],
  );

  const backToPreferences = useCallback(() => {
    navigation.selectScreen("new-game-preferences");
  }, [navigation]);

  const acceptArchetype = useCallback(
    (archetype: ArchetypeSelection) => {
      setDraft((current) => (current === null ? null : { ...current, archetype }));
      navigation.selectScreen("new-game-identity");
    },
    [navigation],
  );

  const backToArchetype = useCallback(() => {
    navigation.selectScreen("new-game-archetype");
  }, [navigation]);

  const acceptIdentity = useCallback(
    (identity: CampaignIdentityDraft) => {
      setDraft((current) => (current === null ? null : { ...current, identity }));
      navigation.selectScreen("new-game-fleet-method");
    },
    [navigation],
  );

  const backToIdentity = useCallback(() => {
    navigation.selectScreen("new-game-identity");
  }, [navigation]);

  const acceptFleetMethod = useCallback(
    (fleetMethod: FleetMethodDraft) => {
      setDraft((current) => (current === null ? null : { ...current, fleetMethod }));
      navigation.selectScreen("new-game-review");
    },
    [navigation],
  );

  const backToFleetMethod = useCallback(() => {
    navigation.selectScreen("new-game-fleet-method");
  }, [navigation]);

  const launch = useCallback(async () => {
    if (bridge === undefined || !isLaunchableDraft(draft)) return;
    navigation.selectScreen("new-game-launching");
    setStatus("launching");
    setError(null);
    try {
      const outcome = await compileNewGame(bridge, draft);
      if (outcome.kind === "cancelled") {
        navigation.selectScreen("new-game-review");
        return;
      }
      if (outcome.kind === "failed") {
        setError(outcome.message);
        return;
      }
      await delay(COSMETIC_MINIMUM_DURATION_MS);
      setDraft(null);
      setBriefingSessionId(outcome.sessionId);
      navigation.selectScreen("opening-briefing");
    } finally {
      setStatus("ready");
    }
  }, [bridge, draft, navigation]);

  const backToReviewFromLaunch = useCallback(() => {
    setError(null);
    navigation.selectScreen("new-game-review");
  }, [navigation]);

  const takeCommand = useCallback(async () => {
    if (briefingSessionId === null) return;
    const sessionId = briefingSessionId;
    await navigation.openCampaign(sessionId);
    setBriefingSessionId(null);
  }, [briefingSessionId, navigation]);

  return useMemo(
    () => ({
      state: { draft, status, error, briefingSessionId },
      actions: {
        start,
        cancel,
        confirmNation,
        applyRecommendedSetup,
        backToNation,
        acceptPreferences,
        backToPreferences,
        acceptArchetype,
        backToArchetype,
        acceptIdentity,
        backToIdentity,
        acceptFleetMethod,
        backToFleetMethod,
        launch,
        backToReviewFromLaunch,
        takeCommand,
      },
    }),
    [
      acceptArchetype,
      acceptFleetMethod,
      acceptIdentity,
      acceptPreferences,
      applyRecommendedSetup,
      backToArchetype,
      backToFleetMethod,
      backToIdentity,
      backToNation,
      backToPreferences,
      backToReviewFromLaunch,
      briefingSessionId,
      cancel,
      confirmNation,
      draft,
      error,
      launch,
      start,
      status,
      takeCommand,
    ],
  );
}
