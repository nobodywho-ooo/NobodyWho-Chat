import React from 'react';
import { Linking } from 'react-native';
import {
  render,
  fireEvent,
  type RenderResult,
} from '@testing-library/react-native';

import { mockNavigate } from 'jest/mock/node-modules';

import { SettingsScreen } from '../SettingsScreen';

const getRow = (screen: RenderResult, title: string) => {
  const [row] = screen.container.queryAll(node => node.props.title === title);
  return row;
};

beforeEach(() => {
  mockNavigate.mockClear();
});

test('renders correctly SettingsScreen', async () => {
  expect((await render(<SettingsScreen />)).toJSON()).toMatchSnapshot();
});

// Models moved to the drawer, next to the conversations.
test('does not list models', async () => {
  const screen = await render(<SettingsScreen />);

  expect(screen.queryByText('screens.settings.models')).toBeNull();
});

test('pressing customize navigates to the CustomizeAssistantScreen', async () => {
  const screen = await render(<SettingsScreen />);

  await fireEvent.press(getRow(screen, 'screens.settings.customize'));

  expect(mockNavigate).toHaveBeenCalledWith('CustomizeAssistantScreen');
});

test('pressing language navigates to the LanguageScreen', async () => {
  const screen = await render(<SettingsScreen />);

  await fireEvent.press(getRow(screen, 'screens.settings.language'));

  expect(mockNavigate).toHaveBeenCalledWith('LanguageScreen');
});

test('pressing terms & conditions navigates to the TermsScreen', async () => {
  const screen = await render(<SettingsScreen />);

  await fireEvent.press(getRow(screen, 'screens.settings.terms'));

  expect(mockNavigate).toHaveBeenCalledWith('TermsScreen');
});

test('pressing privacy policy navigates to the PrivacyPolicyScreen', async () => {
  const screen = await render(<SettingsScreen />);

  await fireEvent.press(getRow(screen, 'screens.settings.privacyPolicy'));

  expect(mockNavigate).toHaveBeenCalledWith('PrivacyPolicyScreen');
});

test('pressing website opens the NobodyWho site', async () => {
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const screen = await render(<SettingsScreen />);

  await fireEvent.press(screen.getByText('screens.settings.website'));

  expect(openURL).toHaveBeenCalledWith('https://www.nobodywho.ai/');

  openURL.mockRestore();
});
