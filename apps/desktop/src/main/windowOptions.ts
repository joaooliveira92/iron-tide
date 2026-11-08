export interface DesktopWebPreferences {
  readonly preload: string;
  readonly contextIsolation: true;
  readonly nodeIntegration: false;
  readonly sandbox: true;
  readonly backgroundThrottling?: false;
}

export interface DesktopWindowOptions {
  readonly width: number;
  readonly height: number;
  readonly minWidth: number;
  readonly minHeight: number;
  readonly frame: false;
  readonly show?: false;
  readonly titleBarStyle?: "hidden";
  readonly trafficLightPosition?: { readonly x: number; readonly y: number };
  readonly webPreferences: DesktopWebPreferences;
}

export interface DesktopWindowMode {
  readonly background?: boolean;
}

export const BACKGROUND_WINDOW_SWITCH = "--bluewave-background-window";

export function isBackgroundLaunch(argv: readonly string[]): boolean {
  return argv.includes(BACKGROUND_WINDOW_SWITCH);
}

export function desktopWindowOptions(
  platform: NodeJS.Platform,
  preloadPath: string,
  mode: DesktopWindowMode = {},
): DesktopWindowOptions {
  const background = mode.background === true;
  return {
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    ...(background ? { show: false as const } : {}),
    ...(platform === "darwin"
      ? { titleBarStyle: "hidden" as const, trafficLightPosition: { x: 20, y: 21 } }
      : {}),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      ...(background ? { backgroundThrottling: false as const } : {}),
    },
  };
}
