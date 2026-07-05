import React from 'react';
import { Linking } from 'react-native';
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

  test('opens a tapped link', () => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const { UNSAFE_getByType } = render(
      <MarkdownDocument markdown="[link](https://example.com)" />,
    );

    UNSAFE_getByType('EnrichedMarkdownText' as any).props.onLinkPress({
      url: 'https://example.com',
    });

    expect(Linking.openURL).toHaveBeenCalledWith('https://example.com');
  });

  test('matches snapshot', () => {
    expect(
      render(<MarkdownDocument markdown="# Hello world" />).toJSON(),
    ).toMatchSnapshot();
  });
});
