import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { mockRouter } from 'jest/mock/node-modules';

import { Welcome } from '../Welcome';

const renderWelcome = () => render(<Welcome />);

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

  ['assistant', 'private', 'fast', 'webSearch'].forEach(feature => {
    screen.getByText(`screens.onboarding.welcome.${feature}.title`);
    screen.getByText(`screens.onboarding.welcome.${feature}.subtitle`);
  });
});

test('continues to the text model choice, leaving nothing to go back to', async () => {
  await renderWelcome();

  await fireEvent.press(screen.getByTestId('onboarding-continue-button'));

  expect(mockRouter.replace).toHaveBeenCalledWith('/onboarding/text-model');
});
