// The JSON Schema that constrains `render_ui`'s `ui` argument.
//
// Nobodywho compiles tool JSON Schemas into the llguidance grammar that
// governs the model while it emits a tool call, so this schema is what keeps
// the `ui` payload coherent. But the SAME schema is rendered into the model's
// system prompt by the chat template (tool definitions, including
// `parameters`). That is the hard constraint this file is written around:
//
//   * It must be SMALL. A deep, fully-inlined recursive schema grows ~×5 per
//     nesting level and the chat template injects it into the context, so a
//     recursive expansion overflows before a token is sampled. (That was a
//     real "one large message > context window" failure.)
//   * It must be ACYCLIC. `Tool` runs `JSON.stringify` on it, and nobodywho
//     wraps the tool's args inside its own `{ name, arguments }` object, which
//     breaks `$ref`/`$defs` document-root pointers.
//
// So recurrence is deliberately NOT in the schema. The top level is precise
// (each component with its required fields), while children of Row/Column/List
// and `child` of Card/Button are constrained only to be an OBJECT carrying a
// valid `component` name. That is enough of a grammar to stop the model from
// emitting bare-string children (the classic id-dangling failure) while
// staying a few hundred tokens in the prompt. The full tree — required fields,
// nesting correctness — is enforced by `validateUi` and the renderer, which
// are unbounded and skip bad subtrees gracefully.

const COMPONENT_NAMES: readonly string[] = [
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
];

// The permissive "nested child" schema: an object with a valid component name.
// No additionalProperties:false, so it can carry arbitrary fields (children,
// text, …) that the deeper validator checks. This is what every Row/Column/
// Card/Button/List child must match — forcing real component objects, never
// bare strings or unknown types.
const ANY_COMPONENT = {
  type: 'object',
  properties: { component: { enum: COMPONENT_NAMES } },
  required: ['component'],
} as const;

const BINDING = {
  type: 'object',
  properties: { '@path': { type: 'string' } },
  required: ['@path'],
  additionalProperties: false,
} as const;

const stringOrBinding = { oneOf: [{ type: 'string' }, BINDING] } as const;
const numberOrBinding = { oneOf: [{ type: 'number' }, BINDING] } as const;
const booleanOrBinding = { oneOf: [{ type: 'boolean' }, BINDING] } as const;
const stringListOrBinding = {
  oneOf: [{ type: 'array', items: { type: 'string' } }, BINDING],
} as const;
const weight = { type: 'number' } as const;

const childrenList = {
  type: 'array',
  items: ANY_COMPONENT,
  minItems: 1,
} as const;

const action = {
  oneOf: [
    {
      type: 'object',
      properties: {
        event: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            context: { type: 'object' },
          },
          required: ['name'],
          additionalProperties: false,
        },
      },
      required: ['event'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        openUrl: {
          type: 'object',
          properties: { url: stringOrBinding },
          required: ['url'],
          additionalProperties: false,
        },
      },
      required: ['openUrl'],
      additionalProperties: false,
    },
  ],
} as const;

const text = {
  type: 'object',
  properties: {
    component: { enum: ['Text'] },
    text: stringOrBinding,
    variant: { enum: ['caption', 'body'] },
    weight,
  },
  required: ['component', 'text'],
  additionalProperties: false,
} as const;

const image = {
  type: 'object',
  properties: {
    component: { enum: ['Image'] },
    url: stringOrBinding,
    description: stringOrBinding,
    fit: { enum: ['contain', 'cover', 'fill', 'none', 'scaleDown'] },
    variant: {
      enum: ['avatar', 'smallFeature', 'mediumFeature', 'largeFeature'],
    },
    weight,
  },
  required: ['component', 'url'],
  additionalProperties: false,
} as const;

const row = {
  type: 'object',
  properties: {
    component: { enum: ['Row'] },
    children: childrenList,
    justify: {
      enum: ['center', 'end', 'spaceAround', 'spaceBetween', 'spaceEvenly', 'start', 'stretch'],
    },
    align: { enum: ['start', 'center', 'end', 'stretch'] },
  },
  required: ['component', 'children'],
  additionalProperties: false,
} as const;

