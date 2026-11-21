import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import i18n from 'i18next';

import { getStorage } from 'database';

import { LanguageScreen } from '../LanguageScreen';

const storage = getStorage() as unknown as {
  getItemSync: jest.Mock;
  setItemSync: jest.Mock;
  removeItemSync: jest.Mock;
};

beforeEach(() => {
  storage.getItemSync.mockReset();
  storage.setItemSync.mockClear();
  storage.removeItemSync.mockClear();
});

test('marks the device language as selected when nothing is saved', async () => {
  const screen = await render(<LanguageScreen />);

  expect(
    screen.getByRole('radio', { name: /screens.language.system/ }).props
      .accessibilityState,
  ).toEqual({ selected: true });
});

test('marks the saved language as selected', async () => {
  storage.getItemSync.mockReturnValue('fr');
  const screen = await render(<LanguageScreen />);

  expect(
    screen.getByRole('radio', { name: /Français/ }).props.accessibilityState,
  ).toEqual({ selected: true });
});

test('picking a language saves it and switches the app to it', async () => {
  const screen = await render(<LanguageScreen />);

  await fireEvent.press(screen.getByText('Français'));

  expect(storage.setItemSync).toHaveBeenCalledWith('app_language', 'fr');
  expect(i18n.language).toBe('fr');
});

test('picking the device language forgets the saved choice', async () => {
  storage.getItemSync.mockReturnValue('da');
  const screen = await render(<LanguageScreen />);

  await fireEvent.press(screen.getByText('screens.language.system'));

  expect(storage.removeItemSync).toHaveBeenCalledWith('app_language');
  expect(i18n.language).toBe('en');
});
