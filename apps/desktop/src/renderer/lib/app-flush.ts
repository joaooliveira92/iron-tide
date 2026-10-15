/**
 * Renderer-side flush registry for the shell's bounded quit handshake
 * (ADR-0121). Modules that own deferred writes (the drawing-board draft
 * autosave, ADR-0082) register a flush; when the main process asks the renderer
 * to flush on quit, the shell runs them all — best-effort and failure-isolated —
 * then acknowledges so the quit can proceed.
 */
import type { BluewaveDesktopBridge } from "../../preload/index.js";

type Flush = () => void | Promise<void>;

/** Only the optional quit-flush handshake is required to install the listener. */
type QuitFlushBridge = Pick<BluewaveDesktopBridge, "onQuitFlush" | "notifyQuitFlushComplete">;

const flushes = new Set<Flush>();
let installed = false;

/** Registers a flush; returns an unregister function. */
export function registerAppFlush(flush: Flush): () => void {
  flushes.add(flush);
  return () => {
    flushes.delete(flush);
  };
}

/** Runs every registered flush, isolating failures, resolving when all settle. */
export async function runAppFlushes(): Promise<void> {
  await Promise.all(
    [...flushes].map((flush) =>
      Promise.resolve()
        .then(flush)
        .catch(() => undefined),
    ),
  );
}

/**
 * Wires the main process's quit request (`app:quit-flush`) to the registry and
 * acknowledges with `notifyQuitFlushComplete`. Idempotent, and a no-op when the
 * bridge (or the optional handshake) is absent — tests and embedding.
 */
export function installAppFlushListener(
  bridge: QuitFlushBridge | undefined = window.bluewave,
): void {
  if (installed || bridge?.onQuitFlush === undefined) return;
  installed = true;
  bridge.onQuitFlush(() => {
    void runAppFlushes().finally(() => bridge.notifyQuitFlushComplete?.());
  });
}
