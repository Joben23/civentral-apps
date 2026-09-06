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

const service = loadTypeScriptModule('src/services/drrmEvacuationRoute.ts', {
  '@/src/config/api': { DRRM_CITIZEN_API_BASE_URL: 'https://drrm-staging.civentral.tech/api/citizen' },
});

async function run() {
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        success: true,
        status: 'DEVELOPMENT_PLANNING_PREVIEW',
        route: { type: 'LineString', coordinates: [[121.02, 14.7], [121.03, 14.71]] },
        distance_meters: 850,
        duration_seconds: 300,
        destination: { reference_id: 'CENTER-1', latitude: 14.71, longitude: 121.03 },
        planning_disclaimer: 'Planning preview only.',
      }),
    };
  };

  const result = await service.previewEvacuationRoute(14.7, 121.02, 'CENTER-1');
  assert.equal(request.url, 'https://drrm-staging.civentral.tech/api/citizen/drrm/evacuation-route-preview.php');
  assert.equal(request.options.method, 'POST');
  assert.deepEqual(JSON.parse(request.options.body), {
    latitude: 14.7,
    longitude: 121.02,
    center_reference_id: 'CENTER-1',
  });
  assert.deepEqual(result.route.coordinates[0], [121.02, 14.7]);
  assert.equal(result.status, 'DEVELOPMENT_PLANNING_PREVIEW');

  global.fetch = async () => ({ ok: false, status: 422, text: async () => '{}' });
  await assert.rejects(() => service.previewEvacuationRoute(14.7, 121.02, 'CENTER-1'), (error) => error.code === 'NO_ROUTE');

  console.log('DRRM evacuation route preview checks passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});