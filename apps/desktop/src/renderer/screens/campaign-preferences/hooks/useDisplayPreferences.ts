import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  decodeCampaignPreferences,
  resolveCampaignPreferences,
  type CampaignPreferences,
} from "../../../../shared/preferences-contract.js";
import { useBridge } from "../../../lib/bridge-context.js";

const LEGACY_STORAGE_KEY = "bluewave-display-preferences";

function parseLegacy(raw: string): CampaignPreferences | null {
  try {
    return decodeCampaignPreferences(JSON.parse(raw));
  } catch {
    return null;
  }
}

function takeLegacy(): CampaignPreferences | null {
  const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (raw === null) return null;
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  return parseLegacy(raw);
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
  const campaignRef = useRef<CampaignPreferences | undefined>(undefined);
  const sessionRef = useRef<Partial<CampaignPreferences>>({});
  const loadedFor = useRef<string | undefined>(undefined);

  const commitCampaign = useCallback((next: CampaignPreferences) => {
    campaignRef.current = next;
    setCampaign(next);
  }, []);

  const commitSession = useCallback((next: Partial<CampaignPreferences>) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  useEffect(() => {
    if (sessionId === undefined || bridge === undefined || loadedFor.current === sessionId) return;
    loadedFor.current = sessionId;
    const legacy = takeLegacy();
    if (legacy !== null) {
      commitCampaign(legacy);
      void bridge.preferences.writeCampaign(sessionId, { campaign: legacy });
      return;
    }
    void bridge.preferences.readCampaign(sessionId).then((result) => {
      if (result.outcome === "success") commitCampaign(result.value.campaign);
    });
  }, [bridge, commitCampaign, sessionId]);

  const togglePref = useCallback(
    (key: keyof CampaignPreferences) => {
      const current = resolveCampaignPreferences(campaignRef.current, sessionRef.current);
      const next = { ...current, [key]: !current[key] };
      if (key in sessionRef.current) {
        const rest = { ...sessionRef.current };
        delete rest[key];
        commitSession(rest);
      }
      commitCampaign(next);
      if (sessionId !== undefined && bridge !== undefined) {
        void bridge.preferences.writeCampaign(sessionId, { campaign: next });
      }
    },
    [bridge, commitCampaign, commitSession, sessionId],
  );

  const setSessionOverride = useCallback(
    (key: keyof CampaignPreferences, value: boolean) => {
      commitSession({ ...sessionRef.current, [key]: value });
    },
    [commitSession],
  );

  const clearSessionOverrides = useCallback(() => commitSession({}), [commitSession]);

  const displayPrefs = useMemo(
    () => resolveCampaignPreferences(campaign, session),
    [campaign, session],
  );

  return { displayPrefs, togglePref, setSessionOverride, clearSessionOverrides };
}
