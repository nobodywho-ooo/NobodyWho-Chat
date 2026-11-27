import React, { useCallback, useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { setAppState } from 'database';
import {
  ActionButton,
  Button,
  IconButton,
  Text,
  iconButtonSize,
} from 'components';
import { ConversationsList } from './components';
import { useAiService } from 'services';
import { useTheme } from 'context';
import { useModels } from 'hooks';
import { Theme, isChatPipeline } from 'types';
import { Spacings } from 'style';
import { Routes } from 'navigation';

import styles, {
  FLOATING_BUTTON_BOTTOM,
  RAIL_BUTTON_PITCH,
  RAIL_FIRST_BUTTON_CENTER,
} from './DrawerContentScreen.styles';

interface DrawerContentScreenProps {
  onCloseDrawer: () => void;
  isChatFocused?: boolean;
  onHideSidebar?: () => void;
  railInsetRight?: number; // The safe-area inset of the right edge - Duo
}

const gradientColors: Record<Theme, string[]> = {
  light: ['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.9)'],
  dark: ['rgba(18, 18, 18, 0)', 'rgba(18, 18, 18, 0.9)'],
};

export const DrawerContentScreen: React.FC<DrawerContentScreenProps> = ({
  onCloseDrawer,
  isChatFocused = true,
  onHideSidebar,
  railInsetRight = 0,
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
    router.navigate(Routes.models);
    closeDrawer();
  }, [chat, closeDrawer]);

  const handleSettingsPress = useCallback(() => {
    chat.current?.stopGeneration();
    router.navigate(Routes.settings);
    closeDrawer();
  }, [chat, closeDrawer]);

  const showChat = useCallback(() => {
    router.navigate(Routes.chat);
    closeDrawer();
  }, [closeDrawer]);

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
  const hasRail = railInsetRight > 0;
  const buttonSize = iconButtonSize();

  const settingsButton = (
    <IconButton
      icon={{ iosIconName: 'gearshape', androidIconName: 'settings' }}
      accessibilityRole="button"
      accessibilityLabel={t('screens.drawerContent.settings')}
      onPress={handleSettingsPress}
    />
  );
  const closeButton = (
    <IconButton
      icon={{ iosIconName: 'xmark', androidIconName: 'close' }}
      accessibilityRole="button"
      onPress={closeDrawer}
    />
  );

  return (
    <View
      style={[styles.container, hasRail && { paddingRight: railInsetRight }]}
    >
      {onHideSidebar ? (
        <View style={styles.headerContainer}>
          <IconButton
            icon={{
              iosIconName: 'sidebar.left',
              androidIconName: 'left_panel_close',
            }}
            accessibilityRole="button"
            accessibilityLabel={t('navigation.hideSidebar')}
            onPress={onHideSidebar}
          />
          <Text variant="h3" bold style={styles.centeredTitle}>
            nobodywho
          </Text>
          {settingsButton}
        </View>
      ) : (
        <View style={styles.headerContainer}>
          <Text variant="h3" bold>
            nobodywho
          </Text>
          {hasRail ? (
            <View style={{ height: buttonSize }} />
          ) : (
            <View style={styles.headerButtons}>
              {settingsButton}
              {closeButton}
            </View>
          )}
        </View>
      )}

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

      {hasRail && (
        <View
          style={[
            styles.railButtons,
            {
              top: RAIL_FIRST_BUTTON_CENTER - buttonSize / 2,
              gap: RAIL_BUTTON_PITCH - buttonSize,
            },
          ]}
        >
          {closeButton}
          {settingsButton}
        </View>
      )}

      {showNewChat && (
        <Button
          title={t('screens.drawerContent.newChat')}
          variant="secondary"
          icon={{ iosIconName: 'plus.bubble', androidIconName: 'add_comment' }}
          onPress={handleNewChatPress}
          onLayout={handleNewChatLayout}
          style={[
            styles.floatingButton,
            { bottom: newChatBottom, marginRight: railInsetRight },
          ]}
        />
      )}
    </View>
  );
};
