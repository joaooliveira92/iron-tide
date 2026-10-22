import type { BluewaveDesktopBridge } from "../../preload/index.js";

type Flush = () => void | Promise<void>;

type QuitFlushBridge = Pick<BluewaveDesktopBridge, "onQuitFlush" | "notifyQuitFlushComplete">;

const flushes = new Set<Flush>();
let installed = false;

export function registerAppFlush(flush: Flush): () => void {
  flushes.add(flush);
  return () => {
    flushes.delete(flush);
  };
}

export async function runAppFlushes(): Promise<void> {
  await Promise.all(
    [...flushes].map((flush) =>
      Promise.resolve()
        .then(flush)
        .catch(() => undefined),
    ),
  );
}

export function installAppFlushListener(
  bridge: QuitFlushBridge | undefined = window.bluewave,
): void {
  if (installed || bridge?.onQuitFlush === undefined) return;
  installed = true;
  bridge.onQuitFlush(() => {
    void runAppFlushes().finally(() => bridge.notifyQuitFlushComplete?.());
  });
}
