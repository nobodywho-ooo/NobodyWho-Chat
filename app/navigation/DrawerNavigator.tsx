import * as React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import {
  createDrawerNavigator,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import {
  getFocusedRouteNameFromRoute,
  useNavigation,
} from '@react-navigation/native';
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
import { DrawerContentScreen } from 'screens';
import { PlatformIcon, Text, fontSizes } from 'components';
import {
  log,
  isIOS,
  deleteMessageDocuments,
  getFamilyIcon,
  parameterCountLabel,
} from 'helpers';
import { useAppState, useDrawerFrame, useModels, useStyled } from 'hooks';
import { useAiService } from 'services';
import { Spacings } from 'style';
import { isChatPipeline } from 'types';

import { ChatStackNavigator } from './ChatStackNavigator';
import {
  DrawerStatusReporter,
  buildLeftDrawerGesture,
  useDrawerCoordination,
} from './DrawerCoordination';

const ICON_SIZE = 22;
const HEADER_LOGO_SIZE = 22;
const MENU_ACTION_NEW_CHAT = 'new-chat';
const MENU_ACTION_DELETE_CHAT = 'delete-chat';

const Drawer = createDrawerNavigator();

const ChatHeaderRight = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { conversationIdInUse } = useAppState();
  const { slots } = useAiService();

  const handleMenuAction = React.useCallback(
    async ({ nativeEvent }: NativeActionEvent) => {
      slots.chat.ref.current?.stopGeneration();

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
          const documentPaths =
            await getDocumentPathsByConversationId(conversationIdInUse);

          await deleteConversation(conversationIdInUse);

          await deleteMessageDocuments(documentPaths);
        } catch (error) {
          log('Failed to delete conversation', error, { capture: true });
        }
      }
    },
    [conversationIdInUse, slots],
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
      style={styles.menuButton}
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

const ChatHeaderTitle = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const navigation = useNavigation();
  const { modelIdInUse } = useAppState();
  const { models } = useModels();
  const { slots } = useAiService();

  const model = models.find(({ id }) => id === modelIdInUse);
  const parameterLabel = parameterCountLabel(model?.parameterCountBillions);
  const FamilyIcon = model ? getFamilyIcon(model.family) : undefined;
  // Only chat models can take the chat's place; voice models don't count.
  const canChangeModel =
    models.filter(({ pipeline }) => isChatPipeline(pipeline)).length >= 2;

  const handlePress = React.useCallback(() => {
    slots.chat.ref.current?.stopGeneration();
    // @ts-ignore
    navigation.navigate('Chat', {
      screen: 'DownloadedModelsScreen',
      params: { canDelete: false },
    });
  }, [navigation, slots]);

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
          size={fontSizes.h4 - 4}
          color={colors.onSurfaceVariant}
        />
      )}
    </Pressable>
  );
};

const renderChatHeaderTitle = () => <ChatHeaderTitle />;

const renderDrawerContent = ({ navigation }: DrawerContentComponentProps) => (
  <>
    <DrawerStatusReporter side="left" />
    <DrawerContentScreen
      navigation={navigation}
      onCloseDrawer={() => navigation.closeDrawer()}
    />
  </>
);

export const DrawerNavigator = () => {
  const { colors } = useStyled();
  const { conversationIdInUse } = useAppState();
  const { openSide, scrollGesture, swipeExclusion } = useDrawerCoordination();
  const { swipeEdgeWidth, ...drawerFrame } = useDrawerFrame('left');

  return (
    <Drawer.Navigator
      drawerContent={renderDrawerContent}
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.onSurface,
        headerTitleStyle: { color: colors.onSurface },
        drawerStyle: {
          backgroundColor: colors.surfaceSecondary,
          ...drawerFrame,
          borderTopRightRadius: Spacings.xxxl,
          borderBottomRightRadius: Spacings.xxxl,
        },
        drawerType: 'front',
        overlayStyle: { backgroundColor: colors.shadow },
        swipeEnabled: true,
        swipeEdgeWidth,
        configureGestureHandler: buildLeftDrawerGesture(
          openSide === 'left',
          scrollGesture,
          swipeExclusion,
        ),
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
            headerTitle: renderChatHeaderTitle,
            headerTitleContainerStyle: { marginHorizontal: 8 },
            headerRight:
              conversationIdInUse !== undefined
                ? renderChatHeaderRight
                : undefined,
          };
        }}
      />
    </Drawer.Navigator>
  );
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
