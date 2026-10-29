import { shouldReloadForDevToolsHook } from "./shellPolicy.js";

interface DevToolsWebContents {
  on(event: "did-finish-load", listener: () => void): void;
  executeJavaScript(code: string): Promise<unknown>;
  reload(): void;
}

export interface DevToolsWindow {
  readonly webContents: DevToolsWebContents;
}

export function attachDevToolsPageHook(
  window: DevToolsWindow,
  log: (message: string) => void,
): void {
  let reloaded = false;
  window.webContents.on("did-finish-load", () => {
    if (reloaded) return;
    void window.webContents
      .executeJavaScript(
        "window.__REACT_DEVTOOLS_GLOBAL_HOOK__ ? window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers?.size : -1",
      )
      .then((rendererCount: unknown) => {
        if (
          typeof rendererCount === "number" &&
          shouldReloadForDevToolsHook(rendererCount, reloaded)
        ) {
          reloaded = true;
          log("[shell] React DevTools hook not attached yet; reloading once");
          window.webContents.reload();
        }
      })
      .catch(() => undefined);
  });
}
