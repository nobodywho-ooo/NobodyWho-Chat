import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  APP_LICENCES,
  fetchModelLicences,
  log,
  openExternalUrl,
  WEB_SEARCH_PROVIDERS,
} from 'helpers';
import { useStyled } from 'hooks';
import { ErrorView, HeaderScrollView, ListItem, Text } from 'components';
import { Spacings } from 'style';
import { ModelLicence } from 'types';

import styles from './AcknowledgementsScreen.styles';

type ModelLicences = ModelLicence[] | 'loading' | 'failed';

export const AcknowledgementsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const insets = useSafeAreaInsets();
  const [modelLicences, setModelLicences] = useState<ModelLicences>('loading');

  const load = useCallback(() => {
    let isStale = false;
    setModelLicences('loading');

    fetchModelLicences()
      .then(licences => !isStale && setModelLicences(licences))
      .catch(error => {
        log('AcknowledgementsScreen fetchModelLicences', error);
        if (!isStale) {
          setModelLicences('failed');
        }
      });

    return () => {
      isStale = true;
    };
  }, []);

  useEffect(load, [load]);

  const renderModelLicences = () => {
    if (modelLicences === 'loading') {
      return (
        <ActivityIndicator style={styles.spinner} color={colors.primary} />
      );
    }

    if (modelLicences === 'failed') {
      return (
        <ErrorView
          message={t('screens.acknowledgements.loadFailed')}
          onRetry={load}
          paddingVertical={Spacings.lg}
          alignLeft
        />
      );
    }

    return modelLicences.map(licence => (
      <ListItem
        key={licence.id}
        title={licence.modelName}
        subtitle={licence.licenceType}
        accessibilityRole="link"
        external
        onPress={() => openExternalUrl(licence.url)}
      />
    ));
  };

  return (
    <HeaderScrollView
      style={[styles.container, { backgroundColor: colors.surface }]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + Spacings.xl },
      ]}
    >
      <Text variant="h3" style={styles.heading}>
        {t('screens.acknowledgements.models')}
      </Text>
      {renderModelLicences()}
      <Text variant="h3" style={[styles.heading, styles.sectionHeader]}>
        {t('screens.acknowledgements.others')}
      </Text>
      {APP_LICENCES.map(licence => (
        <ListItem
          key={licence.titleKey}
          title={t(licence.titleKey)}
          subtitle={licence.licenceType}
          accessibilityRole="link"
          external
          onPress={() => openExternalUrl(licence.url)}
        />
      ))}
      <Text variant="h3" style={[styles.heading, styles.sectionHeader]}>
        {t('screens.acknowledgements.searchProviders')}
      </Text>
      {WEB_SEARCH_PROVIDERS.map(provider => (
        <ListItem
          key={provider.name}
          title={provider.name}
          subtitle={t(provider.usageKey)}
          accessibilityRole="link"
          external
          onPress={() => openExternalUrl(provider.url)}
        />
      ))}
    </HeaderScrollView>
  );
};
