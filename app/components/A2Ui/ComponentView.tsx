// Renders one A2UI component against the surface's context — the switch that
// turns the declarative component tree into React Native views. Children are
// looked up by id in the surface's flat component table (`byId`); a List
// re-renders its template once per data item with the item as the binding
// scope. `depth` bounds the walk so a cyclic id chain degrades to a null
// render instead of a stack overflow.

import React, { useState } from 'react';
import {
  Image as RNImage,
  Pressable,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { useStyled } from 'hooks';
import { Spacings } from 'style';
import { PlatformIcon } from '../PlatformIcon/PlatformIcon';
import { SelectablePill } from '../SelectablePill/SelectablePill';
import { Text } from '../Text/Text';

import { bindingPath } from '../../services/a2ui/bindings';
import {
  A2UiList,
  A2UiSlider,
  A2UiTextInput,
  type A2UiComponent,
} from '../../services/a2ui/types';
import { useA2UiContext, A2UiContextProvider } from './A2UiContext';
import { styles } from './styles';

const MAX_DEPTH = 24;

// The component an id resolves to. A dangling id (validated away at tool time,
// but a persisted surface could still hold one) renders a visible placeholder
// rather than silently disappearing.
const missingComponent = (id: string): A2UiComponent => ({
  component: 'Text',
  id: `${id}-missing`,
  text: `[unknown component ${id}]`,
});

interface ComponentViewProps {
  component: A2UiComponent;
  /** Binding scope: the surface data model at the top, a List item inside a template. */
  scope?: unknown;
  depth?: number;
}

export const ComponentView: React.FC<ComponentViewProps> = ({
  component,
  scope,
  depth = 0,
}) => {
  const { colors } = useStyled();
  const context = useA2UiContext();

  if (depth >= MAX_DEPTH) {
    return null;
  }

  switch (component.component) {
    case 'Text': {
      const resolved = context.resolveValue(component.text, scope);
      const text = resolved === null || resolved === undefined
        ? ''
        : String(resolved);
      if (text === '') {
        return null;
      }
      return (
        <Text
          variant={component.variant === 'caption' ? 'caption' : 'body2'}
          style={context.textColor ? { color: context.textColor } : undefined}
        >
          {text}
        </Text>
      );
    }

    case 'Image': {
      const url = context.resolveValue(component.url, scope);
      if (typeof url !== 'string' || url === '') {
        return null;
      }
      const size = imageSize(component.variant);
      const imageStyle = [
        styles.image,
        size,
        component.variant === 'avatar' ? { borderRadius: size.width / 2 } : {},
      ];
      return (
        <RNImage
          source={{ uri: url }}
          accessibilityLabel={
            typeof component.description === 'string'
              ? component.description
              : undefined
          }
          resizeMode={component.fit === 'cover' ? 'cover' : 'contain'}
          style={imageStyle}
        />
      );
    }

    case 'Row':
    case 'Column': {
      const isRow = component.component === 'Row';
      const containerStyle = layoutStyle(isRow, component.justify, component.align);
      return (
        <View style={containerStyle}>
          {component.children.map(id => {
            const child = context.byId.get(id) ?? missingComponent(id);
            const weight = weightOf(child);
            const childStyle = weight !== undefined ? { flex: weight } : undefined;
            return (
              <View key={id} style={childStyle}>
                <ComponentView component={child} scope={scope} depth={depth + 1} />
              </View>
            );
          })}
        </View>
      );
    }

    case 'List': {
      return (
        <ListView component={component} scope={scope} depth={depth} />
      );
    }

    case 'Card': {
      const cardStyle = [
        styles.card,
        { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
      ];
      const child = context.byId.get(component.child) ?? missingComponent(component.child);
      return (
        <View style={cardStyle}>
          <View style={styles.cardChild}>
            <ComponentView component={child} scope={scope} depth={depth + 1} />
          </View>
        </View>
      );
    }

    case 'Divider': {
      const horizontal = component.axis !== 'vertical';
      const dividerStyle = [
        styles.divider,
        { backgroundColor: colors.border },
        horizontal ? styles.dividerHorizontal : styles.dividerVertical,
      ];
      return <View style={dividerStyle} />;
    }

    case 'Button': {
      const primary = component.variant === 'primary';
      const borderless = component.variant === 'borderless';
      const buttonStyle: ViewStyle[] = [
        styles.button,
        {
          backgroundColor: primary
            ? colors.ctaSurfacePrimary
            : borderless
              ? 'transparent'
              : colors.surfaceContainer,
          alignSelf: borderless ? 'flex-start' : 'stretch',
        },
      ];
      const child = context.byId.get(component.child) ?? missingComponent(component.child);
      return (
        <Pressable
          accessibilityRole="button"
          onPress={() => context.onAction(component.action)}
          style={({ pressed }) => [
            buttonStyle,
            pressed && styles.buttonPressed,
          ]}
        >
          <A2UiContextProvider
            value={{
              ...context,
              textColor: primary ? colors.ctaContentPrimary : undefined,
            }}
          >
            <ComponentView component={child} scope={scope} depth={depth + 1} />
          </A2UiContextProvider>
        </Pressable>
      );
    }

    case 'TextField': {
      return <TextFieldView component={component} scope={scope} />;
    }

    case 'CheckBox': {
      return <CheckBoxView component={component} scope={scope} />;
    }

    case 'Slider': {
      return <SliderView component={component} scope={scope} />;
    }

    case 'ChoicePicker': {
      return <ChoicePickerView component={component} scope={scope} />;
    }

    default:
      return null;
  }
};

// --- Shared view helpers ----------------------------------------------------

const layoutStyle = (
  isRow: boolean,
  justify: string | undefined,
  align: string | undefined,
): ViewStyle => ({
  flexDirection: isRow ? 'row' : 'column',
  justifyContent: justifyEdge(justify),
  alignItems: alignEdge(align),
  rowGap: Spacings.xs,
  columnGap: Spacings.xs,
});

const justifyEdge = (justify: string | undefined): ViewStyle['justifyContent'] => {
  switch (justify) {
    case 'center': return 'center';
    case 'end': return 'flex-end';
    case 'spaceBetween': return 'space-between';
    case 'spaceAround': return 'space-around';
    case 'spaceEvenly': return 'space-evenly';
    default: return 'flex-start';
  }
};

const alignEdge = (align: string | undefined): ViewStyle['alignItems'] => {
  switch (align) {
    case 'center': return 'center';
    case 'end': return 'flex-end';
    case 'stretch': return 'stretch';
    default: return 'flex-start';
  }
};

const weightOf = (component: A2UiComponent): number | undefined =>
  'weight' in component && typeof component.weight === 'number'
    ? component.weight
    : undefined;

const imageSize = (
  variant: string | undefined,
): { width: number; height: number } => {
  switch (variant) {
    case 'avatar': return { width: 40, height: 40 };
    case 'smallFeature': return { width: 88, height: 88 };
    case 'mediumFeature': return { width: 140, height: 140 };
    case 'largeFeature': return { width: 220, height: 220 };
    default: return { width: 96, height: 96 };
  }
};

// --- Bindable value state ---------------------------------------------------
// A component whose value the user can edit (TextField/CheckBox/Slider/
// ChoicePicker). Literals go to local state; bindings write through to the
// surface's shadow map, so the wire path stays the source of truth.

const useEditableValue = <T,>(
  value: T | { '@path': string },
): [T, (next: T) => void] => {
  const { resolveValue, setValue } = useA2UiContext();
  const path = bindingPath(value);
  const [local, setLocal] = useState<T>(() => resolveValue(value) as T);

  if (path !== null) {
    return [resolveValue(value) as T, next => setValue(path, next)];
  }
  return [local as T, setLocal];
};

// --- Per-component views ----------------------------------------------------

const ListView: React.FC<{
  component: A2UiList;
  scope?: unknown;
  depth: number;
}> = ({ component, scope, depth }) => {
  const { byId, resolveValue } = useA2UiContext();
  const items = resolveValue({ '@path': component.children.path }, scope);

  if (!Array.isArray(items)) {
    return null;
  }
  const template = byId.get(component.children.componentId) ?? missingComponent(component.children.componentId);
  const horizontal = component.direction === 'horizontal';
  const containerStyle: ViewStyle[] = [
    styles.parentChild,
    { flexDirection: horizontal ? 'row' : 'column' },
  ];

  return (
    <View style={containerStyle}>
      {items.map((item, index) => (
        <ComponentView
          key={`${component.id}-${index}`}
          component={template}
          scope={item}
          depth={depth + 1}
        />
      ))}
    </View>
  );
};

const TextFieldView: React.FC<{
  component: A2UiTextInput;
  scope?: unknown;
}> = ({ component, scope }) => {
  const { colors } = useStyled();
  const { resolveValue } = useA2UiContext();
  const [value, setValue] = useEditableValue(component.value);
  const label = component.label === undefined ? undefined : resolveValue(component.label, scope);
  const placeholder =
    component.placeholder === undefined
      ? undefined
      : resolveValue(component.placeholder, scope);
  const multiline = component.variant === 'longText';
  const fieldStyle = [
    styles.field,
    {
      color: colors.onSurface,
      borderColor: colors.border,
      backgroundColor: colors.surface,
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
        multiline={multiline}
        secureTextEntry={component.variant === 'obscured'}
        keyboardType={component.variant === 'number' ? 'numeric' : 'default'}
        value={String(value ?? '')}
        onChangeText={setValue}
        placeholder={placeholder === null || placeholder === undefined ? undefined : String(placeholder)}
        placeholderTextColor={colors.onSurfaceDisabled}
        style={fieldStyle}
      />
    </View>
  );
};

const CheckBoxView: React.FC<{
  component: A2UiComponent & { component: 'CheckBox' };
  scope?: unknown;
}> = ({ component, scope }) => {
  const { colors } = useStyled();
  const { resolveValue } = useA2UiContext();
  const [checked, setChecked] = useEditableValue(component.value);
  const label = resolveValue(component.label, scope);
  const boxStyle = [
    styles.checkboxBox,
    {
      borderColor: checked ? colors.ctaSurfacePrimary : colors.borderSecondary,
      backgroundColor: checked ? colors.ctaSurfacePrimary : 'transparent',
    },
  ];

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => setChecked(!checked)}
      style={({ pressed }) => [styles.checkboxRow, pressed && styles.buttonPressed]}
    >
      <View style={boxStyle}>
        {checked && (
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

const SliderView: React.FC<{
  component: A2UiSlider;
  scope?: unknown;
}> = ({ component, scope }) => {
  const { colors } = useStyled();
  const { resolveValue } = useA2UiContext();
  const [value, setValue] = useEditableValue(component.value);
  const label = component.label === undefined ? undefined : resolveValue(component.label, scope);
  const min = typeof component.min === 'number' ? component.min : 0;
  const max = component.max;
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
            step={typeof component.steps === 'number' && component.steps > 0 ? component.steps : 1}
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

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const abbreviateNumber = (value: number): string =>
  value >= 1000 ? `${Math.round(value / 1000)}k` : String(Math.round(value));

// A tiny horizontal slider. The chat list and the settings screen both scroll,
// so this is intentionally PanResponder-free: a plain Pressable track that
// snaps on tap rather than dragging. It supports everything the A2UI Slider
// grammar needs and stays out of the list's gesture recognizers.
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
  };
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

const ChoicePickerView: React.FC<{
  component: A2UiComponent & { component: 'ChoicePicker' };
  scope?: unknown;
}> = ({ component, scope }) => {
  const { colors } = useStyled();
  const { resolveValue } = useA2UiContext();
  const [selected, setSelected] = useEditableValue<string[]>(component.value);
  const label = component.label === undefined ? undefined : resolveValue(component.label, scope);
  const multi = component.variant === 'multipleSelection';
  const chips = component.displayStyle === 'chips';
  const values = Array.isArray(selected) ? selected : [];
  const captionStyle = { color: colors.onSurfaceVariant };

  const toggle = (value: string) => {
    const next = multi
      ? values.includes(value)
        ? values.filter(v => v !== value)
        : [...values, value]
      : [value];
    setSelected(next);
  };

  return (
    <View style={styles.choiceContainer}>
      {label !== undefined && label !== null && label !== '' && (
        <Text variant="caption" style={captionStyle}>
          {String(label)}
        </Text>
      )}
      <View style={chips ? styles.chipsRow : undefined}>
        {component.options.map(option => {
          const optionValue = typeof option.value === 'string' ? option.value : String(option.value);
          const resolvedLabel = resolveValue(option.label, scope);
          const isSelected = values.includes(optionValue);

          if (chips) {
            return (
              <SelectablePill
                key={optionValue}
                label={String(resolvedLabel ?? '')}
                selected={isSelected}
                onPress={() => toggle(optionValue)}
              />
            );
          }

          const boxStyle = [
            styles.checkboxBox,
            {
              borderColor: isSelected ? colors.ctaSurfacePrimary : colors.borderSecondary,
              backgroundColor: isSelected ? colors.ctaSurfacePrimary : 'transparent',
            },
          ];
          return (
            <Pressable
              key={optionValue}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              onPress={() => toggle(optionValue)}
              style={({ pressed }) => [styles.choiceRow, pressed && styles.buttonPressed]}
            >
              <View style={boxStyle}>
                {isSelected && (
                  <PlatformIcon
                    iosIconName="checkmark"
                    androidIconName="check"
                    size={14}
                    color={colors.ctaContentPrimary}
                  />
                )}
              </View>
              <Text variant="body2">{String(resolvedLabel ?? '')}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};
