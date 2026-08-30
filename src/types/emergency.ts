export type EmergencyCategory = 'Medical' | 'Fire' | 'Police' | 'Disaster' | 'Traffic Incident' | 'Rescue';

export type SOSStatus = 'Triggered' | 'Dispatched' | 'On Scene' | 'Resolved' | 'Cancelled';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy?: number;
  addressName?: string;
}

export interface IncidentSOSReport {
  id: string;
  category: EmergencyCategory;
  status: SOSStatus;
  location: LocationCoords;
  timestamp: string;
  responderUnit?: string;
  notes?: string;
}
