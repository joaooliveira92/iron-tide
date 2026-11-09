import { BrowserWindow } from "electron";
import { desktopWindowOptions, isBackgroundLaunch } from "./windowOptions.js";

export function createDesktopWindow(preloadPath: string): BrowserWindow {
  return new BrowserWindow(
    desktopWindowOptions(process.platform, preloadPath, {
      background: isBackgroundLaunch(process.argv),
    }),
  );
}
