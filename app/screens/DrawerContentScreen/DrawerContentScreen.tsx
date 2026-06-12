import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import { setAppState } from 'database';
import { Button, IconButton, Text } from 'components';
import { ActionButton, ConversationsList } from './components';
import { useTheme } from 'context';
import { useModels } from 'hooks';
import { Theme } from 'types';

import styles from './DrawerContentScreen.styles';

interface DrawerContentScreenProps {
  onCloseDrawer: () => void;
}

const gradientColors: Record<Theme, string[]> = {
  light: ['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.9)'],
  dark: ['rgba(18, 18, 18, 0)', 'rgba(18, 18, 18, 0.9)'],
};

export const DrawerContentScreen: React.FC<DrawerContentScreenProps> = ({
  onCloseDrawer,
}) => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { models } = useModels();
  const theme = useTheme();

  const closeDrawer = onCloseDrawer;

  const handleSettingsPress = useCallback(() => {
    // @ts-ignore
    navigation.navigate('SettingsScreen');
  }, [navigation]);

  const handleChangeModelPress = useCallback(() => {
    // @ts-ignore
    navigation.navigate('DownloadedModelsScreen');
  }, [navigation]);

  const handleNewChatPress = useCallback(() => {
    setAppState({ conversationIdInUse: undefined });
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
          onPress={closeDrawer}
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

      <View style={styles.floatingButtonContainer}>
        <Button
          title={t('screens.drawerContent.newChat')}
          variant="secondary"
          icon={{ iosIconName: 'plus.bubble', androidIconName: 'add_comment' }}
          onPress={handleNewChatPress}
        />
      </View>
    </View>
  );
};
