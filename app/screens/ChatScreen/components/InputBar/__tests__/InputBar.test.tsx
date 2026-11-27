import React from 'react';
import { Text } from 'react-native';
import { render, act, within } from '@testing-library/react-native';

import { lightColors } from 'style';

import { InputBar } from '../InputBar';

jest.unmock('../InputBar');

// IconButton is host-mocked ('IconButton'), so it's found by host type.
const isIconButton = (node: { type: unknown }) => node.type === 'IconButton';

const foo = () => {
  // do nothing.
};

// InputBar's expanded state is owned by its parent (ChatScreen drives the blur
// overlay from it), so tests render it through a small stateful host.
const StatefulInputBar: React.FC<
  Partial<React.ComponentProps<typeof InputBar>>
> = props => {
  const [attachExpanded, setAttachExpanded] = React.useState(false);
  return (
    <InputBar
      value={''}
      isStreaming={false}
      attachExpanded={attachExpanded}
      onAttachExpandedChange={setAttachExpanded}
      onChangeText={foo}
      onSend={foo}
      onStop={foo}
      {...props}
    />
  );
};

test('renders correctly InputBar', async () => {
  const tree = (await render(<StatefulInputBar />)).toJSON();
  expect(tree).toMatchSnapshot();
});

test('renders correctly InputBar with value', async () => {
  const tree = (
    await render(<StatefulInputBar value={'Type here'} />)
  ).toJSON();
  expect(tree).toMatchSnapshot();
});

test('renders correctly InputBar when streaming', async () => {
  const tree = (await render(<StatefulInputBar isStreaming />)).toJSON();
  expect(tree).toMatchSnapshot();
});

test('renders the collapsed + toggle when attachments are enabled', async () => {
  const tree = (
    await render(
      <StatefulInputBar
        canAttachImage
        canAttachAudio
        onAttachImage={foo}
        onAttachAudio={foo}
      />,
    )
  ).toJSON();
  expect(tree).toMatchSnapshot();
});

test('pressing + lists the attach options and keeps the text input', async () => {
  const screen = await render(
    <StatefulInputBar
      canAttachImage
      canAttachAudio
      onAttachImage={foo}
      onAttachAudio={foo}
    />,
  );

  const iconNames = () =>
    screen.container
      .queryAll(isIconButton)
      .map(node => node.props.icon.iosIconName);

  // Collapsed: a single + toggle and the text input, no photo/waveform.
  expect(iconNames()).toContain('plus');
  expect(iconNames()).not.toContain('photo');
  expect(
    screen.queryByPlaceholderText('components.inputBar.placeholder'),
  ).toBeTruthy();

  const toggle = screen.container
    .queryAll(isIconButton)
    .find(node => node.props.icon.iosIconName === 'plus');
  await act(() => toggle?.props.onPress());

  // Expanded: toggle becomes ×, the photo + camera + waveform options are
  // listed, and the text input stays visible.
  expect(iconNames()).toEqual(
    expect.arrayContaining(['xmark', 'photo', 'camera', 'waveform']),
  );
  // Each attach option carries a label alongside its icon.
  expect(screen.getByText('components.inputBar.photo')).toBeTruthy();
  expect(screen.getByText('components.inputBar.camera')).toBeTruthy();
  expect(screen.getByText('components.inputBar.audio')).toBeTruthy();
  expect(
    screen.queryByPlaceholderText('components.inputBar.placeholder'),
  ).toBeTruthy();
});

