import React, { ReactNode, useCallback, useMemo } from 'react';
import { View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ModalBottomSheet,
  type ModalDetent,
} from '@swmansion/react-native-bottom-sheet';
import { useStyled } from 'hooks';
import { Spacings } from 'style';

import { IconButton } from '../IconButton/IconButton';
import { iconButtonSize } from '../IconButton/IconButton.styles';

import styles from './Sheet.styles';

// floating: a card inset from the screen edges, rounded on every corner, with
// a close button in its top-right corner. standard: attached to the bottom
// edge with a grab bar, and expandable to the full height.
export type SheetVariant = 'floating' | 'standard';

// 'content' fits the sheet to its children; a percentage of the screen gives
// scrolling content (a flex: 1 ScrollView) a height to fill, and fades it out
// at the sheet's bottom edge instead of cutting it. Pad the scroll content's
// bottom by useSheetBottomClearance() so its end can scroll clear of the fade.
export type SheetHeight = 'content' | `${number}%`;

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  // Read out for the close button and the scrim behind the sheet.
  closeLabel: string;
  variant?: SheetVariant;
  height?: SheetHeight;
  // Floating sheets get a glass close button in the top-right corner; turn it
  // off for a sheet that draws its own close control in its header.
  showCloseButton?: boolean;
  children: ReactNode;
  testID?: string;
}

const FLOATING_MARGIN = Spacings.md;
// Wide windows (iPad, iPhone Duo open) get a centred column, not a sheet
// spanning the whole width.
const FLOATING_MAX_WIDTH = 480;
const STANDARD_MAX_WIDTH = 640;
const SCRIM_COLOR = 'rgba(0, 0, 0, 0.4)';
const BOTTOM_FADE_HEIGHT = Spacings.xxl;
const CLOSED = 0;
const OPEN = 1;

export const Sheet: React.FC<SheetProps> = ({
  visible,
  onClose,
  closeLabel,
  variant = 'floating',
  height = 'content',
  showCloseButton = true,
  children,
  testID,
}) => {
  const { colors } = useStyled();
  const insets = useSafeAreaInsets();
  const isFloating = variant === 'floating';

  // Side insets include the safe area: iPhone Duo's vertical bar sits on one
  // edge in landscape.
  const margin = isFloating ? FLOATING_MARGIN : 0;
  const left = insets.left + margin;
  const right = insets.right + margin;
  const bottom = isFloating ? Math.max(insets.bottom, FLOATING_MARGIN) : 0;
  const maxWidth =
    (isFloating ? FLOATING_MAX_WIDTH : STANDARD_MAX_WIDTH) + left + right;

  const detents = useMemo<ModalDetent[]>(
    () => [
      CLOSED,
      { value: height, insets: { left, right, bottom } },
      ...(isFloating
        ? []
        : [{ value: '100%' as const, insets: { left, right } }]),
    ],
    [height, left, right, bottom, isFloating],
  );

  // Dragging the sheet down, tapping the scrim and Android's back gesture all
  // land on the closed detent.
  const handleIndexChange = useCallback(
    (index: number) => {
      if (index === CLOSED) {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <ModalBottomSheet
      windowOverlay
      lazy
      index={visible ? OPEN : CLOSED}
      detents={detents}
      onIndexChange={handleIndexChange}
      maxWidth={maxWidth}
      scrimColor={SCRIM_COLOR}
      scrimAccessibilityLabel={closeLabel}
      surface={
        <View style={[styles.surface, { backgroundColor: colors.surface }]} />
      }
      surfaceStyle={
        isFloating ? styles.floatingSurface : styles.standardSurface
      }
    >
      <View style={height !== 'content' && styles.fill} testID={testID}>
        {isFloating && showCloseButton && (
          <IconButton
            icon={{ iosIconName: 'xmark', androidIconName: 'close' }}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            style={styles.closeButton}
            testID={testID && `${testID}-close`}
          />
        )}
        {!isFloating && (
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
        )}
        {children}
        {height !== 'content' && (
          <LinearGradient
            pointerEvents="none"
            colors={[`${colors.surface}00`, colors.surface]}
            style={[
              styles.bottomFade,
              { height: BOTTOM_FADE_HEIGHT + (isFloating ? 0 : insets.bottom) },
            ]}
          />
        )}
      </View>
    </ModalBottomSheet>
  );
};

// Bottom padding for a sheet's scroll content: past the bottom fade and, on a
// standard sheet that reaches the screen's bottom edge, the home indicator.
export const useSheetBottomClearance = (variant: SheetVariant = 'floating') => {
  const insets = useSafeAreaInsets();
  return BOTTOM_FADE_HEIGHT + (variant === 'standard' ? insets.bottom : 0);
};

// Room the floating close button takes at the sheet's top-right corner, for
// content that shares its row (a title) to keep clear of.
export const SHEET_CLOSE_BUTTON_CLEARANCE =
  Spacings.md + iconButtonSize(false) + Spacings.sm;
