import type {
  CitizenIncidentBarangay,
  CitizenIncidentType,
} from '@/src/types/drrmIncidents';

export const INCIDENT_TYPE_OPTIONS: readonly {
  value: CitizenIncidentType;
  label: string;
}[] = [
  { value: 'FLOOD', label: 'Flood' },
  { value: 'FIRE', label: 'Fire' },
  { value: 'LANDSLIDE', label: 'Landslide' },
  { value: 'EARTHQUAKE', label: 'Earthquake' },
  { value: 'ROAD_BLOCKAGE', label: 'Road Blockage' },
  { value: 'FALLEN_TREE', label: 'Fallen Tree' },
  { value: 'STRUCTURAL_DAMAGE', label: 'Structural Damage' },
  { value: 'MEDICAL_EMERGENCY', label: 'Medical Emergency' },
  { value: 'UTILITY_HAZARD', label: 'Utility Hazard' },
  { value: 'OTHER', label: 'Other' },
];

export function getIncidentTypeLabel(value: CitizenIncidentType | ''): string {
  return INCIDENT_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? '';
}

export function filterIncidentBarangays(
  barangays: readonly CitizenIncidentBarangay[],
  query: string,
): CitizenIncidentBarangay[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [...barangays];

  const isFullNameQuery = normalizedQuery.startsWith('barangay');
  const numberQuery = normalizedQuery.replace(/^barangay\s*/, '');
  return barangays.filter((barangay) => {
    const normalizedName = barangay.name.toLowerCase();
    const number = normalizedName.replace(/^barangay\s*/, '');
    return (
      normalizedName.includes(normalizedQuery) ||
      (!isFullNameQuery && number.includes(numberQuery))
    );
  });
}
