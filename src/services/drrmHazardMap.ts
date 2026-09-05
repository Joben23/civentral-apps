import { CITIZEN_API_BASE_URL } from '@/src/config/api';
import type {
  AnyHazardMapResponse,
  BarangayBoundaryProperties,
  CityBoundaryProperties,
  EvacuationCenterProperties,
  FaultContext,
  FaultLayerData,
  FaultProperties,
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  HazardMapDevelopmentStatus,
  HazardMapGeometry,
  HazardMapLayer,
  HazardMapResponseByLayer,
  HazardMapSource,
  HazardSusceptibilityProperties,
  LineStringGeometry,
  MultiLineStringGeometry,
  MultiPolygonGeometry,
  PointGeometry,
  PolygonGeometry,
  Position,
  SusceptibilityLevel,
} from '@/src/types/drrmHazardMap';

const HAZARD_MAP_PATH = '/drrm/hazard-map.php';
const REQUEST_TIMEOUT_MS = 20_000;
const CALOOCAN_CITY = 'Caloocan City' as const;
const LAYERS: HazardMapLayer[] = [
  'boundary',
  'barangays',
  'flood',
  'landslide',
  'fault',
  'evacuation-centers',
];
const SUSCEPTIBILITY_LEVELS: SusceptibilityLevel[] = ['Low', 'Moderate', 'High', 'Very High'];

export type DrrmHazardMapErrorCode = 'HTTP_ERROR' | 'INVALID_RESPONSE' | 'NETWORK_ERROR' | 'TIMEOUT';

export class DrrmHazardMapError extends Error {
  constructor(public readonly code: DrrmHazardMapErrorCode) {
    super('Hazard and evacuation map information could not be loaded.');
    this.name = 'DrrmHazardMapError';
  }
}

type UnknownRecord = Record<string, unknown>;
type PolygonalGeometry = PolygonGeometry | MultiPolygonGeometry;
type LinearGeometry = LineStringGeometry | MultiLineStringGeometry;

const responseCache = new Map<HazardMapLayer, AnyHazardMapResponse>();
const inFlightRequests = new Map<HazardMapLayer, Promise<AnyHazardMapResponse>>();

function invalidResponse(): never {
  throw new DrrmHazardMapError('INVALID_RESPONSE');
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(record: UnknownRecord, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') {
    invalidResponse();
  }
  return value;
}

function readNumber(record: UnknownRecord, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    invalidResponse();
  }
  return value;
}

function parsePosition(value: unknown): Position {
  if (!Array.isArray(value) || value.length < 2) {
    invalidResponse();
  }
  const longitude = value[0];
  const latitude = value[1];
  if (
    typeof longitude !== 'number' ||
    typeof latitude !== 'number' ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  ) {
    invalidResponse();
  }
  return [longitude, latitude];
}

function parsePositionArray(value: unknown): Position[] {
  if (!Array.isArray(value) || value.length === 0) {
    invalidResponse();
  }
  return value.map(parsePosition);
}

function parsePointGeometry(value: unknown): PointGeometry {
  if (!isRecord(value) || value.type !== 'Point') {
    invalidResponse();
  }
  return { type: 'Point', coordinates: parsePosition(value.coordinates) };
}

function parsePolygonalGeometry(value: unknown): PolygonalGeometry {
  if (!isRecord(value) || !Array.isArray(value.coordinates)) {
    invalidResponse();
  }
  if (value.type === 'Polygon') {
    return { type: 'Polygon', coordinates: value.coordinates.map(parsePositionArray) };
  }
  if (value.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: value.coordinates.map((polygon) => {
        if (!Array.isArray(polygon) || polygon.length === 0) invalidResponse();
        return polygon.map(parsePositionArray);
      }),
    };
  }
  return invalidResponse();
}

function parseLinearGeometry(value: unknown): LinearGeometry {
  if (!isRecord(value) || !Array.isArray(value.coordinates)) {
    invalidResponse();
  }
  if (value.type === 'LineString') {
    return { type: 'LineString', coordinates: parsePositionArray(value.coordinates) };
  }
  if (value.type === 'MultiLineString') {
    return { type: 'MultiLineString', coordinates: value.coordinates.map(parsePositionArray) };
  }
  return invalidResponse();
}

