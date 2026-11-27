import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { router, type NativeStackNavigationOptions } from 'expo-router';
import {
  MenuView,
  type MenuAction,
  type NativeActionEvent,
} from '@react-native-menu/menu';
import { useTranslation } from 'react-i18next';
import { setAppState } from 'database';
import {
  deleteConversation,
  getDocumentPathsByConversationId,
} from 'repositories';
import { PlatformIcon, Text, fontSizes } from 'components';
import {
  log,
  isIOS,
  deleteMessageDocuments,
  getFamilyIcon,
  parameterCountLabel,
} from 'helpers';
import { useAppState, useModels, useStyled } from 'hooks';
import { useAiService } from 'services';
import { Spacings } from 'style';
import { isChatPipeline } from 'types';

import { useMenuHeaderOptions } from './MenuHeader';
import { Routes } from './routes';

const ICON_SIZE = 22;
const HEADER_LOGO_SIZE = 22;
const MENU_ACTION_NEW_CHAT = 'new-chat';
const MENU_ACTION_DELETE_CHAT = 'delete-chat';

const useChatMenu = () => {
  const { conversationIdInUse } = useAppState();
  const { slots } = useAiService();

  const newChat = useCallback(() => {
    slots.chat.ref.current?.stopGeneration();
    setAppState({ conversationIdInUse: undefined });
  }, [slots]);

  const deleteChat = useCallback(async () => {
    slots.chat.ref.current?.stopGeneration();

    if (conversationIdInUse === undefined) {
      return;
    }

    setAppState({ conversationIdInUse: undefined });

    try {
      const documentPaths =
        await getDocumentPathsByConversationId(conversationIdInUse);

      await deleteConversation(conversationIdInUse);

      await deleteMessageDocuments(documentPaths);
    } catch (error) {
      log('Failed to delete conversation', error, { capture: true });
    }
  }, [conversationIdInUse, slots]);

  return {
    hasConversation: conversationIdInUse !== undefined,
    newChat,
    deleteChat,
  };
};

export const ChatHeaderRight = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { hasConversation, newChat, deleteChat } = useChatMenu();

  const handleMenuAction = useCallback(
    ({ nativeEvent }: NativeActionEvent) => {
      if (nativeEvent.event === MENU_ACTION_NEW_CHAT) {
        newChat();
      } else if (nativeEvent.event === MENU_ACTION_DELETE_CHAT) {
        deleteChat();
      }
    },
    [newChat, deleteChat],
  );

  const newChatAction: MenuAction = {
    id: MENU_ACTION_NEW_CHAT,
    title: t('navigation.chatMenu.newChat'),
    titleColor: colors.onSurface,
    imageColor: colors.onSurface,
    image: Platform.select({
      ios: 'plus.bubble',
      // @react-native-menu/menu resolves Android images by drawable name; 'add_comment'
      // is the Material vector drawable bundled at res/drawable/add_comment.xml.
      android: 'add_comment',
    }),
  };

  const deleteChatAction: MenuAction = {
    id: MENU_ACTION_DELETE_CHAT,
    title: t('navigation.chatMenu.deleteChat'),
    attributes: { destructive: true },
    titleColor: colors.dangerSurface,
    imageColor: colors.dangerSurface,
    image: Platform.select({
      ios: 'trash',
      android: 'ic_menu_delete',
    }),
  };

  const actions: MenuAction[] = isIOS
    ? [
        {
          id: 'new-chat-section',
          title: '',
          displayInline: true,
          subactions: [newChatAction],
        },
        {
          id: 'delete-chat-section',
          title: '',
          displayInline: true,
          subactions: [deleteChatAction],
        },
      ]
    : [newChatAction, deleteChatAction];

  return (
    <View
      pointerEvents={hasConversation ? 'auto' : 'none'}
      accessibilityElementsHidden={!hasConversation}
      importantForAccessibility={
        hasConversation ? 'auto' : 'no-hide-descendants'
      }
    >
      <MenuView
        style={styles.menuButton}
        onPressAction={handleMenuAction}
        actions={actions}
      >
        <PlatformIcon
          iosIconName="ellipsis.circle"
          androidIconName="more_horiz"
          size={ICON_SIZE}
          color={hasConversation ? colors.onSurface : colors.onSurfaceDisabled}
        />
      </MenuView>
    </View>
  );
};

export const renderChatHeaderRight = () => <ChatHeaderRight />;

