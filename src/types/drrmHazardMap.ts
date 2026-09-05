export type HazardMapLayer =
  | 'boundary'
  | 'barangays'
  | 'flood'
  | 'landslide'
  | 'fault'
  | 'evacuation-centers';

export type SusceptibilityLevel = 'Low' | 'Moderate' | 'High' | 'Very High';
export type Position = [longitude: number, latitude: number];

export interface PointGeometry {
  type: 'Point';
  coordinates: Position;
}

export interface LineStringGeometry {
  type: 'LineString';
  coordinates: Position[];
}

export interface MultiLineStringGeometry {
  type: 'MultiLineString';
  coordinates: Position[][];
}

export interface PolygonGeometry {
  type: 'Polygon';
  coordinates: Position[][];
}

export interface MultiPolygonGeometry {
  type: 'MultiPolygon';
  coordinates: Position[][][];
}

export type HazardMapGeometry =
  | PointGeometry
  | LineStringGeometry
  | MultiLineStringGeometry
  | PolygonGeometry
  | MultiPolygonGeometry;

export interface GeoJsonFeature<
  TGeometry extends HazardMapGeometry,
  TProperties extends object,
> {
  type: 'Feature';
  properties: TProperties;
  geometry: TGeometry;
}

export interface GeoJsonFeatureCollection<
  TGeometry extends HazardMapGeometry,
  TProperties extends object,
> {
  type: 'FeatureCollection';
  features: GeoJsonFeature<TGeometry, TProperties>[];
}

export interface HazardMapSource {
  agency: string;
  name: string;
  classification_scale?: SusceptibilityLevel[];
}

export interface HazardMapDevelopmentStatus {
  code: string;
  label: string;
  disclaimer: string;
  pending_boundaries?: string[];
}

export interface CityBoundaryProperties {
  name: 'Caloocan City';
  city_code: string;
  component_count: 2;
  components: ['North Caloocan', 'South Caloocan'];
}

export interface BarangayBoundaryProperties {
  name: string;
  psgc_code: string;
  boundary_status: 'Validated development boundary';
}

export interface HazardSusceptibilityProperties {
  hazard: 'Flood' | 'Rain-induced landslide';
  susceptibility: SusceptibilityLevel;
  source_classification: string;
}

export interface FaultProperties {
  name: 'West Valley Fault';
  fault_system: string;
  feature_class: string;
  trace_type: string;
  intersects_caloocan: false;
}

export interface FaultContext {
  active_fault_intersects_caloocan: false;
  nearest_known_active_fault: 'West Valley Fault';
  minimum_distance_km: number;
  advisory: string;
}

export interface FaultLayerData {
  context: FaultContext;
  geometry: GeoJsonFeatureCollection<LineStringGeometry | MultiLineStringGeometry, FaultProperties>;
}

export interface EvacuationCenterProperties {
  id: string;
  name: string;
  barangay?: string;
  location?: string;
  address?: string;
  capacity?: number;
  operational_status?: string;
  publication_status?: string;
  managing_office?: string;
  latitude: number;
  longitude: number;
  verification_status?: string;
  source_context?: string;
  source_status?: string;
}

export interface PublicHazardMapResponse<TLayer extends HazardMapLayer, TData> {
  success: true;
  city: 'Caloocan City';
  layer: TLayer;
  data_as_of?: string;
  source?: HazardMapSource;
  development_status?: HazardMapDevelopmentStatus;
  data: TData;
}

export type BoundaryLayerResponse = PublicHazardMapResponse<
  'boundary',
  GeoJsonFeatureCollection<MultiPolygonGeometry, CityBoundaryProperties>
>;

export type BarangayLayerResponse = PublicHazardMapResponse<
  'barangays',
  GeoJsonFeatureCollection<PolygonGeometry | MultiPolygonGeometry, BarangayBoundaryProperties>
>;

export type FloodLayerResponse = PublicHazardMapResponse<
  'flood',
  GeoJsonFeatureCollection<PolygonGeometry | MultiPolygonGeometry, HazardSusceptibilityProperties>
>;

export type LandslideLayerResponse = PublicHazardMapResponse<
  'landslide',
  GeoJsonFeatureCollection<PolygonGeometry | MultiPolygonGeometry, HazardSusceptibilityProperties>
>;

export type FaultLayerResponse = PublicHazardMapResponse<'fault', FaultLayerData>;

export type EvacuationCentersLayerResponse = PublicHazardMapResponse<
  'evacuation-centers',
  GeoJsonFeatureCollection<PointGeometry, EvacuationCenterProperties>
>;

export interface HazardMapResponseByLayer {
  boundary: BoundaryLayerResponse;
  barangays: BarangayLayerResponse;
  flood: FloodLayerResponse;
  landslide: LandslideLayerResponse;
  fault: FaultLayerResponse;
  'evacuation-centers': EvacuationCentersLayerResponse;
}

export type AnyHazardMapResponse = HazardMapResponseByLayer[HazardMapLayer];

export type MapFeatureSelection =
  | { kind: 'barangay'; properties: BarangayBoundaryProperties }
  | { kind: 'flood' | 'landslide'; properties: HazardSusceptibilityProperties }
  | { kind: 'fault'; properties: FaultProperties; context: FaultContext }
  | { kind: 'evacuation-center'; properties: EvacuationCenterProperties };