function parseFeatureCollection<TGeometry extends HazardMapGeometry, TProperties extends object>(
  value: unknown,
  expectedCount: number | undefined,
  parseGeometry: (geometry: unknown) => TGeometry,
  parseProperties: (properties: unknown) => TProperties,
): GeoJsonFeatureCollection<TGeometry, TProperties> {
  if (!isRecord(value) || value.type !== 'FeatureCollection' || !Array.isArray(value.features)) {
    invalidResponse();
  }
  if (expectedCount !== undefined && value.features.length !== expectedCount) {
    invalidResponse();
  }
  const features = value.features.map((item): GeoJsonFeature<TGeometry, TProperties> => {
    if (!isRecord(item) || item.type !== 'Feature') {
      invalidResponse();
    }
    return {
      type: 'Feature',
      properties: parseProperties(item.properties),
      geometry: parseGeometry(item.geometry),
    };
  });
  return { type: 'FeatureCollection', features };
}

function parseSource(value: unknown): HazardMapSource {
  if (!isRecord(value)) invalidResponse();
  const source: HazardMapSource = { agency: readString(value, 'agency'), name: readString(value, 'name') };
  if (value.classification_scale !== undefined) {
    if (!Array.isArray(value.classification_scale)) invalidResponse();
    const scale = value.classification_scale.map((item) => {
      if (typeof item !== 'string' || !SUSCEPTIBILITY_LEVELS.includes(item as SusceptibilityLevel)) {
        return invalidResponse();
      }
      return item as SusceptibilityLevel;
    });
    source.classification_scale = scale;
  }
  return source;
}

function parseDevelopmentStatus(value: unknown): HazardMapDevelopmentStatus {
  if (!isRecord(value)) invalidResponse();
  const status: HazardMapDevelopmentStatus = {
    code: readString(value, 'code'),
    label: readString(value, 'label'),
    disclaimer: readString(value, 'disclaimer'),
  };
  if (value.pending_boundaries !== undefined) {
    if (!Array.isArray(value.pending_boundaries)) invalidResponse();
    status.pending_boundaries = value.pending_boundaries.map((item) => {
      if (typeof item !== 'string' || item.trim() === '') return invalidResponse();
      return item;
    });
  }
  return status;
}

function parseCityProperties(value: unknown): CityBoundaryProperties {
  if (!isRecord(value) || value.name !== CALOOCAN_CITY || value.component_count !== 2) invalidResponse();
  if (!Array.isArray(value.components) || value.components[0] !== 'North Caloocan' || value.components[1] !== 'South Caloocan') {
    invalidResponse();
  }
  return {
    name: CALOOCAN_CITY,
    city_code: readString(value, 'city_code'),
    component_count: 2,
    components: ['North Caloocan', 'South Caloocan'],
  };
}

function parseBarangayProperties(value: unknown): BarangayBoundaryProperties {
  if (!isRecord(value) || value.boundary_status !== 'Validated development boundary') invalidResponse();
  const name = readString(value, 'name');
  if (!/^Barangay (?:[1-9]|[1-9][0-9]|1[0-8][0-9])$/.test(name) || name === 'Barangay 176') {
    invalidResponse();
  }
  return { name, psgc_code: readString(value, 'psgc_code'), boundary_status: 'Validated development boundary' };
}

function parseSusceptibilityProperties(
  value: unknown,
  expectedHazard: HazardSusceptibilityProperties['hazard'],
): HazardSusceptibilityProperties {
  if (!isRecord(value) || value.hazard !== expectedHazard) invalidResponse();
  const susceptibility = readString(value, 'susceptibility');
  if (!SUSCEPTIBILITY_LEVELS.includes(susceptibility as SusceptibilityLevel)) invalidResponse();
  return {
    hazard: expectedHazard,
    susceptibility: susceptibility as SusceptibilityLevel,
    source_classification: readString(value, 'source_classification'),
  };
}

function parseFaultProperties(value: unknown): FaultProperties {
  if (!isRecord(value) || value.name !== 'West Valley Fault' || value.intersects_caloocan !== false) invalidResponse();
  return {
    name: 'West Valley Fault',
    fault_system: readString(value, 'fault_system'),
    feature_class: readString(value, 'feature_class'),
    trace_type: readString(value, 'trace_type'),
    intersects_caloocan: false,
  };
}

function parseFaultData(value: unknown): FaultLayerData {
  if (!isRecord(value) || !isRecord(value.context)) invalidResponse();
  const contextRecord = value.context;
  if (
    contextRecord.active_fault_intersects_caloocan !== false ||
    contextRecord.nearest_known_active_fault !== 'West Valley Fault'
  ) {
    invalidResponse();
  }
  const context: FaultContext = {
    active_fault_intersects_caloocan: false,
    nearest_known_active_fault: 'West Valley Fault',
    minimum_distance_km: readNumber(contextRecord, 'minimum_distance_km'),
    advisory: readString(contextRecord, 'advisory'),
  };
  return {
    context,
    geometry: parseFeatureCollection(value.geometry, 1, parseLinearGeometry, parseFaultProperties),
  };
}

