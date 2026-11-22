// A2UI types: the on-device catalog subset rendered by the local model.
//
// Components nest by value (children are full component objects), never by
// id reference. A flat id registry is what small local models fail at — LFM3
// emits Row children that don't exist, and the whole card collapses. So the
// wire format the model writes is a plain JSON tree: a `components` array of
// inline components plus an optional `dataModel` that `{"@path": "/..."}`
// bindings resolve against.

/** A literal value or a reference into the surface's data model. */
export type DynamicValue<T> = T | { '@path': string };

export interface A2UiText {
  component: 'Text';
  text: DynamicValue<string>;
  variant?: 'caption' | 'body';
  weight?: number;
}

export interface A2UiIcon {
  component: 'Icon';
  /** A semantic icon name (e.g. "search", "heart", "settings"); an
   *  unmapped name falls back to a generic help icon. */
  name: string;
  variant?: 'small' | 'medium' | 'large';
  weight?: number;
}

export interface A2UiImage {
  component: 'Image';
  url: DynamicValue<string>;
  description?: DynamicValue<string>;
  fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scaleDown';
  variant?: 'avatar' | 'smallFeature' | 'mediumFeature' | 'largeFeature';
  weight?: number;
}

export interface A2UiRow {
  component: 'Row';
  children: A2UiComponent[];
  justify?:
    | 'center'
    | 'end'
    | 'spaceAround'
    | 'spaceBetween'
    | 'spaceEvenly'
    | 'start'
    | 'stretch';
  align?: 'start' | 'center' | 'end' | 'stretch';
}

export interface A2UiColumn {
  component: 'Column';
  children: A2UiComponent[];
  justify?:
    | 'start'
    | 'center'
    | 'end'
    | 'spaceBetween'
    | 'spaceAround'
    | 'spaceEvenly'
    | 'stretch';
  align?: 'start' | 'center' | 'end' | 'stretch';
}

export interface A2UiList {
  component: 'List';
  /** An inline template rendered once per item of `path`. */
  children: { path: string; component: A2UiComponent };
  direction?: 'vertical' | 'horizontal';
  align?: 'start' | 'center' | 'end' | 'stretch';
}

export interface A2UiCard {
  component: 'Card';
  child: A2UiComponent;
}

export interface A2UiDivider {
  component: 'Divider';
  axis?: 'horizontal' | 'vertical';
}

export interface A2UiButton {
  component: 'Button';
  child: A2UiComponent;
  variant?: 'default' | 'primary' | 'borderless';
  action: A2UiAction;
}

export interface A2UiEventAction {
  event: { name: string; context?: Record<string, unknown> };
}

export interface A2UiOpenUrlAction {
  openUrl: { url: DynamicValue<string> };
}

export type A2UiAction = A2UiEventAction | A2UiOpenUrlAction;

export interface A2UiTextInput {
  component: 'TextField';
  label: DynamicValue<string>;
  value: DynamicValue<string>;
  placeholder?: DynamicValue<string>;
  variant?: 'longText' | 'number' | 'shortText' | 'obscured';
  weight?: number;
  /** Validation rules shown as inline errors while the user fills the field. */
  '@checks'?: A2UiCheckRule[];
}

export interface A2UiCheckBox {
  component: 'CheckBox';
  label: DynamicValue<string>;
  value: DynamicValue<boolean>;
  weight?: number;
}

export interface A2UiSlider {
  component: 'Slider';
  min?: number;
  max: number;
  value: DynamicValue<number>;
  steps?: number;
  label?: DynamicValue<string>;
  weight?: number;
}

export interface A2UiChoiceOption {
  label: DynamicValue<string>;
  value: string;
}

export interface A2UiChoicePicker {
  component: 'ChoicePicker';
  label?: DynamicValue<string>;
  options: A2UiChoiceOption[];
  value: DynamicValue<string[]>;
  variant?: 'multipleSelection' | 'mutuallyExclusive';
  displayStyle?: 'checkbox' | 'chips';
  weight?: number;
}

export interface A2UiTab {
  title: DynamicValue<string>;
  child: A2UiComponent;
}

export interface A2UiTabs {
  component: 'Tabs';
  tabs: A2UiTab[];
}

/** A validation rule a field is checked against; a failure shows `message`. */
export interface A2UiCheckRule {
  condition: 'required' | 'numeric' | 'email';
  message?: DynamicValue<string>;
}

export type A2UiComponent =
  | A2UiText
  | A2UiIcon
  | A2UiImage
  | A2UiRow
  | A2UiColumn
  | A2UiList
  | A2UiCard
  | A2UiDivider
  | A2UiButton
  | A2UiTextInput
  | A2UiCheckBox
  | A2UiSlider
  | A2UiChoicePicker
  | A2UiTabs;

/** The `ui` argument of the `render_ui` tool call. */
export interface A2UiSurface {
  components: A2UiComponent[];
  dataModel?: Record<string, unknown>;
}

export const A2UI_COMPONENTS: readonly A2UiComponent['component'][] = [
  'Text',
  'Icon',
  'Image',
  'Row',
  'Column',
  'List',
  'Card',
  'Divider',
  'Button',
  'TextField',
  'CheckBox',
  'Slider',
  'ChoicePicker',
  'Tabs',
] as const;

export const isA2UiComponentName = (
  value: unknown,
): value is A2UiComponent['component'] =>
  typeof value === 'string' &&
  (A2UI_COMPONENTS as readonly string[]).includes(value);