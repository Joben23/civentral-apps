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

const types = loadTypeScriptModule('src/types/drrmIncidentNotifications.ts');
const service = loadTypeScriptModule('src/services/drrmIncidentNotifications.ts', {
  '@/src/config/api': { CITIZEN_API_BASE_URL: 'https://example.gov.ph/api/citizen' },
  '@/src/types/drrmIncidentNotifications': types,
});
const presentation = loadTypeScriptModule(
  'src/features/notifications/notificationPresentation.ts',
);

const notification = {
  event_id: `inc_evt_${'a'.repeat(32)}`,
  incident_number: 'INC-2026-123456',
  title: 'Floodwater rising near main road',
  status: 'RESPONDING',
  status_label: 'Responding',
  occurred_at: '2026-08-26T10:00:00+08:00',
  message: 'A response team is responding to the incident.',
  is_read: false,
  reporter_reference: 'must-not-project',
  incident_id: 'internal-uuid',
  actor_id: 'internal-actor',
  admin_notes: 'private note',
  assignment_reference: 'private assignment',
  response_logs: ['private response log'],
};

const response = (notifications, unreadCount = 0) => ({
  success: true,
  unread_count: unreadCount,
  count: notifications.length,
  has_more: false,
  notifications,
});

async function run() {
  const parsed = service.parseCitizenIncidentNotificationsResponse(
    response([notification], 1),
  );
  assert.equal(parsed.unread_count, 1);
  assert.equal(parsed.count, 1);
  assert.equal(parsed.notifications[0].event_id, notification.event_id);
  assert.equal(parsed.notifications[0].incident_number, 'INC-2026-123456');
  assert.equal(parsed.notifications[0].status, 'RESPONDING');
  assert.equal(parsed.notifications[0].is_read, false);
  assert.deepEqual(Object.keys(parsed.notifications[0]).sort(), [
    'event_id',
    'incident_number',
    'is_read',
    'message',
    'occurred_at',
    'status',
    'status_label',
    'title',
  ]);
  assert.doesNotMatch(
    JSON.stringify(parsed),
    /reporter_reference|incident_id|actor_id|admin_notes|assignment_reference|response_logs/,
  );

  const empty = service.parseCitizenIncidentNotificationsResponse(response([]));
  assert.equal(empty.unread_count, 0);
  assert.deepEqual(empty.notifications, []);
  assert.throws(
    () => service.parseCitizenIncidentNotificationsResponse(response([notification], 0)),
    (error) => error.code === 'INVALID_RESPONSE',
  );

  const now = new Date(2026, 7, 26, 12, 0, 0);
  const localIso = (day, hour, minute, second = 0) =>
    new Date(2026, 7, day, hour, minute, second).toISOString();
  assert.equal(presentation.formatIncidentNotificationTime(localIso(26, 11, 59, 30), now), 'Just now');
  assert.equal(presentation.formatIncidentNotificationTime(localIso(26, 11, 55), now), '5 mins ago');
  assert.equal(presentation.formatIncidentNotificationTime(localIso(26, 10, 0), now), '2 hours ago');
  assert.equal(presentation.formatIncidentNotificationTime(localIso(25, 15, 0), now), 'Yesterday');
  assert.equal(presentation.formatIncidentNotificationTime(localIso(24, 12, 0), now), 'Aug 24');

  const screenSource = fs.readFileSync(
    path.resolve('src/features/notifications/NotificationsScreen.tsx'),
    'utf8',
  );
  const serviceSource = fs.readFileSync(
    path.resolve('src/services/drrmIncidentNotifications.ts'),
    'utf8',
  );
  const homeSource = fs.readFileSync(
    path.resolve('src/features/dashboard/HomeScreen.tsx'),
    'utf8',
  );
  const notificationSource = `${screenSource}\n${serviceSource}\n${homeSource}`;
  assert.match(screenSource, /No notifications yet/);
  assert.match(screenSource, /notifications-empty-state/);
  assert.match(screenSource, /notifications-error-state/);
  assert.match(screenSource, /DRRM INCIDENT UPDATE/);
  assert.doesNotMatch(
    notificationSource,
    /Typhoon Weather Advisory #2|Business Permit E-Clearance Ready|Mobile Health Clinic Schedule|10 mins ago|2 hours ago|1 day ago/,
  );
  assert.doesNotMatch(
    screenSource,
    /reporter_reference|incident_uuid|incident_id|actor_id|admin_notes|assignment_reference|response_logs/i,
  );

  let capturedRequest;
  global.fetch = async (url, options) => {
    capturedRequest = { url, options };
    return { ok: true, text: async () => JSON.stringify(response([notification], 1)) };
  };
  const fetched = await service.getCitizenIncidentNotifications();
  assert.equal(fetched.unread_count, 1);
  assert.equal(service.getCitizenIncidentUnreadCountSnapshot(), 1);
  assert.equal(
    capturedRequest.url,
    'https://example.gov.ph/api/citizen/drrm/incident-notifications.php',
  );
  assert.equal(capturedRequest.options.method, 'GET');
  assert.equal(capturedRequest.options.credentials, 'include');
  assert.equal(capturedRequest.options.body, undefined);
  assert.equal(capturedRequest.options.headers.Authorization, undefined);
  assert.equal(new URL(capturedRequest.url).search, '');

  global.fetch = async (url, options) => {
    capturedRequest = { url, options };
    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          success: true,
          last_seen_at: '2026-08-26T12:01:00+08:00',
          message: 'Incident notifications were marked as read.',
        }),
    };
  };
  await service.markCitizenIncidentNotificationsRead();
  assert.equal(service.getCitizenIncidentUnreadCountSnapshot(), 0);
  assert.equal(
    capturedRequest.url,
    'https://example.gov.ph/api/citizen/drrm/incident-notifications-read.php',
  );
  assert.equal(capturedRequest.options.method, 'POST');
  assert.equal(capturedRequest.options.credentials, 'include');
  assert.equal(capturedRequest.options.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(capturedRequest.options.body), {});
  assert.doesNotMatch(capturedRequest.options.body, /email|reporter|citizen|incident/i);

  global.fetch = async () => ({ ok: true, text: async () => JSON.stringify(response([notification], 1)) });
  await service.getCitizenIncidentNotifications();
  global.fetch = async () => {
    throw new Error('raw PHP or network detail');
  };
  await assert.rejects(
    () => service.markCitizenIncidentNotificationsRead(),
    (error) => error.code === 'NETWORK_ERROR' && !error.message.includes('raw PHP'),
  );
  assert.equal(service.getCitizenIncidentUnreadCountSnapshot(), 1);
  await assert.rejects(
    () => service.getCitizenIncidentNotifications(),
    (error) =>
      error.code === 'NETWORK_ERROR' &&
      error.message === service.INCIDENT_NOTIFICATIONS_ERROR_MESSAGE,
  );
  assert.doesNotMatch(screenSource, /setNotifications\(\s*\[/);

  assert.equal(fs.existsSync(path.resolve('src/services/notification-service.ts')), false);
  assert.match(serviceSource, /credentials:\s*'include'/);
  assert.match(serviceSource, /body:\s*JSON\.stringify\(\{\}\)/);
  assert.doesNotMatch(serviceSource, /supabase|service_role|reporter_reference|citizen_user_id/i);
  service.resetCitizenIncidentNotificationState();
  assert.equal(service.getCitizenIncidentUnreadCountSnapshot(), 0);

  console.log('DRRM citizen incident notification checks passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
