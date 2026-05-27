import React from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Button,
  ConversationList,
  IconButton,
  PlatformIcon,
  Text,
} from 'components';
import { useStyled } from 'hooks';

import styles from './DrawerContentScreen.styles';

interface DrawerContentScreenProps {
  onCloseDrawer: () => void;
}

export const DrawerContentScreen: React.FC<DrawerContentScreenProps> = ({
  onCloseDrawer,
}) => {
  const { colors } = useStyled();
  const navigation = useNavigation();

  const closeDrawer = onCloseDrawer;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="h3" bold>
          NobodyWho
        </Text>
        <IconButton
          icon={{ iosIconName: 'xmark', androidIconName: 'close' }}
          onPress={closeDrawer}
        />
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => {
            // @ts-ignore
            navigation.navigate('SettingsScreen');
          }}
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: colors.surfaceContainer },
            pressed && { opacity: 0.6 },
          ]}
        >
          <PlatformIcon
            iosIconName="gearshape"
            androidIconName="settings"
            size={20}
            color={colors.onSurface}
          />
          <Text variant="body1" style={styles.actionLabel}>
            Settings
          </Text>
        </Pressable>
      </View>

      <ConversationList />

      <View style={styles.floatingButton}>
        <Button
          title="New Chat"
          variant="secondary"
          icon={{ iosIconName: 'plus.bubble', androidIconName: 'add_comment' }}
          onPress={closeDrawer}
        />
      </View>
    </View>
  );
};
