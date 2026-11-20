// A2UI types: the subset of the A2UI Basic Catalog (v1.0 wire format) that the
// on-device renderer supports. The model communicates a UI as a flat list of
// components with string ids — nesting happens by id reference, exactly like
// the `createSurface.components` of the A2UI v1.0 wire format — plus an
// optional `dataModel` that `{"@path": "/..."}` bindings resolve against.
//
// The on-device subset deliberately leaves out components that need a server
// round trip (events/functions), media sync, or complex host integration
// (Tabs, Modal, Video, AudioPlayer, DateTimeInput). Extend the renderer and
// the schema together if one of those becomes worth supporting.

/** A literal value or a reference into the surface's data model. */
export type DynamicValue<T> = T | { '@path': string };

/** A single Text component. */
export interface A2UiText {
  component: 'Text';
  id: string;
  text: DynamicValue<string>;
  variant?: 'caption' | 'body';
  weight?: number;
}

export interface A2UiImage {
  component: 'Image';
  id: string;
  url: DynamicValue<string>;
  description?: DynamicValue<string>;
  fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scaleDown';
  variant?: 'avatar' | 'smallFeature' | 'mediumFeature' | 'largeFeature';
  weight?: number;
}

export interface A2UiRow {
  component: 'Row';
  id: string;
  children: string[];
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
  id: string;
  children: string[];
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
  id: string;
  /** An inline template: render `componentId` once per item of `path`. */
  children: { path: string; componentId: string };
  direction?: 'vertical' | 'horizontal';
  align?: 'start' | 'center' | 'end' | 'stretch';
}

export interface A2UiCard {
  component: 'Card';
  id: string;
  child: string;
}

export interface A2UiDivider {
  component: 'Divider';
  id: string;
  axis?: 'horizontal' | 'vertical';
}

export interface A2UiButton {
  component: 'Button';
  id: string;
  child: string;
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
  id: string;
  label: DynamicValue<string>;
  value: DynamicValue<string>;
  placeholder?: DynamicValue<string>;
  variant?: 'longText' | 'number' | 'shortText' | 'obscured';
  weight?: number;
}

export interface A2UiCheckBox {
  component: 'CheckBox';
  id: string;
  label: DynamicValue<string>;
  value: DynamicValue<boolean>;
  weight?: number;
}

export interface A2UiSlider {
  component: 'Slider';
  id: string;
  label?: DynamicValue<string>;
  min: number;
  max: number;
  value: DynamicValue<number>;
  steps?: number;
  weight?: number;
}

export interface A2UiChoiceOption {
  label: DynamicValue<string>;
  value: string;
}

export interface A2UiChoicePicker {
  component: 'ChoicePicker';
  id: string;
  label?: DynamicValue<string>;
  options: A2UiChoiceOption[];
  value: DynamicValue<string[]>;
  /** 'multipleSelection' lets any subset be picked; 'mutuallyExclusive' is single-pick. */
  variant?: 'multipleSelection' | 'mutuallyExclusive';
  displayStyle?: 'checkbox' | 'chips';
  weight?: number;
}

export type A2UiComponent =
  | A2UiText
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
  | A2UiChoicePicker;

/** The `ui` argument of the `render_ui` tool call. */
export interface A2UiSurface {
  components: A2UiComponent[];
  dataModel?: Record<string, unknown>;
}

export const A2UI_COMPONENTS: readonly A2UiComponent['component'][] = [
  'Text',
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
] as const;

export const isA2UiComponentName = (value: unknown): value is A2UiComponent['component'] =>
  typeof value === 'string' &&
  (A2UI_COMPONENTS as readonly string[]).includes(value);
