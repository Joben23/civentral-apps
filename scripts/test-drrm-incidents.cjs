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
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: relativePath,
  }).outputText;
  const loadedModule = { exports: {} };
  const localRequire = (specifier) => {
    if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
    throw new Error(`Unexpected test dependency: ${specifier}`);
  };
  new Function('require', 'module', 'exports', compiled)(
    localRequire,
    loadedModule,
    loadedModule.exports,
  );
  return loadedModule.exports;
}

const types = loadTypeScriptModule('src/types/drrmIncidents.ts');
let uuidSequence = 0;
const cryptoStub = {
  randomUUID: () => {
    uuidSequence += 1;
    return `123e4567-e89b-42d3-a456-${String(uuidSequence).padStart(12, '0')}`;
  },
};
const service = loadTypeScriptModule('src/services/drrmIncidents.ts', {
  'expo-crypto': cryptoStub,
  '@/src/config/api': { CITIZEN_API_BASE_URL: 'https://example.gov.ph/api/citizen' },
  '@/src/types/drrmIncidents': types,
});
const presentation = loadTypeScriptModule('src/features/emergency/incidentPresentation.ts');
const hub = loadTypeScriptModule('src/features/emergency/drrmModules.ts');

const validForm = {
  incidentType: 'FLOOD',
  title: 'Floodwater rising near main road',
  description: 'Floodwater is rising and currently blocking one traffic lane.',
  barangayId: null,
  locationDescription: 'Near Monumento Circle, Caloocan City',
};

const barangayNames = Array.from({ length: 188 }, (_, index) => index + 1)
  .filter((number) => number !== 176)
  .map((number) => `Barangay ${number}`);
const barangayResponse = {
  success: true,
  count: 187,
  barangays: barangayNames.map((name, index) => ({
    barangay_id: `00000000-0000-4000-8000-${(index + 1).toString(16).padStart(12, '0')}`,
    name,
  })),
};
const selectedBarangayId = barangayResponse.barangays[122].barangay_id;

const successResponse = {
  success: true,
  incident_number: 'INC-2026-123456',
  status: 'SUBMITTED',
  submitted_at: '2026-08-25T10:30:00+08:00',
  message: 'Your incident report was submitted for DRRM review.',
};

