# Ship-building content (EARLY band, 1880-1899)

Authored data for `@bluewave/ship-design` (spec: `.scratch/ship-building/spec.md`).
The subtree is loaded by the content compiler: `pack.json`'s `shipBuilding` map is
the single declaration of every file below, and `content:check`/`content:build`
fail closed if a discovered file is undeclared or a declared file is missing
(CAH-MAN-1/2). `shipBuilding` is a build-time loading declaration and is not part
of the compiled artifact's content identity.

| File | Contents |
|---|---|
| `components.yaml` | Pre-1880 ordnance (RMLs, early BL, French 27-cm, German 26-cm) plus the 1885-95 band: 13 weapons (12-inch to .303 Maxim, 2 torpedo tubes), magazines, rangefinder and ship fittings |
| `plants.yaml` | 4 propulsion plants (compound, triple-expansion, water-tube, locomotive-boiler torpedo-boat plant) |
| `hull-forms.yaml` | 5 hull forms: torpedo boat, protected cruiser, coast-defence ship, pre-dreadnought battleship, merchant liner (`traits: [merchant_derived]`) |
| `balance.yaml` | balance constants for hull, machinery, armour, cost, construction, CVE, refit, AI |

Source of record: `docs/research/ship-building-early-band.md` (confidence labels kept in comments).

## Pre-1880 armament and the January-1880 reference set (2026-10-10)

`components.yaml` previously had no gun introduced before 1883, so no gun-armed warship could be built at the
`scen_1880` January 1880 start. A research pass added the pre-1880 ordnance (`docs/research/ship-building-1880-pre-era-armament.md`)
and ten historical starting designs in service by 31 Dec 1879 (`docs/research/ship-building-1880-ships-by-nation.md`):

- Guns: British RML 16-in/80-ton, 12.5-in/38-ton, 12-in/35-ton, 12-in/25-ton, 11-in/25-ton, 10-in/18-ton (main and
  battery variants), 8-in/9-ton, 7-in/7-ton and 64-pdr; French 27-cm M1875 and German 26-cm RK L/20. Masses, charges,
  projectiles and muzzle velocity are VERIFIED from Mackinlay's *Text Book of Gunnery 1887* Table XVI; penetration is
  Brassey's *Naval Annual 1886* French Commission table; mount masses and rates of fire are ESTIMATE (no source).
- Designs (`reference-designs/<nation>/`): Devastation, Dreadnought (1875), Alexandra and Iris (UK), Redoutable (France),
  Kaiser and Sachsen (Germany), Principe Amedeo (Italy), Petr Velikiy (Russia) and Mesudiye (Ottoman Empire). The four
  pre-1880 RML threats (`rml_16in` … `rml_9in`) were added to `balance.yaml`'s `environment.threats`.
- Each design compiles with no BLOCKING/CRITICAL finding at its own month (`packages/ship-design/test/references1880.test.ts`).
  Where the hull-weight model needs a moulded depth or a magazine-box thickness, that value is an ESTIMATE (no source
  gives them); the model's lighter hull structure puts some of the smaller ironclads a little under their historical displacement.

## Sourced / fitted values
- Hull weight law `W = 9.9 * (L*B*D)^1.26 kg` and the per-form factors: fitted to White (1894) hull fractions for Majestic (38 %), Edgar (38 %), Siegfried (~31 %), Havock (~33 %).
- Admiralty coefficients per form (`cFormX100`): fitted to trial power of Royal Sovereign, Majestic, Edgar, Havock, Siegfried; `test/earlyBand.test.ts` checks all within 15 %.
- Gun, shell, charge, ROF: navweaps.com compilation of RN tables; armour factors: Britannica 1911 and Brassey 1902.

## Research pass 2 (docs/research/ship-building-early-band-2.md) applied
- Money is GBP with 1 GBP = 1,000,000 micro-units. Costs are calibrated to Brassey: a Havock-like destroyer prices at ~GBP 34.2k (sourced 34,254; machinery 18,674) and a Majestic-like battleship within 20 % of GBP 911k (sources exclude guns) (`test/references.test.ts`). Hull GBP 70/t of hull line, compound armour GBP 95/t, iron 50, heavy guns GBP 197/kg (200/long ton), machinery GBP 4.5-8 per ihp.
- Gun data: 6"/26 mass 5.08 t, 12"/35 charge 76 kg, sustained rates of fire (0.8 / 5 / 10 / 15 rds/min), QF charges, 6-inch mount 7.6 t, torpedoes per tube 3, Barr & Stroud rangefinder 1893.
- Ship data: Havock coal 61 t and crew 42, Majestic moulded depth 14.0 m (hull form refitted), rounds per gun 200 (6-inch) / 300 (12-pdr), stability windows widened to the sourced GM ranges.

