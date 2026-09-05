const DEFAULT_API_BASE_URL = 'https://civentral.tech';
const CITIZEN_API_PATH = '/api/citizen';

function removeTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

const configuredApiBaseUrl = removeTrailingSlashes(
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL,
);

const configuredDrrmApiBaseUrl = removeTrailingSlashes(
  process.env.EXPO_PUBLIC_DRRM_API_BASE_URL?.trim() ||
    (configuredApiBaseUrl.includes('/api/') ? DEFAULT_API_BASE_URL : configuredApiBaseUrl),
);

const safeDrrmApiBaseUrl = configuredDrrmApiBaseUrl.endsWith(CITIZEN_API_PATH)
  || !configuredDrrmApiBaseUrl.includes('/api/')
  ? configuredDrrmApiBaseUrl
  : DEFAULT_API_BASE_URL;

/**
 * Public backend origin/base path configured for the Expo bundle.
 *
 * Both a backend root (for example, https://example.gov.ph/civentral-drrm)
 * and the legacy /api/citizen-suffixed value are supported.
 */
export const API_BASE_URL = configuredApiBaseUrl;

export const CITIZEN_API_BASE_URL = configuredApiBaseUrl.endsWith(CITIZEN_API_PATH)
  ? configuredApiBaseUrl
  : `${configuredApiBaseUrl}${CITIZEN_API_PATH}`;

/** Public citizen base used only by Module 1 DRRM services. */
export const DRRM_CITIZEN_API_BASE_URL = configuredDrrmApiBaseUrl.endsWith(CITIZEN_API_PATH)
  ? safeDrrmApiBaseUrl
  : `${safeDrrmApiBaseUrl}${CITIZEN_API_PATH}`;

