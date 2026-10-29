export interface DesktopWebPreferences {
  readonly preload: string;
  readonly contextIsolation: true;
  readonly nodeIntegration: false;
  readonly sandbox: true;
}

export interface DesktopWindowOptions {
  readonly width: number;
  readonly height: number;
  readonly minWidth: number;
  readonly minHeight: number;
  readonly frame: false;
  readonly titleBarStyle?: "hidden";
  readonly trafficLightPosition?: { readonly x: number; readonly y: number };
  readonly webPreferences: DesktopWebPreferences;
}

export function desktopWindowOptions(
  platform: NodeJS.Platform,
  preloadPath: string,
): DesktopWindowOptions {
  return {
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    ...(platform === "darwin"
      ? { titleBarStyle: "hidden" as const, trafficLightPosition: { x: 20, y: 21 } }
      : {}),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  };
}
