const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTypeScriptModule(relativePath, dependencies = {}) {
  const source = fs.readFileSync(path.resolve(relativePath), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: relativePath,
  }).outputText;
  const loadedModule = { exports: {} };
  const localRequire = (specifier) => {
    if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
    throw new Error(`Unexpected test dependency: ${specifier}`);
  };
  new Function('require', 'module', 'exports', compiled)(localRequire, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

const apiBase = 'https://drrm-staging.civentral.tech/api/citizen';
const service = loadTypeScriptModule('src/services/drrmFloodReference.ts', {
  '@/src/config/api': { DRRM_CITIZEN_API_BASE_URL: apiBase },
});
const selection = loadTypeScriptModule('src/features/emergency/drrmMapSelection.ts');
const floodState = loadTypeScriptModule('src/features/emergency/drrmFloodCheckState.ts');
const geometry = loadTypeScriptModule('src/features/emergency/drrmMapGeometry.ts');

const selectedLocation = { latitude: 14.763294, longitude: 121.042348 };

function mappedResponse(classification = 'HIGH', overlapCount = 1) {
  return {
    success: true,
    status: 'DEVELOPMENT_REFERENCE',
    intersection: true,
    source_status: 'DEVELOPMENT_PREVIEW',
    reference_source: 'DENR-MGB',
    location: selectedLocation,
    classification,
    risk_rank: 3,
    overlap_count: overlapCount,
    multiple_reference_polygons: overlapCount > 1,
  };
}

function noIntersectionResponse() {
  return {
    success: true,
    status: 'NO_MAPPED_REFERENCE_INTERSECTION',
    intersection: false,
    source_status: 'DEVELOPMENT_PREVIEW',
    reference_source: 'DENR-MGB',
    location: { latitude: 14.767059, longitude: 121.099154 },
    warning: 'This does not mean the location is flood-safe. The current reference dataset is incomplete/draft and does not replace official advisories.',
  };
}

async function testService() {
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, text: async () => JSON.stringify(mappedResponse('LOW')) };
  };

  const result = await service.checkFloodReference(selectedLocation.latitude, selectedLocation.longitude);
  assert.equal(request.url, `${apiBase}/drrm/flood-reference-check.php`);
  assert.equal(request.options.method, 'POST');
  assert.deepEqual(JSON.parse(request.options.body), selectedLocation);
  assert.deepEqual(Object.keys(JSON.parse(request.options.body)).sort(), ['latitude', 'longitude']);
  assert.equal(result.status, 'DEVELOPMENT_REFERENCE');
  assert.equal(result.classification, 'LOW');

  for (const classification of ['LOW', 'MODERATE', 'HIGH', 'VERY HIGH']) {
    const parsed = service.parseFloodReferenceResponse(mappedResponse(classification));
    assert.equal(parsed.intersection, true);
    assert.equal(parsed.classification, classification);
  }

  const overlap = service.parseFloodReferenceResponse(mappedResponse('VERY HIGH', 2));
  assert.equal(overlap.overlap_count, 2);
  assert.equal(overlap.multiple_reference_polygons, true);

  const noIntersection = service.parseFloodReferenceResponse(noIntersectionResponse());
  assert.equal(noIntersection.status, 'NO_MAPPED_REFERENCE_INTERSECTION');
  assert.equal(noIntersection.intersection, false);
  assert.equal(noIntersection.classification, undefined);
  assert.match(noIntersection.warning, /does not mean the location is flood-safe/i);

  for (const [status, code] of [[400, 'INVALID_REQUEST'], [404, 'NOT_FOUND'], [422, 'INVALID_LOCATION'], [502, 'UNAVAILABLE']]) {
    global.fetch = async () => ({ ok: false, status, text: async () => '{}' });
    await assert.rejects(
      () => service.checkFloodReference(selectedLocation.latitude, selectedLocation.longitude),
      (error) => error.code === code,
    );
  }

  global.fetch = async () => { throw new TypeError('network unavailable'); };
  await assert.rejects(
    () => service.checkFloodReference(selectedLocation.latitude, selectedLocation.longitude),
    (error) => error.code === 'NETWORK_ERROR',
  );
}