## Pass 2 audit and armour availability (2026-10-09, tickets 25 and SB-2)
Each VERIFIED / SINGLE-SOURCE value in `docs/research/ship-building-early-band-2.md` ("Suggested catalogue values") was checked against the content:
- **Already applied:** gun masses, charges and rates of fire, 6-inch mount mass, 12-inch and secondary rounds per gun, torpedo mass and tubes per ship, torpedo gear cost, destroyer and battleship costs, armour and heavy-gun prices, bunker and crew figures of the reference designs, moulded depths, stability windows, rangefinder year.
- **Applied now:** bunker stowage (`bunkerLitreBpPerKg` 11148 = 40 ft3 per long ton Welsh coal; it was 1 L/kg, 10 % short); torpedo provenance labels (mass and length SINGLE-SOURCE, speed and range VERIFIED); armour material availability (`ship.armour.materialAvailability`: dates and technology ids from the tech tree, `hc_compound_armor` 1886, `hc_nickel_steel_armor` 1889, `hc_harvey_armor` 1892, `hc_krupp_cemented_armor` 1900, iron and mild steel open from 1880; compound obsolete advisory from 1889; no maximum plate thickness because no source gives one).
- **Not applicable (research marks them UNVERIFIED):** barbette/turret/shield masses of 12, 10 and 9.2-inch mounts, tube and carriage masses, magazine capacities per ship, British steel/Harvey/Krupp armour price per ton, Edgar and Speedy costs, QF gun unit prices, accommodation volume per man, Majestic/Edgar dynamo size, rangefinder mass. Applying a number here would be invention; they need a third research pass.
- **Not authored on purpose:** per-component `allowedZones`. No source constrains where a fitting may sit and a guess would invalidate legitimate designs; the zone-refusal code path is covered by pure tests only.

## Placeholders (no source; replace before release)
Heavy mount masses (12/10/9.2-inch), tube and carriage masses, magazine/fitting data, QF unit prices, rangefinder mass, part-load fuel curves, plant volumes and reliability, zone shares, stability windows,
crew per tonne, all cost/construction/CVE/refit/AI constants. Each is marked `PLACEHOLDER` or `ESTIMATE` in the files or in `balance.yaml`'s header.

## Opening ship types and starter designs (2026-10-10, ADR-0088)

The designer offers `B CA CL DD KE AMC` at the 1880 start. `reference-designs/<nation>/starters.yaml` entries with `starterFor: <type>` are the
starting points the Drawing Board's "Ship types" panel loads; the newest one not after the campaign month is used. New, non-historical
starters (`starter_*_1880`: DD, KE, AMC, CA, CL) are tuned to compile legally at 1880-01 under this content; their dimensions, power
and armour are ESTIMATES, not real ships. Before the 6-inch breech-loaders
of 1883 the only gun at or below 6 inches is the 1-inch Nordenfelt, so KE and AMC starters carry machine guns only.

**Status of the merchant hull (2026-10-10, research pass 3):** `merchant_liner_form` is now fitted from White 1894's
passenger-steamer hull-and-outfit fraction of displacement (45-55 % iron, 47.6 % steel for a 500 ft / 12,500 t liner,
pp. 411-413): `formBp 13400` returns 47.6 % at the Oregon's dimensions, replacing the borrowed `protected_cruiser_form`
coefficient. The Admiralty coefficient `cFormX100 26000` is bounded by the period liners Etruria, Campania and City of Paris
(25,000-29,000); the L/B band was widened to 8.0-10.5 for the sourced 9.1-9.3 ratio. Both are ESTIMATE/SINGLE-SOURCE
(derived from verified fractions and trial data, not a weighed liner), documented in `docs/research/ship-building-merchant-liner.md`.
The waterplane, sheer, fullness, LCB, cost complexity and the AMC GM ceiling stay BALANCE TARGET. The armed merchant cruiser
is now balanced enough for release; a ship-specific liner hull-weight measurement would upgrade the labels.
