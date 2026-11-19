import * as React from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createDrawerNavigator,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { VoiceAssistantScreen } from 'screens';
import { useSlotModel, useStyled } from 'hooks';
import { Spacings } from 'style';
import { ModelSlot } from 'types';

import { DrawerNavigator } from './DrawerNavigator';
import {
  DrawerOpenerReporter,
  DrawerStatusReporter,
  buildRightDrawerGesture,
  useDrawerCoordination,
} from './DrawerCoordination';

const Drawer = createDrawerNavigator();

const renderVoiceAssistant = ({ navigation }: DrawerContentComponentProps) => (
  <>
    <DrawerStatusReporter side="right" />
    <DrawerOpenerReporter side="right" navigation={navigation} />
    <VoiceAssistantScreen
      onCloseDrawer={() => navigation.closeDrawer()}
      onOpenModels={() => {
        navigation.navigate('Main', { screen: 'Models' });
        navigation.closeDrawer();
      }}
    />
  </>
);

export const RootDrawerNavigator = () => {
  const { colors } = useStyled();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { openSide, scrollGesture, swipeExclusion } = useDrawerCoordination();
  const chatModel = useSlotModel(ModelSlot.chat);

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
        swipeEdgeWidth: windowWidth,
        // Left-ward drag opens; while open, a right-ward drag closes it. The
        // left drawer owns right-ward drags, so the two never fight.
        configureGestureHandler: buildRightDrawerGesture(
          openSide === 'right',
          scrollGesture,
          swipeExclusion,
        ),
      }}
    >
      <Drawer.Screen
        name="Main"
        component={DrawerNavigator}
        options={{
          swipeEnabled:
            chatModel !== undefined &&
            // Disabled while the left drawer is open so its close gesture wins.
            openSide !== 'left',
        }}
      />
    </Drawer.Navigator>
  );
};
