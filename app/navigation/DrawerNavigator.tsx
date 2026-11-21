import { useCallback, useRef, useEffect } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createDrawerNavigator,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
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
import { DrawerContentScreen, ModelsScreen, SettingsScreen } from 'screens';
import { PlatformIcon, Text, fontSizes } from 'components';
import {
  log,
  isIOS,
  deleteMessageDocuments,
  getFamilyIcon,
  parameterCountLabel,
} from 'helpers';
import { useAppState, useModels, useStyled } from 'hooks';
import { subscribeChatModelArrival, useAiService } from 'services';
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

  const runMenuAction = useCallback(
    async (event: string) => {
      slots.chat.ref.current?.stopGeneration();

      if (event === MENU_ACTION_NEW_CHAT) {
        setAppState({ conversationIdInUse: undefined });
        return;
      }

      if (
        event === MENU_ACTION_DELETE_CHAT &&
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

  const handleMenuAction = useCallback(
    ({ nativeEvent }: NativeActionEvent) => runMenuAction(nativeEvent.event),
    [runMenuAction],
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

  const hasConversation = conversationIdInUse !== undefined;

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

const renderChatHeaderRight = () => <ChatHeaderRight />;

const ChatHeaderTitle = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const navigation = useNavigation();
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
    // @ts-ignore
    navigation.navigate('DownloadedModelsScreen', { canDelete: false });
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
          size={chevronIconSize}
          color={colors.onSurfaceVariant}
        />
      )}
    </Pressable>
  );
};

const renderChatHeaderTitle = () => <ChatHeaderTitle />;

const OpenChatOnModelArrival = ({
  navigation,
}: Pick<DrawerContentComponentProps, 'navigation'>) => {
  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;

  useEffect(
    () =>
      subscribeChatModelArrival(() => {
        navigationRef.current.navigate('Chat');
      }),
    [],
  );

  return null;
};

const renderDrawerContent = ({ navigation }: DrawerContentComponentProps) => (
  <>
    <DrawerStatusReporter side="left" />
    <OpenChatOnModelArrival navigation={navigation} />
    <DrawerContentScreen
      navigation={navigation}
      onCloseDrawer={() => navigation.closeDrawer()}
    />
  </>
);

export const DrawerNavigator = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { openSide, scrollGestures, swipeExclusion } = useDrawerCoordination();

  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  return (
    <Drawer.Navigator
      drawerContent={renderDrawerContent}
      screenOptions={{
        headerTransparent: true,
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
        swipeEdgeWidth: windowWidth,
        configureGestureHandler: buildLeftDrawerGesture(
          openSide === 'left',
          scrollGestures,
          swipeExclusion,
        ),
      }}
    >
      <Drawer.Screen
        name="Chat"
        component={ChatStackNavigator}
        options={{
          // Disabled while the right drawer is open so its close gesture wins.
          swipeEnabled: openSide !== 'right',
          headerTitle: renderChatHeaderTitle,
          headerTitleContainerStyle: { marginHorizontal: 8 },
          headerRight: renderChatHeaderRight,
          inactiveBehavior: 'none',
        }}
      />
      <Drawer.Screen
        name="Models"
        component={ModelsScreen}
        options={{
          title: t('navigation.models'),
          swipeEnabled: openSide !== 'right',
        }}
      />
      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: t('navigation.settings'),
          swipeEnabled: openSide !== 'right',
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