test('an audio-only model greys out photo and camera and explains why', async () => {
  const onAttachImage = jest.fn();
  const onUnavailable = jest.fn();
  const screen = await render(
    <StatefulInputBar
      canAttachAudio
      onAttachAudio={foo}
      onAttachImage={onAttachImage}
      onUnavailable={onUnavailable}
    />,
  );

  const toggle = screen.container
    .queryAll(isIconButton)
    .find(node => node.props.icon.iosIconName === 'plus');
  await act(() => toggle?.props.onPress());

  const iconNames = screen.container
    .queryAll(isIconButton)
    .map(node => node.props.icon.iosIconName);

  // All three options are listed; only audio is usable.
  expect(iconNames).toEqual(
    expect.arrayContaining(['waveform', 'photo', 'camera']),
  );

  const photo = screen.container
    .queryAll(isIconButton)
    .find(node => node.props.icon.iosIconName === 'photo')!;
  expect(photo.props.color).toBe(lightColors.onSurfaceDisabled);

  await act(() => photo.props.onPress());
  expect(onAttachImage).not.toHaveBeenCalled();
  expect(onUnavailable).toHaveBeenCalledWith(
    'components.inputBar.imageUnavailable',
  );
});

test('every optional feature button is shown, greyed out, when unavailable', async () => {
  const onUnavailable = jest.fn();
  const onAttachExpandedChange = jest.fn();
  const screen = await render(
    <InputBar
      value=""
      isStreaming={false}
      attachExpanded={false}
      onAttachExpandedChange={onAttachExpandedChange}
      onChangeText={foo}
      onSend={foo}
      onStop={foo}
      onUnavailable={onUnavailable}
    />,
  );

  const byIcon = (name: string) =>
    screen.container
      .queryAll(isIconButton)
      .find(node => node.props.icon.iosIconName === name)!;

  for (const [icon, message] of [
    ['plus', 'components.inputBar.attachUnavailable'],
    ['mic', 'components.inputBar.dictationUnavailable'],
    ['lightbulb', 'components.inputBar.thinkingUnavailable'],
  ]) {
    const button = byIcon(icon);
    expect(button.props.color).toBe(lightColors.onSurfaceDisabled);
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    await act(() => button.props.onPress());
    expect(onUnavailable).toHaveBeenLastCalledWith(message);
  }

  // The + never opens the tray when there's nothing to attach.
  expect(onAttachExpandedChange).not.toHaveBeenCalled();
});

// Render an image-capable InputBar in its expanded state and report which attach
// icons are visible.
const expandedImageIcons = async (
  imageSource?: 'photo' | 'camera',
): Promise<string[]> => {
  const screen = await render(
    <StatefulInputBar
      canAttachImage
      imageSource={imageSource}
      onAttachImage={foo}
      onAttachCamera={foo}
    />,
  );
  // Find the toggle by its (stable) label, not its icon — the icon is a
  // paperclip rather than a + once an attachment is present.
  const toggle = screen.container
    .queryAll(isIconButton)
    .find(
      node => node.props.accessibilityLabel === 'components.inputBar.attach',
    );
  await act(() => toggle?.props.onPress());
  return screen.container
    .queryAll(isIconButton)
    .map(node => node.props.icon.iosIconName);
};

test('with no image attached, both photo and camera are offered', async () => {
  const icons = await expandedImageIcons(undefined);
  expect(icons).toContain('photo');
  expect(icons).toContain('camera');
});

test('an image attached via Photo hides the Camera button', async () => {
  const icons = await expandedImageIcons('photo');
  expect(icons).toContain('photo');
  expect(icons).not.toContain('camera');
});

test('an image captured via Camera hides the Photo button', async () => {
  const icons = await expandedImageIcons('camera');
  expect(icons).toContain('camera');
  expect(icons).not.toContain('photo');
});

test('with an image attached, only the image option is listed', async () => {
  const screen = await render(
    <StatefulInputBar
      canAttachImage
      canAttachAudio
      imageSource="photo"
      onAttachImage={foo}
      onAttachCamera={foo}
      onAttachAudio={foo}
    />,
  );

  const toggle = screen.container
    .queryAll(isIconButton)
    .find(
      node => node.props.accessibilityLabel === 'components.inputBar.attach',
    );
  await act(() => toggle?.props.onPress());

  const iconNames = screen.container
    .queryAll(isIconButton)
    .map(node => node.props.icon.iosIconName);
  expect(iconNames).toContain('photo');
  expect(iconNames).not.toContain('camera');
  // The audio attach option is gone. It shares the waveform icon with the
  // always-present voice-assistant button, so assert on its label, not the icon.
  expect(screen.queryByLabelText('components.inputBar.attachAudio')).toBeNull();
  // The remaining option offers to unselect the attachment.
  expect(screen.getByText('components.inputBar.unselect')).toBeTruthy();
});