function testIndependentState() {
  const modes = selection.MAP_LOCATION_SELECTION_MODE;
  const original = { routeOrigin: [121.01, 14.71], floodCheckLocation: [121.02, 14.72] };
  const nextRoute = selection.selectPreparednessLocation(original, modes.ROUTE_ORIGIN_SELECTION, [121.03, 14.73]);
  assert.deepEqual(nextRoute.routeOrigin, [121.03, 14.73]);
  assert.deepEqual(nextRoute.floodCheckLocation, original.floodCheckLocation);

  const nextFlood = selection.selectPreparednessLocation(original, modes.FLOOD_CHECK_LOCATION_SELECTION, [121.04, 14.74]);
  assert.deepEqual(nextFlood.routeOrigin, original.routeOrigin);
  assert.deepEqual(nextFlood.floodCheckLocation, [121.04, 14.74]);
  assert.equal(selection.selectPreparednessLocation(original, modes.NONE, [0, 0]), original);

  let state = floodState.floodCheckReducer(floodState.INITIAL_FLOOD_CHECK_STATE, {
    type: 'LOCATION_SELECTED', location: [121.042348, 14.763294],
  });
  state = floodState.floodCheckReducer(state, { type: 'CHECK_SUCCEEDED', result: mappedResponse('HIGH') });
  state = floodState.floodCheckReducer(state, { type: 'BEGIN_LOCATION_SELECTION' });
  assert.deepEqual(state.location, [121.042348, 14.763294]);
  assert.equal(state.result, null);
  state = floodState.floodCheckReducer(state, { type: 'CLEAR' });
  assert.deepEqual(state, floodState.INITIAL_FLOOD_CHECK_STATE);
}

