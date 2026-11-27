import React from 'react';
import { router, useIsFocused, usePathname } from 'expo-router';
import { Drawer, type DrawerContentComponentProps } from 'expo-router/drawer';
import { VoiceAssistantScreen } from 'screens';
import { useDrawerFrame, useSlotModel, useStyled } from 'hooks';
import {
  DrawerCoordinationProvider,
  DrawerOpenerReporter,
  DrawerStatusReporter,
  Routes,
  buildRightDrawerGesture,
  useDrawerCoordination,
} from 'navigation';
import { Spacings } from 'style';
import { ModelSlot } from 'types';

const renderVoiceAssistant = ({ navigation }: DrawerContentComponentProps) => (
  <>
    <DrawerStatusReporter side="right" />
    <DrawerOpenerReporter side="right" navigation={navigation} />
    <VoiceAssistantScreen
      onCloseDrawer={() => navigation.closeDrawer()}
      onOpenModels={() => {
        router.navigate(Routes.models);
        navigation.closeDrawer();
      }}
    />
  </>
);

const VoiceDrawer = () => {
  const { colors } = useStyled();
  const frame = useDrawerFrame('right');
  const { openSide, scrollGestures, swipeExclusion } = useDrawerCoordination();
  const chatModel = useSlotModel(ModelSlot.chat);
  const pathname = usePathname();
  const isFocused = useIsFocused();

  return (
    <Drawer
      drawerContent={renderVoiceAssistant}
      screenOptions={{
        headerShown: false,
        drawerPosition: 'right',
        drawerStyle: {
          backgroundColor: colors.surfaceSecondary,
          paddingTop: frame.paddingTop,
          width: frame.width,
          borderTopLeftRadius: Spacings.xxxl,
          borderBottomLeftRadius: Spacings.xxxl,
        },
        drawerType: 'front',
        overlayColor: colors.shadow,
        swipeEdgeWidth: frame.swipeEdgeWidth,
        configureGestureHandler: buildRightDrawerGesture(
          openSide === 'right',
          scrollGestures,
          swipeExclusion,
        ),
        swipeEnabled:
          chatModel !== undefined &&
          openSide !== 'left' &&
          isFocused &&
          pathname === Routes.chat,
      }}
    >
      <Drawer.Screen name="(main)" />
    </Drawer>
  );
};

export default function DrawersLayout() {
  return (
    <DrawerCoordinationProvider>
      <VoiceDrawer />
    </DrawerCoordinationProvider>
  );
}
