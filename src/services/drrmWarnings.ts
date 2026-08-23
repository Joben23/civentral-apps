import { CITIZEN_API_BASE_URL } from '@/src/config/api';
import type {
  ActiveWarningsResponse,
  AffectedArea,
  CitizenWarning,
  WarningLevel,
  WarningLevelCode,
  WarningSource,
} from '@/src/types/drrmWarnings';

const ACTIVE_WARNINGS_PATH = '/drrm/active-warnings.php';
const REQUEST_TIMEOUT_MS = 10_000;
const CALOOCAN_CITY = 'Caloocan City';
const WARNING_LEVEL_SCALE = 'CIVENTRAL Warning Level';
const WARNING_LEVEL_CODES: WarningLevelCode[] = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'];

export const ACTIVE_WARNINGS_ERROR_MESSAGE =
  'Emergency warning information could not be loaded.';

export type DrrmWarningsErrorCode =
  | 'HTTP_ERROR'
  | 'INVALID_RESPONSE'
  | 'NETWORK_ERROR'
  | 'TIMEOUT';

export class DrrmWarningsError extends Error {
  constructor(public readonly code: DrrmWarningsErrorCode) {
    super(ACTIVE_WARNINGS_ERROR_MESSAGE);
    this.name = 'DrrmWarningsError';
  }
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(record: UnknownRecord, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DrrmWarningsError('INVALID_RESPONSE');
  }
  return value;
}

function readNullableString(record: UnknownRecord, key: string): string | null {
  const value = record[key];
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw new DrrmWarningsError('INVALID_RESPONSE');
  }
  return value;
}

function parseWarningLevel(value: unknown): WarningLevel {
  if (!isRecord(value)) {
    throw new DrrmWarningsError('INVALID_RESPONSE');
  }

  const code = readString(value, 'code');
  if (!WARNING_LEVEL_CODES.includes(code as WarningLevelCode)) {
    throw new DrrmWarningsError('INVALID_RESPONSE');
  }

  const scale = readString(value, 'scale');
  if (scale !== WARNING_LEVEL_SCALE) {
    throw new DrrmWarningsError('INVALID_RESPONSE');
  }

  return {
    code: code as WarningLevelCode,
    label: readString(value, 'label'),
    scale,
  };
}

function parseSource(value: unknown): WarningSource {
  if (!isRecord(value)) {
    throw new DrrmWarningsError('INVALID_RESPONSE');
  }
  return {
    code: readString(value, 'code'),
    name: readString(value, 'name'),
  };
}

function parseAffectedAreas(value: unknown): AffectedArea[] {
  if (!Array.isArray(value)) {
    throw new DrrmWarningsError('INVALID_RESPONSE');
  }

  return value.map((area) => {
    if (!isRecord(area)) {
      throw new DrrmWarningsError('INVALID_RESPONSE');
    }
    return {
      scope: readString(area, 'scope'),
      name: readString(area, 'name'),
    };
  });
}

function parseWarning(value: unknown): CitizenWarning {
  if (!isRecord(value)) {
    throw new DrrmWarningsError('INVALID_RESPONSE');
  }

  return {
    id: readString(value, 'id'),
    title: readString(value, 'title'),
    hazard_type: readString(value, 'hazard_type'),
    hazard_label: readString(value, 'hazard_label'),
    warning_level: parseWarningLevel(value.warning_level),
    summary: readString(value, 'summary'),
    issued_at: readString(value, 'issued_at'),
    valid_until: readNullableString(value, 'valid_until'),
    source: parseSource(value.source),
    source_reference: readNullableString(value, 'source_reference'),
    scope: readString(value, 'scope'),
    affected_areas: parseAffectedAreas(value.affected_areas),
    last_updated: readNullableString(value, 'last_updated'),
  };
}

export function parseActiveWarningsResponse(value: unknown): ActiveWarningsResponse {
  if (!isRecord(value) || value.success !== true || !Array.isArray(value.warnings)) {
    throw new DrrmWarningsError('INVALID_RESPONSE');
  }

  const city = readString(value, 'city');
  const warningLevelScale = readString(value, 'warning_level_scale');
  const activeWarningCount = value.active_warning_count;

  if (
    city !== CALOOCAN_CITY ||
    warningLevelScale !== WARNING_LEVEL_SCALE ||
    typeof activeWarningCount !== 'number' ||
    !Number.isInteger(activeWarningCount) ||
    activeWarningCount < 0 ||
    activeWarningCount !== value.warnings.length
  ) {
    throw new DrrmWarningsError('INVALID_RESPONSE');
  }

  return {
    success: true,
    city,
    warning_level_scale: warningLevelScale,
    data_as_of: readString(value, 'data_as_of'),
    active_warning_count: activeWarningCount,
    warnings: value.warnings.map(parseWarning),
  };
}

export async function getActiveWarnings(): Promise<ActiveWarningsResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${CITIZEN_API_BASE_URL}${ACTIVE_WARNINGS_PATH}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new DrrmWarningsError('HTTP_ERROR');
    }

    let payload: unknown;
    try {
      payload = JSON.parse(await response.text()) as unknown;
    } catch {
      throw new DrrmWarningsError('INVALID_RESPONSE');
    }

    return parseActiveWarningsResponse(payload);
  } catch (error) {
    if (error instanceof DrrmWarningsError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new DrrmWarningsError('TIMEOUT');
    }
    throw new DrrmWarningsError('NETWORK_ERROR');
  } finally {
    clearTimeout(timeoutId);
  }
}

export const DrrmWarningsService = {
  getActiveWarnings,
};

