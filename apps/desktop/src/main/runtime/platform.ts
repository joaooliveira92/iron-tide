import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { Context, Effect, Layer } from "effect";
import { CommandFailed } from "./commandError.js";

export class NativeDialog extends Context.Service<
  NativeDialog,
  {
    readonly chooseSaveDirectory: (
      suggestedName: string,
    ) => Effect.Effect<string | null, CommandFailed>;
    readonly choosePackageDirectory: () => Effect.Effect<string | null, CommandFailed>;
    readonly chooseCopyDirectory: (
      suggestedName: string,
    ) => Effect.Effect<string | null, CommandFailed>;
  }
>()("bluewave/desktop/NativeDialog") {}

export interface AppPathsShape {
  readonly supportDir: () => Effect.Effect<string, CommandFailed>;
  readonly userDataDir: () => Effect.Effect<string, CommandFailed>;
  readonly homeDir: string;
  readonly appVersion: () => Effect.Effect<string, CommandFailed>;
  readonly platform: NodeJS.Platform;
  readonly arch: string;
  readonly processId: number;
}

export class AppPaths extends Context.Service<AppPaths, AppPathsShape>()(
  "bluewave/desktop/AppPaths",
) {}

export class Clock extends Context.Service<
  Clock,
  {
    readonly now: () => Effect.Effect<Date>;
  }
>()("bluewave/desktop/Clock") {}

export class IdGenerator extends Context.Service<
  IdGenerator,
  {
    readonly next: () => Effect.Effect<string>;
  }
>()("bluewave/desktop/IdGenerator") {}

export function nativeDialogLayer(): Layer.Layer<NativeDialog> {
  return Layer.succeed(NativeDialog, {
    chooseSaveDirectory: (suggestedName) =>
      Effect.tryPromise({
        try: async () => {
          const { dialog } = await import("electron");
          const result = await dialog.showSaveDialog({
            title: "Choose a location to save this campaign",
            defaultPath: suggestedName,
            buttonLabel: "Create Campaign",
          });
          return result.canceled || !result.filePath ? null : result.filePath;
        },
        catch: (e) => new CommandFailed({ reason: "DIALOG_FAILED", diagnostics: [String(e)] }),
      }),
    choosePackageDirectory: () =>
      Effect.tryPromise({
        try: async () => {
          const { dialog } = await import("electron");
          const result = await dialog.showOpenDialog({
            title: "Choose a campaign package",
            buttonLabel: "Open",
            properties: ["openDirectory"],
          });
          return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]!;
        },
        catch: (e) => new CommandFailed({ reason: "DIALOG_FAILED", diagnostics: [String(e)] }),
      }),
    chooseCopyDirectory: (suggestedName) =>
      Effect.tryPromise({
        try: async () => {
          const { dialog } = await import("electron");
          const result = await dialog.showSaveDialog({
            title: "Save a copy of this campaign",
            defaultPath: suggestedName,
            buttonLabel: "Save Copy",
          });
          return result.canceled || !result.filePath ? null : result.filePath;
        },
        catch: (e) => new CommandFailed({ reason: "DIALOG_FAILED", diagnostics: [String(e)] }),
      }),
  });
}

export function appPathsLayer(): Layer.Layer<AppPaths> {
  return Layer.succeed(AppPaths, {
    supportDir: () =>
      Effect.tryPromise({
        try: async () => {
          const { app } = await import("electron");
          return join(app.getPath("userData"), "support");
        },
        catch: (e) => new CommandFailed({ reason: "PATH_UNAVAILABLE", diagnostics: [String(e)] }),
      }),
    userDataDir: () =>
      Effect.tryPromise({
        try: async () => {
          const { app } = await import("electron");
          return app.getPath("userData");
        },
        catch: (e) => new CommandFailed({ reason: "PATH_UNAVAILABLE", diagnostics: [String(e)] }),
      }),
    homeDir: homedir(),
    appVersion: () =>
      Effect.tryPromise({
        try: async () => {
          const { app } = await import("electron");
          return app.getVersion();
        },
        catch: (e) => new CommandFailed({ reason: "PATH_UNAVAILABLE", diagnostics: [String(e)] }),
      }),
    platform: process.platform,
    arch: process.arch,
    processId: process.pid,
  });
}

export function clockLayer(): Layer.Layer<Clock> {
  return Layer.succeed(Clock, { now: () => Effect.sync(() => new Date()) });
}

export function idGeneratorLayer(): Layer.Layer<IdGenerator> {
  return Layer.succeed(IdGenerator, { next: () => Effect.sync(() => randomUUID()) });
}
