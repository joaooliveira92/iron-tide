# N-2: The 14-inch Whitehead torpedo model identity

Status: new research note, created 2026-10-17 for the N-2 "1880 content completion"
effort (wayfinder research ticket #40). It determines what the shipped torpedo model
id `whitehead_14in_1886` denotes, whether a unique historical designation exists for
it, and what the id therefore is. It is the registered replacement citation for that
model's identity (see §7).

## 1. Question

The 1880 pack ships a torpedo model with the content id `whitehead_14in_1886`
(`content/production/1880/ship-building/parts/torpedo.yaml`). Its own fields disagree
with the year in its id: it is `availableFrom: 1880-01`, and its only revision is
`from: 1884-01` (a 1877 26 lb / 12 kg wet-guncotton charge, re-rated to the 58–70 lb /
26–27 kg charge by the 1884 Mark IV). The id is also a frozen contract id: it is a
member of the combat `torpedo_models_v1` / `torpedo_v1` `shippedModelIds` set
(`SEED_TORPEDO_MODEL_IDS`, `packages/combat/src/torpedoes/constants.ts`) and of the
model→fuze key set (`packages/combat/src/torpedoes/detonation.ts`), and is referenced
across the torpedo part, component, design, launcher, and cross-process fixtures.

Questions: was there a 14-inch Whitehead torpedo designated "14-inch Whitehead 1886"
(or anything meaning the same) by its manufacturer or by a service? If not, what is
the id?

## 2. Sources and method

- **Secondary (web, reputable, not read in the original):** The Dreadnought Project,
  ["14-in Fiume Mark IV Torpedo"](https://www.dreadnoughtproject.org/tfs/index.php/14-in_Fiume_Mark_IV_Torpedo)
  — "In 1885, the Royal Navy ordered 220 of these new torpedoes"; describes it as
  "manufactured by the Whitehead & Company" and the first significant order since the
  236 units of Fiume Mark I. Provides 1896 trial speeds (20.59 kn / 22.85 kn).
- **Secondary (web, reputable, not read in the original):** Wikipedia,
  ["Whitehead torpedo"](https://en.wikipedia.org/wiki/Whitehead_torpedo) — the 1868
  offering included a fourteen-inch (36 cm) torpedo, 11 ft 7 in (3.53 m) long, weighing
  346 lb (157 kg) with a 40 lb (18 kg) warhead; the model list uses manufacturer
  Roman-numeral marks ("Whitehead Mark 1 … Mark 5").
- **Secondary (web, reputable, not read in the original):** University of Melbourne,
  [The History of the Torpedo — "The Whitehead Torpedo"](https://www.torp.esrc.unimelb.edu.au/biogs/E000001b.htm)
  — the Royal Navy purchased and began manufacturing the design in 1871.
- **Primary (in-repo, directly verified):** the shipped content itself —
  `content/production/1880/ship-building/parts/torpedo.yaml` (the model and its
  revision), `components.yaml` (`torpedoModelId`), `torpedo_launcher.yaml`
  (`loadsTorpedo`), `designs.yaml`, and the combat contract
  (`packages/combat/src/torpedoes/constants.ts`, `detonation.ts`).

Method: confirm whether any manufacturer or service used a designation matching the id,
then classify the id against the terminology the sources actually use. The legacy notes
the model originally cited are unavailable (§7), so this note stands in for them at
authority order 7 (new cited research, per ADR-0210).

## 3. Findings

### 3.1 Terminology the sources actually use

Two distinct naming systems appear, and neither matches the id:

- **Manufacturer (Whitehead & Co., Fiume):** Roman-numeral marks — "Fiume Mark I",
  "Fiume Mark IV". Correct form would be **14-in Fiume Mark IV**.
- **Service (Royal Navy):** calibre-prefixed marks — "14-in Mark N", later
  "14-in RGF [Royal Gun Factory] Mark IX / X". Correct form would be **14-in Mark IV**.

No source uses, or reports a manufacturer or service using, a plain decimal
"14-inch Whitehead 1886".

### 3.2 Chronology

- 1868 — Whitehead offers a 14-inch (36 cm) torpedo (3.53 m, 346 lb, 40 lb warhead).
- 1869/1871 — Austria buys manufacturing rights; the Royal Navy buys and starts making
  the design.
- 1884 — the 14-inch Mark IV re-rates the charge from the 1877 pattern's 26 lb (12 kg)
  to 58–70 lb (26–27 kg).
- 1885 — the Royal Navy orders 220 × 14-in Fiume Mark IV (Whitehead's first large order
  since the 236 × Fiume Mark I); in service around 1886.
- 1896 — RN 14-in RGF Mark IX enters service (superseding the Fiume-built marks).

## 4. The id under audit

`whitehead_14in_1886` is **not** a manufacturer designation (that would be
`14-in Fiume Mark IV`) and **not** a service designation (that would be
`14-in Mark IV`). It is a **repository-internal canonical identifier** of the form
`<family>_<calibre>_<vintage-year>`, whose trailing year is a **retrospective vintage
label** — the ~1886 service year of the 14-in Fiume Mark IV, the nearest vessel of that
calibre in the sources. It is deliberately not the model's in-game availability year
(`1880-01`, the pack's era-start) nor its revision year (`1884-01`, the Mark IV
re-rating), both of which describe the simulated torpedo rather than naming it.

## 5. Decision

Keep `whitehead_14in_1886` as the **canonical repository id**. It is a frozen contract
id — renaming it would change the `torpedo_models_v1` / `torpedo_v1` id surface, the
model→fuze key set, and the authoritative content hash, which is torpedo-contract scope
(N-3) and not an N-2 content-completion change. The correct N-2 resolution is to record
the identity and its status, not to rename the id.

Recorded relationship, made explicit at the definition site: the id is a canonical
repository identifier carrying a retrospective vintage label; the corresponding
historical object is the 14-inch Whitehead (in the shipped model, the 1877 pattern as
re-rated by the 1884 Fiume Mark IV), with manufacturer mark `14-in Fiume Mark IV` and
RN service mark `14-in Mark IV`.

**Naming policy (recorded here for sibling ids):** `<family>_<calibre>_<vintage-year>`,
where the trailing year is a repository retrospective vintage label — not a
manufacturer or service designation, and not the in-game availability year. Sibling
ids in the shipped set (`whitehead_18in_1894`, `rn_21in_mk_iv_1916`, `usn_21in_mk14_1931`,
…) follow the same shape; several encode the actual service mark, so the year is a
label even where it coincides with a service year.

## 6. Confidence

**MEDIUM.** The classification rests on authoritative secondary sources (the
Dreadnought Project, Wikipedia, the University of Melbourne torpedo history) consistent
with one another, plus the shipped content's own fields. The strongest form of the
claim — that *no* period source used "14-inch Whitehead 1886" — cannot be proven from
these sources alone; it would need the RN Admiralty torpedo-mark registers or Whitehead
& Co. order books, which are not in this tree.

## 7. ADR-0210 finding: the model's original citations are unavailable

The model's provenance previously cited `docs/research/ship-building-early-band-2.md`
(§2) and `docs/research/c1-m3-torpedoes.md` (§3.1). Neither file exists in this
repository or in its reachable history; per ADR-0210 they are **unavailable, unverified
legacy references** and may not be cited. This note is the registered replacement
citation **for this model's identity**. The same two paths are cited more broadly across
the torpedo content and combat contract (e.g. `torpedo.yaml`, `constants.ts`,
`detonation.ts`, `torpedoModels.ts`); replacing those citations for the other models
and for the torpedo model table is a separate documentation effort and is not part of
ticket #40.
