import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { isLiquidGlassSupported } from '@callstack/liquid-glass';
import { SettingsScreen } from 'screens';
import { useStyled } from 'hooks';

const Stack = createNativeStackNavigator();

export const MoreStackNavigator = () => {
  const { colors } = useStyled();

  return (
    <Stack.Navigator
      initialRouteName="SettingsScreen"
      screenOptions={{
        ...(!isLiquidGlassSupported && {
          headerStyle: { backgroundColor: colors.surface },
        }),
        headerTintColor: colors.onSurface,
        headerTitleStyle: { color: colors.onSurface },
        headerLargeTitleStyle: { color: colors.onSurface },
      }}
    >
      <Stack.Screen
        name="SettingsScreen"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          headerLargeTitleEnabled: true,
        }}
      />
    </Stack.Navigator>
  );
};
