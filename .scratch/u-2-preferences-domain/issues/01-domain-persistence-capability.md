# 01: Versioned preferences domain, app-scope persistence, capability and selectors

**What to build:** The end-to-end path a preference takes — strict schema and
central defaults, atomic app-scope persistence, a narrow preload capability, and
typed renderer selectors — proved by migrating the existing Appearance settings
(theme, background, font, interface density) off `localStorage` and onto the
domain, so the game reads and writes them through one validated source and they
survive an app restart.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] A main-process preferences model holds a versioned Effect `Schema`, the
      central defaults, a version constant, and the app-scope keys from D4
      (appearance subset plus the shared shape); strict validation rejects an
      unknown key and an out-of-range value with a stable `_tag`.
- [x] An effect-free shared module holds the preference keys, value unions, scope
      enum, and decoded shape for the renderer; a parity test asserts it equals the
      schema's decoded type.
- [x] App-scope persistence writes atomically (temp + rename) to one file in the
      app-data directory; a round-trip restores every value; an interrupted write
      leaves the old or the new file, never a partial one.
- [x] A dedicated `preferences.read` / `preferences.write` preload capability
      decodes every payload with a strict schema at the main boundary, rejects
      excess keys, and returns the decoded preferences; a malformed payload fails
      with a typed `_tag`, never a raw error.
- [x] Typed renderer selectors read and write through the capability; the theme,
      background, font, and density controls use them, and the `bluewave-theme`,
      `bluewave-background`, `bluewave-font`, and `bluewave-density`
      `localStorage` keys are no longer written.
- [x] The renderer and preload import no `effect`; the runtime-free and
      boundary-decode gates stay green.
- [x] A test drives a write then a fresh read through the real composition and
      observes the persisted value.

## Resolution (U-2 ticket 01)

The end-to-end app-scope preference path is live and the four Appearance settings
now read and write through it.

- **Shared contract** `apps/desktop/src/shared/preferences-contract.ts`
  (effect-free): version constant, scope enum, value-literal arrays + derived
  unions, the full D4 app-scope shape, frozen central defaults, the snapshot and
  write request types. It imports nothing, so the renderer/preload stay
  runtime-free.
- **Main model** `apps/desktop/src/main/preferences/`: `preferencesSchema.ts`
  (strict Effect `Schema`, `Schema.Int.check(Schema.isBetween(…))` for `textScale`,
  version pinned to a literal), `preferencesErrors.ts` (`Data.TaggedError` classes
  + stable-reason projection), `preferencesStore.ts` (`PreferencesStore` service;
  one `<userDataDir>/preferences.json`; tolerant read → defaults; atomic write via
  the extracted `runtime/atomicWrite.ts`), `preferencesBridge.ts`
  (`createPreferencesBridge` decoding with `{ onExcessProperty: "error" }`).
- **Boundary**: `preferences:read` / `preferences:write` channels registered in
  `main/index.ts`; `preload/index.ts` exposes a typed `preferences` capability;
  the IPC/preload allow-list test is updated.
- **Renderer**: `lib/preferences-context.tsx` reads on mount and writes optimistic
  merges through the capability; the four shell contexts source
  `usePreferences()` and no longer touch `localStorage`. E2E and the `snap` tool
  seed `<userDataDir>/preferences.json` (shared `e2e/preferences-fixture.ts`).
- **Note**: `highContrast` and the campaign/session scopes, migration/recovery,
  and currency/language/measurement selectors are deliberately deferred to U-4 and
  tickets 02–06. The version constant and defaults live in the shared effect-free
  contract (single source) rather than duplicated in main, so they cannot drift;
  the parity test binds the decoded type to the contract.
