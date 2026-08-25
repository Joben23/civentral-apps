export const CITIZEN_INCIDENT_TYPES = [
  'FLOOD',
  'FIRE',
  'LANDSLIDE',
  'EARTHQUAKE',
  'ROAD_BLOCKAGE',
  'FALLEN_TREE',
  'STRUCTURAL_DAMAGE',
  'MEDICAL_EMERGENCY',
  'UTILITY_HAZARD',
  'OTHER',
] as const;

export type CitizenIncidentType = (typeof CITIZEN_INCIDENT_TYPES)[number];

export interface CitizenIncidentBarangay {
  barangay_id: string;
  name: string;
}

export interface CitizenIncidentFormValues {
  incidentType: CitizenIncidentType | '';
  title: string;
  description: string;
  barangayId: string | null;
  locationDescription: string;
}

export type CitizenIncidentFormErrors = Partial<
  Record<keyof CitizenIncidentFormValues, string>
>;

export interface CitizenIncidentRequestPayload {
  request_id: string;
  incident_type: CitizenIncidentType;
  title: string;
  description: string;
  barangay_id?: string;
  location_description: string;
}

export interface CitizenIncidentBarangayResponse {
  success: true;
  count: number;
  barangays: CitizenIncidentBarangay[];
}

export interface CitizenIncidentSubmissionResponse {
  success: true;
  incident_number: string;
  status: 'SUBMITTED';
  submitted_at: string;
  message: string;
}

export type CitizenIncidentErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'INVALID_INCIDENT_TYPE'
  | 'INVALID_BARANGAY'
  | 'INVALID_LOCATION'
  | 'INVALID_COORDINATES'
  | 'INVALID_REQUEST'
  | 'RATE_LIMITED'
  | 'DUPLICATE_SUBMISSION'
  | 'INCIDENT_SERVICE_UNAVAILABLE'
  | 'INCIDENT_SUBMISSION_FAILED';
