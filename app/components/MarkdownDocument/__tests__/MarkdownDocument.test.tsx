import React from 'react';
import { render } from '@testing-library/react-native';
import { MarkdownDocument } from '../MarkdownDocument';

jest.mock('react-native-enriched-markdown', () => ({
  EnrichedMarkdownText: 'EnrichedMarkdownText',
}));

describe('MarkdownDocument', () => {
  test('forwards the markdown to EnrichedMarkdownText', () => {
    const json = JSON.stringify(
      render(<MarkdownDocument markdown="# Hello world" />).toJSON(),
    );

    expect(json).toContain('# Hello world');
  });

  test('matches snapshot', () => {
    expect(
      render(<MarkdownDocument markdown="# Hello world" />).toJSON(),
    ).toMatchSnapshot();
  });
});
