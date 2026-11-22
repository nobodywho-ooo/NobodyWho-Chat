import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { haptics } from 'helpers';

import { parseUiSource } from '../../../services/a2ui/parse';

import { A2UiSurface } from '../A2UiSurface';

// A surface exercising data-model binding, nesting and an interactive
// control, so the snapshot covers the renderer's main paths. Components nest
// by value — no ids.
const bindingSurface = parseUiSource(`
root = Stack([card, flip])
card = Card([TextContent($message)])
flip = Button("Flip it", @ToAssistant("Flipped"))
`).root;

test('renders a binding-driven surface', async () => {
  const { toJSON } = await render(
    <A2UiSurface root={bindingSurface} dataModel={{ message: 'Hello, Ada' }} />,
  );
  expect(toJSON()).toMatchSnapshot();
});

test('renders the data-model value', async () => {
  const { getByText } = await render(
    <A2UiSurface root={bindingSurface} dataModel={{ message: 'Hello, Ada' }} />,
  );
  expect(getByText('Hello, Ada')).toBeTruthy();
});

test('a button press dispatches its action with a haptic', async () => {
  const medium = jest.spyOn(haptics, 'medium').mockImplementation(() => {});
  try {
    const { getByRole } = await render(
      <A2UiSurface root={bindingSurface} dataModel={{ message: 'Hi' }} />,
    );
    fireEvent.press(getByRole('button'));
    expect(medium).toHaveBeenCalled();
  } finally {
    medium.mockRestore();
  }
});

test('renders an Icon and switches Tabs', async () => {
  const root = parseUiSource(`
root = Stack([tabs])
tabs = Tabs([{label: "Summary", content: [Icon("search"), TextContent("Summary content")]}, {label: "Detail", content: [TextContent("Detail content")]}])
`).root;
  const screen = await render(<A2UiSurface root={root} />);
  expect(screen.getByText('Summary content')).toBeTruthy();
  fireEvent.press(screen.getAllByRole('tab')[1]);
  expect(await screen.findByText('Detail content')).toBeTruthy();
});

test('renders typewriter fields, checks and sliders', async () => {
  const root = parseUiSource(`
root = Stack([Input("Name", "", "Enter name", "text"), CheckBox("Subscribe", true), Slider("Budget", 0, 100, 42)])
`).root;
  const screen = await render(<A2UiSurface root={root} />);
  expect(screen.getByText('Name')).toBeTruthy();
  expect(screen.getByText('Budget')).toBeTruthy();
  expect(screen.getByText('42')).toBeTruthy();
  // Editing the input keeps the surface reactive.
  fireEvent.changeText(screen.getByDisplayValue(''), 'Ada');
  expect(await screen.findByDisplayValue('Ada')).toBeTruthy();
});

test('renders a map with markers and a route', async () => {
  const root = parseUiSource(`
root = Stack([themap])
themap = Map([{label: "Louvre", lat: 48.8606, lon: 2.3376}, {label: "Orsay", lat: 48.86, lon: 2.3266}], [{lat: 48.8606, lon: 2.3376}, {lat: 48.86, lon: 2.3266}], "medium")
`).root;
  const screen = await render(<A2UiSurface root={root} />);
  expect(screen.getByText('Louvre')).toBeTruthy();
  expect(screen.getByText('Orsay')).toBeTruthy();
});

test('a null root renders nothing', async () => {
  const { toJSON } = await render(<A2UiSurface root={null} />);
  expect(toJSON()).toBeNull();
});