const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTypeScriptModule(relativePath, dependencies = {}) {
  const source = fs.readFileSync(path.resolve(relativePath), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: relativePath,
  }).outputText;
  const loadedModule = { exports: {} };
  const localRequire = (specifier) => {
    if (Object.hasOwn(dependencies, specifier)) {
      return dependencies[specifier];
    }
    throw new Error(`Unexpected test dependency: ${specifier}`);
  };
  new Function('require', 'module', 'exports', compiled)(
    localRequire,
    loadedModule,
    loadedModule.exports,
  );
  return loadedModule.exports;
}

const service = loadTypeScriptModule('src/services/drrmWarnings.ts', {
  '@/src/config/api': { CITIZEN_API_BASE_URL: 'https://example.gov.ph/api/citizen' },
});
const hazardService = loadTypeScriptModule('src/services/drrmHazardMap.ts', {
  '@/src/config/api': { DRRM_CITIZEN_API_BASE_URL: 'https://drrm-staging.civentral.tech/api/citizen' },
});
const presentation = loadTypeScriptModule('src/features/emergency/warningPresentation.ts');
const hub = loadTypeScriptModule('src/features/emergency/drrmModules.ts');

const warning = (code, id = code) => ({
  id,
  title: `${code} rainfall warning`,
  hazard_type: 'HEAVY_RAINFALL',
  hazard_label: 'Heavy Rainfall',
  warning_level: {
    code,
    label: code[0] + code.slice(1).toLowerCase(),
    scale: 'CIVENTRAL Warning Level',
  },
  summary: 'Take appropriate safety precautions.',
  issued_at: '2026-08-23T08:00:00+08:00',
  valid_until: '2026-08-23T18:00:00+08:00',
  source: { code: 'CIVENTRAL', name: 'CIVENTRAL DRRM' },
  source_reference: null,
  scope: 'BARANGAY',
  affected_areas: [
    { scope: 'BARANGAY', name: 'Barangay 171' },
    { scope: 'BARANGAY', name: 'Barangay 172' },
  ],
  last_updated: '2026-08-23T09:00:00+08:00',
});

const response = (warnings) => ({
  success: true,
  city: 'Caloocan City',
  warning_level_scale: 'CIVENTRAL Warning Level',
  data_as_of: '2026-08-23T09:00:00+08:00',
  active_warning_count: warnings.length,
  warnings,
});

const positionRing = [
  [120.98, 14.64],
  [121.08, 14.64],
  [121.08, 14.82],
  [120.98, 14.82],
  [120.98, 14.64],
];
const polygon = () => ({ type: 'Polygon', coordinates: [positionRing] });
const multiPolygon = () => ({ type: 'MultiPolygon', coordinates: [[positionRing]] });
const featureCollection = (features) => ({ type: 'FeatureCollection', features });
const feature = (properties, geometry = polygon()) => ({ type: 'Feature', properties, geometry });
const hazardResponse = (layer, data, source = { agency: 'CIVENTRAL DRRM', name: 'Prepared GIS' }) => ({
  success: true,
  city: 'Caloocan City',
  layer,
  data_as_of: '2026-08-19T00:00:00Z',
  source,
  development_status: {
    code: 'DEVELOPMENT_PREVIEW',
    label: 'Development preview',
    disclaimer: 'Prepared GIS information pending source and LGU verification.',
  },
  data,
});

const boundaryResponse = () => hazardResponse('boundary', featureCollection([
  feature({
    name: 'Caloocan City',
    city_code: 'PH1307501',
    component_count: 2,
    components: ['North Caloocan', 'South Caloocan'],
  }, multiPolygon()),
]));

const barangayResponse = () => {
  const numbers = Array.from({ length: 188 }, (_, index) => index + 1).filter((number) => number !== 176);
  return hazardResponse('barangays', featureCollection(numbers.map((number) => feature({
    name: `Barangay ${number}`,
    psgc_code: String(1380100000 + number),
    boundary_status: 'Validated development boundary',
  }))));
};

const susceptibilityResponse = (layer, count, hazard) => hazardResponse(
  layer,
  featureCollection(Array.from({ length: count }, (_, index) => {
    const levels = ['Low', 'Moderate', 'High', 'Very High'];
    const susceptibility = levels[index % levels.length];
    return feature({
      hazard,
      susceptibility,
      source_classification: `${susceptibility} Susceptibility`,
    });
  })),
  { agency: 'DENR-MGB', name: `${hazard} susceptibility`, classification_scale: ['Low', 'Moderate', 'High', 'Very High'] },
);

