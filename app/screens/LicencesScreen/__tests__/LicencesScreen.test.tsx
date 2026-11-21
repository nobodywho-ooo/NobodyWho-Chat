import React from 'react';
import { Linking } from 'react-native';
import {
  render,
  fireEvent,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { LicencesScreen } from '../LicencesScreen';

const licences = [
  {
    id: 25,
    modelName: 'LFM2.5',
    licenceType: 'LFM Open License v1.0',
    url: 'https://huggingface.co/LiquidAI/LFM2.5-2.6B/blob/main/LICENSE',
  },
  {
    id: 12,
    modelName: 'Silero VAD',
    licenceType: 'MIT',
    url: 'https://huggingface.co/onnx-community/silero-vad/blob/main/LICENSE',
  },
];

const mockFetch = (implementation: () => Promise<unknown>) => {
  const fetchMock = jest.fn(implementation);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

// ListItem and Button are host mocks in tests: find them by their title prop.
const byTitle = (title: string) =>
  screen.container.queryAll(node => node.props.title === title)[0];

const findRow = async (title: string) => {
  await screen.findByText('screens.licences.models');
  await waitFor(() => expect(byTitle(title)).toBeTruthy());
  return byTitle(title);
};

const respondWith = (body: unknown) =>
  mockFetch(async () => ({ ok: true, json: async () => body }));

test('lists the model licences first, then the others', async () => {
  respondWith(licences);
  await render(<LicencesScreen />);

  await findRow('LFM2.5');
  const texts = screen.container
    .queryAll(
      node =>
        typeof node.props.title === 'string' ||
        typeof node.props.children === 'string',
    )
    .map(node => node.props.title ?? node.props.children);
  const order = [
    'screens.licences.models',
    'LFM2.5',
    'Silero VAD',
    'screens.licences.others',
    'screens.licences.webSearch',
  ].map(text => texts.indexOf(text));

  expect(order).not.toContain(-1);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  expect(byTitle('LFM2.5').props.subtitle).toBe('LFM Open License v1.0');
});

test('pressing a model licence opens its url', async () => {
  respondWith(licences);
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await render(<LicencesScreen />);

  await fireEvent.press(await findRow('Silero VAD'));

  expect(openURL).toHaveBeenCalledWith(licences[1].url);
  openURL.mockRestore();
});

test('pressing the web search licence opens the Private Mind licence', async () => {
  respondWith(licences);
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await render(<LicencesScreen />);

  await fireEvent.press(await findRow('screens.licences.webSearch'));

  expect(openURL).toHaveBeenCalledWith(
    'https://github.com/software-mansion-labs/private-mind/blob/main/LICENSE',
  );
  openURL.mockRestore();
});

test('keeps the other licences and offers a retry when the models fail', async () => {
  const fetchMock = mockFetch(async () => ({ ok: false, status: 500 }));
  await render(<LicencesScreen />);

  expect(await screen.findByText('screens.licences.loadFailed')).toBeTruthy();
  expect(byTitle('screens.licences.webSearch')).toBeTruthy();

  fetchMock.mockImplementation(async () => ({
    ok: true,
    json: async () => licences,
  }));
  await fireEvent.press(byTitle('common.retry'));

  expect(await findRow('LFM2.5')).toBeTruthy();
  expect(screen.queryByText('screens.licences.loadFailed')).toBeNull();
});
