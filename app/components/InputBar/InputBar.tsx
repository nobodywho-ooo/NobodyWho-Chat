import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleProp,
  ViewStyle,
} from 'react-native';
import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';
import { MaterialSymbol, SFSymbol } from '@react-navigation/native';
import { useStyled } from 'hooks';

import { styles, getBoxShadow, INPUT_BAR_HEIGHT } from './InputBar.styles';
import { isIOS } from 'helpers';

const getInputWrapperProps = (isLiquidGlassSupported: boolean) =>
  isLiquidGlassSupported
    ? {
        effect: 'regular' as const,
        interactive: true,
      }
    : {};
interface InputBarProps {
  value: string;
  isStreaming: boolean;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onStop: () => void;
  style?: StyleProp<ViewStyle>;
}

export const InputBar: React.FC<InputBarProps> & { height: number } = ({
  value,
  isStreaming,
  onChangeText,
  onSend,
  onStop,
  style,
}) => {
  const { colors } = useStyled();
  const InputWrapper = isLiquidGlassSupported ? LiquidGlassView : View;

  return (
    <View style={[styles.inputBarOuter, style]}>
      <InputWrapper
        style={[
          styles.inputBarInner,
          !isLiquidGlassSupported && getBoxShadow(colors.shadow),
          !isLiquidGlassSupported && {
            backgroundColor: colors.surfaceSecondary,
          },
        ]}
        {...getInputWrapperProps(isLiquidGlassSupported)}
      >
        <TextInput
          style={[styles.textInput, { color: colors.onSurface }]}
          placeholder="Ask something..."
          placeholderTextColor="#999"
          value={value}
          onChangeText={onChangeText}
          multiline
        />
        <InputBarAction
          isStreaming={isStreaming}
          value={value}
          onSend={onSend}
          onStop={onStop}
        />
      </InputWrapper>
    </View>
  );
};

InputBar.height = INPUT_BAR_HEIGHT;

interface InputBarActionProps {
  isStreaming: boolean;
  value: string;
  onSend: () => void;
  onStop: () => void;
}

const InputBarAction: React.FC<InputBarActionProps> = ({
  isStreaming,
  value,
  onSend,
  onStop,
}) => {
  const { colors } = useStyled();

  if (isStreaming) {
    return (
      <Pressable onPress={onStop}>
        {isIOS ? (
          <SFSymbol name="stop.circle" size={28} color={colors.danger} />
        ) : (
          <MaterialSymbol name="stop_circle" size={28} color={colors.danger} />
        )}
      </Pressable>
    );
  }

  let color = colors.primary;
  let fontWeight: '500' | '600' = '500';

  if (value === '') {
    color = colors.onSurfaceVariant;
    fontWeight = '600';
  }

  return (
    <Pressable onPress={onSend} style={styles.sendButton}>
      <Text
        style={[
          styles.sendButtonText,
          {
            color: color,
            fontWeight: fontWeight,
          },
        ]}
      >
        Send
      </Text>
    </Pressable>
  );
};
