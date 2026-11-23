// Renders one OpenUI Lang element against the surface's context — the switch
// that turns the parsed component tree (ElementNode from @openuidev/lang-core)
// into React Native views. Components nest by value (no id registry), so a
// Stack just maps over its children and a List renders each item. `depth`
// bounds the walk so a cyclic tree (only possible via a malformed but
// schema-legal payload) degrades to a null render instead of a stack overflow.

import React, { useState } from 'react';
import {
  Image as RNImage,
  Pressable,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { useStyled } from 'hooks';
import { log } from 'helpers';
import { Spacings } from 'style';
import { PlatformIcon } from '../PlatformIcon/PlatformIcon';
import { SelectablePill } from '../SelectablePill/SelectablePill';
import { Text } from '../Text/Text';
import { platformIconFor } from './icons';

import type { A2UiMapMarker, A2UiMapPoint } from '../../services/a2ui/types';
import { MapView } from './MapView';
import { useA2UiContext, A2UiContextProvider } from './A2UiContext';
import { styles } from './styles';

const MAX_DEPTH = 24;

type ElementNode = {
  typeName: string;
  props: Record<string, unknown>;
  statementId?: string;
  partial?: boolean;
};

const isElement = (value: unknown): value is ElementNode =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  typeof (value as { typeName?: unknown }).typeName === 'string';

interface ElementViewProps {
  node: unknown;
  /** The stream is still writing; a live card may tolerate late fitness. */
  live?: boolean;
  scope?: unknown;
  depth?: number;
}

export const ElementView: React.FC<ElementViewProps> = ({
  node,
  live,
  scope,
  depth = 0,
}) => {
  const { colors } = useStyled();
  const context = useA2UiContext();

  if (depth >= MAX_DEPTH) {
    log('[a2ui] ElementView depth cap hit');
    return null;
  }

  // A non-element child (text, number, array, reference) renders as text.
  if (!isElement(node)) {
    const value = context.evalValue(node);
    if (value === null || value === undefined || value === '') {
      return null;
    }
    return <Text variant="body2">{String(value)}</Text>;
  }

  const el = node;
  const props = el.props;

  switch (el.typeName) {
    case 'TextContent': {
      const text = context.evalValue(props.text);
      if (text === null || text === undefined || text === '') {
        return null;
      }
      return (
        <Text
          variant="body2"
          style={context.textColor ? { color: context.textColor } : undefined}
        >
          {String(text)}
        </Text>
      );
    }

    case 'Stack': {
      const orientation = context.evalValue(props.orientation) as
        | 'vertical'
        | 'horizontal'
        | undefined;
      const gapName = context.evalValue(props.gap) as 'xs' | 'sm' | 'md' | undefined;
      const gap = gapName === 'xs' ? Spacings.xs : gapName === 'md' ? Spacings.md : Spacings.sm;
      const horizontal = orientation === 'horizontal';
      return (
        <View
          style={{
            flexDirection: horizontal ? 'row' : 'column',
            ...(horizontal ? { columnGap: gap } : { rowGap: gap }),
            alignItems: horizontal ? 'center' : 'stretch',
          }}
        >
          {Array.isArray(props.children) && props.children.length === 1 && isElement(props.children[0])
            ? <View key={0} style={horizontal ? undefined : { alignSelf: 'stretch' }}><ElementView node={props.children[0]} scope={scope} depth={depth + 1} /></View>
            : Array.isArray(props.children)
              ? props.children.map((child, index) => (
                  <View
                    key={index}
                    // Stretch so fixed-height children (Image, Map, …) never
                    // collapse to a 1px sliver in a vertical stack.
                    style={horizontal ? undefined : { alignSelf: 'stretch' }}
                  >
                    <ElementView node={child} scope={scope} depth={depth + 1} />
                  </View>
                ))
              : null}
        </View>
      );
    }

    case 'Icon': {
      const name = String(context.evalValue(props.name) ?? '');
      const size = iconSize(context.evalValue(props.size) as string | undefined);
      const platform = platformIconFor(name);
      return (
        <PlatformIcon
          iosIconName={platform.iosIconName}
          androidIconName={platform.androidIconName}
          size={size}
          color={context.textColor ?? colors.onSurface}
        />
      );
    }

    case 'Image': {
      const url = context.evalValue(props.url);
      if (typeof url !== 'string' || url === '') {
        return null;
      }
      const variant = context.evalValue(props.variant) as string | undefined;
      const caption = context.evalValue(props.caption);
      const size = imageSize(variant);
      return (
        <View style={styles.imageContainer}>
          <RNImage
            source={{ uri: url }}
            resizeMode="cover"
            style={[styles.image, size as { width: number; height: number }]}
          />
          {typeof caption === 'string' && caption !== '' && (
            <Text variant="caption" style={styles.imageCaption}>
              {caption}
            </Text>
          )}
        </View>
      );
    }

    case 'Card': {
      const title = context.evalValue(props.title);
      return (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
          ]}
        >
          {typeof title === 'string' && title !== '' && (
            <Text variant="body2" style={styles.cardTitle}>
              {title}
            </Text>
          )}
          <View style={styles.cardChild}>
            {renderChildren(props.children, scope ?? undefined, depth, live)}
          </View>
        </View>
      );
    }

    case 'Divider': {
      return (
        <View
          style={[styles.divider, { backgroundColor: colors.border }, styles.dividerHorizontal]}
        />
      );
    }

    case 'Button': {
      const label = String(context.evalValue(props.label) ?? '');
      const buttonStyle: ViewStyle[] = [
        styles.button,
        { backgroundColor: colors.ctaSurfacePrimary, alignSelf: 'stretch' },
      ];
      return (
        <Pressable
          accessibilityRole="button"
          onPress={() => context.onAction(props.action)}
          style={({ pressed }) => [buttonStyle, pressed && styles.buttonPressed]}
        >
          <A2UiContextProvider
            value={{ ...context, textColor: colors.ctaContentPrimary }}
          >
            <Text variant="body2" style={styles.buttonLabel}>
              {label}
            </Text>
          </A2UiContextProvider>
        </Pressable>
      );
    }

    case 'Input':
      return <InputView props={props} />;

    case 'CheckBox':
      return <CheckBoxView props={props} />;

    case 'Slider':
      return <SliderView props={props} />;

    case 'ChoicePicker':
      return <ChoicePickerView props={props} />;

    case 'List': {
      const items = context.evalValue(props.items);
      const orientation = context.evalValue(props.orientation) as
        | 'vertical'
        | 'horizontal'
        | undefined;
      if (!Array.isArray(items)) {
        log('[a2ui] List items not an array');
        return null;
      }
      const horizontal = orientation === 'horizontal';
      return (
        <View
          style={{
            ...(horizontal
              ? { flexDirection: 'row' as const, columnGap: Spacings.xs }
              : { rowGap: Spacings.xs, alignSelf: 'stretch' as const }),
          }}
        >
          {items.map((item, index) => (
            <View key={index} style={horizontal ? undefined : { alignSelf: 'stretch' }}>
              <ElementView node={item} scope={scope} depth={depth + 1} />
            </View>
          ))}
        </View>
      );
    }

    case 'Tabs': {
      return <TabsView props={props} scope={scope} depth={depth} />;
    }

    case 'Map': {
      const markers = mapMarkersOf(context.evalValue(props.markers));
      const routeRaw = context.evalValue(props.route);
      const route = Array.isArray(routeRaw)
        ? routeRaw.filter(isMapPoint)
        : undefined;
      return (
        <MapView
          markers={markers}
          route={route}
          variant={context.evalValue(props.variant) as 'small' | 'medium' | 'large' | undefined}
        />
      );
    }

    default:
      log('[a2ui] unknown component', el.typeName);
      return null;
  }
};

