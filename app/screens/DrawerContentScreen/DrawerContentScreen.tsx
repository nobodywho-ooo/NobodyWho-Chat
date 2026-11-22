import React, { useCallback, useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { setAppState } from 'database';
import { ActionButton, Button, IconButton, Text } from 'components';
import { ConversationsList } from './components';
import { useAiService } from 'services';
import { useTheme } from 'context';
import { useModels } from 'hooks';
import { Theme, isChatPipeline } from 'types';
import { Spacings } from 'style';

import styles, { FLOATING_BUTTON_BOTTOM } from './DrawerContentScreen.styles';

interface DrawerContentScreenProps {
  navigation: DrawerContentComponentProps['navigation'];
  onCloseDrawer: () => void;
  isChatFocused?: boolean;
}

const gradientColors: Record<Theme, string[]> = {
  light: ['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.9)'],
  dark: ['rgba(18, 18, 18, 0)', 'rgba(18, 18, 18, 0.9)'],
};

export const DrawerContentScreen: React.FC<DrawerContentScreenProps> = ({
  navigation,
  onCloseDrawer,
  isChatFocused = true,
}) => {
  const { t } = useTranslation();
  const { models } = useModels();
  const { slots } = useAiService();
  const chat = slots.chat.ref;
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const closeDrawer = onCloseDrawer;

  const handleModelsPress = useCallback(() => {
    chat.current?.stopGeneration();
    navigation.navigate('Models');
    closeDrawer();
  }, [navigation, chat, closeDrawer]);

  const handleSettingsPress = useCallback(() => {
    chat.current?.stopGeneration();
    navigation.navigate('Settings');
    closeDrawer();
  }, [navigation, chat, closeDrawer]);

  const showChat = useCallback(() => {
    navigation.navigate('Chat');
    closeDrawer();
  }, [navigation, closeDrawer]);

  const handleNewChatPress = useCallback(() => {
    setAppState({ conversationIdInUse: undefined });
    showChat();
  }, [showChat]);

  const [newChatHeight, setNewChatHeight] = useState(0);

  const handleNewChatLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setNewChatHeight(current => (current === height ? current : height));
  }, []);

  const showNewChat = models.some(({ pipeline }) => isChatPipeline(pipeline));
  const newChatBottom = Math.max(
    FLOATING_BUTTON_BOTTOM,
    insets.bottom + Spacings.md,
  );
  const listBottomInset = showNewChat
    ? newChatBottom + newChatHeight + Spacings.lg
    : 0;

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text variant="h3" bold>
          nobodywho
        </Text>
        <View style={styles.headerButtons}>
          <IconButton
            icon={{ iosIconName: 'gearshape', androidIconName: 'settings' }}
            accessibilityRole="button"
            accessibilityLabel={t('screens.drawerContent.settings')}
            onPress={handleSettingsPress}
          />
          <IconButton
            icon={{ iosIconName: 'xmark', androidIconName: 'close' }}
            accessibilityRole="button"
            onPress={closeDrawer}
          />
        </View>
      </View>

      <View style={styles.actionsContainer}>
        <ActionButton
          icon={{
            iosIconName: 'square.stack.3d.up',
            androidIconName: 'layers',
          }}
          label={t('screens.drawerContent.models')}
          onPress={handleModelsPress}
        />
      </View>

      <ConversationsList
        onSelect={showChat}
        bottomInset={listBottomInset}
        showSelection={isChatFocused}
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
          style={[styles.floatingButton, { bottom: newChatBottom }]}
        />
      )}
    </View>
  );
};
