import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

// Kept laid out (a real size, inside the window's width) but far above the
// screen: a zero-size or display:none WebView is throttled or never lays the
// page out on some Android WebView versions, and the parser then finds nothing.
const OFFSCREEN_TOP = -10000;
const OFFSCREEN_HEIGHT = 600;

export default StyleSheet.create({
  hidden: {
    position: 'absolute',
    top: OFFSCREEN_TOP,
    left: 0,
    width: '100%',
    height: OFFSCREEN_HEIGHT,
  },
  revealed: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    elevation: 1000,
  },
  header: {
    paddingBottom: Spacings.md,
    paddingHorizontal: Spacings.xl,
    gap: Spacings.xxs,
  },
  frameOffscreen: {
    flex: 1,
  },
  frame: {
    flex: 1,
    marginHorizontal: Spacings.lg,
    borderRadius: Spacings.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacings.md,
    paddingHorizontal: Spacings.lg,
    paddingTop: Spacings.md,
  },
});
