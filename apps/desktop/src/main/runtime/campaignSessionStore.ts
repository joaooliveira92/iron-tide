// The in-memory campaign-session registry as a service (INC-3; ADR-0159). The
// process-local session + construction-workspace state (no persistence of its
// own — the authoritative record is the `SaveStore` package) is resolved through
// the Layer rather than by importing the module-level Maps.
import { Context, Effect, Layer } from "effect";
import {
  getCampaignSession,
  registerCampaignSession,
  removeCampaignSession,
  type CampaignSessionRecord,
} from "../campaignSessions.js";
import {
  clearConstructionWorkspace,
  getConstructionWorkspace,
  hasConstructionWorkspace,
  type ConstructionWorkspace,
} from "../constructionWorkspace.js";
import { SessionNotFound } from "./commandError.js";

export class CampaignSessionStore extends Context.Service<
  CampaignSessionStore,
  {
    readonly get: (sessionId: string) => Effect.Effect<CampaignSessionRecord, SessionNotFound>;
    readonly register: (record: CampaignSessionRecord) => Effect.Effect<void>;
    readonly remove: (sessionId: string) => Effect.Effect<void>;
    readonly getConstructionWorkspace: (
      record: CampaignSessionRecord,
    ) => Effect.Effect<ConstructionWorkspace>;
    readonly hasConstructionWorkspace: (sessionId: string) => Effect.Effect<boolean>;
    readonly clearConstructionWorkspace: (sessionId: string) => Effect.Effect<void>;
  }
>()("bluewave/desktop/CampaignSessionStore") {}

export function campaignSessionStoreLayer(): Layer.Layer<CampaignSessionStore> {
  return Layer.succeed(CampaignSessionStore, {
    get: (sessionId) => {
      const record = getCampaignSession(sessionId);
      return record === undefined
        ? Effect.fail(new SessionNotFound({ sessionId }))
        : Effect.succeed(record);
    },
    register: (record) => Effect.sync(() => registerCampaignSession(record)),
    remove: (sessionId) => Effect.sync(() => removeCampaignSession(sessionId)),
    getConstructionWorkspace: (record) => Effect.sync(() => getConstructionWorkspace(record)),
    hasConstructionWorkspace: (sessionId) => Effect.sync(() => hasConstructionWorkspace(sessionId)),
    clearConstructionWorkspace: (sessionId) =>
      Effect.sync(() => clearConstructionWorkspace(sessionId)),
  });
}
