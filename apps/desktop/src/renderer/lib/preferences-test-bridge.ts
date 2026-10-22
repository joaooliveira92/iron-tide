import type { BluewaveDesktopBridge } from "../../preload/index.js";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import {
  DEFAULT_APP_PREFERENCES,
  DEFAULT_CAMPAIGN_PREFERENCES,
  PREFERENCES_SCHEMA_VERSION,
  type AppPreferences,
  type CampaignPreferences,
  type CampaignPreferencesSnapshot,
  type PreferencesSnapshot,
  type WriteAppPreferencesRequest,
  type WriteCampaignPreferencesRequest,
} from "../../shared/preferences-contract.js";

export interface PreferencesBridgeStub {
  readonly bridge: BluewaveDesktopBridge;
  readonly writes: readonly WriteAppPreferencesRequest[];
  readonly campaignWrites: readonly WriteCampaignPreferencesRequest[];
  readCalls(): number;
  current(): PreferencesSnapshot;
  currentCampaign(sessionId: string): CampaignPreferencesSnapshot;
}

export function createPreferencesBridgeStub(
  initial: AppPreferences = DEFAULT_APP_PREFERENCES,
): PreferencesBridgeStub {
  let current: PreferencesSnapshot = { version: PREFERENCES_SCHEMA_VERSION, app: initial };
  const writes: WriteAppPreferencesRequest[] = [];
  const campaignWrites: WriteCampaignPreferencesRequest[] = [];
  const campaigns = new Map<string, CampaignPreferences>();
  let readCalls = 0;

  const preferences = {
    read: async (): Promise<BridgeResult<PreferencesSnapshot>> => {
      readCalls += 1;
      return { outcome: "success", value: current, diagnostics: [] };
    },
    write: async (
      request: WriteAppPreferencesRequest,
    ): Promise<BridgeResult<PreferencesSnapshot>> => {
      writes.push(request);
      current = { version: PREFERENCES_SCHEMA_VERSION, app: request.app };
      return { outcome: "success", value: current, diagnostics: [] };
    },
    readCampaign: async (sessionId: string): Promise<BridgeResult<CampaignPreferencesSnapshot>> => {
      const campaign = campaigns.get(sessionId) ?? DEFAULT_CAMPAIGN_PREFERENCES;
      return {
        outcome: "success",
        value: { version: PREFERENCES_SCHEMA_VERSION, campaign },
        diagnostics: [],
      };
    },
    writeCampaign: async (
      sessionId: string,
      request: WriteCampaignPreferencesRequest,
    ): Promise<BridgeResult<CampaignPreferencesSnapshot>> => {
      campaignWrites.push(request);
      campaigns.set(sessionId, request.campaign);
      return {
        outcome: "success",
        value: { version: PREFERENCES_SCHEMA_VERSION, campaign: request.campaign },
        diagnostics: [],
      };
    },
  };

  return {
    bridge: { preferences } as BluewaveDesktopBridge,
    writes,
    campaignWrites,
    readCalls: () => readCalls,
    current: () => current,
    currentCampaign: (sessionId) => ({
      version: PREFERENCES_SCHEMA_VERSION,
      campaign: campaigns.get(sessionId) ?? DEFAULT_CAMPAIGN_PREFERENCES,
    }),
  };
}
