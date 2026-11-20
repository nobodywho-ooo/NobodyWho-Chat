// Defensive validator for `render_ui` arguments.
//
// Sampling is already constrained to the shape of `A2UI_UI_SCHEMA` by
// nobodywho's tool-call grammar, and `Tool` hands the parsed object over as
// JSON. This pass is the renderer's own gate: it type-checks what the grammar
// could not (id references resolve, enums are real, values have the right
// kind) so a stray-but-schema-valid object degrades to an error the model can
// see and fix, never a crash. The `reason` doubles as the tool result string.

import {
  A2UiAction,
  A2UiChoiceOption,
  A2UiComponent,
  A2UiSurface,
  isA2UiComponentName,
  A2UI_COMPONENTS,
} from './types';

export type Validation =
  | { valid: true; surface: A2UiSurface }
  | { valid: false; reason: string };

type UnknownRecord = Record<string, unknown>;

const IMAGE_FITS = ['contain', 'cover', 'fill', 'none', 'scaleDown'] as const;
type ImageFit = (typeof IMAGE_FITS)[number];
const IMAGE_VARIANTS = [
  'avatar',
  'smallFeature',
  'mediumFeature',
  'largeFeature',
] as const;
type ImageVariant = (typeof IMAGE_VARIANTS)[number];

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const isBinding = (value: unknown): value is { '@path': string } =>
  isRecord(value) && isString(value['@path']);

const describe = (value: unknown): string => {
  if (Array.isArray(value)) return 'an array';
  if (value === null) return 'null';
  return typeof value;
};

export const validateUi = (input: unknown): Validation => {
  if (!isRecord(input) || !('components' in input)) {
    return {
      valid: false,
      reason:
        'render_ui expects a JSON object with a "components" array and an optional "dataModel" object.',
    };
  }

  const errors: string[] = [];
  const rawComponents = input.components;
  const dataModel = isRecord(input.dataModel) ? input.dataModel : {};

  if (!Array.isArray(rawComponents) || rawComponents.length === 0) {
    return {
      valid: false,
      reason: '"components" must be a non-empty array of component objects.',
    };
  }

  const components: A2UiComponent[] = [];
  const byId = new Map<string, A2UiComponent>();

  rawComponents.forEach((raw, index) => {
    const at = `components[${index}]`;
    if (!isRecord(raw)) {
      errors.push(`${at}: expected an object, got ${describe(raw)}.`);
      return;
    }

    const { component, id, ...props } = raw;

    if (!isA2UiComponentName(component)) {
      errors.push(
        `${at}: unknown component "${String(component)}" — supported: ${A2UI_COMPONENTS.join(', ')}.`,
      );
      return;
    }
    if (!isString(id)) {
      errors.push(`${at}: every component needs a non-empty string "id".`);
      return;
    }
    if (byId.has(id)) {
      errors.push(`${at}: duplicate id "${id}".`);
      return;
    }

    const validated = parseComponent(component, id, props, at, errors);
    if (validated !== undefined) {
      byId.set(id, validated);
      components.push(validated);
    }
  });

  if (errors.length > 0) {
    return { valid: false, reason: errors.join(' ') };
  }

  // Reference integrity: every child id must resolve within the flat list, or
  // the renderer would draw a broken frame.
  const referenced = new Set<string>();
  components.forEach(component => {
    switch (component.component) {
      case 'Card':
      case 'Button':
        referenced.add(component.child);
        break;
      case 'Row':
      case 'Column':
        component.children.forEach(child => referenced.add(child));
        break;
      case 'List':
        referenced.add(component.children.componentId);
        break;
    }
  });
  const dangling = [...referenced].filter(id => !byId.has(id));
  if (dangling.length > 0) {
    return {
      valid: false,
      reason: `references to unknown component id(s): ${dangling.map(id => `"${id}"`).join(', ')}.`,
    };
  }

  return { valid: true, surface: { components, dataModel } };
};

const stringOrBinding = (value: unknown): value is string | { '@path': string } =>
  isString(value) || isBinding(value);

