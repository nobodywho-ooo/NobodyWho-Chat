import React from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useStyled } from 'hooks';
import {
  SCRAPE_IDLE_SOURCE,
  isAllowedScrapeNavigation,
  useScrapeHost,
} from 'services';

import { Button } from '../Button/Button';
import { Text } from '../Text/Text';

import styles from './WebScrapeHost.styles';

// The browser web search runs its queries in. Search engines answer a plain
// fetch from an app with a bot wall, so the result pages are loaded in a real
// WebView kept off-screen and read by an injected parser (see useScrapeHost).
// It is mounted once at the app root, so a search survives navigating around,
// and only comes forward when an engine asks the user to prove they're human.
export const WebScrapeHost: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const insets = useSafeAreaInsets();
  const {
    webRef,
    nav,
    onLoadScript,
    revealed,
    closeAndCancel,
    recheck,
    handleMessage,
    handleLoadEnd,
    handleNavigationStateChange,
  } = useScrapeHost();

  return (
    <View
      style={
        revealed
          ? [styles.revealed, { backgroundColor: colors.surface }]
          : styles.hidden
      }
      pointerEvents={revealed ? 'auto' : 'none'}
      accessibilityElementsHidden={!revealed}
      importantForAccessibility={revealed ? 'auto' : 'no-hide-descendants'}
    >
      {revealed && (
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text bold>{t('components.webScrapeHost.title')}</Text>
          <Text variant="body2" style={{ color: colors.onSurfaceVariant }}>
            {t('components.webScrapeHost.hint')}
          </Text>
        </View>
      )}

      <View
        style={
          revealed
            ? [styles.frame, { borderColor: colors.border }]
            : styles.frameOffscreen
        }
      >
        <WebView
          key={nav?.key ?? 'idle'}
          ref={webRef}
          source={nav ? { uri: nav.uri } : SCRAPE_IDLE_SOURCE}
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={request =>
            isAllowedScrapeNavigation(request.url)
          }
          incognito
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          injectedJavaScript={onLoadScript}
          onMessage={handleMessage}
          onLoadEnd={handleLoadEnd}
          onNavigationStateChange={handleNavigationStateChange}
          style={[styles.webview, { backgroundColor: colors.surfaceSecondary }]}
        />
      </View>

      {revealed && (
        <View style={[styles.actions, { paddingBottom: insets.bottom + 14 }]}>
          <Button
            small
            variant="outline"
            title={t('components.webScrapeHost.skip')}
            onPress={closeAndCancel}
            testID="web-challenge-cancel"
          />
          <Button
            small
            title={t('components.webScrapeHost.done')}
            onPress={recheck}
            testID="web-challenge-done"
          />
        </View>
      )}
    </View>
  );
};
