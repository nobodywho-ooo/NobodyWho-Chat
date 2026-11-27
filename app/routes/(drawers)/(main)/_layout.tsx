import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Drawer, type DrawerContentComponentProps } from 'expo-router/drawer';
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { DrawerContentScreen } from 'screens';
import { useDrawerFrame, useStyled } from 'hooks';
import {
  DRAWER_ROUTE_NAMES,
  DrawerStatusReporter,
  Routes,
  SidebarContext,
  buildLeftDrawerGesture,
  useDrawerCoordination,
} from 'navigation';
import { subscribeChatModelArrival } from 'services';
import { Spacings } from 'style';

const SIDEBAR_ANIMATION_MS = 250;

const MENU_SCREEN_PATHS = new Set<string>([
  Routes.chat,
  Routes.models,
  Routes.settings,
]);

const OpenChatOnModelArrival = () => {
  useEffect(
    () => subscribeChatModelArrival(() => router.navigate(Routes.chat)),
    [],
  );

  return null;
};

export default function MenuDrawerLayout() {
  const { colors } = useStyled();
  const frame = useDrawerFrame('left');
  const { openSide, scrollGestures, swipeExclusion } = useDrawerCoordination();
  const pathname = usePathname();
  const isSidebarLayout = frame.isSidebar;
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const isSidebarShown = isSidebarLayout && isSidebarOpen;
  const sidebarOffset = isSidebarShown ? 0 : -frame.width;

  const sidebar = useMemo(
    () => ({ isSidebarLayout, isSidebarOpen, setSidebarOpen }),
    [isSidebarLayout, isSidebarOpen],
  );

  const animatedSidebarOffset = useSharedValue(sidebarOffset);

  useEffect(() => {
    animatedSidebarOffset.set(
      withTiming(sidebarOffset, { duration: SIDEBAR_ANIMATION_MS }),
    );
  }, [animatedSidebarOffset, sidebarOffset]);

  const sidebarOffsetStyle = useAnimatedStyle(() => ({
    marginLeft: animatedSidebarOffset.get(),
  }));

  const renderDrawerContent = ({
    navigation,
    state,
  }: DrawerContentComponentProps) => (
    <View
      accessibilityElementsHidden={isSidebarLayout && !isSidebarOpen}
      importantForAccessibility={
        isSidebarLayout && !isSidebarOpen ? 'no-hide-descendants' : 'auto'
      }
      style={[
        styles.drawerContent,
        {
          width: frame.width,
          paddingTop: frame.paddingTop,
          paddingLeft: frame.paddingLeft,
        },
      ]}
    >
      <DrawerStatusReporter
        side="left"
        isSidebar={isSidebarLayout}
        navigation={navigation}
      />
      <OpenChatOnModelArrival />
      <DrawerContentScreen
        onCloseDrawer={() => navigation.closeDrawer()}
        onHideSidebar={
          isSidebarLayout ? () => setSidebarOpen(false) : undefined
        }
        railInsetRight={frame.paddingRight}
        isChatFocused={
          state.routes[state.index]?.name === DRAWER_ROUTE_NAMES.chat
        }
      />
    </View>
  );

  return (
    <SidebarContext.Provider value={sidebar}>
      <Drawer
        drawerContent={renderDrawerContent}
        screenOptions={{
          headerShown: false,
          drawerStyle: [
            {
              backgroundColor: colors.surfaceSecondary,
              width: frame.width,
              overflow: 'hidden',
              borderTopRightRadius: isSidebarLayout ? 0 : Spacings.xxxl,
              borderBottomRightRadius: isSidebarLayout ? 0 : Spacings.xxxl,
            },
            isSidebarLayout && (sidebarOffsetStyle as ViewStyle),
          ],
          drawerType: isSidebarLayout ? 'permanent' : 'front',
          overlayColor: colors.shadow,
          swipeEdgeWidth: frame.swipeEdgeWidth,
          configureGestureHandler: buildLeftDrawerGesture(
            openSide === 'left',
            scrollGestures,
            swipeExclusion,
          ),
          swipeEnabled:
            !isSidebarLayout &&
            openSide !== 'right' &&
            MENU_SCREEN_PATHS.has(pathname),
        }}
      >
        <Drawer.Screen name={DRAWER_ROUTE_NAMES.chat} />
        <Drawer.Screen name={DRAWER_ROUTE_NAMES.models} />
        <Drawer.Screen name={DRAWER_ROUTE_NAMES.settings} />
      </Drawer>
    </SidebarContext.Provider>
  );
}

const styles = StyleSheet.create({
  drawerContent: {
    flex: 1,
  },
});
