import { StyleSheet } from 'react-native';

import { Spacings } from './Spacings';

export const CONTAINER_PADDING_HORIZONTAL = Spacings.lg;
export const CONTENT_MAX_WIDTH = 560;

// iPad/Duo ratio for chat's messages / input bar
export const WIDE_CONTENT_RATIO = 0.8;
export const WIDE_LAYOUT_MIN_WIDTH = 700;
export const SIDEBAR_WIDTH = 320;

export const PHONE_MAX_WIDTH = 480;
export const DRAWER_MAX_WIDTH = 360;

export const VOICE_DRAWER_MAX_WIDTH = 480;

export default StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: CONTAINER_PADDING_HORIZONTAL,
  },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
});
