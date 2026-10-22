export const CARD_PALETTES = [
  {
    background: "linear-gradient(145deg, #243a31 0%, #152820 48%, #0c1713 100%)",
    accent: "#7fae8f",
    border: "rgba(127, 174, 143, 0.48)",
  },
  {
    background: "linear-gradient(145deg, #253448 0%, #142333 50%, #09121c 100%)",
    accent: "#68a5d4",
    border: "rgba(104, 165, 212, 0.48)",
  },
  {
    background: "linear-gradient(145deg, #423324 0%, #2a2018 50%, #17100b 100%)",
    accent: "#d4a359",
    border: "rgba(212, 163, 89, 0.52)",
  },
  {
    background: "linear-gradient(145deg, #3d2934 0%, #271a22 50%, #160d12 100%)",
    accent: "#c97998",
    border: "rgba(201, 121, 152, 0.48)",
  },
  {
    background: "linear-gradient(145deg, #34314b 0%, #211f34 50%, #110f1f 100%)",
    accent: "#9790d7",
    border: "rgba(151, 144, 215, 0.48)",
  },
  {
    background: "linear-gradient(145deg, #264247 0%, #172b30 50%, #0b171a 100%)",
    accent: "#63b4bd",
    border: "rgba(99, 180, 189, 0.48)",
  },
] as const;

export type CardPalette = (typeof CARD_PALETTES)[number];

export function paletteForIndex(index: number): CardPalette {
  return CARD_PALETTES[index % CARD_PALETTES.length] as CardPalette;
}
