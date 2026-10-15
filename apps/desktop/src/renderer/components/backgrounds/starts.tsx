"use client";

import {
  type HTMLMotionProps,
  motion,
  type MotionValue,
  type SpringOptions,
  type Transition,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import * as React from "react";
import { cn } from "../../lib/utils.js";

type StarLayerProps = HTMLMotionProps<"div"> & {
  count?: number;
  size?: number;
  transition?: Transition;
  starColor?: string;
};

function generateStars(count: number, starColor: string) {
  const shadows: string[] = [];
  for (let i = 0; i < count; i++) {
    const x = Math.floor(Math.random() * 4000) - 2000;
    const y = Math.floor(Math.random() * 4000) - 2000;
    shadows.push(`${x}px ${y}px ${starColor}`);
  }
  return shadows.join(", ");
}

function StarLayer({
  count = 1000,
  size = 1,
  transition = { repeat: Infinity, duration: 50, ease: "linear" },
  starColor = "color-mix(in oklab, var(--foreground) 60%, transparent)",
  className,
  ...props
}: StarLayerProps) {
  const [boxShadow, setBoxShadow] = React.useState<string>("");

  React.useEffect(() => {
    setBoxShadow(generateStars(count, starColor));
  }, [count, starColor]);

  return (
    <motion.div
      data-slot="star-layer"
      animate={{ y: [0, -2000] }}
      transition={transition}
      className={cn("absolute top-0 left-0 w-full h-[2000px]", className)}
      {...props}
    >
      <div
        className="absolute bg-transparent rounded-full"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          boxShadow: boxShadow,
        }}
      />
      <div
        className="absolute bg-transparent rounded-full top-[2000px]"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          boxShadow: boxShadow,
        }}
      />
    </motion.div>
  );
}

// Bigger/closer star layers shift more against the shared mouse offset than
// smaller/farther ones, so the field reads as having depth instead of
// panning as one flat plane.
function ParallaxLayer({
  offsetX,
  offsetY,
  depth,
  transition,
  pointerEvents,
  children,
}: {
  offsetX: MotionValue<number>;
  offsetY: MotionValue<number>;
  depth: number;
  transition: SpringOptions;
  pointerEvents: boolean;
  children: React.ReactNode;
}) {
  const scaledX = useTransform(offsetX, (v) => v * depth);
  const scaledY = useTransform(offsetY, (v) => v * depth);
  const springX = useSpring(scaledX, transition);
  const springY = useSpring(scaledY, transition);

  return (
    <motion.div
      style={{ x: springX, y: springY }}
      className={cn({ "pointer-events-none": !pointerEvents })}
    >
      {children}
    </motion.div>
  );
}

type StarsBackgroundProps = React.ComponentProps<"div"> & {
  factor?: number;
  speed?: number;
  transition?: SpringOptions;
  starColor?: string;
  pointerEvents?: boolean;
};

function StarsBackground({
  children,
  className,
  factor = 0.05,
  speed = 50,
  transition = { stiffness: 50, damping: 20 },
  starColor = "color-mix(in oklab, var(--foreground) 60%, transparent)",
  pointerEvents = true,
  ...props
}: StarsBackgroundProps) {
  const offsetX = useMotionValue(1);
  const offsetY = useMotionValue(1);

  // Bound to `window` rather than this div's onMouseMove: the header sits on
  // top (z-50, blurred) and would otherwise swallow the pointer, leaving the
  // parallax dead whenever the cursor crosses it. A window listener still
  // fires via bubbling no matter what's stacked on top.
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const newOffsetX = -(e.clientX - centerX) * factor;
      const newOffsetY = -(e.clientY - centerY) * factor;
      offsetX.set(newOffsetX);
      offsetY.set(newOffsetY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [offsetX, offsetY, factor]);

  return (
    <div
      data-slot="stars-background"
      className={cn(
        "relative size-full overflow-hidden bg-background dark:bg-[radial-gradient(ellipse_at_bottom,_var(--sidebar)_0%,_var(--background)_100%)]",
        className,
      )}
      {...props}
    >
      <ParallaxLayer
        offsetX={offsetX}
        offsetY={offsetY}
        depth={0.3}
        transition={transition}
        pointerEvents={pointerEvents}
      >
        <StarLayer
          count={1000}
          size={1}
          transition={{ repeat: Infinity, duration: speed, ease: "linear" }}
          starColor={starColor}
        />
      </ParallaxLayer>
      <ParallaxLayer
        offsetX={offsetX}
        offsetY={offsetY}
        depth={0.6}
        transition={transition}
        pointerEvents={pointerEvents}
      >
        <StarLayer
          count={400}
          size={2}
          transition={{
            repeat: Infinity,
            duration: speed * 2,
            ease: "linear",
          }}
          starColor={starColor}
        />
      </ParallaxLayer>
      <ParallaxLayer
        offsetX={offsetX}
        offsetY={offsetY}
        depth={1}
        transition={transition}
        pointerEvents={pointerEvents}
      >
        <StarLayer
          count={200}
          size={3}
          transition={{
            repeat: Infinity,
            duration: speed * 3,
            ease: "linear",
          }}
          starColor={starColor}
        />
      </ParallaxLayer>
      {children}
    </div>
  );
}

export { StarLayer, type StarLayerProps, StarsBackground, type StarsBackgroundProps };
