"use client";

import {
  type CSSProperties,
  type HTMLAttributes,
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

type MapGeometry = {
  width: number;
  height: number;
  radius: number;
  bezel: number;
};

const MAX_TEXTURE_SIZE = 480;
const EDGE_TAPER_PX = 1.25;

const displacementMapCache = new Map<string, string>();

function supportsSvgBackdropFilter() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isChromium = /Chrom(e|ium)/.test(ua) || /Edg\//.test(ua);
  return isChromium && !/Firefox/.test(ua);
}

function createDisplacementMap({ width, height, radius, bezel }: MapGeometry) {
  const cacheKey = `${width}:${height}:${radius}:${bezel}`;
  const cached = displacementMapCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const downscale = Math.min(1, MAX_TEXTURE_SIZE / Math.max(width, height));
  const texWidth = Math.max(2, Math.round(width * downscale));
  const texHeight = Math.max(2, Math.round(height * downscale));

  const canvas = document.createElement("canvas");
  canvas.width = texWidth;
  canvas.height = texHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const image = ctx.createImageData(texWidth, texHeight);
  const data = image.data;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const r = Math.min(radius, halfWidth, halfHeight);
  const bezelPx = Math.max(1, bezel * Math.min(halfWidth, halfHeight));

  for (let ty = 0; ty < texHeight; ty += 1) {
    for (let tx = 0; tx < texWidth; tx += 1) {
      const px = ((tx + 0.5) / texWidth) * width - halfWidth;
      const py = ((ty + 0.5) / texHeight) * height - halfHeight;

      const qx = Math.abs(px) - (halfWidth - r);
      const qy = Math.abs(py) - (halfHeight - r);
      let signedDistance: number;
      let dirX = 0;
      let dirY = 0;
      if (qx > 0 && qy > 0) {
        const len = Math.hypot(qx, qy);
        signedDistance = len - r;
        dirX = (Math.sign(px) * qx) / len;
        dirY = (Math.sign(py) * qy) / len;
      } else if (qx > qy) {
        signedDistance = qx - r;
        dirX = Math.sign(px);
      } else {
        signedDistance = qy - r;
        dirY = Math.sign(py);
      }

      const index = (ty * texWidth + tx) * 4;
      const inside = -signedDistance;

      if (inside <= 0) {
        data[index] = 128;
        data[index + 1] = 128;
        data[index + 2] = 128;
        data[index + 3] = 255;
        continue;
      }

      const t = Math.min(1, inside / bezelPx);
      let magnitude = 1 - convexSquircle(t);
      magnitude *= Math.min(1, inside / EDGE_TAPER_PX);

      data[index] = Math.round(128 + dirX * magnitude * 127);
      data[index + 1] = Math.round(128 + dirY * magnitude * 127);
      data[index + 2] = 128;
      data[index + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  const mapUrl = canvas.toDataURL("image/png");
  displacementMapCache.set(cacheKey, mapUrl);
  return mapUrl;
}

function convexSquircle(x: number) {
  return Math.pow(1 - Math.pow(1 - x, 4), 0.25);
}

export type LiquidGlassProps = HTMLAttributes<HTMLDivElement> & {
  blur?: number;
  refraction?: number;
  /**
   * @deprecated Texture size now derives from element size. Accepted for
   * backwards-compatibility but has no effect.
   */
  mapSize?: number;
  bezel?: number;
  saturation?: number;
};

export const LiquidGlass = forwardRef<HTMLDivElement, LiquidGlassProps>(function LiquidGlass(
  {
    blur = 2,
    refraction = 15,
    mapSize: _mapSize,
    bezel = 0.34,
    saturation = 1.28,
    className,
    style,
    children,
    ...props
  },
  ref,
) {
  const rawId = useId();
  const filterId = useMemo(() => `liquid-glass-${rawId.replace(/:/g, "")}`, [rawId]);

  const localRef = useRef<HTMLDivElement | null>(null);
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      localRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  const [geometry, setGeometry] = useState<MapGeometry | null>(null);

  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      if (!width || !height) return;
      const parsed = Number.parseFloat(getComputedStyle(el).borderTopLeftRadius);
      const radius = Math.min(
        Number.isFinite(parsed) ? parsed : Math.min(width, height) / 2,
        width / 2,
        height / 2,
      );
      setGeometry((prev) =>
        prev &&
        prev.width === width &&
        prev.height === height &&
        prev.radius === radius &&
        prev.bezel === bezel
          ? prev
          : { width, height, radius, bezel },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [bezel]);

  const mapUrl = useMemo(() => (geometry ? createDisplacementMap(geometry) : ""), [geometry]);

  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(supportsSvgBackdropFilter());
  }, []);

  const refractionActive = supported && mapUrl !== "";
  const backdropFilter = refractionActive
    ? `url(#${filterId}) blur(${blur}px) saturate(${saturation})`
    : `blur(${blur + 2}px) saturate(${saturation})`;

  return (
    <>
      <div
        ref={setRefs}
        className={cn("relative overflow-hidden rounded-full bg-white/8", className)}
        style={
          {
            ...style,
            backdropFilter,
            WebkitBackdropFilter: backdropFilter,
          } as CSSProperties
        }
        {...props}
      >
        {children}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{
            padding: "var(--liquid-glass-rim-width, 0.5px)",
            background:
              "linear-gradient(to right, rgba(255,255,255,0), var(--liquid-glass-rim-light, rgba(255,255,255,0.25)) var(--liquid-glass-rim-fade, 18%), var(--liquid-glass-rim-light, rgba(255,255,255,0.25)) calc(100% - var(--liquid-glass-rim-fade, 18%)), rgba(255,255,255,0)), " +
              "linear-gradient(to bottom, rgba(0,0,0,0), var(--liquid-glass-rim-dark, rgba(0,0,0,0.2)) var(--liquid-glass-rim-fade, 18%), var(--liquid-glass-rim-dark, rgba(0,0,0,0.2)) calc(100% - var(--liquid-glass-rim-fade, 18%)), rgba(0,0,0,0))",
            WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            mask: "linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)",
          }}
        />
      </div>

      {refractionActive && (
        <svg className="absolute size-0 overflow-hidden" aria-hidden>
          <filter
            id={filterId}
            x="0"
            y="0"
            width="100%"
            height="100%"
            colorInterpolationFilters="sRGB"
          >
            <feImage
              href={mapUrl}
              x="0"
              y="0"
              width="100%"
              height="100%"
              preserveAspectRatio="none"
              result="map"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale={refraction}
              xChannelSelector="R"
              yChannelSelector="G"
              result="displaced"
            />
            <feGaussianBlur in="displaced" stdDeviation="0.15" />
          </filter>
        </svg>
      )}
    </>
  );
});
