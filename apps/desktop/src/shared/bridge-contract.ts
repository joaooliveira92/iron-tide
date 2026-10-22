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
