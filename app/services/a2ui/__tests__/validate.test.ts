import { validateUi } from '../validate';
import { A2UI_GBNF } from '../grammar';
import { A2UI_UI_SCHEMA } from '../schema';
import { A2UI_COMPONENTS } from '../types';

const sampleSurface = {
  components: [
    {
      component: 'Column',
      children: [
        { component: 'Text', text: { '@path': '/message' } },
        {
          component: 'Button',
          child: { component: 'Text', text: 'Continue' },
          variant: 'primary',
          action: { event: { name: 'continue', context: { page: 2 } } },
        },
      ],
    },
  ],
  dataModel: { message: 'Welcome!' },
};

describe('validateUi', () => {
  test('accepts a well-formed surface', () => {
    const validation = validateUi(sampleSurface);
    expect(validation.valid).toBe(true);
    if (validation.valid) {
      expect(validation.surface.components).toHaveLength(1);
      expect(validation.surface.dataModel).toEqual({ message: 'Welcome!' });
      // Nested children are inline objects, not id references.
      expect(validation.warnings).toEqual([]);
    }
  });

  test('accepts every supported component type', () => {
    const components = [
      { component: 'Text', text: 'hi', variant: 'caption' },
      { component: 'Icon', name: 'search', variant: 'medium' },
      { component: 'Image', url: { '@path': '/logo' } },
      {
        component: 'Row',
        children: [{ component: 'Text', text: 'a' }],
      },
      {
        component: 'Column',
        children: [{ component: 'Text', text: 'b' }],
      },
      {
        component: 'List',
        children: {
          path: '/breeds',
          component: { component: 'Image', url: { '@path': 'url' } },
        },
        direction: 'horizontal',
      },
      { component: 'Card', child: { component: 'Text', text: 'c' } },
      { component: 'Divider', axis: 'vertical' },
      {
        component: 'Button',
        child: { component: 'Text', text: 'go' },
        variant: 'borderless',
        action: { openUrl: { url: 'https://example.com' } },
      },
      {
        component: 'TextField',
        label: 'Name',
        value: { '@path': '/form/name' },
        placeholder: '…',
        '@checks': [{ condition: 'required', message: 'Needed' }],
      },
      { component: 'CheckBox', label: 'Agree', value: false },
      {
        component: 'Slider',
        min: 0,
        max: 10,
        value: { '@path': '/form/level' },
        steps: 2,
      },
      {
        component: 'ChoicePicker',
        label: 'Pick',
        options: [
          { label: 'One', value: '1' },
          { label: 'Two', value: '2' },
        ],
        value: ['1'],
        variant: 'mutuallyExclusive',
        displayStyle: 'chips',
      },
      {
        component: 'Tabs',
        tabs: [
          { title: 'One', child: { component: 'Text', text: 'tab one' } },
          { title: 'Two', child: { component: 'Text', text: 'tab two' } },
        ],
      },
      {
        component: 'Map',
        markers: [{ label: 'Louvre' }, { label: 'Orsay', lat: 48.86, lon: 2.33 }],
        route: [
          { lat: 48.8606, lon: 2.3376 },
          { lat: 48.8616, lon: 2.3522 },
        ],
        variant: 'medium',
      },
    ];
    const validation = validateUi({ components });
    expect(validation.valid).toBe(true);
  });

  // Lenient by design: recoverable problems become warnings while the surface
  // stays renderable — never a collapse to raw JSON.
  test('skips an unknown component and warns', () => {
    const validation = validateUi({
      components: [{ component: 'Video', url: 'x' }],
    });
    expect(validation.valid).toBe(true);
    expect(validation.warnings.join(' ')).toContain('unknown component "Video"');
  });

  test('Map tolerates bad markers/route points and warns', () => {
    const validation = validateUi({
      components: [
        {
          component: 'Map',
          markers: [
            { label: { '@path': '/city' } },
            { label: 42 },
            'ghost',
            { icon: 'location', lat: 'x', lon: 1 },
          ],
          route: [{ lat: 1 }, { lat: 2, lon: 3 }],
        },
      ],
      dataModel: { city: 'Paris' },
    });
    expect(validation.valid).toBe(true);
    if (validation.valid) {
      const map = validation.surface.components[0];
      expect(map.component).toBe('Map');
      if (map.component === 'Map') {
        expect(map.markers).toEqual([
          { label: { '@path': '/city' } },
          { icon: 'location', lon: 1 },
        ]);
        expect(map.route).toEqual([{ lat: 2, lon: 3 }]);
      }
      expect(validation.warnings.join(' ')).toContain('skipped');
    }
  });

  test('drops non-object children and warns', () => {
    const validation = validateUi({
      components: [
        { component: 'Row', children: ['ghost', { component: 'Text', text: 'ok' }] },
      ],
    });
    expect(validation.valid).toBe(true);
    const textCount = validation.valid
      ? validation.surface.components[0].component === 'Row'
        ? validation.surface.components[0].children.length
        : -1
      : -1;
    expect(textCount).toBe(1);
    expect(validation.warnings.join(' ')).toContain('ghost');
  });

  test('only rejects payloads that cannot render at all', () => {
    expect(validateUi([1, 2, 3]).valid).toBe(false);
    expect(validateUi('components').valid).toBe(false);
    expect(validateUi(null).valid).toBe(false);
    expect(validateUi({}).valid).toBe(false);
    expect(validateUi({ components: 'nope' }).valid).toBe(false);
  });
});

// A regression guard for the exact failure this feature has seen before: the
// recursive schema must never be a cyclic object graph, because `Tool` runs
// JSON.stringify on it (a cycle throws and the chat fails to build).
test('the ui schema is acyclic and JSON-serializable', () => {
  const json = JSON.stringify(A2UI_UI_SCHEMA);
  expect(json).toBeTruthy();
  const parsed = JSON.parse(json);
  expect(parsed.properties.components.type).toBe('array');
  expect(parsed.properties.components.items.oneOf.length).toBeGreaterThan(0);
});

// This schema is also injected into the model's system prompt by the chat
// template, so it must stay tiny — a huge schema overflowed the context
// before generation even started (a real failure we hit). Guard the size.
test('the ui schema stays small enough for the prompt and llguidance', () => {
  const json = JSON.stringify(A2UI_UI_SCHEMA);
  expect(json.length).toBeLessThan(50_000);
});

describe('grammar.ts reference grammar', () => {
  test('covers exactly the supported components', () => {
    // The GBNF must be kept in lock-step with the JSON Schema used to derive
    // the runtime constraint — the component set is its fingerprint.
    A2UI_COMPONENTS.forEach(component => {
      expect(A2UI_GBNF).toContain(component);
    });
  });
});