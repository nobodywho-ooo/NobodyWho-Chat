import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { FullScreenImageModal } from '../UserMessage/FullScreenImageModal';

test('shows the image when a uri is provided', async () => {
  const { container, getByLabelText } = await render(
    <FullScreenImageModal uri="file:///img.jpg" onClose={jest.fn()} />,
  );

  expect(
    getByLabelText('components.messageListItem.closeImage'),
  ).toBeOnTheScreen();
  const [image] = container.queryAll(node => node.type === 'Image');
  expect(image.props.source).toEqual({
    uri: 'file:///img.jpg',
  });
});

test('calls onClose when the close button is pressed', async () => {
  const onClose = jest.fn();
  const { getByLabelText } = await render(
    <FullScreenImageModal uri="file:///img.jpg" onClose={onClose} />,
  );

  await fireEvent.press(
    getByLabelText('components.messageListItem.closeImage'),
  );
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('is hidden and renders no image when uri is null', async () => {
  const { container, queryByLabelText } = await render(
    <FullScreenImageModal uri={null} onClose={jest.fn()} />,
  );

  expect(queryByLabelText('components.messageListItem.closeImage')).toBeNull();
  expect(container.queryAll(node => node.type === 'Image')).toHaveLength(0);
});

test('matches the snapshot when showing an image', async () => {
  const { toJSON } = await render(
    <FullScreenImageModal uri="file:///img.jpg" onClose={jest.fn()} />,
  );
  expect(toJSON()).toMatchSnapshot();
});