const parseComponent = (
  component: A2UiComponent['component'],
  id: string,
  props: UnknownRecord,
  at: string,
  errors: string[],
): A2UiComponent | undefined => {
  const problem = (message: string): undefined => {
    errors.push(`${at} (${component}): ${message}`);
    return undefined;
  };

  const expectStringValue = (value: unknown, what: string): string | undefined => {
    if (stringOrBinding(value)) return undefined;
    return `${what} must be a string or a {"@path": "..."} reference, got ${describe(value)}.`;
  };

  const expectEnum = <T extends string>(
    value: unknown,
    allowed: readonly T[],
    what: string,
  ): string | undefined => {
    if (value === undefined) return undefined;
    if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
      return undefined;
    }
    return `${what} must be one of ${allowed.map(v => `"${v}"`).join(', ')}, got ${describe(value)}.`;
  };

  switch (component) {
    case 'Text': {
      const text = expectStringValue(props.text, 'text');
      const variant = expectEnum(props.variant, ['caption', 'body'], 'variant');
      if (text || variant) return problem([text, variant].filter(Boolean).join(' '));
      return {
        component,
        id,
        text: props.text as string | { '@path': string },
        ...(props.variant === 'caption' || props.variant === 'body'
          ? { variant: props.variant }
          : {}),
        ...(typeof props.weight === 'number' ? { weight: props.weight } : {}),
      };
    }
    case 'Image': {
      const url = expectStringValue(props.url, 'url');
      const description = props.description === undefined
        ? undefined
        : expectStringValue(props.description, 'description');
      const fit = expectEnum(props.fit, IMAGE_FITS, 'fit');
      const variant = expectEnum(props.variant, IMAGE_VARIANTS, 'variant');
      const problems = [url, description, fit, variant].filter(Boolean);
      if (problems.length > 0) return problem(problems.join(' '));
      return {
        component,
        id,
        url: props.url as string | { '@path': string },
        ...(stringOrBinding(props.description)
          ? { description: props.description as string | { '@path': string } }
          : {}),
        ...((IMAGE_FITS as readonly string[]).includes(props.fit as string)
          ? { fit: props.fit as ImageFit }
          : {}),
        ...((IMAGE_VARIANTS as readonly string[]).includes(props.variant as string)
          ? { variant: props.variant as ImageVariant }
          : {}),
        ...(typeof props.weight === 'number' ? { weight: props.weight } : {}),
      };
    }
    case 'Row': {
      return parseRowColumn('Row', id, props, at, errors);
    }
    case 'Column': {
      return parseRowColumn('Column', id, props, at, errors);
    }
    case 'List': {
      const children = props.children;
      if (!isRecord(children)) {
        return problem('children must be an object with "path" and "componentId".');
      }
      const direction = expectEnum(props.direction, ['vertical', 'horizontal'], 'direction');
      const align = expectEnum(props.align, ['start', 'center', 'end', 'stretch'], 'align');
      const problems = [
        isString(children.path) ? undefined : 'children.path must be a non-empty string.',
        isString(children.componentId)
          ? undefined
          : 'children.componentId must be a non-empty string.',
        direction,
        align,
      ].filter((message): message is string => Boolean(message));
      if (problems.length > 0) return problem(problems.join(' '));
      return {
        component,
        id,
        children: {
          path: children.path as string,
          componentId: children.componentId as string,
        },
        ...(props.direction === 'vertical' || props.direction === 'horizontal'
          ? { direction: props.direction }
          : {}),
        ...((['start', 'center', 'end', 'stretch'] as const) as readonly string[]).includes(
          props.align as string,
        )
          ? { align: props.align as 'center' }
          : {},
      };
    }
    case 'Card': {
      if (!isString(props.child)) {
        return problem('child must be a non-empty component id string.');
      }
      return { component, id, child: props.child };
    }
    case 'Divider': {
      const axis = expectEnum(props.axis, ['horizontal', 'vertical'], 'axis');
      if (axis) return problem(axis);
      return {
        component,
        id,
        ...(props.axis === 'horizontal' || props.axis === 'vertical'
          ? { axis: props.axis }
          : {}),
      };
    }
    case 'Button': {
      if (!isString(props.child)) {
        return problem('child must be a non-empty component id string.');
      }
      const action = parseAction(props.action);
      if (action === undefined) {
        return problem('action must be an object with an "event" or an "openUrl" key.');
      }
      const variant = expectEnum(props.variant, ['default', 'primary', 'borderless'], 'variant');
      if (variant) return problem(variant);
      return {
        component,
        id,
        child: props.child,
        action,
        ...(props.variant === 'default' || props.variant === 'primary' || props.variant === 'borderless'
          ? { variant: props.variant }
          : {}),
      };
    }
    case 'TextField': {
      const label = expectStringValue(props.label, 'label');
      const value = expectStringValue(props.value, 'value');
      const placeholder =
        props.placeholder === undefined
          ? undefined
          : expectStringValue(props.placeholder, 'placeholder');
      const variant = expectEnum(
        props.variant,
        ['longText', 'number', 'shortText', 'obscured'],
        'variant',
      );
      const problems = [label, value, placeholder, variant].filter(Boolean);
      if (problems.length > 0) return problem(problems.join(' '));
      return {
        component,
        id,
        label: props.label as string | { '@path': string },
        value: props.value as string | { '@path': string },
        ...(stringOrBinding(props.placeholder)
          ? { placeholder: props.placeholder as string | { '@path': string } }
          : {}),
        ...((['longText', 'number', 'shortText', 'obscured'] as const) as readonly string[]).includes(
          props.variant as string,
        )
          ? { variant: props.variant as 'shortText' }
          : {},
        ...(typeof props.weight === 'number' ? { weight: props.weight } : {}),
      };
    }
    case 'CheckBox': {
      const label = expectStringValue(props.label, 'label');
      const valueOk = typeof props.value === 'boolean' || isBinding(props.value);
      if (label || !valueOk) {
        return problem(
          [
            label,
            valueOk ? undefined : 'value must be a boolean or a {"@path": "..."} reference.',
          ]
            .filter(Boolean)
            .join(' '),
        );
      }
      return {
        component,
        id,
        label: props.label as string | { '@path': string },
        value: props.value as boolean | { '@path': string },
        ...(typeof props.weight === 'number' ? { weight: props.weight } : {}),
      };
    }
    case 'Slider': {
      const max = finiteNumber(props.max, 'max');
      const min = props.min === undefined ? undefined : finiteNumber(props.min, 'min');
      const steps = props.steps === undefined ? undefined : finiteNumber(props.steps, 'steps');
      const label =
        props.label === undefined ? undefined : expectStringValue(props.label, 'label');
      const valueOk = typeof props.value === 'number' || isBinding(props.value);
      const problems = [max, min, steps, label, valueOk ? undefined : 'value must be a number or a {"@path": "..."} reference.']
        .filter(Boolean);
      if (problems.length > 0) return problem(problems.join(' '));
      return {
        component,
        id,
        min: typeof props.min === 'number' ? props.min : 0,
        max: props.max as number,
        value: props.value as number | { '@path': string },
        ...(stringOrBinding(props.label)
          ? { label: props.label as string | { '@path': string } }
          : {}),
        ...(typeof props.steps === 'number' ? { steps: props.steps } : {}),
        ...(typeof props.weight === 'number' ? { weight: props.weight } : {}),
      };
    }
    case 'ChoicePicker': {
      const options = parseOptions(props.options, at, errors);
      if (options === undefined) return undefined;
      const valueOk =
        Array.isArray(props.value)
          ? props.value.every(item => typeof item === 'string')
          : isBinding(props.value);
      const variant = expectEnum(props.variant, ['multipleSelection', 'mutuallyExclusive'], 'variant');
      const displayStyle = expectEnum(props.displayStyle, ['checkbox', 'chips'], 'displayStyle');
      const label =
        props.label === undefined ? undefined : expectStringValue(props.label, 'label');
      const problems = [
        valueOk ? undefined : 'value must be an array of selected value strings or a {"@path": "..."} reference.',
        variant,
        displayStyle,
        label,
      ].filter(Boolean);
      if (problems.length > 0) return problem(problems.join(' '));
      return {
        component,
        id,
        options: options as A2UiChoiceOption[],
        value: props.value as string[] | { '@path': string },
        ...(stringOrBinding(props.label)
          ? { label: props.label as string | { '@path': string } }
          : {}),
        ...(props.variant === 'multipleSelection' || props.variant === 'mutuallyExclusive'
          ? { variant: props.variant }
          : {}),
        ...(props.displayStyle === 'checkbox' || props.displayStyle === 'chips'
          ? { displayStyle: props.displayStyle }
          : {}),
        ...(typeof props.weight === 'number' ? { weight: props.weight } : {}),
      };
    }
  }
};

