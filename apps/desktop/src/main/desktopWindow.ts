import { BrowserWindow } from "electron";
import { desktopWindowOptions } from "./windowOptions.js";

export function createDesktopWindow(preloadPath: string): BrowserWindow {
  return new BrowserWindow(desktopWindowOptions(process.platform, preloadPath));
}
