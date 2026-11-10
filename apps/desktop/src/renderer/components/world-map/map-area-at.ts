import { areaAtPoint } from "./map-hit-test.js";
import type { ProjectedArea } from "./projection.js";
import type { MapCamera } from "./useMapCamera.js";

export function areaAt(
  camera: MapCamera,
  areas: readonly ProjectedArea[],
  projection: { readonly width: number },
  clientX: number,
  clientY: number,
): string | null {
  if (typeof document.elementsFromPoint === "function") {
    for (const element of document.elementsFromPoint(clientX, clientY)) {
      const area = element.closest("[data-map-area]");
      if (area instanceof Element) return area.getAttribute("data-map-area");
    }
  }
  const svg = camera.svgRef.current;
  const matrix = svg?.getScreenCTM?.();
  if (svg === null || svg === undefined || matrix === null || matrix === undefined) return null;
  if (matrix.a === 0 || matrix.d === 0 || typeof svg.createSVGPoint !== "function") return null;
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const user = point.matrixTransform(matrix.inverse());
  const { scale, x, y } = camera.getTransform();
  if (scale === 0) return null;
  return areaAtPoint(areas, { x: (user.x - x) / scale, y: (user.y - y) / scale }, projection.width);
}