const finiteNumber = (value: unknown, what: string): string | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return undefined;
  return `${what} must be a number, got ${describe(value)}.`;
};

const parseRowColumn = (
  component: 'Row' | 'Column',
  id: string,
  props: UnknownRecord,
  at: string,
  errors: string[],
): A2UiComponent | undefined => {
  const problem = (message: string): undefined => {
    errors.push(`${at} (${component}): ${message}`);
    return undefined;
  };

  const children = props.children;
  if (!Array.isArray(children) || children.some(item => !isString(item))) {
    return problem('children must be an array of component id strings.');
  }
  const rowJustify = ['center', 'end', 'spaceAround', 'spaceBetween', 'spaceEvenly', 'start', 'stretch'] as const;
  const columnJustify = ['start', 'center', 'end', 'spaceBetween', 'spaceAround', 'spaceEvenly', 'stretch'] as const;
  const align = ['start', 'center', 'end', 'stretch'] as const;

  const justify = component === 'Row'
    ? (rowJustify as readonly string[]).includes(props.justify as string)
      ? props.justify as (typeof rowJustify)[number]
      : undefined
    : (columnJustify as readonly string[]).includes(props.justify as string)
      ? props.justify as (typeof columnJustify)[number]
      : undefined;

  if (props.justify !== undefined && justify === undefined) {
    return problem(
      `justify must be one of ${(component === 'Row' ? rowJustify : columnJustify).map(v => `"${v}"`).join(', ')}, got ${describe(props.justify)}.`,
    );
  }
  if (props.align !== undefined && !(align as readonly string[]).includes(props.align as string)) {
    return problem(
      `align must be one of ${align.map(v => `"${v}"`).join(', ')}, got ${describe(props.align)}.`,
    );
  }

  return {
    component,
    id,
    children: children as string[],
    ...(justify !== undefined ? { justify } : {}),
    ...((align as readonly string[]).includes(props.align as string)
      ? { align: props.align as (typeof align)[number] }
      : {}),
  };
};

