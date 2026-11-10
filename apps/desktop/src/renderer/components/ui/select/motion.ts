import type { Transition, Variants } from "motion/react";

import { EASE_OUT } from "@/lib/ease";

export const INSTANT_TRANSITION: Transition = { duration: 0 };

export const CHEVRON_TRANSITION: Transition = {
  type: "spring",
  duration: 0.4,
  bounce: 0.3,
};

export const LIST_VARIANTS: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.025,
      delayChildren: 0.025,
    },
  },
};

export const ITEM_VARIANTS: Variants = {
  hidden: {
    opacity: 0,
    y: -4,
  },
  show: {
    opacity: 1,
    y: 0,
  },
};

interface TriggerMotionInput {
  open: boolean;
  isTop: boolean;
  reduceMotion: boolean;
}

export function getTriggerMotion({ open, isTop, reduceMotion }: TriggerMotionInput) {
  const nearRadiusKeyframes = open ? [0, 0, 12] : [12, 0, 12];

  const radiusTransition: Transition = reduceMotion
    ? INSTANT_TRANSITION
    : open
      ? {
          duration: 0.6,
          times: [0, 0.4, 1],
          ease: EASE_OUT,
        }
      : {
          duration: 0.42,
          times: [0, 0.5, 1],
          ease: EASE_OUT,
        };

  return {
    animate: {
      borderTopLeftRadius: isTop ? nearRadiusKeyframes : 12,
      borderTopRightRadius: isTop ? nearRadiusKeyframes : 12,
      borderBottomLeftRadius: isTop ? 12 : nearRadiusKeyframes,
      borderBottomRightRadius: isTop ? 12 : nearRadiusKeyframes,
    },
    transition: {
      borderTopLeftRadius: isTop ? radiusTransition : INSTANT_TRANSITION,
      borderTopRightRadius: isTop ? radiusTransition : INSTANT_TRANSITION,
      borderBottomLeftRadius: isTop ? INSTANT_TRANSITION : radiusTransition,
      borderBottomRightRadius: isTop ? INSTANT_TRANSITION : radiusTransition,
    },
  };
}

interface ContentMotionInput {
  open: boolean;
  isTop: boolean;
  reduceMotion: boolean;
  sideOffset: number;
  targetHeight: number;
}

export function getContentMotion({
  open,
  isTop,
  reduceMotion,
  sideOffset,
  targetHeight,
}: ContentMotionInput) {
  const nearGap = open ? sideOffset : 0;
  const nearRadius = open ? 12 : 0;

  const gapTransition: Transition = open
    ? {
        type: "spring",
        duration: 0.5,
        bounce: 0.35,
        delay: 0.08,
      }
    : {
        type: "spring",
        duration: 0.24,
        bounce: 0.1,
      };

  const radiusTransition: Transition = open
    ? {
        duration: 0.24,
        ease: EASE_OUT,
        delay: 0.08,
      }
    : {
        duration: 0.14,
        ease: EASE_OUT,
      };

  const animate = reduceMotion
    ? {
        opacity: open ? 1 : 0,
        height: targetHeight,
      }
    : {
        opacity: open ? 1 : 0,
        height: targetHeight,

        marginTop: isTop ? 0 : nearGap,
        marginBottom: isTop ? nearGap : 0,

        borderTopLeftRadius: isTop ? 12 : nearRadius,
        borderTopRightRadius: isTop ? 12 : nearRadius,
        borderBottomLeftRadius: isTop ? nearRadius : 12,
        borderBottomRightRadius: isTop ? nearRadius : 12,
      };

  const transition: Transition = reduceMotion
    ? INSTANT_TRANSITION
    : {
        opacity: open ? { duration: 0.16 } : { duration: 0.12 },

        height: open
          ? {
              type: "spring",
              duration: 0.36,
              bounce: 0.12,
            }
          : {
              duration: 0.2,
              ease: EASE_OUT,
            },

        marginTop: isTop ? INSTANT_TRANSITION : gapTransition,

        marginBottom: isTop ? gapTransition : INSTANT_TRANSITION,

        borderTopLeftRadius: isTop ? INSTANT_TRANSITION : radiusTransition,

        borderTopRightRadius: isTop ? INSTANT_TRANSITION : radiusTransition,

        borderBottomLeftRadius: isTop ? radiusTransition : INSTANT_TRANSITION,

        borderBottomRightRadius: isTop ? radiusTransition : INSTANT_TRANSITION,
      };

  return { animate, transition };
}