export default ElementView;

// --- helpers ----------------------------------------------------------------

const renderChildren = (
  children: unknown,
  scope: unknown,
  depth: number,
  live?: boolean,
): React.ReactNode => {
  if (!Array.isArray(children)) {
    return null;
  }
  return children.map((child, index) => (
    <ElementView key={index} node={child} scope={scope} depth={depth + 1} live={live} />
  ));
};

// A component whose value the user can edit (Input/CheckBox/Slider/Choice).
// A reactive `$name` value writes through to the surface state; a literal
// keeps its own local state.
const useFieldState = (
  valueProp: unknown,
): [unknown, (next: unknown) => void] => {
  const { evalValue, getState, setField } = useA2UiContext();
  const refName =
    isExprStateRef(valueProp) ? (valueProp as { n?: string }).n ?? null : null;
  const [local, setLocal] = useState(() =>
    refName !== null ? getState(refName) : evalValue(valueProp),
  );

  if (refName !== null) {
    return [getState(refName), next => setField(refName, next)];
  }
  return [local, setLocal];
};

export const isExprStateRef = (value: unknown): boolean =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  (value as { k?: string }).k === 'StateRef';

const mapMarkersOf = (value: unknown): A2UiMapMarker[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (marker): marker is A2UiMapMarker =>
      marker !== null && typeof marker === 'object',
  );
};

