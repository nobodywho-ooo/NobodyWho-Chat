import React, { ReactNode } from 'react';
import { View } from 'react-native';

import type { ChatColumn } from '../../hooks/useChatColumn';

interface ContentColumnProps {
  column: ChatColumn;
  children: ReactNode;
}

// Places chat content (a message row, the input bar) in the chat's column. See
// useChatColumn.
// box-none: the input bar overlays the message list, so the empty margins must
// let touches through.
export const ContentColumn: React.FC<ContentColumnProps> = ({
  column,
  children,
}) => (
  <View
    style={{
      paddingLeft: column.paddingLeft,
      paddingRight: column.paddingRight,
    }}
    pointerEvents="box-none"
  >
    {children}
  </View>
);
