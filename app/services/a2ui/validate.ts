// Lenient validator for `render_ui` arguments.
//
// Sampling is already constrained to the shape of `A2UI_UI_SCHEMA` by
// nobodywho's tool-call grammar, so most of what arrives is structurally
// sound. What the grammar can't check — enum spellings, optional-property
// types, nested shapes — is where small local models slip. Failing the whole
// card on any of those turns a reasonable UI into a raw JSON blob. So this
// pass is deliberately lenient: it normalizes what it can, skips what it
// can't, and reports recoverable problems as `warnings` while still returning
// a renderable surface. It only refuses outright when it cannot build a
// surface at all (e.g. "components" missing or not an array).
//
// Components nest by value (no id registry), so there is no cross-reference
// integrity step — a card either renders or skips a bad subtree.

import {
  A2UiAction,
  A2UiCheckRule,
  A2UiChoiceOption,
  A2UiComponent,
  A2UiSurface,
  A2UiTab,
  isA2UiComponentName,
  A2UI_COMPONENTS,
} from './types';

export type Validation =
  | { valid: true; surface: A2UiSurface; warnings: string[] }
  | { valid: false; reason: string; warnings: string[] };

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
  const warnings: string[] = [];

  if (!isRecord(input) || !('components' in input)) {
    return {
      valid: false,
      warnings,
      reason:
        'render_ui expects a JSON object with a "components" array and an optional "dataModel" object.',
    };
  }

  const rawComponents = input.components;
  const dataModel = isRecord(input.dataModel) ? input.dataModel : {};

  if (!Array.isArray(rawComponents)) {
    return {
      valid: false,
      warnings,
      reason: '"components" must be an array of component objects.',
    };
  }

  if (rawComponents.length === 0) {
    warnings.push(
      '"components" is empty — call render_ui again with at least one component.',
    );
  }

  const components: A2UiComponent[] = [];
  rawComponents.forEach((raw, index) => {
    const at = `components[${index}]`;
    const parsed =
      isRecord(raw) && 'component' in raw
        ? parseComponent(raw, at, warnings)
        : undefined;
    if (parsed !== undefined) {
      components.push(parsed);
    } else if (isRecord(raw)) {
      warnings.push(
        `${at}: not a supported component (${describe(Object.keys(raw))}) — skipped.`,
      );
    } else {
      warnings.push(`${at}: expected an object, got ${describe(raw)} — skipped.`);
    }
  });

  if (components.length === 0 && warnings.length === 0) {
    return {
      valid: false,
      warnings,
      reason: '"components" contained no renderable components.',
    };
  }

  return { valid: true, surface: { components, dataModel }, warnings };
};

const stringOrBinding = (value: unknown): value is string | { '@path': string } =>
  isString(value) || isBinding(value);

// Like stringOrBinding, but allows an empty string literal — an empty form
// value is legitimate (a TextField started blank), while an '@path' still
// must be non-empty.
const dynamicString = (value: unknown): value is string | { '@path': string } =>
  typeof value === 'string' || isBinding(value);

