/**
 * The desktop app's IPC envelope. `BluewaveDesktopBridge` itself lives in
 * `src/preload/index.ts` (grounded in every screen's actual import path —
 * `../../preload/index.js`, not this file) since it's what the preload
 * script literally exposes; this file holds only the generic result
 * envelope shared across every command.
 *
 * Three outcomes, not two — grounded in `command-screen-workflow.ts`'s
 * `applyRejection`, which narrows on `{ outcome: "rejected" }` specifically
 * and reads an optional `currentRevision` (told by the server on a stale
 * optimistic-concurrency conflict, so the client can refresh and retry).
 * `"error"` (transport/unexpected failure) never carries a revision.
 */
/**
 * The `{sessionId, expectedRevision, transportRequestId}` triple travels
 * together on every optimistic-concurrency command (construction and
 * fleet submit/replace/cancel payloads) — grounded in
 * `command-screen-workflow.ts`'s `CommandExecutionContext`. Extend this
 * rather than repeating the three fields.
 */
export interface CommandEnvelope {
  readonly sessionId: string;
  readonly expectedRevision: number;
  readonly transportRequestId: string;
}

/** Grounded in `WindowContext.tsx`/`App.tsx` — the shell renders its own
 * frameless-window titlebar controls, backed by these IPC calls. */
export interface WindowState {
  readonly platform: NodeJS.Platform;
  readonly isMaximized: boolean;
  readonly maximizable: boolean;
  readonly minimizable: boolean;
}

export type BridgeResult<T> =
  | { readonly outcome: "success"; readonly value: T; readonly diagnostics: readonly string[] }
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