const isMapPoint = (value: unknown): value is A2UiMapPoint =>
  value !== null &&
  typeof value === 'object' &&
  typeof (value as { lat?: unknown }).lat === 'number' &&
  typeof (value as { lon?: unknown }).lon === 'number';

const iconSize = (variant: string | undefined): number => {
  switch (variant) {
    case 'small': return 16;
    case 'large': return 28;
    default: return 22;
  }
};

const imageSize = (variant: string | undefined): ViewStyle => {
  switch (variant) {
    case 'large':
    case 'full': return { width: '100%', height: 180 };
    case 'medium': return { width: 140, height: 140 };
    case 'thumb':
    case 'small':
    default: return { width: 96, height: 96 };
  }
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const abbreviateNumber = (value: number): string =>
  value >= 1000 ? `${Math.round(value / 1000)}k` : String(Math.round(value));

// --- Tabs -------------------------------------------------------------------

const TabsView: React.FC<{
  props: Record<string, unknown>;
  scope?: unknown;
  depth: number;
}> = ({ props, depth }) => {
  const { colors } = useStyled();
  const { evalValue } = useA2UiContext();
  const tabs = evalValue(props.tabs);
  const [active, setActive] = useState(0);
  if (!Array.isArray(tabs) || tabs.length === 0) {
    return null;
  }
  const clampActive = Math.min(active, tabs.length - 1);
  const activeTab = tabs[clampActive] as { label?: unknown; content?: unknown };

  return (
    <View style={styles.tabsContainer}>
      <View style={styles.tabsBar}>
        {tabs.map((tab, index) => {
          const title = evalValue((tab as { label?: unknown }).label);
          const selected = index === clampActive;
          return (
            <Pressable
              key={index}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setActive(index)}
              style={({ pressed }) => [
                styles.tabItem,
                {
                  borderBottomColor: selected
                    ? colors.ctaSurfacePrimary
                    : colors.border,
                },
                pressed && styles.buttonPressed,
              ]}
            >
              <Text
                variant="body2"
                style={[
                  styles.tabTitle,
                  selected && { color: colors.ctaSurfacePrimary },
                ]}
              >
                {String(title ?? '')}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ rowGap: Spacings.xs, alignSelf: 'stretch' }}>
        {renderChildren(activeTab.content, undefined, depth + 1)}
      </View>
    </View>
  );
};

// --- Field components (hooks live at the top: node types must not change
// hook order between renders while streaming) ---------------------------------

const InputView: React.FC<{ props: Record<string, unknown> }> = ({ props }) => {
  const { colors } = useStyled();
  const { evalValue } = useA2UiContext();
  const [value, setValue] = useFieldState(props.value);
  const label = evalValue(props.label);
  const placeholder = evalValue(props.placeholder);
  const inputType = evalValue(props.inputType) as
    | 'text'
    | 'number'
    | 'email'
    | 'password'
    | undefined;
  const fieldStyle = [
    styles.field,
    {
      color: colors.onSurface,
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
  ];
  return (
    <View style={styles.fieldContainer}>
      {label !== undefined && label !== null && label !== '' && (
        <Text variant="caption" style={styles.fieldLabel}>
          {String(label)}
        </Text>
      )}
      <TextInput
        secureTextEntry={inputType === 'password'}
        keyboardType={
          inputType === 'number'
            ? 'numeric'
            : inputType === 'email'
              ? 'email-address'
              : 'default'
        }
        value={String(value ?? '')}
        onChangeText={setValue}
        placeholder={
          placeholder === null || placeholder === undefined
            ? undefined
            : String(placeholder)
        }
        placeholderTextColor={colors.onSurfaceDisabled}
        style={fieldStyle}
      />
    </View>
  );
};

const CheckBoxView: React.FC<{ props: Record<string, unknown> }> = ({ props }) => {
  const { colors } = useStyled();
  const { evalValue } = useA2UiContext();
  const [checked, setChecked] = useFieldState(props.value);
  const checkedValue = Boolean(checked);
  const label = evalValue(props.label);
  const boxStyle = [
    styles.checkboxBox,
    {
      borderColor: checkedValue ? colors.ctaSurfacePrimary : colors.borderSecondary,
      backgroundColor: checkedValue ? colors.ctaSurfacePrimary : 'transparent',
    },
  ];
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: checkedValue }}
      onPress={() => setChecked(!checkedValue)}
      style={({ pressed }) => [styles.checkboxRow, pressed && styles.buttonPressed]}
    >
      <View style={boxStyle}>
        {checkedValue && (
          <PlatformIcon
            iosIconName="checkmark"
            androidIconName="check"
            size={14}
            color={colors.ctaContentPrimary}
          />
        )}
      </View>
      <Text variant="body2">{String(label ?? '')}</Text>
    </Pressable>
  );
};

