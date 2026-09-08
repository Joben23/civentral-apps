import type { Position } from '@/src/types/drrmHazardMap';

export const MAP_LOCATION_SELECTION_MODE = {
  NONE: 'NONE',
  ROUTE_ORIGIN_SELECTION: 'ROUTE_ORIGIN_SELECTION',
  FLOOD_CHECK_LOCATION_SELECTION: 'FLOOD_CHECK_LOCATION_SELECTION',
} as const;

export type MapLocationSelectionMode = typeof MAP_LOCATION_SELECTION_MODE[keyof typeof MAP_LOCATION_SELECTION_MODE];

export interface PreparednessLocations {
  routeOrigin: Position | null;
  floodCheckLocation: Position | null;
}

export function selectPreparednessLocation(
  current: PreparednessLocations,
  mode: MapLocationSelectionMode,
  position: Position,
): PreparednessLocations {
  if (mode === MAP_LOCATION_SELECTION_MODE.ROUTE_ORIGIN_SELECTION) {
    return { ...current, routeOrigin: position };
  }
  if (mode === MAP_LOCATION_SELECTION_MODE.FLOOD_CHECK_LOCATION_SELECTION) {
    return { ...current, floodCheckLocation: position };
  }
  return current;
}
