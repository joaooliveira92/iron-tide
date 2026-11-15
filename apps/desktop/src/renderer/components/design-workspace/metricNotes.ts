export const METRIC_NOTES: Readonly<Record<string, string>> = {
  displacement:
    "Total weight of the ship as designed. It must stay within what the hull floats at its design draught.",
  speed:
    "Flat-out speed from the installed power against the hull's resistance, compared with the requirement.",
  range: "Distance steamed at cruising speed on the fuel carried, compared with the requirement.",
  stability:
    "How strongly the ship rights itself when heeled (GM). Too low and she may capsize; too high and she rolls violently and makes a poor gun platform.",
  trim: "How far the ship sits bow- or stern-down, as a share of her length. Heavy weights far forward or aft drive it.",
  stress:
    "Bending load on the hull girder against its strength. Above 100 % the hull is not strong enough.",
  crew: "Men needed to work the ship against the berths provided.",
  reserve:
    "Watertight volume above the waterline, as a share of displacement: what keeps her afloat when holed.",
};