function parseCenterProperties(value: unknown): EvacuationCenterProperties {
  if (!isRecord(value)) invalidResponse();
  const latitude = readNumber(value, 'latitude');
  const longitude = readNumber(value, 'longitude');
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) invalidResponse();
  const properties: EvacuationCenterProperties = {
    id: readString(value, 'id'),
    name: readString(value, 'name'),
    latitude,
    longitude,
  };

  for (const key of ['barangay', 'location', 'address', 'verification_status', 'source_context', 'operational_status', 'publication_status', 'managing_office'] as const) {
    if (value[key] !== undefined) properties[key] = readString(value, key);
  }
  if (value.capacity !== undefined) properties.capacity = readNumber(value, 'capacity');
  return properties;
}

function commonResponse(value: unknown, layer: HazardMapLayer): UnknownRecord {
  if (!isRecord(value) || value.success !== true || value.city !== CALOOCAN_CITY || value.layer !== layer) {
    invalidResponse();
  }
  readString(value, 'data_as_of');
  parseSource(value.source);
  parseDevelopmentStatus(value.development_status);
  return value;
}

export function parseHazardMapResponse(layer: HazardMapLayer, value: unknown): AnyHazardMapResponse {
  const response = commonResponse(value, layer);
  const common = {
    success: true as const,
    city: CALOOCAN_CITY,
    data_as_of: readString(response, 'data_as_of'),
    source: parseSource(response.source),
    development_status: parseDevelopmentStatus(response.development_status),
  };

  switch (layer) {
    case 'boundary':
      return {
        ...common,
        layer,
        data: parseFeatureCollection(response.data, 1, (geometry) => {
          const parsed = parsePolygonalGeometry(geometry);
          if (parsed.type !== 'MultiPolygon') invalidResponse();
          return parsed as MultiPolygonGeometry;
        }, parseCityProperties),
      };
    case 'barangays':
      return { ...common, layer, data: parseFeatureCollection(response.data, 187, parsePolygonalGeometry, parseBarangayProperties) };
    case 'flood':
      return {
        ...common,
        layer,
        data: parseFeatureCollection(response.data, 15, parsePolygonalGeometry, (properties) =>
          parseSusceptibilityProperties(properties, 'Flood')),
      };
    case 'landslide':
      return {
        ...common,
        layer,
        data: parseFeatureCollection(response.data, 13, parsePolygonalGeometry, (properties) =>
          parseSusceptibilityProperties(properties, 'Rain-induced landslide')),
      };
    case 'fault':
      return { ...common, layer, data: parseFaultData(response.data) };
    case 'evacuation-centers':
      return {
        ...common,
        layer,
        data: parseFeatureCollection(response.data, undefined, parsePointGeometry, parseCenterProperties),
      };
  }
}

async function requestLayer(layer: HazardMapLayer): Promise<AnyHazardMapResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${CITIZEN_API_BASE_URL}${HAZARD_MAP_PATH}?layer=${encodeURIComponent(layer)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new DrrmHazardMapError('HTTP_ERROR');
    let payload: unknown;
    try {
      payload = JSON.parse(await response.text()) as unknown;
    } catch {
      throw new DrrmHazardMapError('INVALID_RESPONSE');
    }
    return parseHazardMapResponse(layer, payload);
  } catch (error) {
    if (error instanceof DrrmHazardMapError) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw new DrrmHazardMapError('TIMEOUT');
    throw new DrrmHazardMapError('NETWORK_ERROR');
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getHazardMapLayer<TLayer extends HazardMapLayer>(
  layer: TLayer,
  options: { forceRefresh?: boolean } = {},
): Promise<HazardMapResponseByLayer[TLayer]> {
  if (!LAYERS.includes(layer)) throw new DrrmHazardMapError('INVALID_RESPONSE');
  if (!options.forceRefresh) {
    const cached = responseCache.get(layer);
    if (cached) return cached as HazardMapResponseByLayer[TLayer];
    const pending = inFlightRequests.get(layer);
    if (pending) return pending as Promise<HazardMapResponseByLayer[TLayer]>;
  }

  const request = requestLayer(layer);
  inFlightRequests.set(layer, request);
  try {
    const result = await request;
    responseCache.set(layer, result);
    return result as HazardMapResponseByLayer[TLayer];
  } finally {
    if (inFlightRequests.get(layer) === request) inFlightRequests.delete(layer);
  }
}

export function clearHazardMapLayerCache(layer?: HazardMapLayer): void {
  if (layer) {
    responseCache.delete(layer);
    inFlightRequests.delete(layer);
    return;
  }
  responseCache.clear();
  inFlightRequests.clear();
}

export const DrrmHazardMapService = { getLayer: getHazardMapLayer, clearCache: clearHazardMapLayerCache };
