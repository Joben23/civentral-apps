const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const jsxRuntime = require('react/jsx-runtime');

function loadTypeScriptModule(relativePath, dependencies = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(path.resolve(relativePath), 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: relativePath,
  }).outputText;
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(
    (specifier) => {
      if (specifier === 'react/jsx-runtime') return jsxRuntime;
      if (specifier.endsWith('.png')) return 'logo';
      if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
      throw new Error('Unexpected test dependency: ' + specifier);
    },
    loaded,
    loaded.exports,
  );
  return loaded.exports;
}

const service = loadTypeScriptModule('src/services/drrmWarningNotifications.ts', {
  '@/src/config/api': { CITIZEN_API_BASE_URL: 'https://example.gov.ph/api/citizen' },
});

const firstEventId = '11111111-1111-4111-8111-111111111111';
const secondEventId = '22222222-2222-4222-8222-222222222222';
const firstWarningId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const secondWarningId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const readAt = '2026-09-19T10:10:00+08:00';

function notification(eventId, warningId, isRead = false) {
  return {
    notification_event_id: eventId,
    warning_id: warningId,
    title: 'Flood warning',
    hazard_type: 'FLOOD',
    hazard_label: 'Flood',
    warning_level: {
      code: 'HIGH',
      label: 'High',
      scale: 'CIVENTRAL Warning Level',
    },
    summary: 'Avoid flooded roads.',
    issued_at: '2026-09-19T09:00:00+08:00',
    valid_until: null,
    activated_at: '2026-09-19T09:05:00+08:00',
    source: { code: 'CIVENTRAL', name: 'CIVENTRAL DRRM' },
    source_reference: null,
    scope: 'BARANGAY',
    affected_areas: [{ scope: 'BARANGAY', name: 'Barangay 171' }],
    is_read: isRead,
    read_at: isRead ? readAt : null,
    actor_reference: 'must-not-project',
    raw_payload: 'must-not-project',
  };
}

function feed(notifications) {
  return {
    success: true,
    city: 'Caloocan City',
    data_as_of: '2026-09-19T10:00:00+08:00',
    count: notifications.length,
    unread_count: notifications.filter((item) => !item.is_read).length,
    notifications,
  };
}

function httpResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  };
}

const first = notification(firstEventId, firstWarningId);
const second = notification(secondEventId, secondWarningId);
const initialFeed = feed([first, second]);

