# E-1 research: 1950-1959 gun-armed ships of other nations

## Status

- Prepared for ticket #256 under decision request 0044, Option B. Date of pass: 2026-10-29.
- Scope: UK Daring-class destroyer, UK Tiger-class light cruiser, Soviet Kotlin-class destroyer and their gun armament.
- Every value below was read on the cited page during this pass. Labels follow the pack convention:
  VERIFIED (two sources agree), SINGLE-SOURCE, DERIVED (arithmetic shown), BALANCE TARGET (unsourced),
  ESTIMATE (derived from a related source).

## 1. UK Daring-class destroyer (1952)

Sources: NP https://www.navypedia.org/ships/uk/brit_dd_daring.htm, fetched 2026-10-29.

| Item | Value | Source | Confidence |
|---|---|---|---|
| Displacement | 2,830 t standard, 3,580 t full load | NP | SINGLE-SOURCE |
| Length, beam, draught | 111.6 m pp, 118.9 m oa, 13.1 m, 4.14 m deep load | NP | SINGLE-SOURCE |
| Power, speed | 54,000 shp (40,268 kW), 34.75 kn | NP | SINGLE-SOURCE |
| Fuel, range | 590 t oil, 4,400 nm at 20 kn | NP | SINGLE-SOURCE |
| Armament | 3 x 2 - 120/45 Mk 6; 2 x 2 - 40/60 STAAG Mk 2; 2 x 5 - 533 TT; Squid ASWRL | NP | SINGLE-SOURCE |
| Complement | 297-330 | NP | SINGLE-SOURCE |

The 4.5-inch/45 (120 mm) QF Mark 6 gun in twin mount Mark 6. Navweaps page at
http://www.navweaps.com/Weapons/WNBR_45-45_mk6.php (SINGLE-SOURCE). 120 mm bore,
27.2 kg HE shell, 29.1 kg AP shell, gun mass approx 2,800 kg, twin mount about 15 t,
rate 14-16 rounds per minute, crew about 9 per mount. The mount splits as 6,100 kg
per barrel and 2,800 kg fixed. Charge 4.64 kg (1,706 bp, DERIVED). Service 1948.

Unsourced and set as BALANCE TARGET: mount cost, volume, footprint, crew (modelled
as 4 per barrel, 8 total), round volume, height, FC class.

## 2. UK Tiger-class light cruiser (1959)

Sources: NW6 https://www.navweaps.com/Weapons/WNBR_6-50_mkN5.php, fetched 2026-10-29.
NP http://www.navypedia.org/ships/uk/brit_cr_tiger_44.htm (404, not reachable in pass).

| Item | Value | Source | Confidence |
|---|---|---|---|
| Displacement | 8,900 t standard, 11,700 t full load (ESTIMATE) | Conway's 1947-1995 relayed | BALANCE TARGET |
| Length, beam, draught | 169.3 m oa, 170.0 m wl, 20.0 m, 6.4 m full load | Conway's 1947-1995 relayed | BALANCE TARGET |
| Power, speed | 80,000 shp (59,656 kW), 31.5 kn | Conway's 1947-1995 relayed | BALANCE TARGET |
| Armament | 3 x 2 - 152/50 QF Mark N5; 3 x 2 - 76/70 Mark 6 (not authored, AA only) | NW6 | SINGLE-SOURCE |
| Complement | 694 | Conway's 1947-1995 relayed | BALANCE TARGET |

The 6-inch/50 (152 mm) QF Mark N5 automatic gun in twin Mark 26 turret (NW6,
SINGLE-SOURCE): 152 mm bore, 58.9 kg AP shell, 6,960 kg gun, 155.6 mt (156 t) twin
turret, 15-20 rounds per minute (17 used, BALANCE TARGET), 2,520 fps MV, crew 11 per
barrel (modelled as 22 per mount). The turret splits as 78,798 kg per barrel (rounded)
and -384 kg fixed (set to 0), so the twin returns ~157,596 kg. Charge 31.8 kg (2,301 bp,
DERIVED). Service 1959.

Unsourced and set as BALANCE TARGET: mount cost scales the US 6-inch/47 (same 197,000
micro per kg), round volume, volume, footprint and height follow conventions of the US
6-inch/47 row.

## 3. Soviet Kotlin-class destroyer (1954)

Sources: NP https://www.navypedia.org/ships/russia/rus_dd_kotlin.htm, fetched 2026-10-29.

| Item | Value | Source | Confidence |
|---|---|---|---|
| Displacement | 2,200 t standard, 3,250 t full load | NP | SINGLE-SOURCE |
| Length, beam, draught | 117.4 m oa, 108.2 m wl, 11.8 m, 3.75 m | NP | SINGLE-SOURCE |
| Power, speed | 74,200 shp (55,326 kW), 36.5 kn | NP | SINGLE-SOURCE |
| Fuel, range | 800 t oil, 3,200 nm at 14 kn | NP | SINGLE-SOURCE |
| Armament | 2 x 2 - 130/50 M-1954; 4 x 4 - 45/74 SM-20; 2 x 5 - 533 TT; 2 RBU-2500 | NP | SINGLE-SOURCE |
| Complement | 305 | NP | SINGLE-SOURCE |

The 130mm/50 M-1954 gun in 2-gun SM-2-1 twin mount. Navweaps page at
http://www.navweaps.com/Weapons/WNRussian_5-50_m1946.php (SINGLE-SOURCE):
130 mm bore, 53.6 kg HE-Frag shell, gun mass approx 4,000 kg, twin mount about 35.2 t,
rate 13 rounds per minute, crew about 12 per mount. Charge 15.4 kg (2,870 bp, DERIVED).
Service 1954.

Unsourced and set as BALANCE TARGET: mount cost, volume, footprint, crew (modelled as
6 per barrel), round volume, height.

## 4. Naval profile changes needed

### UK
- Add `postwar_destroyer_form` and `light_cruiser_form` to hull forms
- Add gun family `gun_qf_45in_45` component access
- Add `hp_steam_geared_turbine` to domestic plants
- Add `tube_21in_above_water` to component access
- Add gun models for the QF 4.5-inch/45 Mark 6 and QF 6-inch/50 Mark N5

### Russia
- Add `postwar_destroyer_form` to hull forms
- Add gun family and new gun file access
- Add `hp_steam_geared_turbine` to domestic plants
- Add `tube_21in_above_water` to component access

### France
- Add `postwar_destroyer_form` to hull forms (and light_cruiser_form if needed)
- Add gun families for 127mm/54 Model 1948
- Add `hp_steam_geared_turbine` to domestic plants

## 5. Reference ships for hull forms

The **postwar_destroyer_form** exists (anchored on Forrest Sherman, 124.1 m wl, 4,916 t full load).
The Daring (111.6 m pp) and Kotlin (108.2 m wl) fit within the form's length band (115-135 m).
The Kotlin is slightly below the band; a small postwar destroyer may need the band adjusted,
or a note that Kotlin fits the existing `destroyer_form` instead.

The **light_cruiser_form** also exists (anchored on Worcester, 202.4 m wl).
The Tiger-class at ~170 m wl would NOT fit. A `postwar_light_cruiser_form` may be needed,
but the decision request limits scope - the Tiger can use the light_cruiser_form with its
length band adjusted down to 165 m, or be omitted.

**Decision**: Add `postwar_destroyer_form` to UK and Soviet profiles. The Tiger-class
needs the light_cruiser_form band adjusted (210,000 -> 240,000 mm max, 165,000 mm min).