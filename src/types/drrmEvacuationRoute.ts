import type { Position } from './drrmHazardMap';

export interface EvacuationRoutePreview {
  success: true;
  status: 'DEVELOPMENT_PLANNING_PREVIEW';
  route: {
    type: 'LineString';
    coordinates: Position[];
  };
  distance_meters: number;
  duration_seconds?: number;
  destination?: Record<string, unknown>;
  planning_disclaimer: string;
}