const parseComponent = (
  raw: UnknownRecord,
  at: string,
  warnings: string[],
): A2UiComponent | undefined => {
  const { component, ...props } = raw;
  const problem = (message: string): undefined => {
    warnings.push(`${at}: ${message}`);
    return undefined;
  };

  if (!isA2UiComponentName(component)) {
    warnings.push(
      `${at}: unknown component "${String(component)}" — supported: ${A2UI_COMPONENTS.join(', ')}. Skipped.`,
    );
    return undefined;
  }

  const expectStringValue = (value: unknown, what: string): string | undefined => {
    if (dynamicString(value)) return undefined;
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

  const childAt = (child: unknown): string =>
    `${at}.${isRecord(child) && 'component' in child ? String(child.component) : 'child'}`;

  const parseChildren = (children: unknown): A2UiComponent[] | undefined => {
    if (!Array.isArray(children)) {
      problem('children must be an array of component objects.');
      return undefined;
    }
    if (children.length === 0) {
      warnings.push(`${at}: children is empty — nothing to show inside.`);
    }
    const parsed: A2UiComponent[] = [];
    children.forEach((child, index) => {
      const childAtth = `${at}[${index}]`;
      if (!isRecord(child)) {
        warnings.push(
          `${childAtth}: expected a component object, got ${isString(child) ? JSON.stringify(child) : describe(child)} — skipped.`,
        );
        return;
      }
      const childParsed = parseComponent(child, childAtth, warnings);
      if (childParsed !== undefined) parsed.push(childParsed);
    });
    return parsed;
  };

  switch (component) {
    case 'Text': {
      const text = expectStringValue(props.text, 'text');
      if (text) return problem(text);
      const variant = expectEnum(props.variant, ['caption', 'body'], 'variant');
      if (variant) warnings.push(`${at} (Text): ${variant} — using the default.`);
      return {
        component,
        text: props.text as string | { '@path': string },
        ...(props.variant === 'caption' || props.variant === 'body'
          ? { variant: props.variant }
          : {}),
        ...(typeof props.weight === 'number' ? { weight: props.weight } : {}),
      };
    }
    case 'Icon': {
      if (typeof props.name !== 'string' || props.name.length === 0) {
        return problem('name must be a non-empty icon name string.');
      }
      const variant = expectEnum(props.variant, ['small', 'medium', 'large'], 'variant');
      if (variant) warnings.push(`${at} (Icon): ${variant} — using the default.`);
      return {
        component,
        name: props.name,
        ...(props.variant === 'small' || props.variant === 'medium' || props.variant === 'large'
          ? { variant: props.variant }
          : {}),
        ...(typeof props.weight === 'number' ? { weight: props.weight } : {}),
      };
    }
    case 'Image': {
      const url = expectStringValue(props.url, 'url');
      if (url) return problem(url);
      const description =
        props.description === undefined
          ? undefined
          : expectStringValue(props.description, 'description');
      const fit = expectEnum(props.fit, IMAGE_FITS, 'fit');
      const variant = expectEnum(props.variant, IMAGE_VARIANTS, 'variant');
      [description, fit, variant]
        .filter((message): message is string => Boolean(message))
        .forEach(message => warnings.push(`${at} (Image): ${message}`));
      return {
        component,
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
      return parseRowColumn('Row', props, at, warnings, parseChildren);
    }
    case 'Column': {
      return parseRowColumn('Column', props, at, warnings, parseChildren);
    }
    case 'List': {
      const children = props.children;
      if (!isRecord(children)) {
        return problem('children must be an object with "path" and "component".');
      }
      if (!isString(children.path)) {
        return problem('children.path must be a non-empty string.');
      }
      const template = isRecord(children.component)
        ? parseComponent(children.component, `${at}.component`, warnings)
        : undefined;
      if (template === undefined) {
        return problem('children.component must be a supported component object.');
      }
      const direction = expectEnum(props.direction, ['vertical', 'horizontal'], 'direction');
      const align = expectEnum(props.align, ['start', 'center', 'end', 'stretch'], 'align');
      [direction, align]
        .filter((message): message is string => Boolean(message))
        .forEach(message => warnings.push(`${at} (List): ${message}`));
      return {
        component,
        children: { path: children.path as string, component: template },
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
      const child = isRecord(props.child)
        ? parseComponent(props.child, childAt(props.child), warnings)
        : undefined;
      if (child === undefined) {
        return problem('child must be a supported component object.');
      }
      return { component, child };
    }
    case 'Divider': {
      const axis = expectEnum(props.axis, ['horizontal', 'vertical'], 'axis');
      if (axis) warnings.push(`${at} (Divider): ${axis} — using the default.`);
      return {
        component,
        ...(props.axis === 'horizontal' || props.axis === 'vertical'
          ? { axis: props.axis }
          : {}),
      };
    }
    case 'Button': {
      const child = isRecord(props.child)
        ? parseComponent(props.child, childAt(props.child), warnings)
        : undefined;
      if (child === undefined) {
        return problem('child must be a supported component object.');
      }
      const action = parseAction(props.action);
      if (action === undefined) {
        return problem('action must be an object with an "event" or an "openUrl" key.');
      }
      const variant = expectEnum(props.variant, ['default', 'primary', 'borderless'], 'variant');
      if (variant) warnings.push(`${at} (Button): ${variant} — using the default.`);
      return {
        component,
        child,
        action,
        ...(props.variant === 'default' || props.variant === 'primary' || props.variant === 'borderless'
          ? { variant: props.variant }
          : {}),
      };
    }
    case 'TextField': {
      const label = expectStringValue(props.label, 'label');
      const value = expectStringValue(props.value, 'value');
      if (label || value) return problem([label, value].filter(Boolean).join(' '));
      const placeholder =
        props.placeholder === undefined
          ? undefined
          : expectStringValue(props.placeholder, 'placeholder');
      const variant = expectEnum(
        props.variant,
        ['longText', 'number', 'shortText', 'obscured'],
        'variant',
      );
      [placeholder, variant]
        .filter((message): message is string => Boolean(message))
        .forEach(message => warnings.push(`${at} (TextField): ${message}`));
      const checks = parseChecks(props['@checks'], at, warnings);
      return {
        component,
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
        ...(checks.length > 0 ? { '@checks': checks } : {}),
        ...(typeof props.weight === 'number' ? { weight: props.weight } : {}),
      };
    }
    case 'CheckBox': {
      const label = expectStringValue(props.label, 'label');
      if (label) return problem(label);
      if (typeof props.value !== 'boolean' && !isBinding(props.value)) {
        return problem('value must be a boolean or a {"@path": "..."} reference.');
      }
      return {
        component,
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
      if (max) return problem(max);
      const valueOk = typeof props.value === 'number' || isBinding(props.value);
      if (!valueOk) return problem('value must be a number or a {"@path": "..."} reference.');
      [min, steps, label]
        .filter((message): message is string => Boolean(message))
        .forEach(message => warnings.push(`${at} (Slider): ${message}`));
      return {
        component,
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
      const options = parseOptions(props.options, at, warnings);
      if (options === undefined) return undefined;
      const valueOk =
        Array.isArray(props.value)
          ? props.value.every(item => typeof item === 'string')
          : isBinding(props.value);
      if (!valueOk) {
        return problem(
          'value must be an array of selected value strings or a {"@path": "..."} reference.',
        );
      }
      const variant = expectEnum(props.variant, ['multipleSelection', 'mutuallyExclusive'], 'variant');
      const displayStyle = expectEnum(props.displayStyle, ['checkbox', 'chips'], 'displayStyle');
      const label =
        props.label === undefined ? undefined : expectStringValue(props.label, 'label');
      [variant, displayStyle, label]
        .filter((message): message is string => Boolean(message))
        .forEach(message => warnings.push(`${at} (ChoicePicker): ${message}`));
      return {
        component,
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
    case 'Tabs': {
      const rawTabs = props.tabs;
      if (!Array.isArray(rawTabs)) {
        return problem('tabs must be an array of {"title", "child"} objects.');
      }
      const tabs: A2UiTab[] = [];
      rawTabs.forEach((rawTab, index) => {
        if (!isRecord(rawTab)) {
          warnings.push(`${at} (Tabs)[${index}]: expected an object — skipped.`);
          return;
        }
        if (stringOrBinding(rawTab.title) === false) {
          warnings.push(`${at} (Tabs)[${index}]: title must be a string or a {"@path": "..."} reference — tab skipped.`);
          return;
        }
        const child = isRecord(rawTab.child)
          ? parseComponent(rawTab.child, `${at} (Tabs)[${index}].child`, warnings)
          : undefined;
        if (child === undefined) {
          warnings.push(`${at} (Tabs)[${index}]: child must be a supported component object — tab skipped.`);
          return;
        }
        tabs.push({ title: rawTab.title as string | { '@path': string }, child });
      });
      if (tabs.length === 0) {
        return problem('tabs must contain at least one usable tab.');
      }
      return { component, tabs };
    }
  }
};

const parseChecks = (
  checks: unknown,
  at: string,
  warnings: string[],
): A2UiCheckRule[] => {
  if (checks === undefined) {
    return [];
  }
  if (!Array.isArray(checks)) {
    warnings.push(`${at} (TextField): @checks must be an array — ignored.`);
    return [];
  }
  const parsed: A2UiCheckRule[] = [];
  checks.forEach((check, index) => {
    if (!isRecord(check)) {
      warnings.push(`${at} (TextField) @checks[${index}]: expected an object — skipped.`);
      return;
    }
    const condition = check.condition;
    if (
      condition !== 'required' &&
      condition !== 'numeric' &&
      condition !== 'email'
    ) {
      warnings.push(
        `${at} (TextField) @checks[${index}]: condition must be required|numeric|email — skipped.`,
      );
      return;
    }
    if (check.message !== undefined && !stringOrBinding(check.message)) {
      warnings.push(`${at} (TextField) @checks[${index}]: message must be a string — skipped.`);
      return;
    }
    parsed.push({
      condition,
      ...(stringOrBinding(check.message)
        ? { message: check.message as string | { '@path': string } }
        : {}),
    });
  });
  return parsed;
};

const finiteNumber = (value: unknown, what: string): string | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return undefined;
  return `${what} must be a number, got ${describe(value)}.`;
};

const parseRowColumn = (
  component: 'Row' | 'Column',
  props: UnknownRecord,
  at: string,
  warnings: string[],
  parseChildren: (children: unknown) => A2UiComponent[] | undefined,
): A2UiComponent | undefined => {
  const children = parseChildren(props.children);
  if (children === undefined) return undefined;

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
    warnings.push(
      `${at}: justify must be one of ${(component === 'Row' ? rowJustify : columnJustify).map(v => `"${v}"`).join(', ')}, got ${describe(props.justify)}. Using the default.`,
    );
  }
  if (props.align !== undefined && !(align as readonly string[]).includes(props.align as string)) {
    warnings.push(
      `${at}: align must be one of ${align.map(v => `"${v}"`).join(', ')}, got ${describe(props.align)}. Using the default.`,
    );
  }

  return {
    component,
    children,
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
  warnings: string[],
): A2UiChoiceOption[] | undefined => {
  if (!Array.isArray(options)) {
    warnings.push(
      `${at} (ChoicePicker): options must be an array of {"label", "value"} objects — component skipped.`,
    );
    return undefined;
  }
  const parsed: A2UiChoiceOption[] = [];
  let failed = false;
  options.forEach((option, index) => {
    if (!isRecord(option) || !isString(option.value)) {
      warnings.push(
        `${at} (ChoicePicker): options[${index}] needs a string "value" — option skipped.`,
      );
      return;
    }
    if (!stringOrBinding(option.label)) {
      warnings.push(
        `${at} (ChoicePicker): options[${index}].label must be a string or a {"@path": "..."} reference — option skipped.`,
      );
      return;
    }
    parsed.push({
      label: option.label as string | { '@path': string },
      value: option.value as string,
    });
  });
  return failed ? undefined : parsed;
};