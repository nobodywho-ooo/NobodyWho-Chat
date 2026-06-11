import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('react-native-enriched-markdown', () => ({
  EnrichedMarkdownText: 'EnrichedMarkdownText',
}));

import { PrivacyPolicyScreen } from '../PrivacyPolicyScreen';

describe('PrivacyPolicyScreen', () => {
  test('renders the privacy policy content for NobodyWho ApS', () => {
    const json = JSON.stringify(render(<PrivacyPolicyScreen />).toJSON());

    expect(json).toContain('Privacy Policy');
    expect(json).toContain('NobodyWho ApS');
    expect(json).toContain('46025350');
  });
});
