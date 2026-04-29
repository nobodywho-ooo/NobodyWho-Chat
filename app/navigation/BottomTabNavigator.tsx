import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MoreStackNavigator } from './SettingsStackNavigator';
import { ChatStackNavigator } from './ChatStackNavigator';
import { Platform } from 'react-native';
import { useStyled } from 'hooks';

const Tab = createBottomTabNavigator();

const BottomTabNavigator = () => {
  const { colors } = useStyled();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
        },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.onSurface,
      }}
    >
      <Tab.Screen
        name="Chat"
        options={{
          title: 'Chat',
          headerShown: false,
          tabBarIcon: Platform.select({
            ios: {
              type: 'sfSymbol',
              name: 'bubble.fill',
            },
            android: {
              type: 'materialSymbol',
              name: 'chat',
            },
          }),
        }}
        component={ChatStackNavigator}
      />
      <Tab.Screen
        name="Settings"
        options={{
          headerShown: false,
          tabBarIcon: Platform.select({
            ios: {
              type: 'sfSymbol',
              name: 'gear',
            },
            android: {
              type: 'materialSymbol',
              name: 'settings',
            },
          }),
        }}
        component={MoreStackNavigator}
      />
    </Tab.Navigator>
  );
};

export default BottomTabNavigator;
