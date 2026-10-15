// The desktop main service graph (INC-1..INC-4; ADR-0159). One Layer composed of
// every service a command program may require; grows as slices add services. The
// Electron main process builds one `ManagedRuntime` from this and disposes it on
// quit.
import { Layer } from "effect";
import { CampaignSessionStore, campaignSessionStoreLayer } from "./campaignSessionStore.js";
import { CommandQueueStore, commandQueueStoreLayer } from "./commandQueueStore.js";
import { ContentArtifact, contentArtifactLayer } from "./contentArtifact.js";
import { CrashReporter, crashReporterLayer } from "./crashReporter.js";
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
import { DraftStore, ReportsStore, UiStateStore, sidecarStoresLayer } from "./sidecarStores.js";

/** Every service the desktop command programs may require. */
export type CommandEnv =
  | ContentArtifact
  | ProjectStore
  | CampaignSessionStore
  | CommandQueueStore
  | ReplayService
  | CrashReporter
  | UiStateStore
  | ReportsStore
  | DraftStore
  | NativeDialog
  | AppPaths
  | Clock
  | IdGenerator;

/**
 * The desktop main service graph. `CrashReporter` resolves its `AppPaths` +
 * `Clock` config through the same graph via `Layer.provideMerge`, so the layer
 * keeps a closed `never` requirement (one `ManagedRuntime`).
 */
export function desktopMainLayer(): Layer.Layer<CommandEnv> {
  const platform = Layer.mergeAll(appPathsLayer(), clockLayer());
  return Layer.mergeAll(
    contentArtifactLayer(),
    projectStoreLayer(),
    campaignSessionStoreLayer(),
    commandQueueStoreLayer(),
    sidecarStoresLayer(),
    nativeDialogLayer(),
    idGeneratorLayer(),
    replayServiceLayer(),
    crashReporterLayer().pipe(Layer.provideMerge(platform)),
  );
}
