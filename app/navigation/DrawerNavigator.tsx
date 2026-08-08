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
import { isChatPipeline } from 'types';
import { deleteConversation } from 'repositories';
import { DrawerContentScreen } from 'screens';
import { PlatformIcon, Text } from 'components';
import { log, haptics, isIOS, capitalize } from 'helpers';
import { useAppState, useConversations, useModels, useStyled } from 'hooks';
import { useAiService } from 'services';
import { Spacings } from 'style';

import { ChatStackNavigator } from './ChatStackNavigator';
import {
  DrawerStatusReporter,
  buildLeftDrawerGesture,
  useDrawerCoordination,
} from './DrawerCoordination';

const Drawer = createDrawerNavigator();
const ICON_SIZE = 22;

const MENU_ACTION_NEW_CHAT = 'new-chat';
const MENU_ACTION_DELETE_CHAT = 'delete-chat';

const ChatHeaderRight = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { conversationIdInUse } = useAppState();
  const { chat } = useAiService();

  const handleMenuAction = React.useCallback(
    async ({ nativeEvent }: NativeActionEvent) => {
      chat.current?.stopGeneration();

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
          log('Failed to delete conversation', error, { capture: true });
        }
      }
    },
    [conversationIdInUse, chat],
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

  const model = models.find(({ id }) => id === modelIdInUse);
  const modelName = model?.name;
  const parameterCountBillions = model?.parameterCountBillions;
  let parameterCountLabel: string | undefined = '';

  if (parameterCountBillions !== undefined) {
    parameterCountLabel =
      parameterCountBillions >= 1
        ? `(${parameterCountBillions}B)`
        : `(${Math.round(parameterCountBillions * 1000)}M)`;
  }

  return (
    <View style={styles.titleContainer}>
      <Text variant="body1" bold numberOfLines={1}>
        {capitalize(title)}
      </Text>
      {modelName ? (
        <Text
          variant="caption"
          numberOfLines={1}
          style={{ color: colors.onSurfaceVariant }}
        >
          {modelName} {parameterCountLabel}
        </Text>
      ) : null}
    </View>
  );
};

const renderChatHeaderTitle = ({ children }: { children: string }) => (
  <ChatHeaderTitle title={children} />
);

const renderDrawerContent = ({ navigation }: DrawerContentComponentProps) => (
  <>
    <DrawerStatusReporter side="left" />
    <DrawerContentScreen
      onCloseDrawer={() => {
        navigation.closeDrawer();
      }}
    />
  </>
);

export const DrawerNavigator = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { conversationIdInUse } = useAppState();
  const { conversations } = useConversations();
  const { models } = useModels();
  const { openSide } = useDrawerCoordination();

  const insets = useSafeAreaInsets();

  const currentConversationTitle = conversations.find(
    ({ id }) => id === conversationIdInUse,
  )?.title;

  let title: string | undefined =
    currentConversationTitle ?? t('navigation.newChat');

  if (!models.some(model => isChatPipeline(model.pipeline))) {
    title = undefined;
  }

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
          borderTopRightRadius: Spacings.xxxl,
          borderBottomRightRadius: Spacings.xxxl,
        },
        drawerType: 'front',
        overlayStyle: { backgroundColor: colors.shadow },
        swipeEnabled: true,
        swipeEdgeWidth: Dimensions.get('window').width,
        configureGestureHandler: buildLeftDrawerGesture(openSide === 'left'),
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
            // Disabled while the right drawer is open so its close gesture wins.
            swipeEnabled: (isIOS || isAtRoot) && openSide !== 'right',
            title: title,
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
    paddingRight: isIOS ? undefined : Spacings.md,
    marginHorizontal: Spacings.xl,
  },
});
