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

let warningResetCalls = 0;
const auth = loadTypeScriptModule('src/services/auth-service.ts', {
  '@/src/config/api': { CITIZEN_API_BASE_URL: 'https://example.gov.ph/api/citizen' },
  '@/src/services/drrmIncidentNotifications': {
    resetCitizenIncidentNotificationState() {},
  },
  '@/src/services/drrmWarningNotifications': {
    resetCitizenWarningNotificationState() { warningResetCalls += 1; },
  },
});
const routing = loadTypeScriptModule('src/features/auth/account-routing.ts');

function jsonResponse(status, payload) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(payload),
  };
}

async function run() {
  const existing = auth.parseAccountCheckResponse(
    { status: 'exists', exists: true, user_status: 'active' },
    200,
  );
  assert.equal(existing.status, 'exists');
  assert.equal(routing.getAccountAuthRoute(existing), '/(auth)/login');

  const notFound = auth.parseAccountCheckResponse(
    { status: 'not_found', exists: false, message: 'Account does not exist.' },
    200,
  );
  assert.equal(notFound.status, 'not_found');
  assert.equal(routing.getAccountAuthRoute(notFound), '/(auth)/register');

  for (const [payload, status] of [
    [{ status: 'error', message: 'service unavailable' }, 503],
    [{ status: 'not_found', exists: false }, 404],
    [{ status: 'success' }, 200],
    [{ exists: false }, 200],
    [{ status: 'not_found', exists: true }, 200],
  ]) {
    const result = auth.parseAccountCheckResponse(payload, status);
    assert.equal(result.status, 'error');
    assert.equal(routing.getAccountAuthRoute(result), null);
  }

  assert.equal(auth.normalizeAuthIdentifier('  Citizen.Name@Example.COM  '), 'citizen.name@example.com');
  assert.equal(auth.normalizeAuthIdentifier(' 0917 123 4567 '), '09171234567');

  global.fetch = async () => {
    throw new Error('network unavailable');
  };
  const networkFailure = await auth.AuthService.checkAccount('citizen.name@example.com');
  assert.equal(networkFailure.status, 'error');
  assert.equal(routing.getAccountAuthRoute(networkFailure), null);

  global.fetch = async () => ({ status: 200, ok: true, text: async () => '<html>not json</html>' });
  const malformed = await auth.AuthService.checkAccount('citizen.name@example.com');
  assert.equal(malformed.status, 'error');

  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return jsonResponse(200, { status: 'exists', exists: true });
  };
  const normalizedLookup = await auth.AuthService.checkAccount('  Citizen.Name@Example.COM ');
  assert.equal(normalizedLookup.status, 'exists');
  assert.equal(request.url, 'https://example.gov.ph/api/citizen/check-account.php');
  assert.equal(request.options.credentials, 'include');
  assert.deepEqual(JSON.parse(request.options.body), {
    email: 'citizen.name@example.com',
    identifier: 'citizen.name@example.com',
    mobile_number: 'citizen.name@example.com',
  });

  auth.AuthService.clearCurrentUser();
  global.fetch = async (url, options) => {
    request = { url, options };
    return jsonResponse(200, {
      status: 'success',
      user: { citizen_user_id: 42, email: 'existing@example.test' },
    });
  };
  const login = await auth.AuthService.login(' Existing@Example.Test ', 'password-value');
  assert.equal(login.status, 'success');
  assert.equal(request.url, 'https://example.gov.ph/api/citizen/login.php');
  assert.equal(request.options.credentials, 'include');
  assert.equal(JSON.parse(request.options.body).email, 'existing@example.test');
  assert.equal(auth.AuthService.getCurrentUser().citizen_user_id, 42);

  auth.AuthService.clearCurrentUser();
  let registrationRequestMade = false;
  global.fetch = async () => {
    registrationRequestMade = true;
    return jsonResponse(200, { status: 'otp_required' });
  };
  const unauthorizedRegistration = await auth.AuthService.register({
    email: 'new@example.test',
    firstName: 'New',
    hasNoMiddleName: true,
    lastName: 'Citizen',
    password: 'password-value',
  });
  assert.equal(unauthorizedRegistration.status, 'error');
  assert.equal(registrationRequestMade, false);

  global.fetch = async () =>
    jsonResponse(200, { status: 'not_found', exists: false, message: 'Account does not exist.' });
  const registrationCheck = await auth.AuthService.checkAccount('new@example.test');
  assert.equal(registrationCheck.status, 'not_found');
  assert.equal(auth.AuthService.isRegistrationAllowed('new@example.test'), true);

  global.fetch = async (url, options) => {
    request = { url, options };
    return jsonResponse(200, { status: 'otp_required', email: 'new@example.test' });
  };
  const registration = await auth.AuthService.register({
    email: ' New@Example.Test ',
    firstName: 'New',
    hasNoMiddleName: true,
    lastName: 'Citizen',
    password: 'password-value',
  });
  assert.equal(registration.status, 'otp_required');
  assert.equal(request.url, 'https://example.gov.ph/api/citizen/register.php');
  assert.equal(request.options.credentials, 'include');
  assert.equal(auth.AuthService.getCurrentUser().email, null);

  global.fetch = async (url, options) => {
    request = { url, options };
    return jsonResponse(200, {
      status: 'success',
      user: { citizen_user_id: 84, email: 'new@example.test' },
    });
  };
  const verification = await auth.AuthService.verifyOtp(' New@Example.Test ', '123456');
  assert.equal(verification.status, 'success');
  assert.equal(request.url, 'https://example.gov.ph/api/citizen/verify-otp.php');
  assert.equal(request.options.credentials, 'include');
  assert.equal(auth.AuthService.getCurrentUser().citizen_user_id, 84);

  global.fetch = async (url, options) => {
    request = { url, options };
    return jsonResponse(200, { status: 'success' });
  };
  await auth.AuthService.changePassword({
    currentPassword: 'current-password-value',
    newPassword: 'new-password-value',
  });
  const passwordPayload = JSON.parse(request.options.body);
  assert.equal(request.options.credentials, 'include');
  assert.deepEqual(Object.keys(passwordPayload).sort(), ['current_password', 'new_password']);

  const profile = loadTypeScriptModule('src/services/profile-service.ts', {
    './auth-service': { API_BASE_URL: 'https://example.gov.ph/api/citizen' },
  });
  global.fetch = async (url, options) => {
    request = { url, options };
    return jsonResponse(200, { status: 'success', data: { email: 'session@example.test' } });
  };
  await profile.ProfileService.getProfile();
  assert.equal(request.url, 'https://example.gov.ph/api/citizen/get-profile.php');
  assert.equal(request.options.credentials, 'include');
  assert.equal(request.url.includes('?'), false);

  global.fetch = async (url, options) => {
    request = { url, options };
    return jsonResponse(200, { status: 'success' });
  };
  await profile.ProfileService.updateProfile({
    email: 'updated@example.test',
    phone: '09171234567',
    address: 'Updated address',
  });
  assert.equal(request.options.credentials, 'include');
  assert.equal(Object.hasOwn(JSON.parse(request.options.body), 'citizen_user_id'), false);

  const civicApi = loadTypeScriptModule('src/services/api.ts', {
    './auth-service': { API_BASE_URL: 'https://example.gov.ph/api/citizen' },
  });
  global.fetch = async (url, options) => {
    request = { url, options };
    return jsonResponse(200, { status: 'success', data: [] });
  };
  await civicApi.CivicApiService.getApplications();
  assert.equal(request.options.credentials, 'include');
  assert.deepEqual(JSON.parse(request.options.body), {});

  const entrySource = fs.readFileSync('src/features/auth/screens/AuthEntryScreen.tsx', 'utf8');
  const verifySource = fs.readFileSync('src/features/auth/screens/VerifyEmailScreen.tsx', 'utf8');
  const loginSource = fs.readFileSync('src/features/auth/screens/LoginScreen.tsx', 'utf8');
  const registerSource = fs.readFileSync('src/features/auth/screens/RegisterScreen.tsx', 'utf8');
  const legacyAuthSource = fs.readFileSync('src/features/identity/components/AuthScreen.tsx', 'utf8');
  const homeSource = fs.readFileSync('src/features/dashboard/HomeScreen.tsx', 'utf8');
  const profileSource = fs.readFileSync('src/features/identity/ProfileScreen.tsx', 'utf8');
  const trackerSource = fs.readFileSync('src/features/tracker/TrackerScreen.tsx', 'utf8');

  assert.match(entrySource, /getAccountAuthRoute\(checkResult\)/);
  assert.match(entrySource, /setErrorMessage\(checkResult\.message/);
  assert.match(verifySource, /await AuthService\.verifyOtp\(displayEmail, code\)/);
  assert.match(verifySource, /await AuthService\.resendOtp\(displayEmail\)/);
  assert.doesNotMatch(legacyAuthSource, /Proceed to Dashboard|router\.replace\('\/\(tabs\)'\)/);
  assert.doesNotMatch(loginSource, /citizenUserId\s*:/);
  assert.doesNotMatch(registerSource, /citizen_user_id\s*:/);
  assert.doesNotMatch(homeSource + profileSource, /params\.(email|citizenUserId)/);
  assert.doesNotMatch(trackerSource, /CIT-88490|APP-2026-001/);

  const bundleFiles = [];
  function collectBundleSources(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const child = path.join(directory, entry.name);
      if (entry.isDirectory()) collectBundleSources(child);
      else if (/\.(?:ts|tsx|js|jsx|json)$/.test(entry.name)) bundleFiles.push(child);
    }
  }
  collectBundleSources('app');
  collectBundleSources('src');
  const bundleSource = bundleFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  assert.doesNotMatch(
    bundleSource,
    /service[_-]?role|EXPO_PUBLIC_[A-Z0-9_]*(?:SECRET|PRIVATE|PASSWORD|SERVICE_ROLE)|supabase.{0,40}(?:secret|service[_-]?role)/i,
  );
  assert.doesNotMatch(
    bundleSource,
    /CIV-2026-00001|CIT-88490|citizen@caloocan\.gov\.ph|Proceed to Dashboard/,
  );

  assert.equal(auth.AuthService.isCitizenAuthenticated(), true);
  const revisionBeforeSignOut = auth.AuthService.getCitizenSessionRevisionSnapshot();
  let sessionChanges = 0;
  const unsubscribe = auth.AuthService.subscribeCitizenSession(() => { sessionChanges += 1; });
  auth.AuthService.clearCurrentUser('expired');
  assert.equal(auth.AuthService.isCitizenAuthenticated(), false);
  assert.equal(auth.AuthService.getCurrentUser().citizen_user_id, null);
  assert.equal(auth.AuthService.getSessionEndReason(), 'expired');
  assert.equal(auth.AuthService.getCitizenSessionRevisionSnapshot(), revisionBeforeSignOut + 1);
  assert.equal(sessionChanges, 1);
  assert.ok(warningResetCalls >= 4);
  auth.AuthService.setCurrentUser({ citizen_user_id: 85, email: 'next@example.test' });
  assert.equal(auth.AuthService.getSessionEndReason(), null);
  assert.equal(auth.AuthService.getCurrentUser().citizen_user_id, 85);
  auth.AuthService.clearCurrentUser();
  assert.equal(auth.AuthService.getSessionEndReason(), null);
  assert.equal(auth.AuthService.isCitizenAuthenticated(), false);
  unsubscribe();
  console.log('Citizen authentication flow and security checks passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
