import React from 'react';
import { render } from '@testing-library/react-native';

import { AssistantMessage } from '../AssistantMessage';

// Old A2UI-era cards persisted as render_ui invocations; the tool is gone, so
// they must render as plain tool calls without crashing or showing chips.
test('a legacy render_ui invocation renders as a plain tool block', async () => {
  const view = await render(
    <AssistantMessage
      message={{
        role: 'assistant',
        content: '',
        toolInvocations: [
          {
            name: 'render_ui',
            arguments: { lang: 'root = Stack([TextContent("hi")])' },
            result: 'The UI card was rendered successfully.',
          },
        ],
      }}
      isStreaming={false}
      messageId="m1"
      canPlayAudio={false}
      isAudioLoading={false}
      isAudioPlaying={false}
    />,
  );

  expect(view.getByText('render_ui')).toBeTruthy();
  // No ChoiceButtons for a foreign tool: the choice text never leaks.
  expect(view.queryByText('hi')).toBeNull();
});

test('re-rendering the same message keeps the buttons visible', async () => {
  const message = {
    role: 'assistant' as const,
    content: '',
    toolInvocations: [
      {
        name: 'present_choices',
        arguments: { choices: ['Walk', 'Bus'] },
        result: 'Presented.',
      },
    ],
  };
  const props = {
    isStreaming: false,
    messageId: 'm1',
    canPlayAudio: false,
    isAudioLoading: false,
    isAudioPlaying: false,
  };
  const view = await render(<AssistantMessage message={message} {...props} />);
  // The live turn re-renders the same message many times (each stream tick).
  await view.rerender(<AssistantMessage message={message} {...props} />);
  await view.rerender(<AssistantMessage message={message} {...props} />);

  expect(view.getByText('Walk')).toBeTruthy();
  expect(view.getByText('Bus')).toBeTruthy();
});

test('duplicate present_choices sets collapse to a single row', async () => {
  const view = await render(
    <AssistantMessage
      message={{
        role: 'assistant',
        content: '',
        toolInvocations: [
          {
            name: 'present_choices',
            arguments: { choices: ['Walk', 'Bus'] },
            result: 'Presented.',
          },
          {
            name: 'present_choices',
            arguments: { choices: ['Walk', 'Bus'] },
            result: 'Presented.',
          },
        ],
      }}
      isStreaming={false}
      messageId="m1"
      canPlayAudio={false}
      isAudioLoading={false}
      isAudioPlaying={false}
    />,
  );

  expect(view.getByText('Walk')).toBeTruthy();
  // Only ONE row: asking for the same text twice would otherwise both pass.
  expect(view.getAllByText('Walk')).toHaveLength(1);
  expect(view.getAllByText('Bus')).toHaveLength(1);
});
