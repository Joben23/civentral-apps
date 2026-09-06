import { DRRM_CITIZEN_API_BASE_URL } from '@/src/config/api';
import type { EvacuationRoutePreview } from '@/src/types/drrmEvacuationRoute';
import type { Position } from '@/src/types/drrmHazardMap';

const ROUTE_PREVIEW_PATH = '/drrm/evacuation-route-preview.php';
const REQUEST_TIMEOUT_MS = 20_000;

export type EvacuationRouteErrorCode = 'INVALID_REQUEST' | 'UNAVAILABLE' | 'NO_ROUTE' | 'NETWORK_ERROR' | 'TIMEOUT' | 'INVALID_RESPONSE';

export class EvacuationRouteError extends Error {
  constructor(public readonly code: EvacuationRouteErrorCode) {
    super('Evacuation route planning preview is unavailable.');
    this.name = 'EvacuationRouteError';
  }
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePosition(value: unknown): Position {
  if (!Array.isArray(value) || value.length < 2 || typeof value[0] !== 'number' || typeof value[1] !== 'number'
    || !Number.isFinite(value[0]) || !Number.isFinite(value[1])) {
    throw new EvacuationRouteError('INVALID_RESPONSE');
  }
  return [value[0], value[1]];
}

function parseResponse(value: unknown): EvacuationRoutePreview {
  const disclaimer = isRecord(value)
    ? (typeof value.planning_disclaimer === 'string' ? value.planning_disclaimer : value.disclaimer)
    : undefined;
  if (!isRecord(value) || value.success !== true || value.status !== 'DEVELOPMENT_PLANNING_PREVIEW'
    || !isRecord(value.route) || value.route.type !== 'LineString' || !Array.isArray(value.route.coordinates)
    || value.route.coordinates.length < 2 || typeof value.distance_meters !== 'number'
    || !Number.isFinite(value.distance_meters) || typeof disclaimer !== 'string') {
    throw new EvacuationRouteError('INVALID_RESPONSE');
  }

  const duration = value.duration_seconds;
  if (duration !== undefined && (typeof duration !== 'number' || !Number.isFinite(duration))) {
    throw new EvacuationRouteError('INVALID_RESPONSE');
  }

  return {
    success: true,
    status: 'DEVELOPMENT_PLANNING_PREVIEW',
    route: { type: 'LineString', coordinates: value.route.coordinates.map(parsePosition) },
    distance_meters: value.distance_meters,
    ...(duration === undefined ? {} : { duration_seconds: duration }),
    ...(isRecord(value.destination) ? { destination: value.destination } : {}),
    planning_disclaimer: disclaimer,
  };
}

function errorCodeForStatus(status: number): EvacuationRouteErrorCode {
  if (status === 400) return 'INVALID_REQUEST';
  if (status === 404 || status === 502) return 'UNAVAILABLE';
  if (status === 422) return 'NO_ROUTE';
  return 'NETWORK_ERROR';
}

export async function previewEvacuationRoute(
  latitude: number,
  longitude: number,
  centerReferenceId: string,
): Promise<EvacuationRoutePreview> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const requestUrl = `${DRRM_CITIZEN_API_BASE_URL}${ROUTE_PREVIEW_PATH}`;
  let responseStatus: number | undefined;

  try {
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude, longitude, center_reference_id: centerReferenceId }),
      signal: controller.signal,
    });
    responseStatus = response.status;
    if (!response.ok) throw new EvacuationRouteError(errorCodeForStatus(response.status));
    let payload: unknown;
    try {
      payload = JSON.parse(await response.text()) as unknown;
    } catch {
      throw new EvacuationRouteError('INVALID_RESPONSE');
    }
    return parseResponse(payload);
  } catch (error) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[DRRM evacuation route preview] request failed', {
        url: requestUrl,
        status: responseStatus,
        code: error instanceof EvacuationRouteError ? error.code : 'NETWORK_ERROR',
      });
    }
    if (error instanceof EvacuationRouteError) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw new EvacuationRouteError('TIMEOUT');
    throw new EvacuationRouteError('NETWORK_ERROR');
  } finally {
    clearTimeout(timeoutId);
  }
}

export const DrrmEvacuationRouteService = { preview: previewEvacuationRoute };