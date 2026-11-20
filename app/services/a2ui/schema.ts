// The JSON Schema that constrains `render_ui`'s `ui` argument.
//
// This schema does double duty:
//
// 1. It is the *constrained grammar*. NobodyWho's chat sampler derives the
//    tool-call grammar for a model from the JSON Schemas of its tools
//    (`build_tool_sampler` in nobodywho/core/src/chat.rs): once the model
//    starts a tool call block, sampling switches to an llguidance grammar
//    compiled from `%json <schema>` — the output literally cannot be emitted
//    unless it parses as a JSON object matching this schema. So constraining
//    the tool call is done by writing the schema, not by attaching a separate
//    grammar string to the sampler (a hand-written whole-turn grammar would
//    fight the auto-generated tool grammar and the model's own prose).
//    The hand-readable GBNF pendant lives in `grammar.ts`.
//
// 2. `Tool` also uses it to type-check/convert the parsed arguments on the
//    JS side (see convert_value in react-native-nobodywho). A value with no
//    top-level `type` is passed through untouched, which is what the `oneOf`
//    unions below rely on: the grammar enforces the shape at sample time, the
//    JS side just carries the object across.
//
// The schema is fully inlined (no `$ref`/`$defs`): llguidance's `%json`
// support does not follow references, and nobodywho injects
// `"x-guidance": {"lenient": true}` at the root so keywords it does not
// implement are ignored instead of failing the build.

/** `{"@path": "/a/b"}` — a data-model reference. */
const BINDING = {
  type: 'object',
  properties: { '@path': { type: 'string' } },
  required: ['@path'],
  additionalProperties: false,
} as const;

const stringOrBinding = {
  oneOf: [{ type: 'string' }, BINDING],
} as const;

const numberOrBinding = {
  oneOf: [{ type: 'number' }, BINDING],
} as const;

const booleanOrBinding = {
  oneOf: [{ type: 'boolean' }, BINDING],
} as const;

const stringListOrBinding = {
  oneOf: [{ type: 'array', items: { type: 'string' } }, BINDING],
} as const;

const idList = { type: 'array', items: { type: 'string' } } as const;

const weight = { type: 'number' } as const;

const text = {
  type: 'object',
  properties: {
    component: { enum: ['Text'] },
    id: { type: 'string' },
    text: stringOrBinding,
    variant: { enum: ['caption', 'body'] },
    weight,
  },
  required: ['component', 'id', 'text'],
  additionalProperties: false,
} as const;

const image = {
  type: 'object',
  properties: {
    component: { enum: ['Image'] },
    id: { type: 'string' },
    url: stringOrBinding,
    description: stringOrBinding,
    fit: { enum: ['contain', 'cover', 'fill', 'none', 'scaleDown'] },
    variant: {
      enum: ['avatar', 'smallFeature', 'mediumFeature', 'largeFeature'],
    },
    weight,
  },
  required: ['component', 'id', 'url'],
  additionalProperties: false,
} as const;

const row = {
  type: 'object',
  properties: {
    component: { enum: ['Row'] },
    id: { type: 'string' },
    children: idList,
    justify: {
      enum: ['center', 'end', 'spaceAround', 'spaceBetween', 'spaceEvenly', 'start', 'stretch'],
    },
    align: { enum: ['start', 'center', 'end', 'stretch'] },
  },
  required: ['component', 'id', 'children'],
  additionalProperties: false,
} as const;

const column = {
  type: 'object',
  properties: {
    component: { enum: ['Column'] },
    id: { type: 'string' },
    children: idList,
    justify: {
      enum: ['start', 'center', 'end', 'spaceBetween', 'spaceAround', 'spaceEvenly', 'stretch'],
    },
    align: { enum: ['start', 'center', 'end', 'stretch'] },
  },
  required: ['component', 'id', 'children'],
  additionalProperties: false,
} as const;

const list = {
  type: 'object',
  properties: {
    component: { enum: ['List'] },
    id: { type: 'string' },
    children: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        componentId: { type: 'string' },
      },
      required: ['path', 'componentId'],
      additionalProperties: false,
    },
    direction: { enum: ['vertical', 'horizontal'] },
    align: { enum: ['start', 'center', 'end', 'stretch'] },
  },
  required: ['component', 'id', 'children'],
  additionalProperties: false,
} as const;

const card = {
  type: 'object',
  properties: {
    component: { enum: ['Card'] },
    id: { type: 'string' },
    child: { type: 'string' },
  },
  required: ['component', 'id', 'child'],
  additionalProperties: false,
} as const;

const divider = {
  type: 'object',
  properties: {
    component: { enum: ['Divider'] },
    id: { type: 'string' },
    axis: { enum: ['horizontal', 'vertical'] },
  },
  required: ['component', 'id'],
  additionalProperties: false,
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

const button = {
  type: 'object',
  properties: {
    component: { enum: ['Button'] },
    id: { type: 'string' },
    child: { type: 'string' },
    variant: { enum: ['default', 'primary', 'borderless'] },
    action,
  },
  required: ['component', 'id', 'child', 'action'],
  additionalProperties: false,
} as const;

const textField = {
  type: 'object',
  properties: {
    component: { enum: ['TextField'] },
    id: { type: 'string' },
    label: stringOrBinding,
    value: stringOrBinding,
    placeholder: stringOrBinding,
    variant: { enum: ['longText', 'number', 'shortText', 'obscured'] },
    weight,
  },
  required: ['component', 'id', 'label', 'value'],
  additionalProperties: false,
} as const;

const checkBox = {
  type: 'object',
  properties: {
    component: { enum: ['CheckBox'] },
    id: { type: 'string' },
    label: stringOrBinding,
    value: booleanOrBinding,
    weight,
  },
  required: ['component', 'id', 'label', 'value'],
  additionalProperties: false,
} as const;

const slider = {
  type: 'object',
  properties: {
    component: { enum: ['Slider'] },
    id: { type: 'string' },
    label: stringOrBinding,
    min: { type: 'number' },
    max: { type: 'number' },
    value: numberOrBinding,
    steps: { type: 'integer' },
    weight,
  },
  required: ['component', 'id', 'value', 'max'],
  additionalProperties: false,
} as const;

const choicePicker = {
  type: 'object',
  properties: {
    component: { enum: ['ChoicePicker'] },
    id: { type: 'string' },
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
  required: ['component', 'id', 'options', 'value'],
  additionalProperties: false,
} as const;

/** Every component the on-device renderer understands, as a JSON Schema union. */
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
    },
    dataModel: { type: 'object' },
  },
  required: ['components'],
  additionalProperties: false,
} as const;