async function flush() {
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

async function testService() {
  const parsed = service.parseCitizenWarningNotificationsResponse(initialFeed);
  assert.equal(parsed.unread_count, 2);
  assert.deepEqual(Object.keys(parsed.notifications[0]).sort(), [
    'activated_at', 'affected_areas', 'hazard_label', 'hazard_type', 'is_read',
    'issued_at', 'notification_event_id', 'read_at', 'scope', 'source',
    'source_reference', 'summary', 'title', 'valid_until', 'warning_id', 'warning_level',
  ]);
  assert.doesNotMatch(JSON.stringify(parsed), /actor_reference|raw_payload/);
  assert.deepEqual(service.parseCitizenWarningNotificationsResponse(feed([])).notifications, []);

  const wrongCount = { ...initialFeed, unread_count: 0 };
  assert.throws(() => service.parseCitizenWarningNotificationsResponse(wrongCount),
    (error) => error.code === 'INVALID_RESPONSE');
  assert.throws(() => service.parseCitizenWarningNotificationsResponse(
    feed([{ ...first, is_read: true, read_at: null }]),
  ), (error) => error.code === 'INVALID_RESPONSE');
  assert.throws(() => service.parseCitizenWarningNotificationsResponse(
    feed([{ ...first, warning_id: 'bad-id' }]),
  ), (error) => error.code === 'INVALID_RESPONSE');
  assert.throws(() => service.parseCitizenWarningNotificationsResponse(
    feed([{ ...first, warning_level: { ...first.warning_level, code: 'UNKNOWN' } }]),
  ), (error) => error.code === 'INVALID_RESPONSE');

  let captured;
  global.fetch = async (url, options) => {
    captured = { url, options };
    return httpResponse(200, initialFeed);
  };
  const fetched = await service.getCitizenWarningNotifications();
  assert.equal(fetched.count, 2);
  assert.equal(captured.url,
    'https://example.gov.ph/api/citizen/drrm/warning-notifications.php');
  assert.equal(captured.options.method, 'GET');
  assert.equal(captured.options.credentials, 'include');
  assert.equal(captured.options.body, undefined);
  assert.equal(captured.options.headers.Authorization, undefined);
  assert.equal(new URL(captured.url).search, '');

  let fetchCalls = 0;
  let resolveFetch;
  global.fetch = () => {
    fetchCalls += 1;
    return new Promise((resolve) => { resolveFetch = resolve; });
  };
  const pendingA = service.getCitizenWarningNotifications();
  const pendingB = service.getCitizenWarningNotifications();
  assert.equal(fetchCalls, 1);
  resolveFetch(httpResponse(200, initialFeed));
  assert.equal((await pendingA).count, 2);
  assert.equal((await pendingB).count, 2);

  global.fetch = async (url, options) => {
    captured = { url, options };
    return httpResponse(200, {
      success: true,
      notification_event_id: firstEventId,
      is_read: true,
      read_at: readAt,
      already_read: false,
    });
  };
  const receipt = await service.markCitizenWarningNotificationRead(firstEventId);
  assert.equal(captured.url,
    'https://example.gov.ph/api/citizen/drrm/warning-notifications-read.php');
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.credentials, 'include');
  assert.equal(captured.options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(captured.options.body), { notification_event_id: firstEventId });
  assert.equal(captured.options.headers.Authorization, undefined);
  assert.doesNotMatch(captured.options.body, /citizen_id|citizen_reference|actor_reference|employee_id/);
  const updated = service.applyWarningReadReceipt(parsed, receipt);
  assert.equal(updated.unread_count, 1);
  assert.equal(updated.notifications[0].is_read, true);
  assert.equal(updated.notifications[0].read_at, readAt);
  assert.equal(updated.notifications[1].is_read, false);

  const alreadyRead = service.parseMarkCitizenWarningNotificationReadResponse({
    success: true,
    notification_event_id: firstEventId,
    is_read: true,
    read_at: readAt,
    already_read: true,
  }, firstEventId);
  assert.equal(alreadyRead.already_read, true);
  assert.equal(service.applyWarningReadReceipt(updated, alreadyRead).unread_count, 1);
  await assert.rejects(
    () => service.markCitizenWarningNotificationRead('invalid-event-id'),
    (error) => error.code === 'INVALID_REQUEST',
  );

  for (const [status, code] of [
    [401, 'AUTH_REQUIRED'], [403, 'FORBIDDEN'], [409, 'NOT_ELIGIBLE'], [503, 'HTTP_ERROR'],
  ]) {
    global.fetch = async () => httpResponse(status, { success: false });
    await assert.rejects(
      () => service.markCitizenWarningNotificationRead(firstEventId),
      (error) => error.code === code,
    );
  }
  global.fetch = async () => httpResponse(401, { success: false });
  await assert.rejects(
    () => service.getCitizenWarningNotifications(),
    (error) => error.code === 'AUTH_REQUIRED',
  );
  global.fetch = async () => ({ ok: true, status: 200, text: async () => '<html>wrong</html>' });
  await assert.rejects(
    () => service.getCitizenWarningNotifications(),
    (error) => error.code === 'INVALID_RESPONSE',
  );
  global.fetch = async () => { throw new Error('private backend detail'); };
  await assert.rejects(
    () => service.getCitizenWarningNotifications(),
    (error) => error.code === 'NETWORK_ERROR'
      && !error.message.includes('private backend detail'),
  );

  const priorSetTimeout = global.setTimeout;
  const priorClearTimeout = global.clearTimeout;
  try {
    global.setTimeout = (callback) => {
      queueMicrotask(callback);
      return 1;
    };
    global.clearTimeout = () => {};
    global.fetch = (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });
    await assert.rejects(
      () => service.getCitizenWarningNotifications(),
      (error) => error.code === 'TIMEOUT',
    );
  } finally {
    global.setTimeout = priorSetTimeout;
    global.clearTimeout = priorClearTimeout;
  }

  let resolveStale;
  global.fetch = () => new Promise((resolve) => { resolveStale = resolve; });
  const staleRequest = service.getCitizenWarningNotifications();
  service.resetCitizenWarningNotificationState();
  resolveStale(httpResponse(200, initialFeed));
  await assert.rejects(staleRequest, (error) => error.code === 'SESSION_CHANGED');
}

