import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('react-native-enriched-markdown', () => ({
  EnrichedMarkdownText: 'EnrichedMarkdownText',
}));

import { TermsScreen } from '../TermsScreen';

describe('TermsScreen', () => {
  test('renders the terms content for NobodyWho ApS', async () => {
    const json = JSON.stringify((await render(<TermsScreen />)).toJSON());

    expect(json).toContain('Terms & Conditions');
    expect(json).toContain('NobodyWho ApS');
    expect(json).toContain('46025350');
  });
});