const faultResponse = () => hazardResponse('fault', {
  context: {
    active_fault_intersects_caloocan: false,
    nearest_known_active_fault: 'West Valley Fault',
    minimum_distance_km: 3.76,
    advisory: 'Distance does not mean absence of earthquake risk.',
  },
  geometry: featureCollection([feature({
    name: 'West Valley Fault',
    fault_system: 'Valley Fault System',
    feature_class: 'Active Fault',
    trace_type: 'Approximate',
    intersects_caloocan: false,
  }, { type: 'LineString', coordinates: positionRing.slice(0, 2) })]),
}, { agency: 'DOST-PHIVOLCS', name: 'Active Faults and Trenches' });

const centersResponse = (items = Array.from({ length: 15 }, (_, index) => ({
  reference_id: `EC-${String(index + 1).padStart(3, '0')}`,
  name: `Evacuation Center ${index + 1}`,
  barangay_name: `Barangay ${index + 1}`,
  latitude: 14.7 + index / 1000,
  longitude: 121.02 + index / 1000,
  source_status: 'DEVELOPMENT_PREVIEW',
  verification_status: 'UNVERIFIED_REFERENCE',
}))) => ({
  success: true,
  city: 'Caloocan City',
  layer: 'evacuation-centers',
  source_status: 'DEVELOPMENT_PREVIEW',
  verification_status: 'UNVERIFIED_REFERENCE',
  count: items.length,
  items,
});

const emptyCentersResponse = () => centersResponse([]);

const operationalCentersResponse = () => centersResponse([{
  reference_id: 'EC-PUBLISHED-001',
  name: 'Published Evacuation Center',
  barangay_name: 'Barangay 12',
  latitude: 14.71,
  longitude: 121.01,
  source_status: 'PUBLISHED',
  verification_status: 'VERIFIED',
}]);

