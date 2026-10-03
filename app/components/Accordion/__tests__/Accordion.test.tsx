import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { Text } from '../../Text/Text';
import { Accordion } from '../Accordion';

describe('Accordion', () => {
  test('renders a collapsed accordion', () => {
    const tree = render(
      <Accordion title="Text to Speech">
        <Text>Content</Text>
      </Accordion>,
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });

  test('hides its content until the title is pressed', () => {
    const screen = render(
      <Accordion title="Text to Speech">
        <Text>Content</Text>
      </Accordion>,
    );
    expect(screen.queryByText('Content')).toBeNull();

    fireEvent.press(screen.getByLabelText('Text to Speech'));

    expect(screen.getByText('Content')).toBeTruthy();
  });

  test('pressing the title again hides the content', () => {
    const screen = render(
      <Accordion title="Text to Speech" initiallyExpanded>
        <Text>Content</Text>
      </Accordion>,
    );
    expect(screen.getByText('Content')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Text to Speech'));

    expect(screen.queryByText('Content')).toBeNull();
  });

  test('reports its expanded state to accessibility', () => {
    const screen = render(
      <Accordion title="Text to Speech">
        <Text>Content</Text>
      </Accordion>,
    );
    const header = screen.getByLabelText('Text to Speech');
    expect(header.props.accessibilityState).toEqual({ expanded: false });

    fireEvent.press(header);

    expect(
      screen.getByLabelText('Text to Speech').props.accessibilityState,
    ).toEqual({ expanded: true });
  });
});
