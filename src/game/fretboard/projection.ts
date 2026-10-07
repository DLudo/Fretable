import type { Box, Point } from './geometry'

/**
 * Passage de l'espace du manche (mm, viewBox SVG) aux pixels du conteneur.
 * Reproduit `preserveAspectRatio="xMidYMid meet"`.
 */
export interface BoardProjection {
  toPx(point: Point): Point
  pxPerMm: number
  width: number
  height: number
}

export function createProjection(viewBox: Box, width: number, height: number): BoardProjection {
  const scale = Math.min(width / viewBox.width, height / viewBox.height) || 0
  const offsetX = (width - viewBox.width * scale) / 2
  const offsetY = (height - viewBox.height * scale) / 2
  return {
    pxPerMm: scale,
    width,
    height,
    toPx: ({ x, y }) => ({
      x: offsetX + (x - viewBox.x) * scale,
      y: offsetY + (y - viewBox.y) * scale,
    }),
  }
}