async function run() {
  const expectedTypes = [
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
  ];
  const expectedLabels = [
    'Flood',
    'Fire',
    'Landslide',
    'Earthquake',
    'Road Blockage',
    'Fallen Tree',
    'Structural Damage',
    'Medical Emergency',
    'Utility Hazard',
    'Other',
  ];

  assert.deepEqual(types.CITIZEN_INCIDENT_TYPES, expectedTypes);
  assert.deepEqual(
    presentation.INCIDENT_TYPE_OPTIONS.map((option) => option.value),
    expectedTypes,
  );
  assert.deepEqual(
    presentation.INCIDENT_TYPE_OPTIONS.map((option) => option.label),
    expectedLabels,
  );

  const enabledModules = hub.DRRM_HUB_MODULES.filter((module) => module.enabled);
  assert.deepEqual(
    enabledModules.map((module) => module.id),
    ['hazard-map', 'incident-reporting', 'early-warning'],
  );
  assert.deepEqual(
    enabledModules.map((module) => module.route),
    ['/emergency/hazard-map', '/emergency/report-incident', '/emergency/warnings'],
  );
  assert.deepEqual(
    hub.DRRM_HUB_MODULES.filter((module) => !module.enabled).map((module) => module.id),
    ['relief-distribution', 'barangay-coordination'],
  );

  const requiredErrors = service.validateCitizenIncidentForm({
    incidentType: '',
    title: '',
    description: '',
    barangayId: null,
    locationDescription: '',
  });
  assert.deepEqual(Object.keys(requiredErrors).sort(), [
    'description',
    'incidentType',
    'locationDescription',
    'title',
  ]);
  assert.deepEqual(service.validateCitizenIncidentForm(validForm), {});
  assert.deepEqual(
    service.validateCitizenIncidentForm({ ...validForm, barangayId: selectedBarangayId }),
    {},
  );
  assert.match(
    service.validateCitizenIncidentForm({ ...validForm, title: 'Short' }).title,
    /at least 10/,
  );
  assert.match(
    service.validateCitizenIncidentForm({
      ...validForm,
      description: '<unsafe details that are long enough>',
    })
      .description,
    /unsupported characters/,
  );

  const firstRequestId = service.createCitizenIncidentRequestId();
  const secondRequestId = service.createCitizenIncidentRequestId();
  assert.match(firstRequestId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(firstRequestId, secondRequestId);

  for (const incidentType of expectedTypes) {
    const payload = service.createCitizenIncidentPayload(
      { ...validForm, incidentType },
      '123e4567-e89b-42d3-a456-426614174000',
    );
    assert.equal(payload.incident_type, incidentType);
    assert.deepEqual(Object.keys(payload).sort(), [
      'description',
      'incident_type',
      'location_description',
      'request_id',
      'title',
    ]);
    assert.doesNotMatch(
      JSON.stringify(payload),
      /status|severity|verification_status|source|assignment|response_log|warning|risk_level|probability|citizen_user_id|reporter/i,
    );
  }
  const payloadWithBarangay = service.createCitizenIncidentPayload(
    { ...validForm, barangayId: selectedBarangayId },
    '123e4567-e89b-42d3-a456-426614174000',
  );
  assert.equal(payloadWithBarangay.barangay_id, selectedBarangayId);
  assert.deepEqual(Object.keys(payloadWithBarangay).sort(), [
    'barangay_id',
    'description',
    'incident_type',
    'location_description',
    'request_id',
    'title',
  ]);
  assert.throws(
    () => service.createCitizenIncidentPayload(validForm, 'predictable-counter-1'),
    (error) => error.code === 'INVALID_REQUEST',
  );

  const parsedBarangays = service.parseCitizenIncidentBarangays(barangayResponse);
  assert.equal(parsedBarangays.count, 187);
  assert.equal(parsedBarangays.barangays[0].name, 'Barangay 1');
  assert.equal(parsedBarangays.barangays.at(-1).name, 'Barangay 188');
  assert.equal(parsedBarangays.barangays.some((barangay) => barangay.name === 'Barangay 176'), false);
  assert.equal(parsedBarangays.barangays.some((barangay) => /176-[A-F]/.test(barangay.name)), false);
  assert.deepEqual(
    presentation.filterIncidentBarangays(parsedBarangays.barangays, '123').map((item) => item.name),
    ['Barangay 123'],
  );
  assert.deepEqual(
    presentation.filterIncidentBarangays(parsedBarangays.barangays, 'barangay 25').map((item) => item.name),
    ['Barangay 25'],
  );
  assert.throws(
    () =>
      service.parseCitizenIncidentBarangays({
        ...barangayResponse,
        barangays: barangayResponse.barangays.map((barangay, index) =>
          index === 175 ? { ...barangay, name: 'Barangay 176' } : barangay,
        ),
      }),
    (error) => error.name === 'DrrmCitizenBarangayError',
  );

  const parsedSuccess = service.parseCitizenIncidentResponse(successResponse, 201);
  assert.equal(parsedSuccess.incident_number, 'INC-2026-123456');
  assert.equal(parsedSuccess.status, 'SUBMITTED');
  assert.throws(
    () => service.parseCitizenIncidentResponse(successResponse, 500),
    (error) => error.code === 'INCIDENT_SUBMISSION_FAILED',
  );

  const errorCases = [
    ['AUTHENTICATION_REQUIRED', 401],
    ['INVALID_INCIDENT_TYPE', 400],
    ['INVALID_BARANGAY', 400],
    ['INVALID_LOCATION', 400],
    ['INVALID_COORDINATES', 400],
    ['INVALID_REQUEST', 400],
    ['RATE_LIMITED', 429],
    ['DUPLICATE_SUBMISSION', 409],
    ['INCIDENT_SERVICE_UNAVAILABLE', 503],
    ['INCIDENT_SUBMISSION_FAILED', 500],
  ];
  for (const [code, status] of errorCases) {
    assert.throws(
      () =>
        service.parseCitizenIncidentResponse(
          { success: false, error: { code, message: 'raw backend or Supabase detail' } },
          status,
        ),
      (error) => error.code === code && !error.message.includes('raw backend'),
    );
  }

  let capturedRequest;
  global.fetch = async (url, options) => {
    capturedRequest = { url, options };
    return { status: 200, text: async () => JSON.stringify(barangayResponse) };
  };
  const loadedBarangays = await service.getCitizenIncidentBarangays();
  assert.equal(loadedBarangays.length, 187);
  assert.equal(capturedRequest.url, 'https://example.gov.ph/api/citizen/drrm/barangays.php');
  assert.equal(capturedRequest.options.method, 'GET');
  assert.equal(capturedRequest.options.credentials, undefined);

  global.fetch = async (url, options) => {
    capturedRequest = { url, options };
    return { status: 201, text: async () => JSON.stringify(successResponse) };
  };
  const submitted = await service.submitCitizenIncident(validForm);
  assert.equal(submitted.status, 'SUBMITTED');
  assert.equal(capturedRequest.url, 'https://example.gov.ph/api/citizen/drrm/incidents.php');
  assert.equal(capturedRequest.options.method, 'POST');
  assert.equal(capturedRequest.options.credentials, 'include');
  assert.equal(capturedRequest.options.headers.Authorization, undefined);
  assert.equal(capturedRequest.options.headers['Content-Type'], 'application/json');
  const submittedBody = JSON.parse(capturedRequest.options.body);
  assert.deepEqual(Object.keys(submittedBody).sort(), [
    'description',
    'incident_type',
    'location_description',
    'request_id',
    'title',
  ]);
  assert.match(
    submittedBody.request_id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );

  global.fetch = async () => ({
    status: 401,
    text: async () =>
      JSON.stringify({
        success: false,
        error: { code: 'AUTHENTICATION_REQUIRED', message: 'raw session detail' },
      }),
  });
  await assert.rejects(
    () => service.submitCitizenIncident(validForm),
    (error) =>
      error.code === 'AUTHENTICATION_REQUIRED' && !error.message.includes('raw session detail'),
  );

  global.fetch = async () => {
    throw new Error('raw network detail');
  };
  await assert.rejects(
    () => service.submitCitizenIncident(validForm),
    (error) =>
      error.code === 'INCIDENT_SERVICE_UNAVAILABLE' && !error.message.includes('raw network'),
  );

  const screenSource = fs.readFileSync(
    path.resolve('src/features/emergency/IncidentReportScreen.tsx'),
    'utf8',
  );
  const serviceSource = fs.readFileSync(path.resolve('src/services/drrmIncidents.ts'), 'utf8');
  const authSource = fs.readFileSync(path.resolve('src/services/auth-service.ts'), 'utf8');
  const routeSource = fs.readFileSync(path.resolve('app/emergency/report-incident.tsx'), 'utf8');
  const hazardRoute = fs.readFileSync(path.resolve('app/emergency/hazard-map.tsx'), 'utf8');
  const warningRoute = fs.readFileSync(path.resolve('app/emergency/warnings.tsx'), 'utf8');

  assert.match(routeSource, /IncidentReportScreen/);
  assert.match(hazardRoute, /HazardMapScreen/);
  assert.match(warningRoute, /ActiveWarningsScreen/);
  assert.match(authSource, /login\.php[\s\S]*credentials:\s*'include'/);
  assert.match(serviceSource, /credentials:\s*'include'/);
  assert.match(serviceSource, /Crypto\.randomUUID\(\)/);
  assert.doesNotMatch(serviceSource, /supabase|\.rpc\(/i);

  assert.match(screenSource, /validateCitizenIncidentForm\(values\)/);
  assert.match(screenSource, /submittingRef\.current/);
  assert.match(screenSource, /disabled=\{isSubmitting\}/);
  assert.match(screenSource, /ActivityIndicator/);
  assert.match(screenSource, /Report Submitted/);
  assert.match(screenSource, /incident-number/);
  assert.match(screenSource, /incident-status/);
  assert.match(screenSource, /pending review/);
  assert.match(screenSource, /It has not yet been[\s\S]*verified/);
  assert.match(screenSource, /AUTHENTICATION_REQUIRED/);
  assert.match(screenSource, /Sign In Again/);
  assert.match(screenSource, /router\.replace\('\/\(auth\)\/login'/);
  assert.match(screenSource, /Incident Details/);
  assert.match(screenSource, /Location \/ Landmark \*/);
  assert.match(screenSource, /What Happened\?/);
  assert.match(screenSource, /barangay-selector-modal/);
  assert.match(screenSource, /barangay-search-input/);
  assert.match(screenSource, /barangay-clear-button/);
  assert.match(screenSource, /barangay-error-state/);
  assert.doesNotMatch(screenSource, /\{selectedBarangay\?\.barangay_id\}/);
  assert.doesNotMatch(screenSource, /citizen_user_id|reporter_reference|reporterReference/);

  console.log('DRRM citizen incident reporting checks passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
