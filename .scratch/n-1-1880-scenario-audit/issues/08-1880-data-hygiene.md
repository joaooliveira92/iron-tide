# 08: Fix 1880 content data hygiene

**What to build:** Clean up the concrete data defects found by the audit:
- `gbr_alyxandra` — "Alexandra" is misspelled in `content/production/1880/fleets.yaml`.
- `gbr_malta_temp` — placeholder id (`_temp`) and composite name
  "HMS Mediterranean (Temeraire)".
- Cross-era class-name collisions: "Fusō" (1877 ironclad vs 1915 battleship),
  "Dreadnought (1875)" vs "Dreadnought" (1906), and "Courbet" (1880 ironclad vs
  1913 dreadnought), which make class names ambiguous in the UI and catalogs.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Ship/class names are correctly spelled and free of placeholders.
- [ ] Class names are unambiguous across eras (suffix/rename as needed).
- [ ] Ids are stable and referenced consistently by fleets and constructions.