export const ChatHeaderTitle = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { modelIdInUse } = useAppState();
  const { models } = useModels();
  const { slots } = useAiService();

  const chevronIconSize = fontSizes.h4 + (isIOS ? -4 : 4);
  const model = models.find(({ id }) => id === modelIdInUse);
  const parameterLabel = parameterCountLabel(model?.parameterCountBillions);
  const FamilyIcon = model ? getFamilyIcon(model.family) : undefined;
  const canChangeModel =
    models.filter(({ pipeline }) => isChatPipeline(pipeline)).length >= 2;

  const handlePress = useCallback(() => {
    slots.chat.ref.current?.stopGeneration();
    router.push({
      pathname: Routes.downloadedModels,
      params: { canDelete: 'false' },
    });
  }, [slots]);

  if (!model?.name) {
    return null;
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={!canChangeModel}
      accessibilityRole={canChangeModel ? 'button' : undefined}
      accessibilityHint={
        canChangeModel ? t('screens.drawerContent.changeModel') : undefined
      }
      style={({ pressed }) => [
        styles.titleContainer,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {FamilyIcon && (
        <FamilyIcon
          width={HEADER_LOGO_SIZE}
          height={HEADER_LOGO_SIZE}
          color={colors.onSurface}
        />
      )}
      <View style={styles.titleTextContainer}>
        <Text variant="h4" bold numberOfLines={1} style={styles.titleText}>
          {model.name}
        </Text>
        {parameterLabel ? (
          <Text variant="h4" style={{ color: colors.onSurfaceVariant }}>
            {parameterLabel}
          </Text>
        ) : null}
      </View>
      {canChangeModel && (
        <PlatformIcon
          iosIconName="chevron.right"
          androidIconName="chevron_right"
          size={chevronIconSize}
          color={colors.onSurfaceVariant}
        />
      )}
    </Pressable>
  );
};

export const renderChatHeaderTitle = () => <ChatHeaderTitle />;

const renderNoTitle = () => null;

// iOS: a custom title view handed over while the screen mounts beside the
// sidebar is never placed in the bar — it stays at the window's top-left,
// hidden under the sidebar. Added one frame later, UIKit lays it out.
const useMountedAfterFirstFrame = () => {
  const [isMounted, setMounted] = useState(!isIOS);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return isMounted;
};

// The chat's native header: the menu button (useMenuHeaderOptions), the model
// name and the More menu, a native bar item on iOS (into the vertical bar on
// iPhone Duo).
export const useChatHeaderOptions = (): NativeStackNavigationOptions => {
  const { t } = useTranslation();
  const { hasConversation, newChat, deleteChat } = useChatMenu();
  const menuOptions = useMenuHeaderOptions();
  const isTitleMounted = useMountedAfterFirstFrame();

  return useMemo<NativeStackNavigationOptions>(() => {
    const options: NativeStackNavigationOptions = {
      ...menuOptions,
      headerTitle: isTitleMounted ? renderChatHeaderTitle : renderNoTitle,
    };

    if (!isIOS) {
      return { ...options, headerRight: renderChatHeaderRight };
    }

    return {
      ...options,
      unstable_headerRightItems: () => [
        {
          type: 'menu',
          label: t('navigation.chatMenu.more'),
          icon: { type: 'sfSymbol', name: 'ellipsis' },
          disabled: !hasConversation,
          menu: {
            items: [
              {
                type: 'submenu',
                label: '',
                inline: true,
                items: [
                  {
                    type: 'action',
                    label: t('navigation.chatMenu.newChat'),
                    icon: { type: 'sfSymbol', name: 'plus.bubble' },
                    onPress: newChat,
                  },
                ],
              },
              {
                type: 'submenu',
                label: '',
                inline: true,
                items: [
                  {
                    type: 'action',
                    label: t('navigation.chatMenu.deleteChat'),
                    icon: { type: 'sfSymbol', name: 'trash' },
                    destructive: true,
                    onPress: deleteChat,
                  },
                ],
              },
            ],
          },
        },
      ],
    };
  }, [t, hasConversation, newChat, deleteChat, menuOptions, isTitleMounted]);
};

const styles = StyleSheet.create({
  menuButton: {
    width: ICON_SIZE * 2,
    height: ICON_SIZE * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flexShrink: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: isIOS ? 'center' : 'flex-start',
    gap: Spacings.sm,
    paddingRight: isIOS ? undefined : Spacings.md,
    marginHorizontal: Spacings.xl,
  },
  titleTextContainer: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacings.xs,
  },
  titleText: {
    flexShrink: 1,
  },
});
