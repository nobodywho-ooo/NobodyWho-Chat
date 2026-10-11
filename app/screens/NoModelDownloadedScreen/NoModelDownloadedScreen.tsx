import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Button, PlatformIcon, Text } from 'components';
import { useModelDownloads, useStyled } from 'hooks';
import { isChatPipeline } from 'types';

import { DownloadingChatModels } from './components';
import styles from './NoModelDownloadedScreen.styles';

export const NoModelDownloadedScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const navigation = useNavigation();
  const { downloads } = useModelDownloads();

  const chatDownloads = downloads.filter(download =>
    isChatPipeline(download.model.pipeline),
  );

  if (chatDownloads.length > 0) {
    return <DownloadingChatModels downloads={chatDownloads} />;
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
        },
      ]}
    >
      <PlatformIcon
        iosIconName="square.stack.3d.up.fill"
        androidIconName="layers"
        size={50}
        color={colors.onSurfaceDisabled}
      />
      <Text variant="h3" style={styles.text}>
        {t('screens.noModelDownloaded.noModelAvailable')}
      </Text>
      <Button
        title={t('screens.noModelDownloaded.downloadModel')}
        onPress={() => {
          // @ts-ignore
          navigation.navigate('ModelsScreen');
        }}
      />
    </View>
  );
};
