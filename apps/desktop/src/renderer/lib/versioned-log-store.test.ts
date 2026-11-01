import { beforeEach, describe, expect, it } from "vite-plus/test";

import { LOG_STORE_SCHEMA_VERSION, createLogStore, isRecord } from "./versioned-log-store.js";

interface Entry {
  readonly id: string;
  readonly note: string;
}

const KEY = "bluewave-test-log-store";

const ALPHA: Entry = { id: "alpha", note: "first" };
const BRAVO: Entry = { id: "bravo", note: "second" };
const CHARLIE: Entry = { id: "charlie", note: "third" };

function isEntry(value: unknown): value is Entry {
  return isRecord(value) && typeof value.id === "string" && typeof value.note === "string";
}

function entry(id: string, note: string): Entry {
  return { id, note };
}

function makeStore(options: Partial<{ maxEntries: number; maxChars: number }> = {}) {
  const tasks: (() => void)[] = [];
  const store = createLogStore<Entry>({
    storageKey: KEY,
    maxEntries: options.maxEntries ?? 3,
    maxChars: options.maxChars ?? 2000,
    isEntry,
    schedule: (task) => tasks.push(task),
  });
  const flush = (): void => {
    let task = tasks.shift();
    while (task !== undefined) {
      task();
      task = tasks.shift();
    }
  };
  return { store, flush };
}

function stored(): unknown {
  return JSON.parse(localStorage.getItem(KEY) ?? "null");
}

describe("versioned log store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("writes a schema-versioned envelope, newest entry first", () => {
    const { store, flush } = makeStore();
    store.prepend(ALPHA);
    store.prepend(BRAVO);
    flush();
    expect(stored()).toEqual({
      schemaVersion: LOG_STORE_SCHEMA_VERSION,
      entries: [BRAVO, ALPHA],
    });
  });

  it("reads back what it wrote through a second store instance", () => {
    const first = makeStore();
    first.store.prepend(ALPHA);
    first.store.prepend(BRAVO);
    first.flush();
    const second = makeStore();
    expect(second.store.entries()).toEqual([BRAVO, ALPHA]);
  });

  it("migrates an unversioned bare array on read", () => {
    localStorage.setItem(KEY, JSON.stringify([BRAVO, ALPHA]));
    const { store } = makeStore();
    expect(store.entries()).toEqual([BRAVO, ALPHA]);
  });

  it("drops entries that fail the guard, from legacy and versioned payloads", () => {
    localStorage.setItem(KEY, JSON.stringify([BRAVO, { id: 42 }, "nope", ALPHA]));
    const legacy = makeStore();
    expect(legacy.store.entries()).toEqual([BRAVO, ALPHA]);

    localStorage.setItem(
      KEY,
      JSON.stringify({
        schemaVersion: LOG_STORE_SCHEMA_VERSION,
        entries: [CHARLIE, { note: "x" }],
      }),
    );
    const versioned = makeStore();
    expect(versioned.store.entries()).toEqual([CHARLIE]);
  });

  it("starts empty on corrupt JSON, a foreign schema version, or a non-object payload", () => {
    for (const raw of ["not json", '{"schemaVersion":9999,"entries":[]}', '"text"', "42", "[]"]) {
      localStorage.setItem(KEY, raw);
      expect(makeStore().store.entries()).toEqual([]);
    }
  });

  it("keeps only the newest maxEntries", () => {
    const { store, flush } = makeStore({ maxEntries: 2 });
    store.prepend(ALPHA);
    store.prepend(BRAVO);
    store.prepend(CHARLIE);
    expect(store.entries()).toEqual([CHARLIE, BRAVO]);
    flush();
    expect(stored()).toEqual({
      schemaVersion: LOG_STORE_SCHEMA_VERSION,
      entries: [CHARLIE, BRAVO],
    });
  });

  it("trims the oldest entries until the payload fits maxChars", () => {
    const wide = [
      entry("c", "x".repeat(60)),
      entry("b", "y".repeat(60)),
      entry("a", "z".repeat(60)),
    ];
    localStorage.setItem(
      KEY,
      JSON.stringify({ schemaVersion: LOG_STORE_SCHEMA_VERSION, entries: wide }),
    );
    const { store, flush } = makeStore({ maxChars: 160 });
    store.prepend(entry("d", "w".repeat(60)));
    flush();
    const raw = localStorage.getItem(KEY) ?? "";
    const parsed = JSON.parse(raw) as { readonly entries: readonly Entry[] };
    expect(raw.length).toBeLessThanOrEqual(160);
    expect(parsed.entries.length).toBeGreaterThan(0);
    expect(parsed.entries.length).toBeLessThan(wide.length + 1);
    expect(parsed.entries[0]?.id).toBe("d");
  });

  it("removes the key on clear and never resurrects it from a pending write", () => {
    const { store, flush } = makeStore();
    store.prepend(ALPHA);
    flush();
    expect(localStorage.getItem(KEY)).not.toBeNull();
    store.clear();
    expect(localStorage.getItem(KEY)).toBeNull();
    store.entries();
    store.prepend(BRAVO);
    store.clear();
    flush();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
