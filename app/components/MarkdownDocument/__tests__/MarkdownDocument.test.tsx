import React from 'react';
import { Linking } from 'react-native';
import { render } from '@testing-library/react-native';
import { MarkdownDocument } from '../MarkdownDocument';

jest.mock('react-native-enriched-markdown', () => ({
  EnrichedMarkdownText: 'EnrichedMarkdownText',
}));

describe('MarkdownDocument', () => {
  test('forwards the markdown to EnrichedMarkdownText', async () => {
    const json = JSON.stringify(
      (await render(<MarkdownDocument markdown="# Hello world" />)).toJSON(),
    );

    expect(json).toContain('# Hello world');
  });

  test('opens a tapped link', async () => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const { container } = await render(
      <MarkdownDocument markdown="[link](https://example.com)" />,
    );
    const [markdown] = container.queryAll(
      node => node.type === 'EnrichedMarkdownText',
    );

    markdown.props.onLinkPress({
      url: 'https://example.com',
    });

    expect(Linking.openURL).toHaveBeenCalledWith('https://example.com');
  });

  test('matches snapshot', async () => {
    expect(
      (await render(<MarkdownDocument markdown="# Hello world" />)).toJSON(),
    ).toMatchSnapshot();
  });
});
