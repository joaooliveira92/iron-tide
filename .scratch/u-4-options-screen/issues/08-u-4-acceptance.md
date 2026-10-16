# 08: U-4 acceptance — reachability, invariance and boundary proof

**What to build:** The evidence that the Options screen is real and honest: it is
reachable from both entry points, every control takes effect, and no setting moves
an authoritative outcome — and the sprint meets its definition of done on a clean
commit.

**Blocked by:** 02, 03, 04, 05, 06, 07.

**Status:** done

- [x] Reachability tests prove Options opens from the pre-campaign main menu and
      from a campaign and behaves the same in both.
- [x] Every section's controls are exercised end-to-end: the written preference, the
      applied DOM/token effect, and the reset result are observed.
- [x] The currency and language controls are shown to be honest (availability with
      reason, effective mode, no placeholder language, tested locales only).
- [x] The verbatim-string check proves no raw key renders in production and the
      en-US fallback is complete.
- [x] An invariance test changes every control and observes the compiled campaign
      snapshot, the save and the cross-process golden reference run unchanged; no
      save/wire format or compatibility version changed (record before/after hashes).
- [x] The U-4 validation report is written with exact commands and observed results;
      the SPRINT-PLAN row and the `.ai/specs/` pointer are updated; the tree is
      clean with Conventional Commit subjects.
- [x] `pnpm preflight`, `pnpm test:scripts`, and `pnpm check` are green on the exact
      commit.
