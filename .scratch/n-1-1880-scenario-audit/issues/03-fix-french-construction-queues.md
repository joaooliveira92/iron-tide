# 03: Fix the French construction-queue design references

**What to build:** Correct `content/production/1880/constructions.yaml` so each
French project builds its own class: `con_fra_courbet` targets `fra_courbet` but
references `des_fra_redoutable`, and `con_fra_devastation` targets
`fra_devastation` but references `des_fra_amiral_duperre`. Either point each
project at the correct design for its class (authoring the missing
`des_fra_courbet` / `des_fra_devastation` if needed) or correct the target/class
names so target and design agree.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Every construction project's `designVersionId` resolves to a design whose
      class matches the project's `targetId` ship. Authored the missing
      `des_fra_devastation` (Dévastation-class ironclad, 1875–1886) and pointed
      both `con_fra_devastation` and `con_fra_courbet` at it; linked
      `fra_devastation`/`fra_courbet` to that design and set both ships'
      `classId` to "Dévastation" (the historical class, resolving the 1880
      "Courbet" vs 1913 dreadnought collision of F8).
- [x] A deterministic test asserts target↔design class consistency for all
      projects (`packages/content-compiler/test/constructionDesignConsistency.test.ts`;
      verified red on the wrong reference).