function assertClose(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} should be close to ${expected}`);
}

function testMapProjection() {
  const bounds = { minLongitude: 120, maxLongitude: 122, minLatitude: 14, maxLatitude: 16 };
  const position = [120.5, 15.5];
  const viewportWidth = 500;
  const viewportHeight = 360;
  const zoom = 1.5;
  const translationX = 30;
  const translationY = -20;
  const [svgX, svgY] = geometry.projectPosition(position, bounds);
  const svgScale = Math.min(viewportWidth / geometry.DRRM_MAP_WIDTH, viewportHeight / geometry.DRRM_MAP_HEIGHT);
  const svgOffsetX = (viewportWidth - geometry.DRRM_MAP_WIDTH * svgScale) / 2;
  const svgOffsetY = (viewportHeight - geometry.DRRM_MAP_HEIGHT * svgScale) / 2;
  const localX = svgOffsetX + svgX * svgScale;
  const localY = svgOffsetY + svgY * svgScale;
  const screenX = viewportWidth / 2 + (localX - viewportWidth / 2) * zoom + translationX;
  const screenY = viewportHeight / 2 + (localY - viewportHeight / 2) * zoom + translationY;
  const recovered = geometry.screenToPosition(
    screenX, screenY, viewportWidth, viewportHeight, zoom, translationX, translationY, bounds,
  );
  assert.ok(recovered);
  assertClose(recovered[0], position[0]);
  assertClose(recovered[1], position[1]);

  const boundary = {
    data: { features: [{ geometry: { coordinates: [[[
      [120, 14], [122, 14], [122, 16], [120, 16], [120, 14],
    ]]] } }] },
  };
  assert.equal(geometry.positionInsideBoundary([121, 15], boundary), true);
  assert.equal(geometry.positionInsideBoundary([123, 15], boundary), false);
}

function testSourceContracts() {
  const screen = fs.readFileSync(path.resolve('src/features/emergency/HazardMapScreen.tsx'), 'utf8');
  const map = fs.readFileSync(path.resolve('src/features/emergency/components/GeoJsonHazardMap.tsx'), 'utf8');
  const panel = fs.readFileSync(path.resolve('src/features/emergency/components/FloodRiskCheckPanel.tsx'), 'utf8');
  const floodService = fs.readFileSync(path.resolve('src/services/drrmFloodReference.ts'), 'utf8');
  const routeService = fs.readFileSync(path.resolve('src/services/drrmEvacuationRoute.ts'), 'utf8');

  assert.match(screen, /testID=.flood-risk-check-tab./);
  assert.match(screen, /switchPreparednessTool\('FLOOD_RISK_CHECK'\)/);
  assert.match(screen, /testID=.evacuation-route-tab./);
  assert.match(screen, /testID=.evacuation-route-preview./);
  assert.doesNotMatch(screen, /toolTabDisabled/);
  assert.match(screen, /MAP_LOCATION_SELECTION_MODE\.ROUTE_ORIGIN_SELECTION/);
  assert.match(screen, /MAP_LOCATION_SELECTION_MODE\.FLOOD_CHECK_LOCATION_SELECTION/);
  assert.match(screen, /beginFloodLocationSelection/);
  assert.match(screen, /Please select a location inside Caloocan City\./);

  const invalidTapHandler = screen.slice(screen.indexOf('const handleInvalidMapTap'), screen.indexOf('const cancelMapLocationSelection'));
  assert.doesNotMatch(invalidTapHandler, /setMapLocationSelectionMode/);
  const tabHandler = screen.slice(screen.indexOf('const switchPreparednessTool'), screen.indexOf('const beginRouteLocationSelection'));
  assert.doesNotMatch(tabHandler, /setRoute\(|dispatchFloodCheck/);
  const clearHandler = screen.slice(screen.indexOf('const clearFloodCheck'), screen.indexOf('const previewRoute'));
  assert.doesNotMatch(clearHandler, /setStartingLocation|setSelectedCenter|setRoute\(/);

  assert.match(map, /projection\(startingLocation\)/);
  assert.match(map, /projection\(floodCheckLocation\)/);
  assert.match(map, /testID=.flood-check-location-marker./);
  assert.match(map, /stroke=.#7C3AED./);
  assert.match(map, /Gesture\.Tap\(\)/);
  assert.match(map, /Gesture\.Pinch\(\)/);
  assert.match(map, /Gesture\.Pan\(\)/);
  assert.match(map, /Gesture\.Exclusive\(tapGesture, panGesture\)/);
  assert.match(map, /\.maxDistance\(12\)/);
  assert.match(map, /Reset map view/);
  assert.match(map, /evacuationCenters\?\.data\.features\.map/);

  assert.match(panel, /Flood Risk Location/);
  assert.match(panel, /No location selected/);
  assert.match(panel, /Location selected/);
  assert.match(panel, /Check Flood Reference/);
  assert.match(panel, /NO MAPPED REFERENCE INTERSECTION/);
  assert.match(panel, /result\.warning/);
  assert.match(panel, /Multiple mapped reference polygons overlap this location/);
  assert.match(panel, /AI Flood Prediction/);
  assert.match(panel, /Not available/);
  assert.match(panel, /governed model and validated forecast inputs/);
  assert.doesNotMatch(panel, /NO FLOOD RISK|FLOOD-FREE/);

  assert.match(floodService, /DRRM_CITIZEN_API_BASE_URL/);
  assert.match(floodService, /JSON\.stringify\(\{ latitude, longitude \}\)/);
  assert.doesNotMatch(floodService, /flood-risk-ai|\/ready|probability|confidence|rainfall|forecast_window/i);
  assert.match(routeService, /evacuation-route-preview\.php/);

  for (const message of [
    'Unable to check this location. Please try again.',
    'Flood reference checking is currently unavailable.',
    'Please select a valid location inside Caloocan City.',
    'Flood reference service is temporarily unavailable.',
    'Unable to connect to the flood reference service.',
  ]) assert.match(screen, new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

async function run() {
  await testService();
  testIndependentState();
  testMapProjection();
  testSourceContracts();
  console.log('DRRM flood reference integration checks passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
