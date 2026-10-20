import React, { useCallback, useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import { setAppState } from 'database';
import { Button, IconButton, Text } from 'components';
import { ActionButton, ConversationsList } from './components';
import { useAiService } from 'services';
import { useTheme } from 'context';
import { useModels } from 'hooks';
import { Theme, isChatPipeline } from 'types';
import { Spacings } from 'style';

import styles, { FLOATING_BUTTON_BOTTOM } from './DrawerContentScreen.styles';

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
  const { slots } = useAiService();
  const chat = slots.chat.ref;
  const theme = useTheme();

  const closeDrawer = onCloseDrawer;

  const handleSettingsPress = useCallback(() => {
    chat.current?.stopGeneration();
    navigation.navigate('Chat', { screen: 'SettingsScreen' });
    closeDrawer();
  }, [navigation, chat, closeDrawer]);

  const handleNewChatPress = useCallback(() => {
    setAppState({ conversationIdInUse: undefined });
    closeDrawer();
  }, [closeDrawer]);

  const [newChatHeight, setNewChatHeight] = useState(0);

  const handleNewChatLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setNewChatHeight(current => (current === height ? current : height));
  }, []);

  // A voice model alone has nothing to chat with.
  const showNewChat = models.some(({ pipeline }) => isChatPipeline(pipeline));
  const listBottomInset = showNewChat
    ? FLOATING_BUTTON_BOTTOM + newChatHeight + Spacings.lg
    : 0;

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text variant="h3" bold>
          nobodywho
        </Text>
        <IconButton
          icon={{ iosIconName: 'xmark', androidIconName: 'close' }}
          glass
          onPress={closeDrawer}
        />
      </View>

      <View style={styles.actionsContainer}>
        <ActionButton
          icon={{ iosIconName: 'gearshape', androidIconName: 'settings' }}
          label={t('screens.drawerContent.settings')}
          onPress={handleSettingsPress}
        />
      </View>

      <ConversationsList
        onCloseDrawer={closeDrawer}
        bottomInset={listBottomInset}
      />

      <LinearGradient
        pointerEvents="none"
        colors={gradientColors[theme]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.bottomGradient}
      />

      {showNewChat && (
        <Button
          title={t('screens.drawerContent.newChat')}
          variant="secondary"
          icon={{ iosIconName: 'plus.bubble', androidIconName: 'add_comment' }}
          onPress={handleNewChatPress}
          onLayout={handleNewChatLayout}
          style={styles.floatingButton}
        />
      )}
    </View>
  );
};
