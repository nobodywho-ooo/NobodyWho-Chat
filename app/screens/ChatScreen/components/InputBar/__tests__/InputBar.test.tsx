import React from 'react';
import { TextInput } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { IconButton } from 'components';

import { InputBar } from '../InputBar';

jest.unmock('../InputBar');

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

test('renders correctly InputBar', () => {
  const tree = render(<StatefulInputBar />).toJSON();
  expect(tree).toMatchSnapshot();
});

test('renders correctly InputBar with value', () => {
  const tree = render(<StatefulInputBar value={'Type here'} />).toJSON();
  expect(tree).toMatchSnapshot();
});

test('renders correctly InputBar when streaming', () => {
  const tree = render(<StatefulInputBar isStreaming />).toJSON();
  expect(tree).toMatchSnapshot();
});

test('renders the collapsed + toggle when attachments are enabled', () => {
  const tree = render(
    <StatefulInputBar
      showImageAttach
      showAudioAttach
      onAttachImage={foo}
      onAttachAudio={foo}
    />,
  ).toJSON();
  expect(tree).toMatchSnapshot();
});

test('pressing + lists the attach options and keeps the text input', () => {
  const screen = render(
    <StatefulInputBar
      showImageAttach
      showAudioAttach
      onAttachImage={foo}
      onAttachAudio={foo}
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

  // Expanded: toggle becomes ×, the photo + camera + waveform options are
  // listed, and the text input stays visible.
  expect(iconNames()).toEqual(
    expect.arrayContaining(['xmark', 'photo', 'camera', 'waveform']),
  );
  // Each attach option carries a label alongside its icon.
  expect(screen.getByText('components.inputBar.photo')).toBeTruthy();
  expect(screen.getByText('components.inputBar.camera')).toBeTruthy();
  expect(screen.getByText('components.inputBar.audio')).toBeTruthy();
  expect(screen.UNSAFE_queryByType(TextInput)).toBeTruthy();
});

test('the camera button only appears for image-capable models', () => {
  const screen = render(
    <StatefulInputBar showAudioAttach onAttachAudio={foo} />,
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
    <StatefulInputBar
      showImageAttach
      imageSource={imageSource}
      onAttachImage={foo}
      onAttachCamera={foo}
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

test('with an image attached, only the image option is listed', () => {
  const screen = render(
    <StatefulInputBar
      showImageAttach
      showAudioAttach
      imageSource="photo"
      onAttachImage={foo}
      onAttachCamera={foo}
      onAttachAudio={foo}
    />,
  );

  const toggle = screen
    .UNSAFE_getAllByType(IconButton as never)
    .find(
      node => node.props.accessibilityLabel === 'components.inputBar.attach',
    );
  act(() => toggle?.props.onPress());

  const iconNames = screen
    .UNSAFE_getAllByType(IconButton as never)
    .map(node => node.props.icon.iosIconName);
  expect(iconNames).toContain('photo');
  expect(iconNames).not.toContain('camera');
  expect(iconNames).not.toContain('waveform');
  // The remaining option offers to unselect the attachment.
  expect(screen.getByText('components.inputBar.unselect')).toBeTruthy();
});

test('with audio attached, only the audio option is listed', () => {
  const screen = render(
    <StatefulInputBar
      showImageAttach
      showAudioAttach
      hasAudio
      onAttachImage={foo}
      onAttachCamera={foo}
      onAttachAudio={foo}
    />,
  );

  const toggle = screen
    .UNSAFE_getAllByType(IconButton as never)
    .find(
      node => node.props.accessibilityLabel === 'components.inputBar.attach',
    );
  act(() => toggle?.props.onPress());

  const iconNames = screen
    .UNSAFE_getAllByType(IconButton as never)
    .map(node => node.props.icon.iosIconName);
  expect(iconNames).toContain('waveform');
  expect(iconNames).not.toContain('photo');
  expect(iconNames).not.toContain('camera');
  expect(screen.getByText('components.inputBar.unselect')).toBeTruthy();
});

test('the toggle shows a paperclip once an attachment is present', () => {
  const screen = render(
    <StatefulInputBar
      showImageAttach
      imageSource="photo"
      onAttachImage={foo}
      onAttachCamera={foo}
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
    showImageAttach: true,
    onAttachImage: foo,
    onAttachCamera: foo,
  };
  const screen = render(<StatefulInputBar {...props} />);

  // Open the tray — the attach options are listed above the input.
  const toggle = screen
    .UNSAFE_getAllByType(IconButton as never)
    .find(
      node => node.props.accessibilityLabel === 'components.inputBar.attach',
    );
  act(() => toggle?.props.onPress());
  expect(screen.queryByText('components.inputBar.photo')).toBeTruthy();

  // An image gets attached (the parent updates imageSource) → tray collapses.
  screen.rerender(<StatefulInputBar {...props} imageSource="photo" />);
  expect(screen.queryByText('components.inputBar.photo')).toBeNull();
});

test('sending closes the expanded tray', () => {
  const onSend = jest.fn();
  const screen = render(
    <StatefulInputBar
      value={'hello'}
      showImageAttach
      onAttachImage={foo}
      onAttachCamera={foo}
      onSend={onSend}
    />,
  );

  const toggle = screen
    .UNSAFE_getAllByType(IconButton as never)
    .find(
      node => node.props.accessibilityLabel === 'components.inputBar.attach',
    );
  act(() => toggle?.props.onPress());
  expect(screen.queryByText('components.inputBar.photo')).toBeTruthy();

  // The send button is the icon button with the arrow-up icon.
  const send = screen
    .UNSAFE_getAllByType(IconButton as never)
    .find(node => node.props.icon.iosIconName === 'arrow.up');
  act(() => send?.props.onPress());

  expect(onSend).toHaveBeenCalled();
  expect(screen.queryByText('components.inputBar.photo')).toBeNull();
});
