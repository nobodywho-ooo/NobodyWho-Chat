import React, { useCallback, useMemo } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useNavigation, type NativeStackNavigationOptions } from 'expo-router';
import { DrawerActions } from 'expo-router/react-navigation';
import { useTranslation } from 'react-i18next';
import { IconButton } from 'components';
import { isIOS } from 'helpers';
import { useStyled } from 'hooks';
import { Spacings } from 'style';

import { useSidebar } from './Sidebar';

interface MenuToggleButtonProps {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export const MenuToggleButton: React.FC<MenuToggleButtonProps> = ({
  onPress,
  style,
}) => {
  const { t } = useTranslation();
  const { isSidebarLayout } = useSidebar();

  return (
    <IconButton
      icon={
        isSidebarLayout
          ? { iosIconName: 'sidebar.left', androidIconName: 'left_panel_open' }
          : { iosIconName: 'line.3.horizontal', androidIconName: 'menu' }
      }
      accessibilityRole="button"
      accessibilityLabel={t(
        isSidebarLayout ? 'navigation.showSidebar' : 'navigation.openMenu',
      )}
      onPress={onPress}
      style={style}
    />
  );
};

export const useOpenMenu = () => {
  const navigation = useNavigation();
  const { isSidebarLayout, setSidebarOpen } = useSidebar();

  return useCallback(() => {
    if (isSidebarLayout) {
      setSidebarOpen(true);
      return;
    }

    navigation.dispatch(DrawerActions.openDrawer());
  }, [isSidebarLayout, setSidebarOpen, navigation]);
};

export const useMenuHeaderOptions = (
  title = '',
): NativeStackNavigationOptions => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { isSidebarLayout, isSidebarShown } = useSidebar();
  const openMenu = useOpenMenu();

  return useMemo<NativeStackNavigationOptions>(() => {
    const showMenuButton = !isSidebarShown;
    const shared: NativeStackNavigationOptions = {
      title,
      headerTransparent: true,
      headerShadowVisible: false,
      scrollEdgeEffects: { top: 'hidden' },
      headerTintColor: colors.onSurface,
      headerTitleStyle: { color: colors.onSurface },
      headerBackVisible: false,
    };

    if (!isIOS) {
      return {
        ...shared,
        headerLeft: showMenuButton
          ? () => (
              <MenuToggleButton
                onPress={openMenu}
                style={title ? styles.androidButtonBesideTitle : undefined}
              />
            )
          : undefined,
      };
    }

    return {
      ...shared,
      ...(showMenuButton && {
        unstable_headerLeftItems: () =>
          isSidebarLayout
            ? [
                {
                  type: 'custom',
                  element: <MenuToggleButton onPress={openMenu} />,
                  hidesSharedBackground: true,
                },
              ]
            : [
                {
                  type: 'button',
                  label: t('navigation.openMenu'),
                  icon: { type: 'sfSymbol', name: 'line.3.horizontal' },
                  onPress: openMenu,
                },
              ],
      }),
    };
  }, [title, t, colors.onSurface, isSidebarLayout, isSidebarShown, openMenu]);
};

// Screens pushed inside a menu screen's stack (Settings > Language, Chat > Downloaded Models)
export const usePushedScreenOptions = (): NativeStackNavigationOptions => {
  const { colors } = useStyled();

  return useMemo<NativeStackNavigationOptions>(
    () => ({
      headerTransparent: true,
      headerShadowVisible: false,
      scrollEdgeEffects: { top: 'hidden' },
      headerTintColor: colors.onSurface,
      headerTitleStyle: { color: colors.onSurface },
      headerBackButtonDisplayMode: 'minimal',
    }),
    [colors.onSurface],
  );
};

const styles = StyleSheet.create({
  androidButtonBesideTitle: {
    marginRight: Spacings.lg,
  },
});
