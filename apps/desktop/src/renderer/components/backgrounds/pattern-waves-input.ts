export interface PointerState {
  x: number;
  y: number;
  inside: boolean;
  placed: boolean;
  lastX: number;
  lastY: number;
  burst: number;
}

export function createPointerState(): PointerState {
  return { x: 0, y: 0, inside: false, placed: false, lastX: 0, lastY: 0, burst: 0 };
}

export function bindPointerInput(
  container: HTMLElement,
  pointer: PointerState,
  wake: () => void,
): () => void {
  const locate = (event: PointerEvent) => {
    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return { x, y, inside: x >= 0 && y >= 0 && x <= rect.width && y <= rect.height };
  };

  const onPointerMove = (event: PointerEvent) => {
    const spot = locate(event);
    pointer.x = spot.x;
    pointer.y = spot.y;
    if (spot.inside !== pointer.inside) pointer.placed = false;
    pointer.inside = spot.inside;
    if (spot.inside) wake();
  };

  const onPointerDown = (event: PointerEvent) => {
    const spot = locate(event);
    if (!spot.inside) return;
    pointer.x = spot.x;
    pointer.y = spot.y;
    if (!pointer.inside) {
      pointer.lastX = spot.x;
      pointer.lastY = spot.y;
    }
    pointer.burst = 1.2;
    wake();
  };

  const onPointerLeave = () => {
    pointer.inside = false;
    pointer.placed = false;
    wake();
  };

  const onPointerOut = (event: PointerEvent) => {
    if (!event.relatedTarget) onPointerLeave();
  };

  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerType === "touch") onPointerLeave();
  };

  const onVisibility = () => {
    if (!document.hidden) wake();
  };

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("pointerout", onPointerOut, { passive: true });
  window.addEventListener("pointerup", onPointerUp, { passive: true });
  window.addEventListener("blur", onPointerLeave);
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointerout", onPointerOut);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("blur", onPointerLeave);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
