import type { PreferencesRecoveryInfo, PreferencesSnapshot } from "./preferences-contract.js";

export interface CommandEnvelope {
  readonly sessionId: string;
  readonly expectedRevision: number;
  readonly transportRequestId: string;
}

export interface WindowState {
  readonly platform: NodeJS.Platform;
  readonly isMaximized: boolean;
  readonly maximizable: boolean;
  readonly minimizable: boolean;
}

export interface AppStartupSnapshot {
  readonly preferences: PreferencesSnapshot;
  readonly windowState: WindowState;
  readonly preferencesRecovery?: PreferencesRecoveryInfo;
}

export type BridgeResult<T> =
  | {
      readonly outcome: "success";
      readonly value: T;
      readonly diagnostics: readonly string[];
    }
  | {
      readonly outcome: "rejected";
      readonly reason: string;
      readonly diagnostics: readonly string[];
      readonly currentRevision?: number;
    }
  | {
      readonly outcome: "error";
      readonly reason: string;
      readonly diagnostics: readonly string[];
    };
