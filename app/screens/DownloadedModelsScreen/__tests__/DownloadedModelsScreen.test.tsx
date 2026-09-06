import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';

import { getDocumentPathsByModelId } from 'repositories';
import { deleteMessageDocuments } from 'helpers';
import { mockSetAppState } from 'jest/mock/database';
import { mockUseAppState, mockUseModels } from 'jest/mock/hooks';
import { mockGoBack, mockSetOptions, mockUseRoute } from 'jest/mock/node-modules';
import { buildModel } from 'jest/factories/model';

import { DownloadedModelsScreen } from '../DownloadedModelsScreen';

// The screen stops any in-flight generation before switching models; expose the
// chat ref so that can be asserted. Deleting the selected voice model also
// disposes the TTS engine before its files go away.
const mockStopGeneration = jest.fn();
const mockDisposeTts = jest.fn();
const mockDisposeChat = jest.fn();
const mockChat = { current: { stopGeneration: mockStopGeneration } };
jest.mock('services', () => ({
  useAiService: () => ({
    chat: mockChat,
    disposeTts: mockDisposeTts,
    disposeChat: mockDisposeChat,
  }),
}));

// Deleting a model also clears any message attachments that belonged to its
// conversations. Stub the lookup + delete so the cleanup wiring can be asserted
// (the underlying query/fs behaviour is covered in their own unit tests).
jest.mock('repositories', () => ({
  ...jest.requireActual('repositories'),
  getDocumentPathsByModelId: jest.fn(),
}));
jest.mock('helpers', () => ({
  ...jest.requireActual('helpers'),
  deleteMessageDocuments: jest.fn(),
}));
const mockGetDocumentPaths = getDocumentPathsByModelId as jest.Mock;
const mockDeleteMessageDocuments = deleteMessageDocuments as jest.Mock;

const headerToggle = () => {
  const headerRight = mockSetOptions.mock.calls.at(-1)![0].headerRight;
  const [toggle] = React.Children.toArray(
    headerRight().props.children,
  ) as React.ReactElement<{ onPress: () => void }>[];
  return toggle;
};

beforeEach(() => {
  mockUseModels.mockReturnValue({ models: [] });
  mockUseAppState.mockReturnValue({});
  mockUseRoute.mockReturnValue({ params: { canDelete: true } });
  mockSetAppState.mockClear();
  mockSetOptions.mockClear();
  mockStopGeneration.mockClear();
  mockDisposeTts.mockClear();
  mockDisposeChat.mockClear();
  mockGoBack.mockClear();
  mockChat.current = { stopGeneration: mockStopGeneration };
  mockGetDocumentPaths.mockReset().mockResolvedValue([]);
  mockDeleteMessageDocuments.mockReset().mockResolvedValue(undefined);
});

test('renders correctly ModelsScreen when empty', () => {
  const screen = render(<DownloadedModelsScreen />);
  expect(screen.toJSON()).toMatchSnapshot();
});

test('renders downloaded models with one selected', () => {
  mockUseModels.mockReturnValue({ models: [buildModel(1), buildModel(2)] });
  mockUseAppState.mockReturnValue({ modelIdInUse: 2 });

  const screen = render(<DownloadedModelsScreen />);
  expect(screen.toJSON()).toMatchSnapshot();
});

test('pressing a model puts it in use, clear the conversation', () => {
  const models = [buildModel(1), buildModel(2)];
  mockUseModels.mockReturnValue({ models });
  mockUseAppState.mockReturnValue({ modelIdInUse: 1 });

  const screen = render(<DownloadedModelsScreen />);
  fireEvent.press(screen.UNSAFE_getByProps({ model: models[1] }), models[1]);

  // Streaming is stopped before the model switch tears down the chat.
  expect(mockStopGeneration).toHaveBeenCalled();
  expect(mockSetAppState).toHaveBeenCalledWith({
    modelIdInUse: 2,
    conversationIdInUse: undefined,
  });
  // The screen dismisses itself so the user returns to the chat.
  expect(mockGoBack).toHaveBeenCalled();
});

test('pressing the already-in-use model does nothing (no switch, no dismiss)', () => {
  const models = [buildModel(1), buildModel(2)];
  mockUseModels.mockReturnValue({ models });
  mockUseAppState.mockReturnValue({ modelIdInUse: 2 });

  const screen = render(<DownloadedModelsScreen />);
  fireEvent.press(screen.UNSAFE_getByProps({ model: models[1] }), models[1]);

  expect(mockSetAppState).not.toHaveBeenCalled();
  expect(mockGoBack).not.toHaveBeenCalled();
});

