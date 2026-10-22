import { useEffect } from "react";

export const VARIANT_PARAM = "variant";

export function readVariantFromLocation(fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return new URLSearchParams(window.location.search).get(VARIANT_PARAM) ?? fallback;
}

function writeVariantToLocation(key: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set(VARIANT_PARAM, key);
  window.history.replaceState(null, "", url);
}

export interface PrototypeSwitcherProps {
  readonly variants: readonly { key: string; name: string }[];
  readonly current: string;
  readonly onChange: (key: string) => void;
}

export function PrototypeSwitcher({ variants, current, onChange }: PrototypeSwitcherProps) {
  const index = Math.max(
    0,
    variants.findIndex((variant) => variant.key === current),
  );

  useEffect(() => {
    writeVariantToLocation(current);
  }, [current]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      const step = event.key === "ArrowLeft" ? -1 : 1;
      const next = variants[(index + step + variants.length) % variants.length];
      if (next !== undefined) onChange(next.key);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index, onChange, variants]);

  if (!import.meta.env.DEV) return null;

  function step(delta: number) {
    const next = variants[(index + delta + variants.length) % variants.length];
    if (next !== undefined) onChange(next.key);
  }

  const active = variants[index];

  return (
    <div
      className="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-1 rounded-full px-1.5 py-1.5 shadow-lg"
      style={{
        background: "oklch(0.18 0 0)",
        border: "1px solid oklch(0.45 0 0)",
        color: "oklch(0.98 0 0)",
      }}
    >
      <button
        type="button"
        onClick={() => step(-1)}
        aria-label="Previous variant"
        className="grid size-7 place-items-center rounded-full hover:bg-white/15"
      >
        ←
      </button>
      <span className="px-2 font-mono text-xs tracking-tight">
        {active?.key ?? "?"} — {active?.name ?? "unknown"}
      </span>
      <button
        type="button"
        onClick={() => step(1)}
        aria-label="Next variant"
        className="grid size-7 place-items-center rounded-full hover:bg-white/15"
      >
        →
      </button>
    </div>
  );
}
