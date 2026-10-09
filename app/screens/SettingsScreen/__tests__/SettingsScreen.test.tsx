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

test('pressing models navigates to the ModelsScreen', async () => {
  const screen = await render(<SettingsScreen />);

  await fireEvent.press(getRow(screen, 'screens.settings.models'));

  expect(mockNavigate).toHaveBeenCalledWith('ModelsScreen');
});

test('pressing customize navigates to the CustomizeAssistantScreen', async () => {
  const screen = await render(<SettingsScreen />);

  await fireEvent.press(getRow(screen, 'screens.settings.customize'));

  expect(mockNavigate).toHaveBeenCalledWith('CustomizeAssistantScreen');
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

  await fireEvent.press(getRow(screen, 'screens.settings.website'));

  expect(openURL).toHaveBeenCalledWith('https://www.nobodywho.ai/');

  openURL.mockRestore();
});
