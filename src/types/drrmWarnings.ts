export type WarningLevelCode = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface WarningLevel {
  code: WarningLevelCode;
  label: string;
  scale: string;
}

export interface WarningSource {
  code: string;
  name: string;
}

export interface AffectedArea {
  scope: string;
  name: string;
}

export interface CitizenWarning {
  id: string;
  title: string;
  hazard_type: string;
  hazard_label: string;
  warning_level: WarningLevel;
  summary: string;
  issued_at: string;
  valid_until: string | null;
  source: WarningSource;
  source_reference: string | null;
  scope: string;
  affected_areas: AffectedArea[];
  last_updated: string | null;
}

export interface ActiveWarningsResponse {
  success: true;
  city: string;
  warning_level_scale: string;
  data_as_of: string;
  active_warning_count: number;
  warnings: CitizenWarning[];
}

