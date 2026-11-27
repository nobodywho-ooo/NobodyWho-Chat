import 'i18n';
import React from 'react';
import { Platform } from 'react-native';
import { ExpoRoot } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import { navigationIntegration } from 'navigation';

const unWantedError =
  'Cannot create devtools websocket connections in embedded environments.';

const SAMPLE_RATE = __DEV__ ? 0 : 0.1;

Sentry.init({
  dsn: 'https://5901cf2e433ebe444dd4dc9f8aebc790@o4511569171709952.ingest.de.sentry.io/4511569173217360',
  sendDefaultPii: false,
  tracesSampleRate: SAMPLE_RATE,
  profilesSampleRate: SAMPLE_RATE,
  enableLogs: true,
  integrations: [navigationIntegration],
  enableNativeFramesTracking: true,
  environment: __DEV__ ? 'development' : 'production',
  debug: false,
  beforeSend(event, hint) {
    // Dev-only noise: Expo's async-require throws this when the JS bundle is embedded rather than served by Metro
    const originalException = hint?.originalException as Error | undefined;
    const message = originalException?.message ?? event.message ?? '';

    if (message.includes(unWantedError)) {
      return null;
    }
    return event;
  },
  beforeBreadcrumb(breadcrumb) {
    // TODO: hot fix, delete when fix in future sentry version
    // On Android the native bridge (sentry-java) deserializes the breadcrumb
    // timestamp as a String, but React Native's toHashMap() converts the JS
    // numeric (epoch seconds) timestamp into a Double, which throws
    // "java.lang.Double cannot be cast to java.lang.String" and drops the
    // breadcrumb. Send an ISO string instead — accepted by both Sentry ingest
    // and the native deserializer. iOS reads it as a number, so leave it alone.
    if (Platform.OS === 'android' && typeof breadcrumb.timestamp === 'number') {
      // @ts-expect-error Sentry types timestamp as number; ISO8601 strings are valid for ingest.
      breadcrumb.timestamp = new Date(
        breadcrumb.timestamp * 1000,
      ).toISOString();
    }
    return breadcrumb;
  },
});

// Route files under app/routes (Expo Router's default filter: no +api, +html
// or +middleware files). This is a bare React Native app whose entry stays
// index.js, so it hands Expo Router the routes itself instead of going through
// expo-router/entry. Must be a literal require.context call for Metro.
const routes = require.context(
  './app/routes',
  true,
  /^(?:\.\/)(?!(?:(?:(?:.*\+api)|(?:\+html)|(?:\+middleware)))\.[tj]sx?$).*(?:\.android|\.ios|\.native)?\.[tj]sx?$/,
);

export default Sentry.wrap(function App() {
  return <ExpoRoot context={routes} />;
});
