import { Layer } from "effect";
import { PreferencesStore, preferencesStoreLayer } from "../preferences/preferencesStore.js";
import {
  CampaignPreferencesStore,
  campaignPreferencesStoreLayer,
} from "../preferences/campaignPreferencesStore.js";
import { CampaignSessionStore, campaignSessionStoreLayer } from "./campaignSessionStore.js";
import { CommandQueueStore, commandQueueStoreLayer } from "./commandQueueStore.js";
import { ContentArtifact, contentArtifactLayer } from "./contentArtifact.js";
import { CrashReporter, crashReporterLayer } from "./crashReporter.js";
import { DecisionSource, decisionSourceLayer } from "./decisionSource.js";
import {
  AppPaths,
  appPathsLayer,
  Clock,
  clockLayer,
  IdGenerator,
  idGeneratorLayer,
  NativeDialog,
  nativeDialogLayer,
} from "./platform.js";
import { ProjectStore, projectStoreLayer } from "./projectStore.js";
import { ReplayService, replayServiceLayer } from "./replayService.js";
import {
  DraftStore,
  ReportsStore,
  TurnSummariesStore,
  UiStateStore,
  sidecarStoresLayer,
} from "./sidecarStores.js";
import {
  PendingTurnStore,
  PlayerBattleStore,
  pendingTurnStoreLayer,
  playerBattleStoreLayer,
} from "./turnSidecarStores.js";

export type CommandEnv =
  | ContentArtifact
  | ProjectStore
  | CampaignSessionStore
  | CommandQueueStore
  | ReplayService
  | CrashReporter
  | UiStateStore
  | ReportsStore
  | TurnSummariesStore
  | DraftStore
  | PendingTurnStore
  | PlayerBattleStore
  | DecisionSource
  | PreferencesStore
  | CampaignPreferencesStore
  | NativeDialog
  | AppPaths
  | Clock
  | IdGenerator;

export function desktopMainLayer(): Layer.Layer<CommandEnv> {
  const platform = Layer.mergeAll(appPathsLayer(), clockLayer());
  return Layer.mergeAll(
    contentArtifactLayer(),
    projectStoreLayer(),
    campaignSessionStoreLayer(),
    commandQueueStoreLayer(),
    sidecarStoresLayer(),
    pendingTurnStoreLayer(),
    playerBattleStoreLayer(),
    decisionSourceLayer(),
    nativeDialogLayer(),
    idGeneratorLayer(),
    replayServiceLayer(),
    preferencesStoreLayer().pipe(Layer.provideMerge(platform)),
    campaignPreferencesStoreLayer(),
    crashReporterLayer().pipe(Layer.provideMerge(platform)),
  );
}