test('with audio attached, only the audio option is listed', async () => {
  const screen = await render(
    <StatefulInputBar
      canAttachImage
      canAttachAudio
      hasAudio
      onAttachImage={foo}
      onAttachCamera={foo}
      onAttachAudio={foo}
    />,
  );

  const toggle = screen.container
    .queryAll(isIconButton)
    .find(
      node => node.props.accessibilityLabel === 'components.inputBar.attach',
    );
  await act(() => toggle?.props.onPress());

  const iconNames = screen.container
    .queryAll(isIconButton)
    .map(node => node.props.icon.iosIconName);
  expect(iconNames).toContain('waveform');
  expect(iconNames).not.toContain('photo');
  expect(iconNames).not.toContain('camera');
  expect(screen.getByText('components.inputBar.unselect')).toBeTruthy();
});

test('the toggle shows a paperclip once an attachment is present', async () => {
  const screen = await render(
    <StatefulInputBar
      canAttachImage
      imageSource="photo"
      onAttachImage={foo}
      onAttachCamera={foo}
    />,
  );

  const toggle = screen.container
    .queryAll(isIconButton)
    .find(
      node => node.props.accessibilityLabel === 'components.inputBar.attach',
    );
  expect(toggle?.props.icon.iosIconName).toBe('paperclip');
  expect(toggle?.props.icon.androidIconName).toBe('attach_file');
});

test('selecting an attachment collapses the expanded tray', async () => {
  const props = {
    canAttachImage: true,
    onAttachImage: foo,
    onAttachCamera: foo,
  };
  const screen = await render(<StatefulInputBar {...props} />);

  // Open the tray — the attach options are listed above the input.
  const toggle = screen.container
    .queryAll(isIconButton)
    .find(
      node => node.props.accessibilityLabel === 'components.inputBar.attach',
    );
  await act(() => toggle?.props.onPress());
  expect(screen.queryByText('components.inputBar.photo')).toBeTruthy();

  // An image gets attached (the parent updates imageSource) → tray collapses.
  await screen.rerender(<StatefulInputBar {...props} imageSource="photo" />);
  expect(screen.queryByText('components.inputBar.photo')).toBeNull();
});

test('sending closes the expanded tray', async () => {
  const onSend = jest.fn();
  const screen = await render(
    <StatefulInputBar
      value={'hello'}
      canAttachImage
      onAttachImage={foo}
      onAttachCamera={foo}
      onSend={onSend}
    />,
  );

  const toggle = screen.container
    .queryAll(isIconButton)
    .find(
      node => node.props.accessibilityLabel === 'components.inputBar.attach',
    );
  await act(() => toggle?.props.onPress());
  expect(screen.queryByText('components.inputBar.photo')).toBeTruthy();

  // The send button is the icon button with the arrow-up icon.
  const send = screen.container
    .queryAll(isIconButton)
    .find(node => node.props.icon.iosIconName === 'arrow.up');
  await act(() => send?.props.onPress());

  expect(onSend).toHaveBeenCalled();
  expect(screen.queryByText('components.inputBar.photo')).toBeNull();
});

// --- Focus -----------------------------------------------------------------

// The bar's border is the last style on the View wrapping the text input.
const barBorderColor = (screen: Awaited<ReturnType<typeof render>>): string => {
  const input = screen.getByPlaceholderText('components.inputBar.placeholder');
  const bar = input.parent;
  const flattened = Object.assign(
    {},
    ...[bar?.props.style].flat(Infinity).filter(Boolean),
  );
  return flattened.borderColor;
};

