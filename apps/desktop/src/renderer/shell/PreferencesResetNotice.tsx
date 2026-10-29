import { useEffect } from "react";
import type { PreferencesRecoveryInfo } from "../../shared/preferences-contract.js";
import { toast } from "../components/ui/toast.js";

export const PREFERENCES_RESET_TOAST_ID = "preferences-reset";

export function preferencesResetMessage(recovery: PreferencesRecoveryInfo): string {
  return `Bluewave could not read your preferences (${recovery.reason}) at ${recovery.file}, so it started with defaults. The existing file was left untouched.`;
}

export function PreferencesResetNotice({
  recovery,
}: {
  readonly recovery: PreferencesRecoveryInfo | undefined;
}) {
  useEffect(() => {
    if (recovery === undefined) return;
    toast(preferencesResetMessage(recovery), {
      id: PREFERENCES_RESET_TOAST_ID,
      duration: 0,
    });
  }, [recovery]);
  return null;
}
