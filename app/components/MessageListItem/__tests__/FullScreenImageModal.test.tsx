import React from 'react';
import { Image, Modal } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { FullScreenImageModal } from '../FullScreenImageModal';

test('shows the image when a uri is provided', () => {
  const { UNSAFE_getByType } = render(
    <FullScreenImageModal uri="file:///img.jpg" onClose={jest.fn()} />,
  );

  expect(UNSAFE_getByType(Modal).props.visible).toBe(true);
  expect(UNSAFE_getByType(Image).props.source).toEqual({ uri: 'file:///img.jpg' });
});

test('calls onClose when the close button is pressed', () => {
  const onClose = jest.fn();
  const { getByLabelText } = render(
    <FullScreenImageModal uri="file:///img.jpg" onClose={onClose} />,
  );

  fireEvent.press(getByLabelText('components.messageListItem.closeImage'));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('is hidden and renders no image when uri is null', () => {
  const { UNSAFE_getByType, UNSAFE_queryByType } = render(
    <FullScreenImageModal uri={null} onClose={jest.fn()} />,
  );

  expect(UNSAFE_getByType(Modal).props.visible).toBe(false);
  expect(UNSAFE_queryByType(Image)).toBeNull();
});

test('matches the snapshot when showing an image', () => {
  const { toJSON } = render(
    <FullScreenImageModal uri="file:///img.jpg" onClose={jest.fn()} />,
  );
  expect(toJSON()).toMatchSnapshot();
});
