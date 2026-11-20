import { validateUi } from '../validate';
import { A2UI_GBNF } from '../grammar';
import { A2UI_COMPONENTS } from '../types';

const sampleSurface = {
  components: [
    { component: 'Column', id: 'root', children: ['greeting', 'cta'] },
    { component: 'Text', id: 'greeting', text: { '@path': '/message' } },
    {
      component: 'Button',
      id: 'cta',
      child: 'ctaLabel',
      variant: 'primary',
      action: { event: { name: 'continue', context: { page: 2 } } },
    },
    { component: 'Text', id: 'ctaLabel', text: 'Continue' },
  ],
  dataModel: { message: 'Welcome!' },
};

describe('validateUi', () => {
  test('accepts a well-formed surface', () => {
    const validation = validateUi(sampleSurface);
    expect(validation.valid).toBe(true);
    if (validation.valid) {
      expect(validation.surface.components).toHaveLength(4);
      expect(validation.surface.dataModel).toEqual({ message: 'Welcome!' });
    }
  });

  test('accepts every supported component type', () => {
    const components = [
      { component: 'Text', id: 'a', text: 'hi', variant: 'caption' },
      { component: 'Image', id: 'b', url: { '@path': '/logo' } },
      { component: 'Row', id: 'c', children: ['a', 'e'] },
      { component: 'Column', id: 'e', children: ['a'] },
      {
        component: 'List',
        id: 'f',
        children: { path: '/breeds', componentId: 'b' },
        direction: 'horizontal',
      },
      { component: 'Card', id: 'g', child: 'a' },
      { component: 'Divider', id: 'h', axis: 'vertical' },
      {
        component: 'Button',
        id: 'i',
        child: 'a',
        variant: 'borderless',
        action: { openUrl: { url: 'https://example.com' } },
      },
      {
        component: 'TextField',
        id: 'j',
        label: 'Name',
        value: { '@path': '/form/name' },
        placeholder: '…',
      },
      { component: 'CheckBox', id: 'k', label: 'Agree', value: false },
      {
        component: 'Slider',
        id: 'l',
        min: 0,
        max: 10,
        value: { '@path': '/form/level' },
        steps: 2,
      },
      {
        component: 'ChoicePicker',
        id: 'm',
        label: 'Pick',
        options: [
          { label: 'One', value: '1' },
          { label: 'Two', value: '2' },
        ],
        value: ['1'],
        variant: 'mutuallyExclusive',
        displayStyle: 'chips',
      },
    ];
    const validation = validateUi({ components });
    expect(validation.valid).toBe(true);
  });

  test('rejects an unknown component type by name', () => {
    const validation = validateUi({
      components: [{ component: 'Video', id: 'v', url: 'x' }],
    });
    expect(validation.valid).toBe(false);
    if (!validation.valid) {
      expect(validation.reason).toContain('unknown component "Video"');
    }
  });

  test('rejects a dangling child reference', () => {
    const validation = validateUi({
      components: [
        { component: 'Column', id: 'root', children: ['nope'] },
      ],
    });
    expect(validation.valid).toBe(false);
    if (!validation.valid) {
      expect(validation.reason).toContain('"nope"');
    }
  });

  test('rejects duplicate ids', () => {
    const validation = validateUi({
      components: [
        { component: 'Text', id: 'x', text: 'one' },
        { component: 'Text', id: 'x', text: 'two' },
      ],
    });
    expect(validation.valid).toBe(false);
    if (!validation.valid) {
      expect(validation.reason).toContain('duplicate id "x"');
    }
  });

  test('rejects a bad button action', () => {
    const validation = validateUi({
      components: [
        { component: 'Button', id: 'b', child: 'l', action: { waffle: true } },
        { component: 'Text', id: 'l', text: 'label' },
      ],
    });
    expect(validation.valid).toBe(false);
  });

  test('rejects a non-object payload', () => {
    expect(validateUi([1, 2, 3]).valid).toBe(false);
    expect(validateUi('components').valid).toBe(false);
    expect(validateUi(null).valid).toBe(false);
    expect(validateUi({}).valid).toBe(false);
    expect(validateUi({ components: [] }).valid).toBe(false);
  });

  test('tolerates an absent or weird dataModel', () => {
    const without = validateUi({
      components: [{ component: 'Text', id: 't', text: 'hi' }],
    });
    expect(without.valid).toBe(true);

    const weird = validateUi({
      components: [{ component: 'Text', id: 't', text: 'hi' }],
      dataModel: 'not-an-object',
    });
    expect(weird.valid).toBe(true);
  });
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
