import * as React from 'react';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createDrawerNavigator,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import {
  MenuView,
  type MenuAction,
  type NativeActionEvent,
} from '@react-native-menu/menu';
import { useTranslation } from 'react-i18next';
import { setAppState } from 'database';
import { deleteConversation } from 'repositories';
import { DrawerContentScreen } from 'screens';
import { PlatformIcon, Text } from 'components';
import { devLog, haptics, isIOS } from 'helpers';
import { useAppState, useConversations, useModels, useStyled } from 'hooks';

import { ChatStackNavigator } from './ChatStackNavigator';
import { Spacings } from 'style';

const Drawer = createDrawerNavigator();
const ICON_SIZE = 22;

const MENU_ACTION_NEW_CHAT = 'new-chat';
const MENU_ACTION_DELETE_CHAT = 'delete-chat';

const ChatHeaderRight = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { conversationIdInUse } = useAppState();

  const handleMenuAction = React.useCallback(
    async ({ nativeEvent }: NativeActionEvent) => {
      if (nativeEvent.event === MENU_ACTION_NEW_CHAT) {
        setAppState({ conversationIdInUse: undefined });
        return;
      }

      if (
        nativeEvent.event === MENU_ACTION_DELETE_CHAT &&
        conversationIdInUse !== undefined
      ) {
        setAppState({ conversationIdInUse: undefined });

        try {
          await deleteConversation(conversationIdInUse);
        } catch (error) {
          devLog('Failed to delete conversation', error);
        }
      }
    },
    [conversationIdInUse],
  );

  const newChatAction: MenuAction = {
    id: MENU_ACTION_NEW_CHAT,
    title: t('navigation.chatMenu.newChat'),
    imageColor: colors.onSurface,
    image: Platform.select({
      ios: 'plus.bubble',
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
    <MenuView
      style={{ marginHorizontal: ICON_SIZE / 2 }}
      onPressAction={handleMenuAction}
      actions={actions}
    >
      <PlatformIcon
        iosIconName="ellipsis.circle"
        androidIconName="more_horiz"
        size={ICON_SIZE}
        color={colors.onSurface}
      />
    </MenuView>
  );
};

const renderChatHeaderRight = () => <ChatHeaderRight />;

const ChatHeaderTitle = ({ title }: { title: string }) => {
  const { colors } = useStyled();
  const { modelIdInUse } = useAppState();
  const { models } = useModels();

  const modelName = models.find(({ id }) => id === modelIdInUse)?.modelName;

  return (
    <View style={styles.titleContainer}>
      <Text variant="body1" bold numberOfLines={1}>
        {title}
      </Text>
      {modelName ? (
        <Text
          variant="caption"
          numberOfLines={1}
          style={{ color: colors.onSurfaceVariant }}
        >
          {modelName}
        </Text>
      ) : null}
    </View>
  );
};

const renderChatHeaderTitle = ({ children }: { children: string }) => (
  <ChatHeaderTitle title={children} />
);

const renderDrawerContent = ({ navigation }: DrawerContentComponentProps) => (
  <DrawerContentScreen
    onCloseDrawer={() => {
      navigation.closeDrawer();
    }}
  />
);

export const DrawerNavigator = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { conversationIdInUse } = useAppState();
  const { conversations } = useConversations();

  const insets = useSafeAreaInsets();

  const currentConversationTitle = conversations.find(
    ({ id }) => id === conversationIdInUse,
  )?.title;

  return (
    <Drawer.Navigator
      drawerContent={renderDrawerContent}
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.onSurface,
        headerTitleStyle: { color: colors.onSurface },
        drawerStyle: {
          backgroundColor: colors.surfaceSecondary,
          paddingTop: insets.top,
          width: '100%',
          borderTopRightRadius: 40,
          borderBottomRightRadius: 40,
        },
        drawerType: 'front',
        overlayStyle: { backgroundColor: colors.shadow },
        swipeEnabled: true,
        swipeEdgeWidth: Dimensions.get('window').width,
      }}
    >
      <Drawer.Screen
        name="Chat"
        component={ChatStackNavigator}
        options={({ route }) => {
          const routeName = getFocusedRouteNameFromRoute(route) ?? 'ChatScreen';
          const isAtRoot = routeName === 'ChatScreen';

          return {
            headerShown: isIOS || isAtRoot,
            swipeEnabled: isIOS || isAtRoot,
            title: currentConversationTitle ?? t('navigation.newChat'),
            headerTitle: renderChatHeaderTitle,
            headerTitleContainerStyle: { marginHorizontal: 8 },
            headerRight:
              conversationIdInUse !== undefined
                ? renderChatHeaderRight
                : undefined,
          };
        }}
        listeners={{
          transitionEnd: () => haptics.soft(),
        }}
      />
    </Drawer.Navigator>
  );
};

const styles = StyleSheet.create({
  titleContainer: {
    flexShrink: 1,
    minWidth: 0,
    justifyContent: 'center',
    alignItems: isIOS ? 'center' : 'flex-start',
    marginHorizontal: Spacings.xl,
  },
});
