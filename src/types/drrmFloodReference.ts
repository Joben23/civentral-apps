export type FloodReferenceClassification = 'LOW' | 'MODERATE' | 'HIGH' | 'VERY HIGH';

export interface FloodReferenceLocation {
  latitude: number;
  longitude: number;
}

interface FloodReferenceBase {
  success: true;
  source_status: 'DEVELOPMENT_PREVIEW';
  reference_source: 'DENR-MGB';
  location: FloodReferenceLocation;
}

export interface FloodReferenceIntersection extends FloodReferenceBase {
  status: 'DEVELOPMENT_REFERENCE';
  intersection: true;
  classification: FloodReferenceClassification;
  risk_rank: number;
  overlap_count: number;
  multiple_reference_polygons: boolean;
}

export interface FloodReferenceNoIntersection extends FloodReferenceBase {
  status: 'NO_MAPPED_REFERENCE_INTERSECTION';
  intersection: false;
  warning: string;
}

export type FloodReferenceResult = FloodReferenceIntersection | FloodReferenceNoIntersection;
