import * as React from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createDrawerNavigator,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { DrawerContentScreen } from 'screens';
import { PlatformIcon, Text } from 'components';
import { haptics, isIOS } from 'helpers';
import { useAppState, useConversations, useModels, useStyled } from 'hooks';

import { ChatStackNavigator } from './ChatStackNavigator';
import { Spacings } from 'style';

const Drawer = createDrawerNavigator();
const ICON_SIZE = 22;

const ChatHeaderRight = () => {
  const { colors } = useStyled();

  return (
    <Pressable
      onPress={() => {
        // open options
      }}
      style={{ marginHorizontal: ICON_SIZE / 2 }}
    >
      <PlatformIcon
        iosIconName="ellipsis.circle"
        androidIconName="more_horiz"
        size={ICON_SIZE}
        color={colors.onSurface}
      />
    </Pressable>
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
            title: currentConversationTitle ?? t('navigation.chat'),
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