function makeUiHarness() {
  let authenticated = false;
  let endReason = null;
  let currentFeed = initialFeed;
  let warningGetError = null;
  let warningMarkError = null;
  let warningGetCalls = 0;
  let warningMarkCalls = [];
  let incidentGetCalls = 0;
  let incidentMarkCalls = 0;
  let warningResetCalls = 0;
  const pushed = [];
  const stateSlots = [];
  const refSlots = [];
  let stateIndex = 0;
  let refIndex = 0;
  let effects = [];
  let focusCallback = null;
  let appStateListener = null;

  const auth = {
    subscribeCitizenSession: () => () => {},
    getCitizenSessionRevisionSnapshot: () => 0,
    isCitizenAuthenticated: () => authenticated,
    getSessionEndReason: () => endReason,
    clearCurrentUser: (reason) => {
      authenticated = false;
      endReason = reason === 'expired' ? 'expired' : null;
    },
  };
  const fakeReact = {
    useCallback: (fn) => fn,
    useEffect: (fn) => { effects.push(fn); },
    useRef: (initial) => {
      const index = refIndex++;
      if (!Object.hasOwn(refSlots, index)) refSlots[index] = { current: initial };
      return refSlots[index];
    },
    useState: (initial) => {
      const index = stateIndex++;
      if (!Object.hasOwn(stateSlots, index)) stateSlots[index] = initial;
      return [stateSlots[index], (value) => {
        stateSlots[index] = typeof value === 'function' ? value(stateSlots[index]) : value;
      }];
    },
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  };
  const warningService = {
    DrrmWarningNotificationService: {
      getCitizenWarningNotifications: async () => {
        warningGetCalls += 1;
        if (warningGetError) throw warningGetError;
        return currentFeed;
      },
      markCitizenWarningNotificationRead: async (eventId) => {
        warningMarkCalls.push(eventId);
        if (warningMarkError) throw warningMarkError;
        return {
          success: true,
          notification_event_id: eventId,
          is_read: true,
          read_at: readAt,
          already_read: false,
        };
      },
    },
    DrrmWarningNotificationsError: service.DrrmWarningNotificationsError,
    WARNING_NOTIFICATIONS_ERROR_MESSAGE: service.WARNING_NOTIFICATIONS_ERROR_MESSAGE,
    applyWarningReadReceipt: service.applyWarningReadReceipt,
    resetCitizenWarningNotificationState: () => { warningResetCalls += 1; },
  };
  const incidentService = {
    INCIDENT_NOTIFICATIONS_ERROR_MESSAGE: 'Incident notifications unavailable.',
    DrrmIncidentNotificationService: {
      getCitizenIncidentNotifications: async () => {
        incidentGetCalls += 1;
        return {
          success: true,
          count: 1,
          unread_count: 1,
          has_more: false,
          notifications: [{
            event_id: 'inc_evt_' + 'a'.repeat(32),
            incident_number: 'INC-2026-123456',
            title: 'Road flooding reported',
            status: 'RESPONDING',
            status_label: 'Responding',
            occurred_at: '2026-09-19T09:15:00+08:00',
            message: 'Team responding.',
            is_read: false,
          }],
        };
      },
      markCitizenIncidentNotificationsRead: async () => {
        incidentMarkCalls += 1;
        return { success: true };
      },
    },
  };
  const ui = loadTypeScriptModule('src/features/notifications/NotificationsScreen.tsx', {
    react: fakeReact,
    'react-native': {
      ActivityIndicator: 'ActivityIndicator',
      AppState: {
        addEventListener: (_type, listener) => {
          appStateListener = listener;
          return { remove() { appStateListener = null; } };
        },
      },
      RefreshControl: 'RefreshControl',
      ScrollView: 'ScrollView',
      StyleSheet: { create: (styles) => styles },
      Text: 'Text',
      TouchableOpacity: 'TouchableOpacity',
      View: 'View',
    },
    '@react-navigation/native': { useFocusEffect: (callback) => { focusCallback = callback; } },
    'expo-router': { useRouter: () => ({ push: (target) => pushed.push(target) }) },
    '@/src/components/ui/Badge': { Badge: 'Badge' },
    '@/src/components/ui/Card': { Card: 'Card' },
    '@/src/features/emergency/components/WarningLevelBadge': { WarningLevelBadge: 'WarningLevelBadge' },
    '@/src/features/emergency/warningPresentation': { formatWarningDateTime: (value) => value },
    '@/src/services/auth-service': { AuthService: auth },
    '@/src/services/drrmIncidentNotifications': incidentService,
    '@/src/services/drrmWarningNotifications': warningService,
    '@/src/features/notifications/notificationPresentation': {
      formatIncidentNotificationTime: (value) => value,
    },
    './notificationPresentation': { formatIncidentNotificationTime: (value) => value },
  });
  const header = loadTypeScriptModule('src/components/common/HeaderBar.tsx', {
    react: fakeReact,
    'react-native': {
      Image: 'Image',
      StyleSheet: { create: (styles) => styles },
      Text: 'Text',
      TouchableOpacity: 'TouchableOpacity',
      View: 'View',
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '@/components/ui/icon-symbol': { IconSymbol: 'IconSymbol' },
    '@/src/services/auth-service': { AuthService: auth },
    '@/src/services/drrmIncidentNotifications': {
      getCitizenIncidentNotifications: incidentService.DrrmIncidentNotificationService.getCitizenIncidentNotifications,
      getCitizenIncidentUnreadCountSnapshot: () => 1,
      subscribeToCitizenIncidentUnreadCount: () => () => {},
    },
  });

  function expand(node) {
    if (Array.isArray(node)) return node.map(expand);
    if (node === null || node === undefined || typeof node !== 'object') return node;
    if (typeof node.type === 'function') return expand(node.type(node.props));
    return {
      type: node.type,
      props: { ...node.props, children: expand(node.props?.children) },
    };
  }
  function render() {
    stateIndex = 0;
    refIndex = 0;
    effects = [];
    focusCallback = null;
    return expand(ui.NotificationsScreen());
  }
  function renderHeader() {
    effects = [];
    return expand(header.HeaderBar({}));
  }
  function find(node, predicate) {
    if (Array.isArray(node)) {
      for (const child of node) {
        const match = find(child, predicate);
        if (match) return match;
      }
      return null;
    }
    if (!node || typeof node !== 'object') return null;
    if (predicate(node)) return node;
    return find(node.props?.children, predicate);
  }
  function textOf(node) {
    if (Array.isArray(node)) return node.map(textOf).join('');
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (!node || typeof node !== 'object') return '';
    return textOf(node.props?.children);
  }
  return {
    auth,
    render,
    renderHeader,
    find,
    textOf,
    get effects() { return effects; },
    get focusCallback() { return focusCallback; },
    get appStateListener() { return appStateListener; },
    get pushed() { return pushed; },
    get warningGetCalls() { return warningGetCalls; },
    get warningMarkCalls() { return warningMarkCalls; },
    get incidentGetCalls() { return incidentGetCalls; },
    get incidentMarkCalls() { return incidentMarkCalls; },
    get warningResetCalls() { return warningResetCalls; },
    setAuthenticated(value) { authenticated = value; endReason = null; },
    setFeed(value) { currentFeed = value; },
    setWarningGetError(value) { warningGetError = value; },
    setWarningMarkError(value) { warningMarkError = value; },
  };
}

async function testUi() {
  const guest = makeUiHarness();
  let tree = guest.render();
  assert.ok(guest.find(tree, (node) => node.props?.testID === 'warning-notifications-sign-in-state'));
  assert.match(guest.textOf(tree), /Sign in to view your warning notifications/);
  assert.equal(guest.warningGetCalls, 0);
  assert.equal(guest.incidentGetCalls, 0);
  guest.renderHeader();
  guest.effects.forEach((effect) => effect());
  assert.equal(guest.incidentGetCalls, 0);

  const app = makeUiHarness();
  app.setAuthenticated(true);
  tree = app.render();
  assert.ok(app.find(tree, (node) => node.props?.testID === 'warning-notifications-loading-state'));
  assert.ok(app.find(tree, (node) => node.props?.testID === 'notifications-loading-state'));
  assert.equal(app.warningMarkCalls.length, 0);
  app.focusCallback();
  app.effects.forEach((effect) => effect());
  await flush();
  tree = app.render();
  const text = app.textOf(tree);
  assert.ok(text.indexOf('ACTIVE WARNING NOTIFICATIONS') < text.indexOf('INCIDENT UPDATES'));
  assert.match(text, /Road flooding reported/);
  assert.equal(app.warningMarkCalls.length, 0);
  assert.equal(app.warningGetCalls, 1);
  assert.equal(app.incidentGetCalls, 1);
  app.effects.forEach((effect) => effect());
  await flush();
  assert.equal(app.incidentMarkCalls, 1);
  assert.equal(app.warningMarkCalls.length, 0);

  const beforeForeground = app.warningGetCalls;
  app.appStateListener('active');
  assert.equal(app.warningGetCalls, beforeForeground);
  const realNow = Date.now;
  try {
    Date.now = () => realNow() + 16_000;
    app.appStateListener('active');
  } finally {
    Date.now = realNow;
  }
  await flush();
  assert.equal(app.warningGetCalls, beforeForeground + 1);
  tree = app.render();
  const beforePullWarnings = app.warningGetCalls;
  const beforePullIncidents = app.incidentGetCalls;
  app.find(tree, (node) => node.type === 'ScrollView').props.refreshControl.props.onRefresh();
  await flush();
  assert.equal(app.warningGetCalls, beforePullWarnings + 1);
  assert.equal(app.incidentGetCalls, beforePullIncidents + 1);
  tree = app.render();

  let firstCard = app.find(tree, (node) => node.props?.testID === 'warning-notification-' + firstEventId);
  assert.ok(firstCard);
  firstCard.props.onPress();
  await flush();
  assert.deepEqual(app.warningMarkCalls, [firstEventId]);
  assert.deepEqual(app.pushed, ['/emergency/' + firstWarningId]);
  tree = app.render();
  firstCard = app.find(tree, (node) => node.props?.testID === 'warning-notification-' + firstEventId);
  assert.match(firstCard.props.accessibilityLabel, /read$/);
  const secondCard = app.find(tree, (node) => node.props?.testID === 'warning-notification-' + secondEventId);
  assert.match(secondCard.props.accessibilityLabel, /unread$/);
  assert.match(app.textOf(tree), /1 unread/);

  app.setFeed(feed([notification(firstEventId, firstWarningId, true)]));
  app.setWarningMarkError(new service.DrrmWarningNotificationsError('NOT_ELIGIBLE'));
  const before409Fetch = app.warningGetCalls;
  secondCard.props.onPress();
  await flush();
  assert.equal(app.warningResetCalls, 1);
  assert.equal(app.warningGetCalls, before409Fetch + 1);
  assert.deepEqual(app.pushed, ['/emergency/' + firstWarningId]);
  tree = app.render();
  assert.equal(app.find(tree, (node) => node.props?.testID === 'warning-notification-' + secondEventId), null);

  const network = makeUiHarness();
  network.setAuthenticated(true);
  network.setWarningMarkError(new service.DrrmWarningNotificationsError('NETWORK_ERROR'));
  network.render();
  network.focusCallback();
  await flush();
  tree = network.render();
  network.find(tree, (node) => node.props?.testID === 'warning-notification-' + firstEventId).props.onPress();
  await flush();
  assert.deepEqual(network.pushed, ['/emergency/' + firstWarningId]);
  tree = network.render();
  assert.match(network.textOf(tree), /Read status could not be saved/);
  assert.match(network.find(tree, (node) => node.props?.testID === 'warning-notification-' + firstEventId)
    .props.accessibilityLabel, /unread$/);

  const expired = makeUiHarness();
  expired.setAuthenticated(true);
  expired.setWarningMarkError(new service.DrrmWarningNotificationsError('AUTH_REQUIRED'));
  expired.render();
  expired.focusCallback();
  await flush();
  tree = expired.render();
  expired.find(tree, (node) => node.props?.testID === 'warning-notification-' + firstEventId).props.onPress();
  await flush();
  tree = expired.render();
  assert.ok(expired.find(tree, (node) => node.props?.testID === 'warning-notifications-session-expired-state'));
  assert.equal(expired.pushed.length, 0);

  const expiredFeed = makeUiHarness();
  expiredFeed.setAuthenticated(true);
  expiredFeed.setWarningGetError(new service.DrrmWarningNotificationsError('AUTH_REQUIRED'));
  expiredFeed.render();
  expiredFeed.focusCallback();
  await flush();
  tree = expiredFeed.render();
  assert.ok(expiredFeed.find(tree,
    (node) => node.props?.testID === 'warning-notifications-session-expired-state'));

  const denied = makeUiHarness();
  denied.setAuthenticated(true);
  denied.setWarningGetError(new service.DrrmWarningNotificationsError('FORBIDDEN'));
  denied.render();
  denied.focusCallback();
  await flush();
  tree = denied.render();
  assert.match(denied.textOf(tree), /Access to warning notifications was denied/);
  const empty = makeUiHarness();
  empty.setAuthenticated(true);
  empty.setFeed(feed([]));
  empty.render();
  empty.focusCallback();
  await flush();
  tree = empty.render();
  assert.ok(empty.find(tree, (node) => node.props?.testID === 'warning-notifications-empty-state'));

  const unavailable = makeUiHarness();
  unavailable.setAuthenticated(true);
  unavailable.setWarningGetError(new service.DrrmWarningNotificationsError('HTTP_ERROR'));
  unavailable.render();
  unavailable.focusCallback();
  await flush();
  tree = unavailable.render();
  assert.ok(unavailable.find(tree, (node) => node.props?.testID === 'warning-notifications-error-state'));
  unavailable.setWarningGetError(null);
  unavailable.find(tree, (node) => node.type === 'TouchableOpacity' && node.props?.onPress
    && unavailable.textOf(node).includes('Retry')).props.onPress();
  await flush();
  tree = unavailable.render();
  assert.ok(unavailable.find(tree, (node) => node.props?.testID === 'warning-notifications-list'));

  const header = makeUiHarness();
  header.setAuthenticated(true);
  tree = header.renderHeader();
  header.effects.forEach((effect) => effect());
  assert.equal(header.incidentGetCalls, 1);
  assert.equal(header.warningGetCalls, 0);
  assert.match(header.find(tree, (node) => node.props?.accessibilityLabel?.startsWith('Notifications,'))
    .props.accessibilityLabel, /1 unread/);

  header.auth.clearCurrentUser('signed-out');
  tree = header.renderHeader();
  header.effects.forEach((effect) => effect());
  assert.equal(header.incidentGetCalls, 1);
  assert.match(header.find(tree, (node) => node.props?.accessibilityLabel?.startsWith('Notifications,'))
    .props.accessibilityLabel, /0 unread/);
  const screenSource = fs.readFileSync('src/features/notifications/NotificationsScreen.tsx', 'utf8');
  assert.match(screenSource, /useFocusEffect/);
  assert.match(screenSource, /AppState\.addEventListener/);
  assert.match(screenSource, /RefreshControl/);
  assert.match(screenSource, /key=\{sessionRevision\}/);
  assert.doesNotMatch(screenSource, /setWarningFeed\(\s*initialFeed/);
}

async function run() {
  await testService();
  await testUi();
  console.log('DRRM citizen warning notification integration checks passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
