import React from 'react';
import { TextInput } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { IconButton } from 'components';

import { InputBar } from '../InputBar';

jest.unmock('../InputBar');

const foo = () => {
  // do nothing.
};

test('renders correctly InputBar', () => {
  const tree = render(
    <InputBar
      value={''}
      isStreaming={false}
      onChangeText={foo}
      onSend={foo}
      onStop={foo}
    />,
  ).toJSON();
  expect(tree).toMatchSnapshot();
});

test('renders correctly InputBar with value', () => {
  const tree = render(
    <InputBar
      value={'Type here'}
      isStreaming={false}
      onChangeText={foo}
      onSend={foo}
      onStop={foo}
    />,
  ).toJSON();
  expect(tree).toMatchSnapshot();
});

test('renders correctly InputBar when streaming', () => {
  const tree = render(
    <InputBar
      value={''}
      isStreaming={true}
      onChangeText={foo}
      onSend={foo}
      onStop={foo}
    />,
  ).toJSON();
  expect(tree).toMatchSnapshot();
});

test('renders the collapsed + toggle when attachments are enabled', () => {
  const tree = render(
    <InputBar
      value={''}
      isStreaming={false}
      showImageAttach
      showAudioAttach
      onAttachImage={foo}
      onAttachAudio={foo}
      onChangeText={foo}
      onSend={foo}
      onStop={foo}
    />,
  ).toJSON();
  expect(tree).toMatchSnapshot();
});

test('pressing + reveals the attach options and hides the text input', () => {
  const screen = render(
    <InputBar
      value={''}
      isStreaming={false}
      showImageAttach
      showAudioAttach
      onAttachImage={foo}
      onAttachAudio={foo}
      onChangeText={foo}
      onSend={foo}
      onStop={foo}
    />,
  );

  const iconNames = () =>
    screen
      .UNSAFE_getAllByType(IconButton as never)
      .map(node => node.props.icon.iosIconName);

  // Collapsed: a single + toggle and the text input, no photo/waveform.
  expect(iconNames()).toContain('plus');
  expect(iconNames()).not.toContain('photo');
  expect(screen.UNSAFE_queryByType(TextInput)).toBeTruthy();

  const toggle = screen
    .UNSAFE_getAllByType(IconButton as never)
    .find(node => node.props.icon.iosIconName === 'plus');
  act(() => toggle?.props.onPress());

  // Expanded: toggle becomes ×, the photo + camera + waveform buttons appear,
  // and the text input is hidden.
  expect(iconNames()).toEqual(
    expect.arrayContaining(['xmark', 'photo', 'camera', 'waveform']),
  );
  // Each attach option carries a label alongside its icon.
  expect(screen.getByText('components.inputBar.photo')).toBeTruthy();
  expect(screen.getByText('components.inputBar.camera')).toBeTruthy();
  expect(screen.getByText('components.inputBar.audio')).toBeTruthy();
  expect(screen.UNSAFE_queryByType(TextInput)).toBeNull();
});

test('the camera button only appears for image-capable models', () => {
  const screen = render(
    <InputBar
      value={''}
      isStreaming={false}
      showAudioAttach
      onAttachAudio={foo}
      onChangeText={foo}
      onSend={foo}
      onStop={foo}
    />,
  );

  const toggle = screen
    .UNSAFE_getAllByType(IconButton as never)
    .find(node => node.props.icon.iosIconName === 'plus');
  act(() => toggle?.props.onPress());

  const iconNames = screen
    .UNSAFE_getAllByType(IconButton as never)
    .map(node => node.props.icon.iosIconName);

  // Audio-only model: the audio option is offered, but neither photo nor camera.
  expect(iconNames).toContain('waveform');
  expect(iconNames).not.toContain('photo');
  expect(iconNames).not.toContain('camera');
});

// Render an image-capable InputBar in its expanded state and report which attach
// icons are visible.
const expandedImageIcons = (imageSource?: 'photo' | 'camera'): string[] => {
  const screen = render(
    <InputBar
      value={''}
      isStreaming={false}
      showImageAttach
      imageSource={imageSource}
      onAttachImage={foo}
      onAttachCamera={foo}
      onChangeText={foo}
      onSend={foo}
      onStop={foo}
    />,
  );
  // Find the toggle by its (stable) label, not its icon — the icon is a
  // paperclip rather than a + once an attachment is present.
  const toggle = screen
    .UNSAFE_getAllByType(IconButton as never)
    .find(
      node =>
        node.props.accessibilityLabel === 'components.inputBar.attach',
    );
  act(() => toggle?.props.onPress());
  return screen
    .UNSAFE_getAllByType(IconButton as never)
    .map(node => node.props.icon.iosIconName);
};

test('with no image attached, both photo and camera are offered', () => {
  const icons = expandedImageIcons(undefined);
  expect(icons).toContain('photo');
  expect(icons).toContain('camera');
});

test('an image attached via Photo hides the Camera button', () => {
  const icons = expandedImageIcons('photo');
  expect(icons).toContain('photo');
  expect(icons).not.toContain('camera');
});

test('an image captured via Camera hides the Photo button', () => {
  const icons = expandedImageIcons('camera');
  expect(icons).toContain('camera');
  expect(icons).not.toContain('photo');
});

test('the toggle shows a paperclip once an attachment is present', () => {
  const screen = render(
    <InputBar
      value={''}
      isStreaming={false}
      showImageAttach
      imageSource="photo"
      onAttachImage={foo}
      onAttachCamera={foo}
      onChangeText={foo}
      onSend={foo}
      onStop={foo}
    />,
  );

  const toggle = screen
    .UNSAFE_getAllByType(IconButton as never)
    .find(
      node => node.props.accessibilityLabel === 'components.inputBar.attach',
    );
  expect(toggle?.props.icon.iosIconName).toBe('paperclip');
  expect(toggle?.props.icon.androidIconName).toBe('attach_file');
});

test('selecting an attachment collapses the expanded tray', () => {
  const props = {
    value: '',
    isStreaming: false,
    showImageAttach: true,
    onAttachImage: foo,
    onAttachCamera: foo,
    onChangeText: foo,
    onSend: foo,
    onStop: foo,
  };
  const screen = render(<InputBar {...props} />);

  // Open the tray — the text input is replaced by the attach options.
  const toggle = screen
    .UNSAFE_getAllByType(IconButton as never)
    .find(
      node => node.props.accessibilityLabel === 'components.inputBar.attach',
    );
  act(() => toggle?.props.onPress());
  expect(screen.UNSAFE_queryByType(TextInput)).toBeNull();

  // An image gets attached (the parent updates imageSource) → tray collapses
  // and the text input is back.
  screen.rerender(<InputBar {...props} imageSource="photo" />);
  expect(screen.UNSAFE_queryByType(TextInput)).toBeTruthy();
});
