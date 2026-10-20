import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { OnboardingScreenProps } from '../../../Onboarding.types';
import { Welcome } from '../Welcome';

const navigation = { replace: jest.fn() };

const renderWelcome = () =>
  render(
    <Welcome
      {...({
        navigation,
        route: { key: 'Welcome', name: 'Welcome' },
      } as unknown as OnboardingScreenProps<'Welcome'>)}
    />,
  );

beforeEach(() => {
  jest.clearAllMocks();
});

test('greets with the app name', async () => {
  await renderWelcome();

  screen.getByText('screens.onboarding.welcome.title', { exact: false });
  screen.getByText('nobodywho chat', { exact: false });
  // Only the brand is coloured; "chat" keeps the title's colour.
  screen.getByText('nobodywho');
});

test('presents each feature with its title and subtitle', async () => {
  await renderWelcome();

  ['assistant', 'private', 'fast'].forEach(feature => {
    screen.getByText(`screens.onboarding.welcome.${feature}.title`);
    screen.getByText(`screens.onboarding.welcome.${feature}.subtitle`);
  });
});

test('continues to the text model choice, leaving nothing to go back to', async () => {
  await renderWelcome();

  await fireEvent.press(screen.getByTestId('onboarding-continue-button'));

  expect(navigation.replace).toHaveBeenCalledWith('TextModelChoice');
});
