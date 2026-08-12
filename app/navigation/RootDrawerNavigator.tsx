import * as React from 'react';
import { Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createDrawerNavigator,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { VoiceAssistantScreen } from 'screens';
import { haptics, isIOS } from 'helpers';
import { useStyled } from 'hooks';
import { Spacings } from 'style';

import { DrawerNavigator } from './DrawerNavigator';
import {
  DrawerCoordinationProvider,
  DrawerOpenerReporter,
  DrawerStatusReporter,
  buildRightDrawerGesture,
  useDrawerCoordination,
} from './DrawerCoordination';

// The inner ChatStackNavigator presents these as Android modals. A full-width
// drawer swipe would fight the modal, so — exactly like the left drawer — the
// right-drawer swipe is disabled off the chat root on Android.
const MODAL_ROUTE_NAMES = new Set([
  'SettingsScreen',
  'ModelsScreen',
  'CustomizeAssistantScreen',
  'DownloadedModelsScreen',
  'TermsScreen',
  'PrivacyPolicyScreen',
]);

type NestedRoute = {
  name: string;
  state?: { index?: number; routes: NestedRoute[] };
};

// Walks the nested navigation state down to the currently focused leaf route.
// The outer drawer sits two navigators above the chat stack, so the built-in
// getFocusedRouteNameFromRoute (one level) can't see it.
const getLeafRouteName = (route: NestedRoute): string => {
  let current = route;
  while (current.state && current.state.routes.length > 0) {
    const { index, routes } = current.state;
    const next = routes[index ?? routes.length - 1];
    if (!next) {
      break;
    }
    current = next;
  }
  return current.name;
};

const Drawer = createDrawerNavigator();

const renderVoiceAssistant = ({ navigation }: DrawerContentComponentProps) => (
  <>
    <DrawerStatusReporter side="right" />
    <DrawerOpenerReporter side="right" navigation={navigation} />
    <VoiceAssistantScreen
      onCloseDrawer={() => {
        haptics.medium();
        navigation.closeDrawer();
      }}
    />
  </>
);

const RootDrawer = () => {
  const { colors } = useStyled();
  const insets = useSafeAreaInsets();
  const { openSide, scrollGesture } = useDrawerCoordination();

  return (
    <Drawer.Navigator
      drawerContent={renderVoiceAssistant}
      screenOptions={{
        headerShown: false,
        drawerPosition: 'right',
        drawerStyle: {
          backgroundColor: colors.surfaceSecondary,
          paddingTop: insets.top,
          width: '100%',
          borderTopLeftRadius: Spacings.xxxl,
          borderBottomLeftRadius: Spacings.xxxl,
        },
        drawerType: 'front',
        overlayStyle: { backgroundColor: colors.shadow },
        swipeEnabled: true,
        swipeEdgeWidth: Dimensions.get('window').width,
        // Left-ward drag opens; while open, a right-ward drag closes it. The
        // left drawer owns right-ward drags, so the two never fight.
        configureGestureHandler: buildRightDrawerGesture(
          openSide === 'right',
          scrollGesture,
        ),
      }}
    >
      <Drawer.Screen
        name="Main"
        component={DrawerNavigator}
        options={({ route }) => ({
          swipeEnabled:
            (isIOS || !MODAL_ROUTE_NAMES.has(getLeafRouteName(route))) &&
            // Disabled while the left drawer is open so its close gesture wins.
            openSide !== 'left',
        })}
        listeners={{
          transitionEnd: () => haptics.soft(),
        }}
      />
    </Drawer.Navigator>
  );
};

export const RootDrawerNavigator = () => (
  <DrawerCoordinationProvider>
    <RootDrawer />
  </DrawerCoordinationProvider>
);
