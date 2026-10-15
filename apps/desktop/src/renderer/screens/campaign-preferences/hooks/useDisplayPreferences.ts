import { useCallback, useEffect, useState } from "react";
import type { DisplayPreferences } from "../types.js";

const STORAGE_KEY = "bluewave-display-preferences";

const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
  showDetailedTooltips: true,
  confirmBeforeTurn: true,
  showUnitFatigue: true,
  showSupplyOverlay: false,
};

function loadDisplayPreferences(): DisplayPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_DISPLAY_PREFERENCES;
    return JSON.parse(raw) as DisplayPreferences;
  } catch {
    return DEFAULT_DISPLAY_PREFERENCES;
  }
}

export interface UseDisplayPreferencesReturn {
  readonly displayPrefs: DisplayPreferences;
  readonly togglePref: (key: keyof DisplayPreferences) => void;
}

export function useDisplayPreferences(): UseDisplayPreferencesReturn {
  const [displayPrefs, setDisplayPrefs] = useState<DisplayPreferences>(loadDisplayPreferences);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(displayPrefs));
  }, [displayPrefs]);

  const togglePref = useCallback((key: keyof DisplayPreferences) => {
    setDisplayPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  return { displayPrefs, togglePref };
}
