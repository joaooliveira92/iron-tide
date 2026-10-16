# 08: Fix 1880 content data hygiene

**What to build:** Clean up the concrete data defects found by the audit:
- `gbr_alyxandra` — "Alexandra" is misspelled in `content/production/1880/fleets.yaml`.
- `gbr_malta_temp` — placeholder id (`_temp`) and composite name
  "HMS Mediterranean (Temeraire)".
- Cross-era class-name collisions: "Fusō" (1877 ironclad vs 1915 battleship),
  "Dreadnought (1875)" vs "Dreadnought" (1906), and "Courbet" (1880 ironclad vs
  1913 dreadnought), which make class names ambiguous in the UI and catalogs.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Ship/class names are correctly spelled and free of placeholders:
      `gbr_alyxandra` → `gbr_alexandra`; `gbr_malta_temp` /
      "HMS Mediterranean (Temeraire)" → `gbr_temeraire` / "HMS Temeraire".
- [x] Class names are unambiguous across eras: "Fusō" → "Fusō (1878)" (1880
      ironclad) and "Fusō (1915)" (battleship); "Dreadnought" → "Dreadnought
      (1906)" beside "Dreadnought (1875)". The "Courbet" collision was removed
      in ticket 03 (the 1880 hull is Dévastation class).
- [x] Ids are stable and referenced consistently (no construction or test
      referenced the renamed ids; the ticket-01 exemption key was updated).
      A deterministic test asserts unambiguous class names and placeholder-free
      identifiers (`packages/content-compiler/test/dataHygiene.test.ts`; verified
      red on the original "Dreadnought" ambiguity).

