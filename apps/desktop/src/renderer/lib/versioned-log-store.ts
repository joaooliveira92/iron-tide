export const LOG_STORE_SCHEMA_VERSION = 1;

export interface LogStoreEnvelope<T> {
  readonly schemaVersion: number;
  readonly entries: readonly T[];
}

export interface LogStoreOptions<T> {
  readonly storageKey: string;
  readonly maxEntries: number;
  readonly maxChars: number;
  readonly isEntry: (value: unknown) => value is T;
  readonly schedule?: (task: () => void) => void;
}

export interface LogStore<T> {
  readonly storageKey: string;
  entries(): readonly T[];
  prepend(entry: T): void;
  clear(): void;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function envelopeEntries<T>(parsed: unknown, isEntry: (value: unknown) => value is T): T[] {
  if (Array.isArray(parsed)) return parsed.filter(isEntry);
  if (
    isRecord(parsed) &&
    parsed.schemaVersion === LOG_STORE_SCHEMA_VERSION &&
    Array.isArray(parsed.entries)
  )
    return parsed.entries.filter(isEntry);
  return [];
}

function envelope<T>(entries: readonly T[]): LogStoreEnvelope<T> {
  return { schemaVersion: LOG_STORE_SCHEMA_VERSION, entries };
}

function serializeWithin<T>(entries: readonly T[], maxChars: number): string {
  let kept = entries;
  while (kept.length > 0) {
    const text = JSON.stringify(envelope(kept));
    if (text.length <= maxChars) return text;
    kept = kept.slice(0, -1);
  }
  return JSON.stringify(envelope<T>([]));
}

function deferIdle(task: () => void): void {
  const requestIdleCallback = (window as Partial<typeof window>).requestIdleCallback;
  if (requestIdleCallback) requestIdleCallback(task);
  else window.setTimeout(task, 0);
}

export function createLogStore<T>(options: LogStoreOptions<T>): LogStore<T> {
  const defer = options.schedule ?? deferIdle;
  let cache: T[] | null = null;
  let scheduled = false;

  function read(): T[] {
    if (cache !== null) return cache;
    const raw = localStorage.getItem(options.storageKey);
    try {
      cache = envelopeEntries(JSON.parse(raw ?? "null"), options.isEntry);
    } catch {
      cache = [];
    }
    return cache;
  }

  function persist(): void {
    scheduled = false;
    const kept = read().slice(0, options.maxEntries);
    try {
      if (kept.length === 0) localStorage.removeItem(options.storageKey);
      else localStorage.setItem(options.storageKey, serializeWithin(kept, options.maxChars));
    } catch (error) {
      console.error(`Failed to save ${options.storageKey}`, error);
    }
  }

  function schedule(): void {
    if (scheduled) return;
    scheduled = true;
    defer(persist);
  }

  return {
    storageKey: options.storageKey,
    entries: read,
    prepend(entry: T): void {
      cache = [entry, ...read()].slice(0, options.maxEntries);
      schedule();
    },
    clear(): void {
      cache = [];
      localStorage.removeItem(options.storageKey);
    },
  };
}
