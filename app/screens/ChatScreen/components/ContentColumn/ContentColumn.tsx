import React, { ReactNode } from 'react';
import { View } from 'react-native';
import { Layout } from 'style';

interface ContentColumnProps {
  // Larger of the left/right safe-area insets. Applied to both sides so the
  // column stays centred under the header title.
  sideInset: number;
  children: ReactNode;
}

// Centres chat content in a readable column on wide windows (a foldable's inner
// display) and keeps it clear of the side safe-area insets — in landscape the
// status bar is a column on the right edge. A no-op on portrait phones.
// box-none: the input bar overlays the message list, so the empty margins must
// let touches through.
export const ContentColumn: React.FC<ContentColumnProps> = ({
  sideInset,
  children,
}) => (
  <View style={{ paddingHorizontal: sideInset }} pointerEvents="box-none">
    <View style={Layout.content} pointerEvents="box-none">
      {children}
    </View>
  </View>
);
