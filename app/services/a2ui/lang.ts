// The A2UI component library, defined for OpenUI Lang.
//
// OpenUI Lang (https://openui.com/docs/openui-lang) is the streaming-first,
// line-oriented language the model writes: `identifier = Expression` with
// `root` as the entry point. `@openuidev/lang-core` turns this Zod library
// into (a) the JSON Schema the parser validates against and (b) the
// "Component Signatures" section of the system prompt.
//
// Components map 1:1 to our React Native renderers (ComponentView).

import { z } from 'zod/v4';
import {
  action,
  createLibrary,
  createParser,
  createStreamingParser,
  generateSystemPrompt,
  type LibrarySpec,
  type OpenUIError,
} from '@openuidev/lang-core';

// ---------------------------------------------------------------------------
// Components — prop key order defines positional argument order for the model.
// ---------------------------------------------------------------------------

const mapPointSchema = z.object({ lat: z.number(), lon: z.number() });
const mapMarkerSchema = z.object({
  label: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
});

const TextContent = {
  name: 'TextContent',
  description: 'A short line of text. Use for titles, labels and values; a card title should be short and bold-looking via a Card.title instead.',
  props: z.object({ text: z.string() }),
};
const Stack = {
  name: 'Stack',
  description: 'Groups child components. Vertical stacks top-to-bottom (default); use orientation="horizontal" to lay children side by side as a row that fills the width.',
  props: z.object({
    children: z.array(z.any()),
    orientation: z.enum(['vertical', 'horizontal']).optional(),
    gap: z.enum(['xs', 'sm', 'md']).optional(),
  }),
};
const Icon = {
  name: 'Icon',
  description: 'A small icon in a filled circle. Use names like "location", "star", "check", "globe", "map", "image", "info", "warning", "heart".',
  props: z.object({
    name: z.string(),
    size: z.enum(['small', 'medium', 'large']).optional(),
  }),
};
const Image = {
  name: 'Image',
  description: 'A remote photo. Only use real, working image URLs (Wikimedia Special:FilePath URLs for landmarks); never invent URLs, never use placehold.co.',
  props: z.object({
    url: z.string(),
    variant: z.enum(['thumb', 'full']).optional(),
    caption: z.string().optional(),
  }),
};
const Card = {
  name: 'Card',
  description: 'A raised box with a subtle border; the standard grouping for one museum, hotel or result. Use title for a small heading inside the box.',
  props: z.object({
    children: z.array(z.any()),
    title: z.string().optional(),
  }),
};
const Divider = {
  name: 'Divider',
  description: 'A thin horizontal separator line.',
  props: z.object({}),
};
const Button = {
  name: 'Button',
  description: 'A tappable action button. Give it an action: @ToAssistant("...") sends a message to the assistant, @OpenUrl("...") opens a URL.',
  props: z.object({
    label: z.string(),
    action: action().optional(),
  }),
};
const Input = {
  name: 'Input',
  description: 'A single-line text field the user can type into. label is shown above the field.',
  props: z.object({
    label: z.string().optional(),
    value: z.string().optional(),
    placeholder: z.string().optional(),
    inputType: z.enum(['text', 'number', 'email', 'password']).optional(),
  }),
};
const CheckBox = {
  name: 'CheckBox',
  description: 'A toggle the user can switch on or off, with a label.',
  props: z.object({
    label: z.string(),
    value: z.boolean().optional(),
  }),
};
const Slider = {
  name: 'Slider',
  description: 'A numeric slider from min to max with a label and the current value shown.',
  props: z.object({
    label: z.string(),
    min: z.number(),
    max: z.number(),
    value: z.number().optional(),
  }),
};
const ChoicePicker = {
  name: 'ChoicePicker',
  description: 'A row of selectable pills; the user picks one option. options are short strings.',
  props: z.object({
    label: z.string().optional(),
    options: z.array(z.string()),
    selected: z.string().optional(),
  }),
};
const List = {
  name: 'List',
  description: 'A list of items laid out vertically (default) or horizontally. Items can be components (render the block per item) or plain values (rendered as text).',
  props: z.object({
    items: z.array(z.any()),
    orientation: z.enum(['vertical', 'horizontal']).optional(),
  }),
};
const Tabs = {
  name: 'Tabs',
  description: 'Tabs with labels and per-tab content; the user switches tabs to see each panel.',
  props: z.object({
    tabs: z.array(z.object({ label: z.string(), content: z.array(z.any()) })),
  }),
};
const Map = {
  name: 'Map',
  description: 'A live map with markers and an optional route line. Coordinates are lat/lon decimals; a marker without coordinates anchors to the route point with the same index. Use variant "medium" (default) or "large".',
  props: z.object({
    markers: z.array(mapMarkerSchema),
    route: z.array(mapPointSchema).optional(),
    variant: z.enum(['small', 'medium', 'large']).optional(),
  }),
};

export const uiComponents = [
  TextContent,
  Icon,
  Image,
  Stack,
  Card,
  Divider,
  Button,
  Input,
  CheckBox,
  Slider,
  ChoicePicker,
  List,
  Tabs,
  Map,
] as const;

export const uiLibrary = createLibrary({
  root: 'Stack',
  components: uiComponents as never,
});

/** The JSON Schema form (what the parsers validate against). */
export const uiLibrarySpec = uiLibrary.toJSONSchema();

/** The LibrarySpec form (what the prompt generator consumes). */
export const uiLibrarySpecForPrompt: LibrarySpec = uiLibrary.toSpec();

export const A2UI_ROOT = 'Stack';

export const createUiParser = () => createParser(uiLibrarySpec, A2UI_ROOT);

export const createUiStreamingParser = () =>
  createStreamingParser(uiLibrarySpec, A2UI_ROOT);

/** The generated "Component Signatures" section used by prompt.ts. */
export const generateUiSpecPrompt = (): string =>
  generateSystemPrompt({
    library: uiLibrarySpecForPrompt,
    promptOptions: { toolCalls: false, bindings: true, editMode: false, inlineMode: false },
  });

export type { OpenUIError };