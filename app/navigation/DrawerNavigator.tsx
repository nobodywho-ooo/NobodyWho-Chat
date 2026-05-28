import * as React from 'react';
import { Dimensions, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { DrawerContentScreen } from 'screens';
import { PlatformIcon } from 'components';
import { haptics, isIOS } from 'helpers';
import { useStyled } from 'hooks';

import { ChatStackNavigator } from './ChatStackNavigator';

const Drawer = createDrawerNavigator();
const ICON_SIZE = 22;

export const DrawerNavigator = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();

  const insets = useSafeAreaInsets();

  return (
    <Drawer.Navigator
      drawerContent={({ navigation }) => (
        <DrawerContentScreen
          onCloseDrawer={() => {
            navigation.closeDrawer();
          }}
        />
      )}
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
            title: t('navigation.chat'),
            headerRight: () => (
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
            ),
          };
        }}
        listeners={{
          transitionEnd: () => haptics.soft(),
        }}
      />
    </Drawer.Navigator>
  );
};
