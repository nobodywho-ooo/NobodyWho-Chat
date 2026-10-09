import React from 'react';
import { Linking } from 'react-native';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';

import { CameraCaptureModal } from '../CameraCaptureModal';

// Controllable expo-camera stand-in. The global node-modules mock hard-codes a
// granted permission, but this suite exercises every permission branch, so it
// overrides expo-camera with mutable permission state and a CameraView whose ref
// exposes a stubbed takePictureAsync.
let mockPermission: {
  granted: boolean;
  canAskAgain: boolean;
} | null = { granted: true, canAskAgain: true };
const mockRequestPermission = jest.fn();
const mockTakePicture = jest.fn();

jest.mock('expo-camera', () => {
  const mockReact = require('react');
  return {
    CameraView: mockReact.forwardRef((_props: unknown, ref: unknown) => {
      mockReact.useImperativeHandle(ref, () => ({
        takePictureAsync: mockTakePicture,
      }));
      return null;
    }),
    useCameraPermissions: () => [mockPermission, mockRequestPermission],
  };
});

const renderModal = async (
  props?: Partial<React.ComponentProps<typeof CameraCaptureModal>>,
) => {
  const onClose = jest.fn();
  const onCapture = jest.fn();
  const screen = await render(
    <CameraCaptureModal
      visible
      onClose={onClose}
      onCapture={onCapture}
      {...props}
    />,
  );
  return { screen, onClose, onCapture };
};

beforeEach(() => {
  mockPermission = { granted: true, canAskAgain: true };
  mockRequestPermission.mockClear();
  mockTakePicture.mockReset();
});

test('requests camera permission when shown without it', async () => {
  mockPermission = { granted: false, canAskAgain: true };
  await renderModal();
  expect(mockRequestPermission).toHaveBeenCalled();
});

test('does not request permission while it is not visible', async () => {
  mockPermission = { granted: false, canAskAgain: true };
  await renderModal({ visible: false });
  expect(mockRequestPermission).not.toHaveBeenCalled();
});

test('renders the shutter once permission is granted', async () => {
  mockPermission = { granted: true, canAskAgain: true };
  const { screen } = await renderModal();
  expect(
    screen.getByLabelText('components.inputBar.attachCamera'),
  ).toBeTruthy();
  expect(mockRequestPermission).not.toHaveBeenCalled();
});

test('the prompt re-requests permission when it can still be asked', async () => {
  mockPermission = { granted: false, canAskAgain: true };
  const { screen } = await renderModal();
  // The mount effect already fired one request; isolate the button press.
  mockRequestPermission.mockClear();

  // The handler only calls the (mocked) permission request — no React state
  // update — so it is invoked directly rather than through act().
  const [button] = screen.container.queryAll(
    node => node.props.title === 'components.cameraCapture.grant',
  );
  button.props.onPress();

  expect(mockRequestPermission).toHaveBeenCalledTimes(1);
});

test('the prompt opens system settings when permission is permanently denied', async () => {
  const openSettingsSpy = jest
    .spyOn(Linking, 'openSettings')
    .mockImplementation(() => Promise.resolve());
  mockPermission = { granted: false, canAskAgain: false };

  const { screen } = await renderModal();
  // A permanently denied permission must not auto-prompt; the user is sent to
  // settings instead.
  expect(mockRequestPermission).not.toHaveBeenCalled();

  const [button] = screen.container.queryAll(
    node => node.props.title === 'components.cameraCapture.openSettings',
  );
  button.props.onPress();

  expect(openSettingsSpy).toHaveBeenCalled();
  openSettingsSpy.mockRestore();
});

test('captures a photo and forwards it to onCapture', async () => {
  mockPermission = { granted: true, canAskAgain: true };
  mockTakePicture.mockResolvedValue({
    uri: 'file://photo.jpg',
    width: 200,
    height: 100,
  });

  const { screen, onCapture } = await renderModal();
  await fireEvent.press(
    screen.getByLabelText('components.inputBar.attachCamera'),
  );

  await waitFor(() =>
    expect(onCapture).toHaveBeenCalledWith({
      uri: 'file://photo.jpg',
      width: 200,
      height: 100,
    }),
  );
  expect(mockTakePicture).toHaveBeenCalledWith({ quality: 1 });
});

test('swallows a failed capture without calling onCapture', async () => {
  mockPermission = { granted: true, canAskAgain: true };
  mockTakePicture.mockRejectedValue(new Error('capture failed'));

  const { screen, onCapture } = await renderModal();
  await act(async () => {
    await fireEvent.press(
      screen.getByLabelText('components.inputBar.attachCamera'),
    );
  });

  expect(onCapture).not.toHaveBeenCalled();
});

test('the close button calls onClose', async () => {
  const { screen, onClose } = await renderModal();
  await fireEvent.press(
    screen.getByLabelText('components.cameraCapture.close'),
  );
  expect(onClose).toHaveBeenCalled();
});
