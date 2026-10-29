// Propulsion plants (docs/research/ship-building-content-sourcing.md). kg/kW: compound 195, TE 170, loco 46 (White 1894 p.562); water-tube 114
// (Highflyer 835.3 t for 10,000 ihp, Brassey 1901 p.128, SECONDARY). SFC base g/kWh at 60% load: 1300/1220/1500(ESTIMATE); water-tube is 1.10 x the
// TE cylindrical curve (Highflyer/Minerva trials burned 7-12 % more coal, Brassey 1901 pp.129-130, SECONDARY).
// part-load curve shape, volume per kW and reliability are PLACEHOLDER/ESTIMATE (no source). Years (VERIFIED): compound 1880; TE 1885 (1885-86
// torpedo gunboats, Brassey 1886 p.80; White p.562 row from 1885); loco 1890 (White 1890-93 row); water-tube 1893 (Speedy, Brassey 1894 p.426).
// compound_locomotive_tb (1880, 46 kg/kW ESTIMATE from the White 1890-93 loco row applied to 1880): the compound + single
// locomotive boiler set of the first-class torpedo boats is VERIFIED in service by 1880 (Lightning 1877, TB2-TB9 1878-79).
import { PropulsionPlantSchema, collection } from "@bluewave/content-authoring";

export default collection("plants", PropulsionPlantSchema, [
  {
    id: "compound_cylindrical",
    fuelType: "COAL",
    weightMilliKgPerKw: 195000,
    volumeLitrePerKw: 180,
    sfcGramPerKwh: {
      points: [
        [0, 1651],
        [2000, 1443],
        [6000, 1300],
        [10000, 1385],
      ],
    },
    reliabilityBp: 8500,
    minKw: 300,
    maxKw: 8000,
    introduction: {
      fromMonth: "1880-01",
      obsoleteMonth: null,
    },
    requires: ["mac_compound_engine"],
  },
  {
    id: "triple_expansion_cylindrical",
    fuelType: "COAL",
    weightMilliKgPerKw: 170000,
    volumeLitrePerKw: 150,
    sfcGramPerKwh: {
      points: [
        [0, 1549],
        [2000, 1354],
        [6000, 1220],
        [10000, 1299],
      ],
    },
    reliabilityBp: 9000,
    minKw: 500,
    maxKw: 14000,
    introduction: {
      fromMonth: "1885-01",
      obsoleteMonth: null,
    },
    requires: ["mac_triple_expansion"],
  },
  {
    id: "triple_expansion_watertube",
    fuelType: "COAL",
    weightMilliKgPerKw: 114000,
    volumeLitrePerKw: 110,
    sfcGramPerKwh: {
      points: [
        [0, 1704],
        [2000, 1489],
        [6000, 1342],
        [10000, 1429],
      ],
    },
    reliabilityBp: 8200,
    minKw: 300,
    maxKw: 20000,
    introduction: {
      fromMonth: "1893-01",
      obsoleteMonth: null,
    },
    requires: ["mac_triple_expansion", "mac_water_tube_boiler"],
  },
  {
    id: "locomotive_boiler_tb",
    fuelType: "COAL",
    weightMilliKgPerKw: 46000,
    volumeLitrePerKw: 60,
    sfcGramPerKwh: {
      points: [
        [0, 1905],
        [2000, 1665],
        [6000, 1500],
        [10000, 1598],
      ],
    },
    reliabilityBp: 8000,
    minKw: 200,
    maxKw: 3000,
    introduction: {
      fromMonth: "1890-01",
      obsoleteMonth: null,
    },
    requires: ["mac_forced_draft"],
  },
  // Lightweight torpedo-craft plant: 2-cyl (vertical) compound engine + a single locomotive boiler, the
  // set fitted to the first-class torpedo boats of 1877-1880 (HMS Lightning 1877, TB2-TB9 1878-79, both
  // 1 loco boiler + compound, 460 ihp; docs/research/ship-building-1880-ships-by-nation.md section 1).
  // The configuration is VERIFIED present in 1880; the per-kW mass is an ESTIMATE. White 1894's machinery
  // table (p. 562, "single large locomotive boiler", first-class torpedo boat 1890-93) gives 70-80 lb/ihp
  // = 43-49 kg/kW for the COMPLETE propelling machinery (engines + boilers + water; the model's
  // auxWeightBp is 0 because White already covers it). 46 kg/kW sits inside that sourced band and is the
  // same figure as the 1890 plant; applying it to 1880 is an ESTIMATE (the 1890-93 row is 10 years later).
  // The SFC curve, volume and reliability are adapted from locomotive_boiler_tb as ESTIMATEs (no source).
  {
    id: "compound_locomotive_tb",
    fuelType: "COAL",
    weightMilliKgPerKw: 46000,
    volumeLitrePerKw: 60,
    sfcGramPerKwh: {
      points: [
        [0, 1905],
        [2000, 1665],
        [6000, 1500],
        [10000, 1598],
      ],
    },
    reliabilityBp: 8000,
    minKw: 150,
    maxKw: 600,
    introduction: {
      fromMonth: "1880-01",
      obsoleteMonth: null,
    },
    requires: ["mac_compound_engine"],
  },
  // High-pressure geared steam turbine plant (E-1 1940-1949, ADR-0284), oil-fired, 650 psi / 850 F (Naval Historical Review, Dec 1981;
  // other sites say 600 psi). Reference installation 60,000 shp (44,742 kW) on two shafts in Fletcher and Gearing; maxKw is the Iowa
  // total of 212,000 shp (158,084 kW) so the later cruiser and battleship slices need no new plant (docs/research/e-1-1940s-hull-and-part-values.md
  // section 9). The mass, volume, fuel-rate curve, reliability and minimum power are BALANCE TARGET: no source gives them. Copying the
  // nearest plant's mass (114 kg/kW) would outweigh the destroyer, so the mass and volume are fitted so the Gearing reference closes on its
  // 3,460 t full load and fits its zones; the fuel curve has the shape of the existing curves (load in bp of installed power).
  {
    id: "hp_steam_geared_turbine",
    fuelType: "OIL",
    weightMilliKgPerKw: 18000,
    volumeLitrePerKw: 20,
    sfcGramPerKwh: {
      points: [
        [0, 510],
        [2000, 445],
        [6000, 400],
        [10000, 425],
      ],
    },
    reliabilityBp: 9000,
    minKw: 2000,
    maxKw: 158084,
    introduction: {
      fromMonth: "1940-01",
      obsoleteMonth: null,
    },
    requires: ["mac_high_pressure_steam", "mac_improved_geared_turbines"],
  },
]);
