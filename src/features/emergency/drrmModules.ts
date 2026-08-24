import type { IconSymbolName } from '@/components/ui/icon-symbol';

export type DrrmModuleId =
  | 'hazard-map'
  | 'relief-distribution'
  | 'incident-reporting'
  | 'early-warning'
  | 'barangay-coordination';

export interface DrrmHubModule {
  id: DrrmModuleId;
  title: string;
  description: string;
  icon: IconSymbolName;
  iconBackground: string;
  iconColor: string;
  enabled: boolean;
  route?: '/emergency/hazard-map' | '/emergency/warnings';
}

export const DRRM_HUB_MODULES: readonly DrrmHubModule[] = [
  {
    id: 'hazard-map',
    title: 'Hazard & Evacuation Map System',
    description: 'View hazard areas, evacuation centers, and evacuation information.',
    icon: 'location.fill',
    iconBackground: '#E0F2FE',
    iconColor: '#0284C7',
    enabled: true,
    route: '/emergency/hazard-map',
  },
  {
    id: 'relief-distribution',
    title: 'Relief Goods Distribution Tracker',
    description: 'View relief distribution and assistance information.',
    icon: 'heart.text.square.fill',
    iconBackground: '#DCFCE7',
    iconColor: '#15803D',
    enabled: false,
  },
  {
    id: 'incident-reporting',
    title: 'Incident Reporting & Response Log',
    description: 'Report disaster-related incidents and monitor response updates.',
    icon: 'doc.text.fill',
    iconBackground: '#FEF3C7',
    iconColor: '#B45309',
    enabled: false,
  },
  {
    id: 'early-warning',
    title: 'Disaster Early Warning System',
    description: 'View active CIVENTRAL emergency warnings for Caloocan City.',
    icon: 'exclamationmark.triangle.fill',
    iconBackground: '#FEE2E2',
    iconColor: '#B91C1C',
    enabled: true,
    route: '/emergency/warnings',
  },
  {
    id: 'barangay-coordination',
    title: 'Barangay DRRM Coordination Tool',
    description: 'View barangay DRRM contacts, updates, and coordination information.',
    icon: 'person.2.fill',
    iconBackground: '#EDE9FE',
    iconColor: '#6D28D9',
    enabled: false,
  },
];
