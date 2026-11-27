import React from 'react';
import { Alert, Linking } from 'react-native';
import {
  render,
  fireEvent,
  waitFor,
  type RenderResult,
} from '@testing-library/react-native';

import { mockRouter } from 'jest/mock/node-modules';

import { SettingsScreen } from '../SettingsScreen';

const getRow = (screen: RenderResult, title: string) => {
  const [row] = screen.container.queryAll(node => node.props.title === title);
  return row;
};

beforeEach(() => {
  mockRouter.push.mockClear();
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

  expect(mockRouter.push).toHaveBeenCalledWith('/settings/customize-assistant');
});

test('pressing language navigates to the LanguageScreen', async () => {
  const screen = await render(<SettingsScreen />);

  await fireEvent.press(getRow(screen, 'screens.settings.language'));

  expect(mockRouter.push).toHaveBeenCalledWith('/settings/language');
});

test('pressing terms & conditions navigates to the TermsScreen', async () => {
  const screen = await render(<SettingsScreen />);

  await fireEvent.press(getRow(screen, 'screens.settings.terms'));

  expect(mockRouter.push).toHaveBeenCalledWith('/settings/terms');
});

test('pressing privacy policy navigates to the PrivacyPolicyScreen', async () => {
  const screen = await render(<SettingsScreen />);

  await fireEvent.press(getRow(screen, 'screens.settings.privacyPolicy'));

  expect(mockRouter.push).toHaveBeenCalledWith('/settings/privacy-policy');
});

test('pressing acknowledgements navigates to the AcknowledgementsScreen', async () => {
  const screen = await render(<SettingsScreen />);

  await fireEvent.press(getRow(screen, 'screens.settings.acknowledgements'));

  expect(mockRouter.push).toHaveBeenCalledWith('/settings/acknowledgements');
});

test('the Links row opens the links sheet, closed by its close icon', async () => {
  const screen = await render(<SettingsScreen />);

  expect(screen.queryByTestId('links-sheet')).toBeNull();
  expect(screen.queryByText('screens.settings.website')).toBeNull();

  await fireEvent.press(getRow(screen, 'screens.settings.links'));

  expect(screen.getByTestId('links-sheet')).toBeTruthy();

  await fireEvent.press(screen.getByTestId('links-sheet-close'));

  expect(screen.queryByTestId('links-sheet')).toBeNull();
});

test.each([
  ['website', 'https://www.nobodywho.ai/'],
  ['nobodywho-github', 'https://github.com/nobodywho-ooo/nobodywho'],
  ['app-repository', 'https://github.com/nobodywho-ooo/NobodyWho-Chat'],
  ['x', 'https://x.com/nobodywho_ai'],
])('the %s link opens %s', async (key, url) => {
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const screen = await render(<SettingsScreen />);

  await fireEvent.press(getRow(screen, 'screens.settings.links'));
  await fireEvent.press(screen.getByTestId(`link-${key}`));

  expect(openURL).toHaveBeenCalledWith(url);
  openURL.mockRestore();
});

test('Feedback, just before Rate the app, opens an email to us about this platform', async () => {
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const screen = await render(<SettingsScreen />);
  const titles = screen.container
    .queryAll(node => typeof node.props.title === 'string')
    .map(node => node.props.title);

  expect(titles.indexOf('screens.settings.feedback')).toBe(
    titles.indexOf('screens.settings.rateApp') - 1,
  );

  await fireEvent.press(getRow(screen, 'screens.settings.feedback'));

  expect(openURL).toHaveBeenCalledWith(
    'mailto:pierre@nobodywho.ai?subject=iOS%20app%20feedback',
  );
  openURL.mockRestore();
});

test('Feedback shows our address when no email app can open it', async () => {
  const openURL = jest
    .spyOn(Linking, 'openURL')
    .mockRejectedValue(new Error('no handler'));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const screen = await render(<SettingsScreen />);

  await fireEvent.press(getRow(screen, 'screens.settings.feedback'));

  await waitFor(() =>
    expect(alert).toHaveBeenCalledWith(
      'screens.settings.feedbackUnavailableTitle',
      'screens.settings.feedbackUnavailableMessage',
    ),
  );
  openURL.mockRestore();
  alert.mockRestore();
});
