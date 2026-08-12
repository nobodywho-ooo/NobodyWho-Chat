import React, { useCallback } from 'react';
import { View } from 'react-native';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import { setAppState } from 'database';
import { Button, IconButton, Text } from 'components';
import { ActionButton, ConversationsList } from './components';
import { useAiService } from 'services';
import { useTheme } from 'context';
import { useModels } from 'hooks';
import { haptics } from 'helpers';
import { Theme } from 'types';

import styles from './DrawerContentScreen.styles';

interface DrawerContentScreenProps {
  navigation: DrawerContentComponentProps['navigation'];
  onCloseDrawer: () => void;
}

const gradientColors: Record<Theme, string[]> = {
  light: ['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.9)'],
  dark: ['rgba(18, 18, 18, 0)', 'rgba(18, 18, 18, 0.9)'],
};

export const DrawerContentScreen: React.FC<DrawerContentScreenProps> = ({
  navigation,
  onCloseDrawer,
}) => {
  const { t } = useTranslation();
  const { models } = useModels();
  const { chat } = useAiService();
  const theme = useTheme();

  const closeDrawer = onCloseDrawer;

  const handleSettingsPress = useCallback(() => {
    chat.current?.stopGeneration();
    navigation.navigate('Chat', { screen: 'SettingsScreen' });
    haptics.medium();
    closeDrawer();
  }, [navigation, chat, closeDrawer]);

  const handleChangeModelPress = useCallback(() => {
    chat.current?.stopGeneration();
    navigation.navigate('Chat', {
      screen: 'DownloadedModelsScreen',
      params: { canDelete: false },
    });
    haptics.medium();
    closeDrawer();
  }, [navigation, chat, closeDrawer]);

  const handleNewChatPress = useCallback(() => {
    setAppState({ conversationIdInUse: undefined });
    haptics.medium();
    closeDrawer();
  }, [closeDrawer]);

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text variant="h3" bold>
          NobodyWho
        </Text>
        <IconButton
          icon={{ iosIconName: 'xmark', androidIconName: 'close' }}
          onPress={() => {
            haptics.medium();
            closeDrawer();
          }}
        />
      </View>

      <View style={styles.actionsContainer}>
        <ActionButton
          icon={{ iosIconName: 'gearshape', androidIconName: 'settings' }}
          label={t('screens.drawerContent.settings')}
          onPress={handleSettingsPress}
        />

        {models.length >= 2 && (
          <ActionButton
            icon={{
              iosIconName: 'arrow.left.arrow.right',
              androidIconName: 'swap_horiz',
            }}
            label={t('screens.drawerContent.changeModel')}
            onPress={handleChangeModelPress}
          />
        )}
      </View>

      <ConversationsList onCloseDrawer={closeDrawer} />

      <LinearGradient
        pointerEvents="none"
        colors={gradientColors[theme]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.bottomGradient}
      />

      {models.length >= 1 && (
        <Button
          title={t('screens.drawerContent.newChat')}
          variant="secondary"
          icon={{ iosIconName: 'plus.bubble', androidIconName: 'add_comment' }}
          onPress={handleNewChatPress}
          style={styles.floatingButton}
        />
      )}
    </View>
  );
};
