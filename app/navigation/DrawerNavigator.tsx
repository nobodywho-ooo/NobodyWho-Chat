import * as React from 'react';
import { Text, View } from 'react-native';

import { createDrawerNavigator } from '@react-navigation/drawer';
import { ChatStackNavigator } from './ChatStackNavigator';

const Drawer = createDrawerNavigator();

function ProfileScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Profile Screen</Text>
    </View>
  );
}

export const DrawerNavigator = () => {
  return (
    <Drawer.Navigator>
      <Drawer.Screen name="Chat" component={ChatStackNavigator} />
      <Drawer.Screen name="Profile" component={ProfileScreen} />
    </Drawer.Navigator>
  );
};
