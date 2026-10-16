# 05: Author initial 1880 relations and tensions

**What to build:** Give the 1880 political layer a historically grounded
starting state. Every one of the 91 relation pairs is currently `neutral` at
`tension` exactly `5`, so no rivalry or alignment exists at start. Author initial
relations, non-aggression pacts, and tensions (e.g. Franco-German, Anglo-French,
Anglo-Russian, Austro-Russian) from
`docs/research/rtw3-manual-baseline.md` and cited sources — never invented.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] At least the major 1880 rivalries and alignments are represented with values
      distinct from a uniform baseline: 23 authored pairs in
      `content/production/1880/diplomacy.yaml` (Dual Alliance Germany/Austria and
      Anglo-Portuguese alliance as `allied` with NAPs; Franco-German 9,
      Russo-Ottoman 8, Austro-Russian and Anglo-Russian 7, Anglo-French 6, and so
      on). Unauthorized pairs keep the canonical neutral@5 default.
- [x] Values are cited to a source; nothing fabricated: each record's direction
      follows the cited diplomatic history (A. J. P. Taylor, *The Struggle for
      Mastery in Europe 1848-1918*), and every record's provenance marks the
      tension magnitude as an admitted balance choice
      (`kind: balance_adjustment`, `sourceStatus: BALANCE_TARGET`) with a note
      naming the relationship (see ADR-0213).
- [x] A deterministic test drives the compiled 1880 snapshot and asserts the
      authored relations/tensions load
      (`packages/content-compiler/test/initialDiplomacy.test.ts`; verified red with
      the Franco-German tension altered).

