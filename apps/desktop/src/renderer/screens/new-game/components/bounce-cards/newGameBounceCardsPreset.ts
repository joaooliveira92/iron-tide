import type { BounceCardsProps } from "./BounceCards.js";

export const NEW_GAME_BOUNCE_CARDS_PROPS = {
  containerWidth: 620,
  containerHeight: 280,
  cardSize: 232,
  cardAspect: 1.5,
  spread: 118,
  rotation: 9,
  arc: 12,
  pushDistance: 150,
  hoverScale: 1.06,
  bounciness: 0.6,
  animationDelay: 0.15,
  animationStagger: 0.07,
  borderWidth: 4,
  borderColor: "#ffffff",
  radius: 16,
} as const satisfies Pick<
  BounceCardsProps,
  | "containerWidth"
  | "containerHeight"
  | "cardSize"
  | "cardAspect"
  | "spread"
  | "rotation"
  | "arc"
  | "pushDistance"
  | "hoverScale"
  | "bounciness"
  | "animationDelay"
  | "animationStagger"
  | "borderWidth"
  | "borderColor"
  | "radius"
>;
