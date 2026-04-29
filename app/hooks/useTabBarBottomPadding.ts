import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isAndroid } from 'helpers';

const _ANDROID_TAB_BAR_HEIGHT = 80;

export const useTabBarBottomPadding = (): number => {
  const insets = useSafeAreaInsets();
  return isAndroid ? _ANDROID_TAB_BAR_HEIGHT + insets.bottom : 90;
};
