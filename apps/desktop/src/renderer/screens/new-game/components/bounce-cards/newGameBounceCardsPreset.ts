import type { BounceCardsProps } from "./BounceCards.js";

/**
 * Shared BounceCards tuning for the new-game flow's card pickers (the preset
 * picker in §2 and the Starting-fleet method picker in §5b). Kept in one place
 * so the two screens cannot drift; callers spread it and add their own
 * `images`/`activeIndex`/`onCardClick`.
 *
 * The cards are 3:2 (`cardAspect`), matching the picker artwork, so each
 * painting is shown whole instead of cropped to a square.
 */
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
