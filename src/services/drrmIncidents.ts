import * as Crypto from 'expo-crypto';
import { CITIZEN_API_BASE_URL } from '@/src/config/api';
import {
  CITIZEN_INCIDENT_TYPES,
  type CitizenIncidentBarangay,
  type CitizenIncidentBarangayResponse,
  type CitizenIncidentErrorCode,
  type CitizenIncidentFormErrors,
  type CitizenIncidentFormValues,
  type CitizenIncidentRequestPayload,
  type CitizenIncidentSubmissionResponse,
} from '@/src/types/drrmIncidents';

const INCIDENTS_PATH = '/drrm/incidents.php';
const BARANGAYS_PATH = '/drrm/barangays.php';
const REQUEST_TIMEOUT_MS = 20_000;
const EXPECTED_BARANGAY_COUNT = 187;
const REQUEST_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BARANGAY_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INCIDENT_NUMBER_PATTERN = /^INC-[0-9]{4}-[0-9]{6,}$/;
const DISALLOWED_PLAIN_TEXT_PATTERN = /[<>\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;

const ERROR_MESSAGES: Record<CitizenIncidentErrorCode, string> = {
  AUTHENTICATION_REQUIRED:
    'Your citizen session has expired or is unavailable. Please sign in again before submitting.',
  INVALID_INCIDENT_TYPE: 'Please select a supported incident type and try again.',
  INVALID_BARANGAY: 'The selected barangay could not be verified. Please review the location.',
  INVALID_LOCATION: 'Please provide a valid Caloocan City location for this incident.',
  INVALID_COORDINATES: 'The location coordinates are invalid. Please review the location.',
  INVALID_REQUEST: 'Some report details are invalid. Please review the form and try again.',
  RATE_LIMITED: 'Too many reports were submitted recently. Please wait before trying again.',
  DUPLICATE_SUBMISSION:
    'An identical incident report was recently submitted. Please avoid sending it again.',
  INCIDENT_SERVICE_UNAVAILABLE:
    'Incident reporting is temporarily unavailable. Please try again later.',
  INCIDENT_SUBMISSION_FAILED:
    'The incident report could not be submitted. Please review it and try again.',
};

type UnknownRecord = Record<string, unknown>;

export class DrrmCitizenIncidentError extends Error {
  constructor(public readonly code: CitizenIncidentErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = 'DrrmCitizenIncidentError';
  }
}

export class DrrmCitizenBarangayError extends Error {
  constructor() {
    super('Barangay choices could not be loaded. You can still describe the location below.');
    this.name = 'DrrmCitizenBarangayError';
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIncidentErrorCode(value: unknown): value is CitizenIncidentErrorCode {
  return typeof value === 'string' && Object.hasOwn(ERROR_MESSAGES, value);
}

function validatePlainText(
  value: string,
  fieldLabel: string,
  minimum: number,
  maximum: number,
): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return `${fieldLabel} is required.`;
  if (trimmed.length < minimum) return `${fieldLabel} must be at least ${minimum} characters.`;
  if (trimmed.length > maximum) return `${fieldLabel} must be ${maximum} characters or fewer.`;
  if (DISALLOWED_PLAIN_TEXT_PATTERN.test(trimmed)) {
    return `${fieldLabel} contains unsupported characters.`;
  }
  return undefined;
}

export function validateCitizenIncidentForm(
  values: CitizenIncidentFormValues,
): CitizenIncidentFormErrors {
  const errors: CitizenIncidentFormErrors = {};

  if (!values.incidentType || !CITIZEN_INCIDENT_TYPES.includes(values.incidentType)) {
    errors.incidentType = 'Incident type is required.';
  }
  if (values.barangayId !== null && !BARANGAY_UUID_PATTERN.test(values.barangayId)) {
    errors.barangayId = 'The selected barangay is invalid. Please clear it and try again.';
  }

  errors.title = validatePlainText(values.title, 'Title', 10, 180);
  errors.description = validatePlainText(values.description, 'Description', 20, 5000);
  errors.locationDescription = validatePlainText(
    values.locationDescription,
    'Location description',
    5,
    500,
  );

  for (const key of Object.keys(errors) as (keyof CitizenIncidentFormErrors)[]) {
    if (errors[key] === undefined) delete errors[key];
  }

  return errors;
}

export function createCitizenIncidentRequestId(): string {
  return Crypto.randomUUID().toLowerCase();
}

export function createCitizenIncidentPayload(
  values: CitizenIncidentFormValues,
  requestId = createCitizenIncidentRequestId(),
): CitizenIncidentRequestPayload {
  const errors = validateCitizenIncidentForm(values);
  if (
    Object.keys(errors).length > 0 ||
    !values.incidentType ||
    !REQUEST_UUID_PATTERN.test(requestId)
  ) {
    throw new DrrmCitizenIncidentError('INVALID_REQUEST');
  }

  const payload: CitizenIncidentRequestPayload = {
    request_id: requestId.toLowerCase(),
    incident_type: values.incidentType,
    title: values.title.trim(),
    description: values.description.trim(),
    location_description: values.locationDescription.trim(),
  };
  if (values.barangayId !== null) {
    payload.barangay_id = values.barangayId.toLowerCase();
  }
  return payload;
}

export function parseCitizenIncidentBarangays(
  payload: unknown,
  responseStatus = 200,
): CitizenIncidentBarangayResponse {
  if (
    responseStatus < 200 ||
    responseStatus >= 300 ||
    !isRecord(payload) ||
    payload.success !== true ||
    payload.count !== EXPECTED_BARANGAY_COUNT ||
    !Array.isArray(payload.barangays) ||
    payload.barangays.length !== EXPECTED_BARANGAY_COUNT
  ) {
    throw new DrrmCitizenBarangayError();
  }

  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const barangays = payload.barangays.map((value): CitizenIncidentBarangay => {
    if (!isRecord(value) || Object.keys(value).sort().join(',') !== 'barangay_id,name') {
      throw new DrrmCitizenBarangayError();
    }
    const id = typeof value.barangay_id === 'string' ? value.barangay_id.toLowerCase() : '';
    const name = typeof value.name === 'string' ? value.name.trim() : '';
    const match = /^Barangay ([1-9]|[1-9]\d|1\d\d)$/.exec(name);
    const number = match ? Number(match[1]) : 0;
    if (
      !BARANGAY_UUID_PATTERN.test(id) ||
      number < 1 ||
      number > 188 ||
      number === 176 ||
      seenIds.has(id) ||
      seenNames.has(name)
    ) {
      throw new DrrmCitizenBarangayError();
    }
    seenIds.add(id);
    seenNames.add(name);
    return { barangay_id: id, name };
  });

  return {
    success: true,
    count: barangays.length,
    barangays: barangays.sort(
      (first, second) =>
        Number(first.name.replace('Barangay ', '')) -
        Number(second.name.replace('Barangay ', '')),
    ),
  };
}

export async function getCitizenIncidentBarangays(): Promise<CitizenIncidentBarangay[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${CITIZEN_API_BASE_URL}${BARANGAYS_PATH}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    let responsePayload: unknown;
    try {
      responsePayload = JSON.parse(await response.text()) as unknown;
    } catch {
      throw new DrrmCitizenBarangayError();
    }
    return parseCitizenIncidentBarangays(responsePayload, response.status).barangays;
  } catch (error) {
    if (error instanceof DrrmCitizenBarangayError) throw error;
    throw new DrrmCitizenBarangayError();
  } finally {
    clearTimeout(timeoutId);
  }
}

function responseErrorCode(responseStatus: number, payload: unknown): CitizenIncidentErrorCode {
  if (isRecord(payload) && isRecord(payload.error) && isIncidentErrorCode(payload.error.code)) {
    return payload.error.code;
  }
  if (responseStatus === 401) return 'AUTHENTICATION_REQUIRED';
  if (responseStatus === 429) return 'RATE_LIMITED';
  if (responseStatus === 503) return 'INCIDENT_SERVICE_UNAVAILABLE';
  if (responseStatus >= 400 && responseStatus < 500) return 'INVALID_REQUEST';
  return 'INCIDENT_SUBMISSION_FAILED';
}

export function parseCitizenIncidentResponse(
  payload: unknown,
  responseStatus = 201,
): CitizenIncidentSubmissionResponse {
  if (
    responseStatus < 200 ||
    responseStatus >= 300 ||
    !isRecord(payload) ||
    payload.success !== true
  ) {
    throw new DrrmCitizenIncidentError(responseErrorCode(responseStatus, payload));
  }

  if (
    typeof payload.incident_number !== 'string' ||
    !INCIDENT_NUMBER_PATTERN.test(payload.incident_number) ||
    payload.status !== 'SUBMITTED' ||
    typeof payload.submitted_at !== 'string' ||
    payload.submitted_at.trim() === '' ||
    Number.isNaN(Date.parse(payload.submitted_at)) ||
    typeof payload.message !== 'string' ||
    payload.message.trim() === ''
  ) {
    throw new DrrmCitizenIncidentError('INCIDENT_SUBMISSION_FAILED');
  }

  return {
    success: true,
    incident_number: payload.incident_number,
    status: 'SUBMITTED',
    submitted_at: payload.submitted_at,
    message: payload.message,
  };
}

export async function submitCitizenIncident(
  values: CitizenIncidentFormValues,
): Promise<CitizenIncidentSubmissionResponse> {
  const payload = createCitizenIncidentPayload(values);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${CITIZEN_API_BASE_URL}${INCIDENTS_PATH}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    let responsePayload: unknown;
    try {
      responsePayload = JSON.parse(await response.text()) as unknown;
    } catch {
      throw new DrrmCitizenIncidentError(
        response.status === 503 ? 'INCIDENT_SERVICE_UNAVAILABLE' : 'INCIDENT_SUBMISSION_FAILED',
      );
    }

    return parseCitizenIncidentResponse(responsePayload, response.status);
  } catch (error) {
    if (error instanceof DrrmCitizenIncidentError) throw error;
    throw new DrrmCitizenIncidentError('INCIDENT_SERVICE_UNAVAILABLE');
  } finally {
    clearTimeout(timeoutId);
  }
}

export const DrrmCitizenIncidentService = {
  getCitizenIncidentBarangays,
  submitCitizenIncident,
};
