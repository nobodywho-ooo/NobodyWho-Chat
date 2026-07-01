import React from 'react';
import { render, act } from '@testing-library/react-native';

import { buildModel } from 'jest/factories/model';
import { ModelDownload } from 'types';

import { DownloadingModels } from '../DownloadingModels';

const buildDownload = (id: number, progress: number): ModelDownload => {
  const model = buildModel(id, {
    parts: [
      {
        url: `https://example.com/${id}.gguf`,
        fileName: `${id}.gguf`,
        type: 'model',
        path: '',
        sizeGB: 1,
      },
    ],
  });
  return {
    model,
    partsProgress: model.parts.map(part => ({ ...part, progress })),
  };
};

test('renders correctly DownloadingModels', () => {
  const screen = render(
    <DownloadingModels
      downloads={[buildDownload(1, 0.25), buildDownload(2, 0.75)]}
      onStopPress={jest.fn()}
    />,
  );
  expect(screen.toJSON()).toMatchSnapshot();
});

test('renders correctly DownloadingModels with no active downloads', () => {
  const screen = render(
    <DownloadingModels downloads={[]} onStopPress={jest.fn()} />,
  );
  expect(screen.toJSON()).toMatchSnapshot();
});

test('passes the weighted download progress to each card', () => {
  const download = buildDownload(1, 0.5);
  const screen = render(
    <DownloadingModels downloads={[download]} onStopPress={jest.fn()} />,
  );

  const card = screen.UNSAFE_getByProps({ model: download.model });
  expect(card.props.downloadProgress).toBeCloseTo(0.5);
});

test('pressing a downloading card invokes onStopPress with its model', () => {
  const onStopPress = jest.fn();
  const download = buildDownload(1, 0.5);
  const screen = render(
    <DownloadingModels downloads={[download]} onStopPress={onStopPress} />,
  );

  const card = screen.UNSAFE_getByProps({ model: download.model });
  act(() => card.props.onPress(download.model));

  expect(onStopPress).toHaveBeenCalledWith(download.model);
});