const parseAction = (action: unknown): A2UiAction | undefined => {
  if (!isRecord(action)) return undefined;

  if ('event' in action) {
    const event = action.event;
    if (!isRecord(event) || !isString(event.name)) return undefined;
    return {
      event: {
        name: event.name,
        ...('context' in event && isRecord(event.context)
          ? { context: event.context }
          : {}),
      },
    };
  }
  if ('openUrl' in action) {
    const openUrl = action.openUrl;
    if (!isRecord(openUrl) || !stringOrBinding(openUrl.url)) return undefined;
    return { openUrl: { url: openUrl.url as string | { '@path': string } } };
  }
  return undefined;
};

const parseOptions = (
  options: unknown,
  at: string,
  errors: string[],
): A2UiChoiceOption[] | undefined => {
  if (!Array.isArray(options)) {
    errors.push(`${at} (ChoicePicker): options must be an array of {"label", "value"} objects.`);
    return undefined;
  }
  const parsed: A2UiChoiceOption[] = [];
  let failed = false;
  options.forEach((option, index) => {
    if (!isRecord(option) || !isString(option.value)) {
      errors.push(`${at} (ChoicePicker): options[${index}] needs a string "value".`);
      failed = true;
      return;
    }
    if (!stringOrBinding(option.label)) {
      errors.push(`${at} (ChoicePicker): options[${index}].label must be a string or a {"@path": "..."} reference.`);
      failed = true;
      return;
    }
    parsed.push({
      label: option.label as string | { '@path': string },
      value: option.value as string,
    });
  });
  return failed ? undefined : parsed;
};