const SliderView: React.FC<{ props: Record<string, unknown> }> = ({ props }) => {
  const { colors } = useStyled();
  const { evalValue } = useA2UiContext();
  const [value, setValue] = useFieldState(props.value);
  const label = evalValue(props.label);
  const min = Number(evalValue(props.min) ?? 0);
  const max = Number(evalValue(props.max) ?? 100);
  const raw = clamp(Number(value ?? min), min, max);
  const captionStyle = { color: colors.onSurfaceVariant };
  return (
    <View style={styles.sliderRow}>
      {label !== undefined && label !== null && label !== '' && (
        <Text variant="caption" style={captionStyle}>
          {String(label)}
        </Text>
      )}
      <View style={styles.sliderValueRow}>
        <View style={styles.sliderGrow}>
          <SliderTrack
            value={raw}
            min={min}
            max={max}
            step={1}
            onValueChange={setValue}
          />
        </View>
        <Text variant="caption" style={captionStyle}>
          {abbreviateNumber(raw)}
        </Text>
      </View>
    </View>
  );
};

const ChoicePickerView: React.FC<{ props: Record<string, unknown> }> = ({ props }) => {
  const { colors } = useStyled();
  const { evalValue } = useA2UiContext();
  const [selected, setSelected] = useFieldState(props.selected);
  const label = evalValue(props.label);
  const options = evalValue(props.options);
  const selectedValue = selected === null || selected === undefined ? null : String(selected);
  const optionsList: string[] = Array.isArray(options) ? options.map(String) : [];
  return (
    <View style={styles.choiceContainer}>
      {label !== undefined && label !== null && label !== '' && (
        <Text variant="caption" style={{ color: colors.onSurfaceVariant }}>
          {String(label)}
        </Text>
      )}
      <View style={styles.chipsRow}>
        {optionsList.map(option => (
          <SelectablePill
            key={option}
            label={option}
            selected={option === selectedValue}
            onPress={() => setSelected(option)}
          />
        ))}
      </View>
    </View>
  );
};

// --- Slider track (tap-to-set) ----------------------------------------------

const SliderTrack: React.FC<{
  value: number;
  min: number;
  max: number;
  step: number;
  onValueChange: (value: number) => void;
}> = ({ value, min, max, step, onValueChange }) => {
  const { colors } = useStyled();
  const [width, setWidth] = React.useState(0);
  const range = max - min;
  const ratio = range > 0 ? (value - min) / range : 0;
  const trackStyle = [styles.sliderTrack, { backgroundColor: colors.surfaceContainer }];
  const fillStyle = {
    width: `${Math.round(ratio * 100)}%`,
    height: '100%',
    backgroundColor: colors.ctaSurfacePrimary,
    borderRadius: 4,
  } as const;
  const thumbStyle = [
    styles.sliderThumb,
    {
      backgroundColor: colors.ctaSurfacePrimary,
      borderColor: colors.surface,
      left: `${Math.round(ratio * 100)}%`,
    },
  ];

  const pressAt = (event: { nativeEvent: { locationX: number } }) => {
    if (width <= 0) {
      return;
    }
    const next = min + (event.nativeEvent.locationX / width) * range;
    const stepped = Math.round(next / step) * step;
    onValueChange(clamp(stepped, min, max));
  };

  return (
    <Pressable
      accessibilityRole="adjustable"
      accessibilityValue={{ min, max, now: Math.round(value) }}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      onPress={pressAt}
      style={trackStyle}
    >
      <View style={fillStyle} />
      <View style={thumbStyle} />
    </Pressable>
  );
};