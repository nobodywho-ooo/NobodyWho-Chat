import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { mockNavigate } from 'jest/mock/node-modules';

import { SettingsScreen } from '../SettingsScreen';

beforeEach(() => {
  mockNavigate.mockClear();
});

test('renders correctly SettingsScreen', () => {
  expect(render(<SettingsScreen />).toJSON()).toMatchSnapshot();
});

test('pressing models navigates to the ModelsScreen', () => {
  const screen = render(<SettingsScreen />);

  fireEvent.press(
    screen.UNSAFE_getByProps({ title: 'screens.settings.models' }),
  );

  expect(mockNavigate).toHaveBeenCalledWith('ModelsScreen');
});

test('pressing terms & conditions navigates to the TermsScreen', () => {
  const screen = render(<SettingsScreen />);

  fireEvent.press(
    screen.UNSAFE_getByProps({ title: 'screens.settings.terms' }),
  );

  expect(mockNavigate).toHaveBeenCalledWith('TermsScreen');
});

test('pressing privacy policy navigates to the PrivacyPolicyScreen', () => {
  const screen = render(<SettingsScreen />);

  fireEvent.press(
    screen.UNSAFE_getByProps({ title: 'screens.settings.privacyPolicy' }),
  );

  expect(mockNavigate).toHaveBeenCalledWith('PrivacyPolicyScreen');
});
