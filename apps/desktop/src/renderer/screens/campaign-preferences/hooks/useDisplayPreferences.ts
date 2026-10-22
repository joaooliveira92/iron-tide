import { useCallback, useEffect, useRef, useState } from "react";

import {
  DEFAULT_CAMPAIGN_PREFERENCES,
  resolveCampaignPreferences,
  type CampaignPreferences,
} from "../../../../shared/preferences-contract.js";
import { useBridge } from "../../../lib/bridge-context.js";

const LEGACY_STORAGE_KEY = "bluewave-display-preferences";

function readLegacy(): CampaignPreferences | null {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw === null ? null : (JSON.parse(raw) as CampaignPreferences);
  } catch {
    return null;
  }
}

export interface UseDisplayPreferencesReturn {
  readonly displayPrefs: CampaignPreferences;
  readonly togglePref: (key: keyof CampaignPreferences) => void;
  readonly setSessionOverride: (key: keyof CampaignPreferences, value: boolean) => void;
  readonly clearSessionOverrides: () => void;
}

export function useDisplayPreferences(sessionId?: string): UseDisplayPreferencesReturn {
  const bridge = useBridge();
  const [campaign, setCampaign] = useState<CampaignPreferences | undefined>(undefined);
  const [session, setSession] = useState<Partial<CampaignPreferences>>({});
  const loadedFor = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (sessionId === undefined || bridge === undefined || loadedFor.current === sessionId) return;
    loadedFor.current = sessionId;
    const legacy = readLegacy();
    if (legacy !== null) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      setCampaign(legacy);
      void bridge.preferences.writeCampaign(sessionId, { campaign: legacy });
      return;
    }
    void bridge.preferences.readCampaign(sessionId).then((result) => {
      if (result.outcome === "success") setCampaign(result.value.campaign);
    });
  }, [bridge, sessionId]);

  const togglePref = useCallback(
    (key: keyof CampaignPreferences) => {
      setCampaign((prev) => {
        const current = { ...DEFAULT_CAMPAIGN_PREFERENCES, ...prev, ...session };
        const next = { ...current, [key]: !current[key] };
        setSession((s) => {
          if (!(key in s)) return s;
          const rest = { ...s };
          delete rest[key];
          return rest;
        });
        if (sessionId !== undefined && bridge !== undefined) {
          void bridge.preferences.writeCampaign(sessionId, { campaign: next });
        }
        return next;
      });
    },
    [bridge, session, sessionId],
  );

  const setSessionOverride = useCallback((key: keyof CampaignPreferences, value: boolean) => {
    setSession((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearSessionOverrides = useCallback(() => setSession({}), []);

  return {
    displayPrefs: resolveCampaignPreferences(campaign, session),
    togglePref,
    setSessionOverride,
    clearSessionOverrides,
  };
}
