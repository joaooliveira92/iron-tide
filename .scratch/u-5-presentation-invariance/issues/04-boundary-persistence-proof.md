# 04: Boundary persistence proof through the Electron seam

**What to build:** Proof that a preference write survives the real main-process IPC
handler + preload-capability decode and is re-read after a fresh composition, not only
through a renderer stub.

**Blocked by:** None.

**Status:** ready-for-agent

- [ ] A main-process test builds the real preferences IPC handler over a temporary
      app-data directory, writes through the capability decode, and re-reads the value
      after a fresh composition.
- [ ] A malformed or excess-key payload is rejected with a stable `_tag` and leaves
      the stored file unchanged.
- [ ] Campaign-scope read/write paths are covered, not only app scope.
- [ ] The packaged smoke asserts a preference persists if it can be added cheaply and
      stably; otherwise the limitation is recorded (no Playwright expansion).
- [ ] No save/wire format changes.