const column = {
  type: 'object',
  properties: {
    component: { enum: ['Column'] },
    children: childrenList,
    justify: {
      enum: ['start', 'center', 'end', 'spaceBetween', 'spaceAround', 'spaceEvenly', 'stretch'],
    },
    align: { enum: ['start', 'center', 'end', 'stretch'] },
  },
  required: ['component', 'children'],
  additionalProperties: false,
} as const;

const list = {
  type: 'object',
  properties: {
    component: { enum: ['List'] },
    children: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        component: ANY_COMPONENT,
      },
      required: ['path', 'component'],
      additionalProperties: false,
    },
    direction: { enum: ['vertical', 'horizontal'] },
    align: { enum: ['start', 'center', 'end', 'stretch'] },
  },
  required: ['component', 'children'],
  additionalProperties: false,
} as const;

const card = {
  type: 'object',
  properties: {
    component: { enum: ['Card'] },
    child: ANY_COMPONENT,
  },
  required: ['component', 'child'],
  additionalProperties: false,
} as const;

const divider = {
  type: 'object',
  properties: {
    component: { enum: ['Divider'] },
    axis: { enum: ['horizontal', 'vertical'] },
  },
  required: ['component'],
  additionalProperties: false,
} as const;

const button = {
  type: 'object',
  properties: {
    component: { enum: ['Button'] },
    child: ANY_COMPONENT,
    variant: { enum: ['default', 'primary', 'borderless'] },
    action,
  },
  required: ['component', 'child', 'action'],
  additionalProperties: false,
} as const;

const textField = {
  type: 'object',
  properties: {
    component: { enum: ['TextField'] },
    label: stringOrBinding,
    value: stringOrBinding,
    placeholder: stringOrBinding,
    variant: { enum: ['longText', 'number', 'shortText', 'obscured'] },
    weight,
  },
  required: ['component', 'label', 'value'],
  additionalProperties: false,
} as const;

const checkBox = {
  type: 'object',
  properties: {
    component: { enum: ['CheckBox'] },
    label: stringOrBinding,
    value: booleanOrBinding,
    weight,
  },
  required: ['component', 'label', 'value'],
  additionalProperties: false,
} as const;

const slider = {
  type: 'object',
  properties: {
    component: { enum: ['Slider'] },
    label: stringOrBinding,
    min: { type: 'number' },
    max: { type: 'number' },
    value: numberOrBinding,
    steps: { type: 'integer' },
    weight,
  },
  required: ['component', 'value', 'max'],
  additionalProperties: false,
} as const;

const choicePicker = {
  type: 'object',
  properties: {
    component: { enum: ['ChoicePicker'] },
    label: stringOrBinding,
    options: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: stringOrBinding,
          value: { type: 'string' },
        },
        required: ['label', 'value'],
        additionalProperties: false,
      },
    },
    value: stringListOrBinding,
    variant: { enum: ['multipleSelection', 'mutuallyExclusive'] },
    displayStyle: { enum: ['checkbox', 'chips'] },
    weight,
  },
  required: ['component', 'options', 'value'],
  additionalProperties: false,
} as const;

/** Every component the renderer understands, as a precise JSON Schema union. */
export const A2UI_COMPONENT_SCHEMAS = [
  text,
  image,
  row,
  column,
  list,
  card,
  divider,
  button,
  textField,
  checkBox,
  slider,
  choicePicker,
] as const;

/** The `ui` argument schema handed to `render_ui`'s Tool definition. */
export const A2UI_UI_SCHEMA = {
  type: 'object',
  properties: {
    components: {
      type: 'array',
      items: { oneOf: A2UI_COMPONENT_SCHEMAS },
      minItems: 1,
    },
    dataModel: { type: 'object' },
  },
  required: ['components'],
  additionalProperties: false,
} as const;