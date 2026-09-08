import { DRRM_CITIZEN_API_BASE_URL } from '@/src/config/api';
import type {
  FloodReferenceClassification,
  FloodReferenceIntersection,
  FloodReferenceLocation,
  FloodReferenceNoIntersection,
  FloodReferenceResult,
} from '@/src/types/drrmFloodReference';

const FLOOD_REFERENCE_PATH = '/drrm/flood-reference-check.php';
const REQUEST_TIMEOUT_MS = 20_000;
const CLASSIFICATIONS: FloodReferenceClassification[] = ['LOW', 'MODERATE', 'HIGH', 'VERY HIGH'];

export type FloodReferenceErrorCode =
  | 'INVALID_REQUEST'
  | 'NOT_FOUND'
  | 'INVALID_LOCATION'
  | 'UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'INVALID_RESPONSE'
  | 'REQUEST_FAILED';

export class FloodReferenceError extends Error {
  constructor(public readonly code: FloodReferenceErrorCode) {
    super('The flood reference check could not be completed.');
    this.name = 'FloodReferenceError';
  }
}

type UnknownRecord = Record<string, unknown>;

function invalidResponse(): never {
  throw new FloodReferenceError('INVALID_RESPONSE');
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readFiniteNumber(record: UnknownRecord, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) invalidResponse();
  return value;
}

function parseLocation(value: unknown): FloodReferenceLocation {
  if (!isRecord(value)) invalidResponse();
  const latitude = readFiniteNumber(value, 'latitude');
  const longitude = readFiniteNumber(value, 'longitude');
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) invalidResponse();
  return { latitude, longitude };
}

function parseBase(value: UnknownRecord) {
  if (value.success !== true || value.source_status !== 'DEVELOPMENT_PREVIEW'
    || value.reference_source !== 'DENR-MGB') {
    invalidResponse();
  }
  return {
    success: true as const,
    source_status: 'DEVELOPMENT_PREVIEW' as const,
    reference_source: 'DENR-MGB' as const,
    location: parseLocation(value.location),
  };
}

export function parseFloodReferenceResponse(value: unknown): FloodReferenceResult {
  if (!isRecord(value)) invalidResponse();
  const base = parseBase(value);

  if (value.status === 'DEVELOPMENT_REFERENCE' && value.intersection === true) {
    if (!CLASSIFICATIONS.includes(value.classification as FloodReferenceClassification)
      || typeof value.risk_rank !== 'number' || !Number.isInteger(value.risk_rank) || value.risk_rank < 1
      || typeof value.overlap_count !== 'number' || !Number.isInteger(value.overlap_count) || value.overlap_count < 1
      || typeof value.multiple_reference_polygons !== 'boolean') {
      invalidResponse();
    }
    return {
      ...base,
      status: 'DEVELOPMENT_REFERENCE',
      intersection: true,
      classification: value.classification as FloodReferenceClassification,
      risk_rank: value.risk_rank,
      overlap_count: value.overlap_count,
      multiple_reference_polygons: value.multiple_reference_polygons,
    } satisfies FloodReferenceIntersection;
  }

  if (value.status === 'NO_MAPPED_REFERENCE_INTERSECTION' && value.intersection === false
    && typeof value.warning === 'string' && value.warning.trim() !== '') {
    return {
      ...base,
      status: 'NO_MAPPED_REFERENCE_INTERSECTION',
      intersection: false,
      warning: value.warning,
    } satisfies FloodReferenceNoIntersection;
  }

  return invalidResponse();
}

function errorCodeForStatus(status: number): FloodReferenceErrorCode {
  if (status === 400) return 'INVALID_REQUEST';
  if (status === 404) return 'NOT_FOUND';
  if (status === 422) return 'INVALID_LOCATION';
  if (status === 502) return 'UNAVAILABLE';
  return 'REQUEST_FAILED';
}

export async function checkFloodReference(latitude: number, longitude: number): Promise<FloodReferenceResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const requestUrl = `${DRRM_CITIZEN_API_BASE_URL}${FLOOD_REFERENCE_PATH}`;
  let responseStatus: number | undefined;

  try {
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude, longitude }),
      signal: controller.signal,
    });
    responseStatus = response.status;
    if (!response.ok) throw new FloodReferenceError(errorCodeForStatus(response.status));
    let payload: unknown;
    try {
      payload = JSON.parse(await response.text()) as unknown;
    } catch {
      throw new FloodReferenceError('INVALID_RESPONSE');
    }
    return parseFloodReferenceResponse(payload);
  } catch (error) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[DRRM flood reference check] request failed', {
        url: requestUrl,
        status: responseStatus,
        message: error instanceof FloodReferenceError ? error.code : 'NETWORK_ERROR',
      });
    }
    if (error instanceof FloodReferenceError) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw new FloodReferenceError('TIMEOUT');
    throw new FloodReferenceError('NETWORK_ERROR');
  } finally {
    clearTimeout(timeoutId);
  }
}

export const DrrmFloodReferenceService = { check: checkFloodReference };
