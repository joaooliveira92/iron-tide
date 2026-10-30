export const STACK_SAMPLE_INTERVAL_MS = 1_000;
const MAX_FRAMES = 8;

interface DebuggerCallFrame {
  readonly functionName?: string;
  readonly url?: string;
  readonly location?: {
    readonly lineNumber?: number;
    readonly columnNumber?: number;
  };
}

interface DebuggerPausedParams {
  readonly callFrames?: readonly DebuggerCallFrame[];
}

export interface DebuggerSession {
  isAttached(): boolean;
  attach(protocolVersion?: string): void;
  detach(): void;
  sendCommand(method: string, params?: Record<string, unknown>): Promise<unknown>;
  on(
    event: "message",
    listener: (event: unknown, method: string, params: unknown, sessionId?: string) => void,
  ): void;
  removeListener(
    event: "message",
    listener: (event: unknown, method: string, params: unknown, sessionId?: string) => void,
  ): void;
}

export interface StackSamplerTarget {
  isDestroyed(): boolean;
  readonly debugger: DebuggerSession;
}

export interface RendererStackSamplerOptions {
  readonly target: StackSamplerTarget;
  readonly log: (message: string) => void;
  readonly intervalMs?: number;
}

function formatFrame(frame: DebuggerCallFrame, index: number): string {
  const name =
    frame.functionName === undefined || frame.functionName === ""
      ? "<anonymous>"
      : frame.functionName;
  const url = frame.url === undefined || frame.url === "" ? "<unknown>" : frame.url;
  const line = frame.location?.lineNumber;
  const column = frame.location?.columnNumber;
  const position =
    line === undefined
      ? url
      : `${url}:${String(line + 1)}${column === undefined ? "" : `:${String(column + 1)}`}`;
  return `#${String(index)} ${name} (${position})`;
}

export function createRendererStackSampler(options: RendererStackSamplerOptions): {
  start(): void;
  stop(): readonly string[];
  snapshot(): readonly string[];
} {
  const { target, log } = options;
  const intervalMs = options.intervalMs ?? STACK_SAMPLE_INTERVAL_MS;
  let interval: ReturnType<typeof setInterval> | undefined;
  let samples: string[] = [];
  let attachedByUs = false;
  let paused = false;

  const onMessage = (_event: unknown, method: string, params: unknown): void => {
    if (method !== "Debugger.paused") return;
    paused = true;
    const frames = (params as DebuggerPausedParams).callFrames ?? [];
    const lines = frames.slice(0, MAX_FRAMES).map(formatFrame);
    const sample = `[shell] hung-window stack sample:\n${lines.join("\n")}`;
    samples.push(sample);
    log(sample);
    void target.debugger.sendCommand("Debugger.resume").catch(() => undefined);
    paused = false;
  };

  const stop = (): readonly string[] => {
    if (interval !== undefined) {
      clearInterval(interval);
      interval = undefined;
    }
    target.debugger.removeListener("message", onMessage);
    void target.debugger.sendCommand("Debugger.disable").catch(() => undefined);
    if (attachedByUs) {
      try {
        target.debugger.detach();
      } catch {
        log("[shell] could not detach the stack sampler debugger");
      }
      attachedByUs = false;
    }
    const flushed = samples;
    samples = [];
    return flushed;
  };

  const start = (): void => {
    if (interval !== undefined || target.isDestroyed()) return;
    try {
      if (!target.debugger.isAttached()) {
        target.debugger.attach("1.3");
        attachedByUs = true;
      }
      target.debugger.on("message", onMessage);
      void target.debugger.sendCommand("Debugger.enable").catch(() => undefined);
      interval = setInterval(() => {
        if (target.isDestroyed() || paused) return;
        paused = true;
        void target.debugger.sendCommand("Debugger.pause").catch(() => {
          paused = false;
        });
      }, intervalMs);
    } catch {
      log("[shell] could not start the stack sampler");
      stop();
    }
  };

  return { start, stop, snapshot: () => [...samples] };
}
