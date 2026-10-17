# 05: Storage rule in the presentation gate

**What to build:** The presentation-formatting gate also bars direct
`localStorage`/`sessionStorage` in the settings/formatting surfaces, so preferences
cannot grow a second store — baselined as a ratchet over the existing allowed uses.

**Blocked by:** None.

**Status:** ready-for-agent

- [ ] The gate flags a direct `localStorage`/`sessionStorage` reference in the
      settings/formatting/Options surfaces.
- [ ] Existing legitimate uses are baselined explicitly (ratchet down only):
      `useDisplayPreferences`'s one-time legacy-migration `localStorage` read/remove
      is the single permitted use; the other preferences consumers
      (`preferences-context`, theme/density/font/background contexts) pass with no
      baseline entry.
- [ ] A test proves a new direct storage read in a guarded file fails the gate.
- [ ] The gate is wired into preflight and stays green on the current tree.
