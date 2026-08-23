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
  assert.equal(enabledModules.length, 1);
  assert.equal(enabledModules[0].id, 'early-warning');
  assert.equal(enabledModules[0].route, '/emergency/warnings');
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

  assert.match(sosFallbackRoute, /Redirect href="\/emergency"/);
  assert.match(customTabBar, /router\.push\('\/emergency'/);
  assert.match(homeScreen, /router\.push\('\/emergency\/warnings'/);
  assert.match(hubRoute, /DrrmHubScreen/);
  assert.match(warningRoute, /ActiveWarningsScreen/);
  assert.match(warningDetailsRoute, /WarningDetailsScreen/);

  const originalApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'https://example.gov.ph/civentral-drrm/';
  const rootConfig = loadTypeScriptModule('src/config/api.ts');
  assert.equal(rootConfig.CITIZEN_API_BASE_URL, 'https://example.gov.ph/civentral-drrm/api/citizen');

  process.env.EXPO_PUBLIC_API_BASE_URL = 'https://example.gov.ph/civentral-drrm/api/citizen/';
  const legacyConfig = loadTypeScriptModule('src/config/api.ts');
  assert.equal(legacyConfig.CITIZEN_API_BASE_URL, 'https://example.gov.ph/civentral-drrm/api/citizen');

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

  console.log('DRRM hub and warning checks passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