async function run() {
  const expectedModuleTitles = [
    'Hazard & Evacuation Map System',
    'Relief Goods Distribution Tracker',
    'Incident Reporting & Response Log',
    'Disaster Early Warning System',
    'Barangay DRRM Coordination Tool',
  ];
  assert.equal(hub.DRRM_HUB_MODULES.length, 5);
  assert.deepEqual(hub.DRRM_HUB_MODULES.map((module) => module.title), expectedModuleTitles);

  const enabledModules = hub.DRRM_HUB_MODULES.filter((module) => module.enabled);
  assert.equal(enabledModules.length, 3);
  assert.deepEqual(
    enabledModules.map((module) => module.id),
    ['hazard-map', 'incident-reporting', 'early-warning'],
  );
  assert.deepEqual(
    enabledModules.map((module) => module.route),
    ['/emergency/hazard-map', '/emergency/report-incident', '/emergency/warnings'],
  );
  assert.ok(
    hub.DRRM_HUB_MODULES.filter((module) => !module.enabled).every((module) => module.route === undefined),
  );
  assert.doesNotMatch(
    JSON.stringify(hub.DRRM_HUB_MODULES),
    /manage|approve|dispatch control|create warning|update database/i,
  );

  const sosFallbackRoute = fs.readFileSync(path.resolve('app/(tabs)/sos.tsx'), 'utf8');
  const customTabBar = fs.readFileSync(
    path.resolve('src/components/navigation/CustomTabBar.tsx'),
    'utf8',
  );
  const homeScreen = fs.readFileSync(path.resolve('src/features/dashboard/HomeScreen.tsx'), 'utf8');
  const hubRoute = fs.readFileSync(path.resolve('app/emergency/index.tsx'), 'utf8');
  const warningRoute = fs.readFileSync(path.resolve('app/emergency/warnings.tsx'), 'utf8');
  const warningDetailsRoute = fs.readFileSync(path.resolve('app/emergency/[warningId].tsx'), 'utf8');
  const hazardMapRoute = fs.readFileSync(path.resolve('app/emergency/hazard-map.tsx'), 'utf8');
  const hazardMapScreen = fs.readFileSync(path.resolve('src/features/emergency/HazardMapScreen.tsx'), 'utf8');
  const hazardMapRenderer = fs.readFileSync(
    path.resolve('src/features/emergency/components/GeoJsonHazardMap.tsx'),
    'utf8',
  );

  assert.match(sosFallbackRoute, /Redirect href="\/emergency"/);
  assert.match(customTabBar, /router\.push\('\/emergency'/);
  assert.match(homeScreen, /router\.push\('\/emergency\/warnings'/);
  assert.match(hubRoute, /DrrmHubScreen/);
  assert.match(warningRoute, /ActiveWarningsScreen/);
  assert.match(warningDetailsRoute, /WarningDetailsScreen/);
  assert.match(hazardMapRoute, /HazardMapScreen/);
  assert.match(hazardMapScreen, /void loadLayer\('boundary'\)/);
  assert.match(hazardMapScreen, /void loadLayer\('evacuation-centers'\)/);
  assert.doesNotMatch(hazardMapScreen, /void loadLayer\('(barangays|flood|landslide|fault)'\)/);
  assert.match(hazardMapRenderer, /from 'react-native-svg'/);
  assert.doesNotMatch(hazardMapRenderer, /react-native-maps|leaflet/i);
  assert.doesNotMatch(hazardMapScreen, /route calculation|directions/i);
  assert.match(hazardMapRenderer, /GestureDetector/);
  assert.match(hazardMapRenderer, /Gesture\.Pinch\(\)/);
  assert.match(hazardMapRenderer, /Gesture\.Pan\(\)/);
  assert.match(hazardMapRenderer, /preserveAspectRatio="xMidYMid meet"/);
  assert.match(hazardMapRenderer, /MAX_ZOOM = 6/);
  assert.match(hazardMapRenderer, /Reset map view/);
  assert.match(hazardMapRenderer, /clampTranslation/);

  const originalApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'https://example.gov.ph/civentral-drrm/';
  const rootConfig = loadTypeScriptModule('src/config/api.ts');
  assert.equal(rootConfig.CITIZEN_API_BASE_URL, 'https://example.gov.ph/civentral-drrm/api/citizen');

  process.env.EXPO_PUBLIC_API_BASE_URL = 'https://example.gov.ph/civentral-drrm/api/citizen/';
  const legacyConfig = loadTypeScriptModule('src/config/api.ts');
  assert.equal(legacyConfig.CITIZEN_API_BASE_URL, 'https://example.gov.ph/civentral-drrm/api/citizen');

  process.env.EXPO_PUBLIC_DRRM_API_BASE_URL = 'https://drrm-staging.civentral.tech/';
  const drrmConfig = loadTypeScriptModule('src/config/api.ts');
  assert.equal(drrmConfig.DRRM_CITIZEN_API_BASE_URL, 'https://drrm-staging.civentral.tech/api/citizen');

  process.env.EXPO_PUBLIC_DRRM_API_BASE_URL = 'https://example.gov.ph/api/employee/';
  const unsafeDrrmConfig = loadTypeScriptModule('src/config/api.ts');
  assert.equal(unsafeDrrmConfig.DRRM_CITIZEN_API_BASE_URL, 'https://civentral.tech/api/citizen');

  process.env.EXPO_PUBLIC_API_BASE_URL = 'https://example.gov.ph/api/employee/';
  delete process.env.EXPO_PUBLIC_DRRM_API_BASE_URL;
  const safeFallbackConfig = loadTypeScriptModule('src/config/api.ts');
  assert.equal(safeFallbackConfig.DRRM_CITIZEN_API_BASE_URL, 'https://civentral.tech/api/citizen');

  if (originalApiBaseUrl === undefined) {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
  } else {
    process.env.EXPO_PUBLIC_API_BASE_URL = originalApiBaseUrl;
  }

  const empty = service.parseActiveWarningsResponse(response([]));
  assert.equal(empty.active_warning_count, 0);
  assert.deepEqual(empty.warnings, []);

  const levels = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'];
  const populated = service.parseActiveWarningsResponse(response(levels.map((level) => warning(level))));
  assert.deepEqual(populated.warnings.map((item) => item.warning_level.code), levels);
  assert.deepEqual(populated.warnings[0].affected_areas.map((area) => area.name), [
    'Barangay 171',
    'Barangay 172',
  ]);
  assert.deepEqual(levels.map(presentation.getWarningBadgeVariant), [
    'success',
    'warning',
    'danger',
    'danger',
  ]);
  assert.notEqual(presentation.formatWarningDateTime('2026-08-23 09:00:00'), 'Not specified');

  assert.throws(
    () => service.parseActiveWarningsResponse({ ...response([]), city: 'Another City' }),
    (error) => error.code === 'INVALID_RESPONSE',
  );
  assert.throws(
    () => service.parseActiveWarningsResponse({ ...response([]), active_warning_count: 1 }),
    (error) => error.code === 'INVALID_RESPONSE',
  );

  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, text: async () => JSON.stringify(response([warning('HIGH', 'WRN-1')])) };
  };
  const fetched = await service.getActiveWarnings();
  assert.equal(fetched.warnings[0].id, 'WRN-1');
  assert.equal(request.url, 'https://example.gov.ph/api/citizen/drrm/active-warnings.php');
  assert.equal(request.options.method, 'GET');
  assert.equal(request.options.headers.Authorization, undefined);

  global.fetch = async () => {
    throw new Error('raw server or network detail');
  };
  await assert.rejects(
    service.getActiveWarnings,
    (error) =>
      error.code === 'NETWORK_ERROR' &&
      error.message === 'Emergency warning information could not be loaded.' &&
      !error.message.includes('raw server'),
  );

  const boundary = hazardService.parseHazardMapResponse('boundary', boundaryResponse());
  assert.equal(boundary.city, 'Caloocan City');
  assert.equal(boundary.data.features[0].properties.component_count, 2);
  assert.equal(boundary.data.features[0].geometry.type, 'MultiPolygon');

  const barangays = hazardService.parseHazardMapResponse('barangays', barangayResponse());
  assert.equal(barangays.data.features.length, 187);
  assert.equal(barangays.data.features.some((item) => item.properties.name === 'Barangay 176'), false);
  assert.equal(barangays.data.features.some((item) => /^Barangay 176-[A-F]$/.test(item.properties.name)), false);

  const flood = hazardService.parseHazardMapResponse(
    'flood',
    susceptibilityResponse('flood', 15, 'Flood'),
  );
  const landslide = hazardService.parseHazardMapResponse(
    'landslide',
    susceptibilityResponse('landslide', 13, 'Rain-induced landslide'),
  );
  assert.deepEqual([...new Set(flood.data.features.map((item) => item.properties.susceptibility))], [
    'Low', 'Moderate', 'High', 'Very High',
  ]);
  assert.equal(landslide.data.features.length, 13);
  assert.equal(JSON.stringify(landslide).includes('debris'), false);

  const fault = hazardService.parseHazardMapResponse('fault', faultResponse());
  assert.equal(fault.data.context.active_fault_intersects_caloocan, false);
  assert.equal(fault.data.context.nearest_known_active_fault, 'West Valley Fault');
  assert.equal(fault.data.context.minimum_distance_km, 3.76);

  const centersPayload = centersResponse();
  const centers = hazardService.parseHazardMapResponse('evacuation-centers', centersPayload);
  assert.equal(centers.data.features.length, 15);
  assert.equal(centers.data.features[0].properties.source_status, 'DEVELOPMENT_PREVIEW');
  assert.equal(centers.data.features[0].properties.verification_status, 'UNVERIFIED_REFERENCE');
  assert.deepEqual(centers.data.features[0].geometry.coordinates, [121.02, 14.7]);

  const emptyCenters = hazardService.parseHazardMapResponse('evacuation-centers', emptyCentersResponse());
  assert.equal(emptyCenters.data.features.length, 0);

  const operationalCenters = hazardService.parseHazardMapResponse('evacuation-centers', operationalCentersResponse());
  assert.equal(operationalCenters.data.features[0].properties.source_status, 'PUBLISHED');
  assert.deepEqual(operationalCenters.data.features[0].geometry.coordinates, [121.01, 14.71]);

  assert.throws(
    () => hazardService.parseHazardMapResponse('boundary', { ...boundaryResponse(), city: 'Another City' }),
    (error) => error.code === 'INVALID_RESPONSE',
  );
  const invalidBarangays = barangayResponse();
  invalidBarangays.data.features[0].properties.name = 'Barangay 176-A';
  assert.throws(
    () => hazardService.parseHazardMapResponse('barangays', invalidBarangays),
    (error) => error.code === 'INVALID_RESPONSE',
  );

  hazardService.clearHazardMapLayerCache();
  const hazardRequests = [];
  global.fetch = async (url, options) => {
    hazardRequests.push({ url, options });
    const layer = new URL(url).searchParams.get('layer');
    const fixtures = {
      boundary: boundaryResponse(),
      flood: susceptibilityResponse('flood', 15, 'Flood'),
      'evacuation-centers': centersResponse(),
    };
    return { ok: true, text: async () => JSON.stringify(fixtures[layer]) };
  };
  await hazardService.getHazardMapLayer('boundary');
  await hazardService.getHazardMapLayer('boundary');
  await hazardService.getHazardMapLayer('flood');
  await hazardService.getHazardMapLayer('evacuation-centers');
  assert.equal(hazardRequests.length, 3);
  assert.equal(hazardRequests[0].url, 'https://drrm-staging.civentral.tech/api/citizen/drrm/hazard-map.php?layer=boundary');
  assert.equal(hazardRequests[1].url, 'https://drrm-staging.civentral.tech/api/citizen/drrm/hazard-map.php?layer=flood');
  assert.equal(hazardRequests[2].url, 'https://drrm-staging.civentral.tech/api/citizen/drrm/hazard-map.php?layer=evacuation-centers');
  assert.doesNotMatch(hazardRequests[2].url, /\/api\/employee|\/api\/api/);
  assert.equal(hazardRequests[0].options.method, 'GET');
  assert.equal(hazardRequests[0].options.headers.Authorization, undefined);

  hazardService.clearHazardMapLayerCache();
  global.fetch = async () => {
    throw new Error('raw PHP or network detail');
  };
  await assert.rejects(
    () => hazardService.getHazardMapLayer('flood'),
    (error) =>
      error.code === 'NETWORK_ERROR' &&
      error.message === 'Hazard and evacuation map information could not be loaded.' &&
      !error.message.includes('raw PHP'),
  );

  console.log('DRRM hub, warning, and hazard-map checks passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