test('delete mode: confirming the alert deletes the in-use model and clears it from use', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const models = [buildModel(1), buildModel(2)];
  mockUseModels.mockReturnValue({ models });
  mockUseAppState.mockReturnValue({ modelIdInUse: 2 });
  mockGetDocumentPaths.mockResolvedValue(['a.png', 'b.mp3']);

  const screen = render(<DownloadedModelsScreen />);

  // The delete toggle lives in the header (set via navigation.setOptions); it is
  // the first header-right action, with the close button after it on iOS.
  act(() => headerToggle().props.onPress());

  // In delete mode, pressing a model prompts for confirmation rather than
  // deleting outright.
  const card = screen.UNSAFE_getByProps({ model: models[1] });
  expect(card.props.deleteMode).toBe(true);
  act(() => card.props.onPress(models[1]));

  expect(alertSpy).toHaveBeenCalled();
  expect(mockSetAppState).not.toHaveBeenCalled();

  // Tapping the destructive confirm button performs the deletion.
  const buttons = alertSpy.mock.calls.at(-1)![2]!;
  const confirm = buttons.find(button => button.style === 'destructive')!;
  await act(async () => {
    confirm.onPress?.();
  });

  await waitFor(() =>
    expect(mockSetAppState).toHaveBeenCalledWith({
      modelIdInUse: undefined,
      conversationIdInUse: undefined,
    }),
  );

  // Deleting the in-use chat model tears down its loaded chat.
  expect(mockDisposeChat).toHaveBeenCalled();

  // The deleted model's attachment files are looked up and cleaned up too, so
  // they don't outlive the conversations that referenced them.
  expect(mockGetDocumentPaths).toHaveBeenCalledWith(2);
  expect(mockDeleteMessageDocuments).toHaveBeenCalledWith(['a.png', 'b.mp3']);
  alertSpy.mockRestore();
});

test('without canDelete (drawer entry) deletion is unavailable', () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockUseRoute.mockReturnValue({ params: { canDelete: false } });
  const models = [buildModel(1), buildModel(2)];
  mockUseModels.mockReturnValue({ models });
  mockUseAppState.mockReturnValue({ modelIdInUse: 1 });

  const screen = render(<DownloadedModelsScreen />);

  // Pressing a model just selects it, with no confirmation alert. (Done before
  // rendering the header below, since a second render tree breaks fireEvent.)
  fireEvent.press(screen.UNSAFE_getByProps({ model: models[1] }), models[1]);
  expect(alertSpy).not.toHaveBeenCalled();
  expect(mockSetAppState).toHaveBeenCalledWith({
    modelIdInUse: 2,
    conversationIdInUse: undefined,
  });

  // No delete toggle is rendered in the header (no trash icon).
  const headerRight = mockSetOptions.mock.calls.at(-1)![0].headerRight;
  const header = render(headerRight());
  expect(header.UNSAFE_queryAllByProps({ iosIconName: 'trash' })).toHaveLength(0);

  alertSpy.mockRestore();
});

test('pressing a TTS model selects it as the voice — never as the chat model', () => {
  const { ModelPipeline } = jest.requireActual('types');
  const models = [
    buildModel(1),
    buildModel(7, { pipeline: ModelPipeline.textToSpeech }),
  ];
  mockUseModels.mockReturnValue({ models });
  mockUseAppState.mockReturnValue({ modelIdInUse: 1 });

  const screen = render(<DownloadedModelsScreen />);
  fireEvent.press(screen.UNSAFE_getByProps({ model: models[1] }), models[1]);

  expect(mockSetAppState).toHaveBeenCalledWith(
    expect.objectContaining({ ttsModelIdInUse: 7 }),
  );
  expect(mockSetAppState).not.toHaveBeenCalledWith(
    expect.objectContaining({ modelIdInUse: 7 }),
  );
  // Selecting a voice doesn't touch the running chat.
  expect(mockStopGeneration).not.toHaveBeenCalled();
  expect(mockGoBack).toHaveBeenCalled();
});

test('the checkmark reflects each pipeline against its own in-use slot', () => {
  const { ModelPipeline } = jest.requireActual('types');
  const models = [
    buildModel(1),
    buildModel(7, { pipeline: ModelPipeline.textToSpeech }),
  ];
  mockUseModels.mockReturnValue({ models });
  // Chat slot points at 1, voice slot at 7 — both cards show as selected.
  mockUseAppState.mockReturnValue({ modelIdInUse: 1, ttsModelIdInUse: 7 });

  const screen = render(<DownloadedModelsScreen />);
  expect(
    screen.UNSAFE_getByProps({ model: models[0] }).props.isSelected,
  ).toBe(true);
  expect(
    screen.UNSAFE_getByProps({ model: models[1] }).props.isSelected,
  ).toBe(true);
});

test('deleting the selected voice model disposes the engine and clears the slot', async () => {
  const { ModelPipeline } = jest.requireActual('types');
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const models = [
    buildModel(1),
    buildModel(7, { pipeline: ModelPipeline.textToSpeech }),
  ];
  mockUseModels.mockReturnValue({ models });
  mockUseAppState.mockReturnValue({ modelIdInUse: 1, ttsModelIdInUse: 7 });

  const screen = render(<DownloadedModelsScreen />);
  act(() => headerToggle().props.onPress());
  act(() =>
    screen.UNSAFE_getByProps({ model: models[1] }).props.onPress(models[1]),
  );

  const buttons = alertSpy.mock.calls.at(-1)![2]!;
  const confirm = buttons.find(button => button.style === 'destructive')!;
  await act(async () => {
    confirm.onPress?.();
  });

  await waitFor(() =>
    expect(mockSetAppState).toHaveBeenCalledWith({ ttsModelIdInUse: undefined }),
  );
  // The engine teardown is enqueued before the files are removed.
  expect(mockDisposeTts).toHaveBeenCalled();
  // The chat slot is untouched.
  expect(mockSetAppState).not.toHaveBeenCalledWith(
    expect.objectContaining({ modelIdInUse: undefined }),
  );
  alertSpy.mockRestore();
});