test('highlights the bar border while the text input is focused', async () => {
  const screen = await render(<StatefulInputBar />);
  const input = screen.getByPlaceholderText('components.inputBar.placeholder');

  expect(barBorderColor(screen)).toBe('#e1e1e1');

  await act(() => input.props.onFocus());
  expect(barBorderColor(screen)).toBe('#c1c1c1');

  await act(() => input.props.onBlur());
  expect(barBorderColor(screen)).toBe('#e1e1e1');
});

test('still forwards focus and blur to the parent', async () => {
  const onFocus = jest.fn();
  const onBlur = jest.fn();
  const screen = await render(
    <StatefulInputBar onFocus={onFocus} onBlur={onBlur} />,
  );
  const input = screen.getByPlaceholderText('components.inputBar.placeholder');

  await act(() => input.props.onFocus());
  expect(onFocus).toHaveBeenCalled();

  await act(() => input.props.onBlur());
  expect(onBlur).toHaveBeenCalled();
});

// --- Composer measurement --------------------------------------------------

test('measures the field for the list inset, not the starters above it', async () => {
  const onComposerLayout = jest.fn();

  const screen = await render(
    <StatefulInputBar
      onComposerLayout={onComposerLayout}
      messageStarters={<Text testID="starters">starters</Text>}
    />,
  );

  // The view the list measures must not be the one wearing the starters: they
  // vanish the moment a conversation gets its first message, and folding them
  // into the inset collapses it mid-turn and slides the conversation down.
  const measured = screen.container.queryAll(
    node => node.type === 'View' && node.props.onLayout === onComposerLayout,
  )[0];
  expect(measured).toBeTruthy();
  expect(within(measured!).queryByTestId('starters')).toBeNull();
  // The starters are on screen, just not inside what gets measured.
  expect(screen.getByTestId('starters')).toBeTruthy();
});

// --- Web search toggle -----------------------------------------------------

const webSearchButton = (screen: Awaited<ReturnType<typeof render>>) =>
  screen.container
    .queryAll(isIconButton)
    .find(
      node => node.props.accessibilityLabel === 'components.inputBar.webSearch',
    );

test('the globe toggle shows its state and reports presses', async () => {
  const onToggleWebSearch = jest.fn();
  const screen = await render(
    <StatefulInputBar webSearchEnabled onToggleWebSearch={onToggleWebSearch} />,
  );

  const button = webSearchButton(screen)!;
  expect(button.props.accessibilityState).toEqual({
    selected: true,
    disabled: false,
  });

  await act(() => button.props.onPress());
  expect(onToggleWebSearch).toHaveBeenCalledTimes(1);
});

test('the globe is greyed out and explains why when the model cannot search', async () => {
  const onToggleWebSearch = jest.fn();
  const onUnavailable = jest.fn();
  const screen = await render(
    <StatefulInputBar
      webSearchUnavailableMessage="too small"
      onToggleWebSearch={onToggleWebSearch}
      onUnavailable={onUnavailable}
    />,
  );

  const button = webSearchButton(screen)!;
  expect(button.props.color).toBe(lightColors.onSurfaceDisabled);

  await act(() => button.props.onPress());
  expect(onToggleWebSearch).not.toHaveBeenCalled();
  expect(onUnavailable).toHaveBeenCalledWith('too small');
});

test('the mic stays visible but disabled while an answer streams in', async () => {
  const screen = await render(<StatefulInputBar canDictate isStreaming />);

  const mic = screen.container
    .queryAll(isIconButton)
    .find(node => node.props.icon.iosIconName === 'mic')!;
  expect(mic.props.disabled).toBe(true);
  expect(mic.props.color).toBe(lightColors.onSurfaceDisabled);
});

