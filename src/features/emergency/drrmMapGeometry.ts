import type { BoundaryLayerResponse, Position } from '@/src/types/drrmHazardMap';

export const DRRM_MAP_WIDTH = 1000;
export const DRRM_MAP_HEIGHT = 720;
export const DRRM_MAP_PADDING = 42;

export interface DrrmMapBounds {
  minLongitude: number;
  maxLongitude: number;
  minLatitude: number;
  maxLatitude: number;
}

export function projectPosition(position: Position, bounds: DrrmMapBounds): [number, number] {
  const longitudeRange = Math.max(bounds.maxLongitude - bounds.minLongitude, 0.000001);
  const latitudeRange = Math.max(bounds.maxLatitude - bounds.minLatitude, 0.000001);
  const usableWidth = DRRM_MAP_WIDTH - DRRM_MAP_PADDING * 2;
  const usableHeight = DRRM_MAP_HEIGHT - DRRM_MAP_PADDING * 2;
  const scale = Math.min(usableWidth / longitudeRange, usableHeight / latitudeRange);
  const renderedWidth = longitudeRange * scale;
  const renderedHeight = latitudeRange * scale;
  const xOffset = (DRRM_MAP_WIDTH - renderedWidth) / 2;
  const yOffset = (DRRM_MAP_HEIGHT - renderedHeight) / 2;
  return [
    xOffset + (position[0] - bounds.minLongitude) * scale,
    yOffset + (bounds.maxLatitude - position[1]) * scale,
  ];
}

export function screenToPosition(
  screenX: number,
  screenY: number,
  viewportWidth: number,
  viewportHeight: number,
  zoom: number,
  translationX: number,
  translationY: number,
  bounds: DrrmMapBounds,
): Position | null {
  if (viewportWidth <= 0 || viewportHeight <= 0 || zoom <= 0) return null;

  // React Native transforms views around their center by default. Undo that transform
  // before undoing the SVG viewBox's xMidYMid meet scaling and map projection.
  const localX = (screenX - translationX - viewportWidth / 2) / zoom + viewportWidth / 2;
  const localY = (screenY - translationY - viewportHeight / 2) / zoom + viewportHeight / 2;
  const svgScale = Math.min(viewportWidth / DRRM_MAP_WIDTH, viewportHeight / DRRM_MAP_HEIGHT);
  const svgOffsetX = (viewportWidth - DRRM_MAP_WIDTH * svgScale) / 2;
  const svgOffsetY = (viewportHeight - DRRM_MAP_HEIGHT * svgScale) / 2;
  const svgX = (localX - svgOffsetX) / svgScale;
  const svgY = (localY - svgOffsetY) / svgScale;
  const longitudeRange = Math.max(bounds.maxLongitude - bounds.minLongitude, 0.000001);
  const latitudeRange = Math.max(bounds.maxLatitude - bounds.minLatitude, 0.000001);
  const mapScale = Math.min(
    (DRRM_MAP_WIDTH - DRRM_MAP_PADDING * 2) / longitudeRange,
    (DRRM_MAP_HEIGHT - DRRM_MAP_PADDING * 2) / latitudeRange,
  );
  const renderedWidth = longitudeRange * mapScale;
  const renderedHeight = latitudeRange * mapScale;
  const mapOffsetX = (DRRM_MAP_WIDTH - renderedWidth) / 2;
  const mapOffsetY = (DRRM_MAP_HEIGHT - renderedHeight) / 2;
  const longitude = bounds.minLongitude + (svgX - mapOffsetX) / mapScale;
  const latitude = bounds.maxLatitude - (svgY - mapOffsetY) / mapScale;
  if (longitude < bounds.minLongitude || longitude > bounds.maxLongitude
    || latitude < bounds.minLatitude || latitude > bounds.maxLatitude) {
    return null;
  }
  return [longitude, latitude];
}

function pointInRing([longitude, latitude]: Position, ring: Position[]): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [currentLongitude, currentLatitude] = ring[index];
    const [previousLongitude, previousLatitude] = ring[previous];
    const intersects = ((currentLatitude > latitude) !== (previousLatitude > latitude))
      && longitude < (previousLongitude - currentLongitude) * (latitude - currentLatitude)
        / (previousLatitude - currentLatitude) + currentLongitude;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function positionInsideBoundary(position: Position, boundary: BoundaryLayerResponse): boolean {
  return boundary.data.features.some((feature) => feature.geometry.coordinates.some((polygon) => {
    const [outerRing, ...holes] = polygon;
    return pointInRing(position, outerRing) && !holes.some((hole) => pointInRing(position, hole));
  }));
}
