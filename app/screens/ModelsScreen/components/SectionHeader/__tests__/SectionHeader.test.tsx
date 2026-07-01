import React from 'react';
import { render } from '@testing-library/react-native';

import { SectionHeader } from '../SectionHeader';

test('renders correctly SectionHeader', () => {
  const screen = render(<SectionHeader title="My section" />);
  expect(screen.toJSON()).toMatchSnapshot();
});

test('renders correctly SectionHeader when first (no top spacing)', () => {
  const screen = render(<SectionHeader title="My section" first />);
  expect(screen.toJSON()).toMatchSnapshot();
});

test('applies the first vs default header style', () => {
  const first = render(<SectionHeader title="First" first />).toJSON();
  const later = render(<SectionHeader title="Later" />).toJSON();

  // The `first` variant uses a different style than a subsequent header, so the
  // two trees must not be identical apart from their text.
  expect(JSON.stringify(first)).not.toEqual(
    JSON.stringify(later).replace('Later', 'First'),
  );
});