test('every feature button is greyed out and disabled while streaming', async () => {
  const screen = await render(
    <StatefulInputBar
      isStreaming
      canAttachImage
      canDictate
      canThink
      thinkingEnabled
      webSearchEnabled
    />,
  );

  const icons = ['plus', 'mic', 'lightbulb', 'globe', 'waveform'];
  for (const icon of icons) {
    const button = screen.container
      .queryAll(isIconButton)
      .find(node => node.props.icon.iosIconName === icon)!;
    expect(button.props.disabled).toBe(true);
    expect(button.props.color).toBe(lightColors.onSurfaceDisabled);
  }

  // The send button turns into stop and stays usable.
  const stop = screen.container
    .queryAll(isIconButton)
    .find(node => node.props.icon.iosIconName === 'stop')!;
  expect(stop.props.disabled).toBe(false);
});

test.each([
  ['recording', { isRecording: true }],
  ['transcribing', { isTranscribing: true }],
])('send is disabled while %s', async (_, dictation) => {
  const screen = await render(
    <StatefulInputBar value="hello" canDictate {...dictation} />,
  );

  const send = screen.container
    .queryAll(isIconButton)
    .find(node => node.props.icon.iosIconName === 'arrow.up')!;
  expect(send.props.disabled).toBe(true);
  expect(send.props.backgroundColor).toBe(
    lightColors.ctaSurfacePrimaryDisabled,
  );
});

// --- Text set from outside -------------------------------------------------

const ControlledInputBar: React.FC<{
  setValueRef: { current: ((text: string) => void) | undefined };
}> = ({ setValueRef }) => {
  const [value, setValue] = React.useState('');
  setValueRef.current = setValue;
  return <StatefulInputBar value={value} onChangeText={setValue} />;
};

const PLACEHOLDER = 'components.inputBar.placeholder';

test('remounts the field when a starter sets its text, so iOS sizes it to fit', async () => {
  const setValueRef: { current: ((text: string) => void) | undefined } = {
    current: undefined,
  };
  const screen = await render(<ControlledInputBar setValueRef={setValueRef} />);
  const before = screen.getByPlaceholderText(PLACEHOLDER);

  await act(() => setValueRef.current?.('A long message starter body'));

  const after = screen.getByPlaceholderText(PLACEHOLDER);
  expect(after).not.toBe(before);
  expect(after.props.value).toBe('A long message starter body');
});

test('keeps the same field while the user types', async () => {
  const setValueRef: { current: ((text: string) => void) | undefined } = {
    current: undefined,
  };
  const screen = await render(<ControlledInputBar setValueRef={setValueRef} />);
  const before = screen.getByPlaceholderText(PLACEHOLDER);

  await act(() => before.props.onChangeText('Hello'));

  const after = screen.getByPlaceholderText(PLACEHOLDER);
  expect(after).toBe(before);
  expect(after.props.value).toBe('Hello');
});

test('keeps the keyboard up across the remount when the field was focused', async () => {
  const setValueRef: { current: ((text: string) => void) | undefined } = {
    current: undefined,
  };
  const screen = await render(<ControlledInputBar setValueRef={setValueRef} />);

  await act(() => screen.getByPlaceholderText(PLACEHOLDER).props.onFocus());
  await act(() => setValueRef.current?.('Starter'));

  expect(screen.getByPlaceholderText(PLACEHOLDER).props.autoFocus).toBe(true);
});

// A field that shrank only on the native text update left the input bar's
// container at its multi-line height, the bar floating above the bottom.
test('remounts the field when sending clears it, without taking the focus back', async () => {
  const setValueRef: { current: ((text: string) => void) | undefined } = {
    current: undefined,
  };
  const screen = await render(<ControlledInputBar setValueRef={setValueRef} />);
  await act(() => screen.getByPlaceholderText(PLACEHOLDER).props.onFocus());
  await act(() =>
    screen
      .getByPlaceholderText(PLACEHOLDER)
      .props.onChangeText('A message long enough for a few lines'),
  );
  const before = screen.getByPlaceholderText(PLACEHOLDER);

  await act(() => setValueRef.current?.(''));

  const after = screen.getByPlaceholderText(PLACEHOLDER);
  expect(after).not.toBe(before);
  expect(after.props.value).toBe('');
  expect(after.props.autoFocus).toBe(false);
});
