import { useEffect, useState } from "react";

/** True while the viewport is at least `px` wide (true where matchMedia is unavailable, e.g. tests). */
export function useMinWidth(px: number): boolean {
  const query = `(min-width: ${px}px)`;
  const [matches, setMatches] = useState(() =>
    typeof window.matchMedia === "function" ? window.matchMedia(query).matches : true,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
