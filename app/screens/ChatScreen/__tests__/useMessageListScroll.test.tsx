import { renderHook, act } from '@testing-library/react-native';
import type { LegendListRef } from '@legendapp/list/react-native';

import type { DisplayMessage } from 'types';

import {
  mockListState,
  mockScrollToOffset,
} from '../../../../jest/mock/node-modules';
import { useMessageListScroll } from '../hooks/useMessageListScroll';

const messages = [
  { role: 'user', content: 'Explain a complex topic simply' },
  { role: 'assistant', content: 'Imagine quantum computing' },
] as DisplayMessage[];

const listStub = {
  clearCaches: jest.fn(),
  getState: () => mockListState,
  scrollToIndex: jest.fn(() => Promise.resolve()),
  scrollToOffset: mockScrollToOffset,
} as unknown as LegendListRef;

// A scroll makes legend-list size the items it has never measured, and it
// reports each of those sizes through `totalSize` synchronously, from inside
// the scroll call itself. That is the loop the hook has to survive: following
// the answer means scrolling on `totalSize`, and the scroll reports
// `totalSize` right back.
const scrollReportingSizes = (reports: number) => {
  let remaining = reports;
  mockScrollToOffset.mockImplementation(() => {
    if (remaining > 0) {
      remaining--;
      mockListState.emitTotalSize(1000 + remaining);
    }
  });
};

// Following the answer is what subscribes the hook to `totalSize`.
const renderFollowingList = () => {
  const view = renderHook(() => useMessageListScroll(messages));
  view.result.current.listRef.current = listStub;
  act(() => view.result.current.scrollToBottom());
  mockScrollToOffset.mockClear();
  return view;
};

beforeEach(() => {
  mockListState.reset();
  mockScrollToOffset.mockReset();
});

it('does not recurse when its own scroll keeps reporting sizes', () => {
  const view = renderFollowingList();
  scrollReportingSizes(Number.POSITIVE_INFINITY);

  expect(() => act(() => mockListState.emitTotalSize(1200))).not.toThrow();
  expect(mockScrollToOffset).toHaveBeenCalledTimes(1);
  expect(view.result.current.canScrollToBottom).toBe(false);
});

it('replays the scroll it had to skip', async () => {
  renderFollowingList();
  scrollReportingSizes(1);

  await act(async () => {
    mockListState.emitTotalSize(1200);
    await new Promise(resolve => requestAnimationFrame(resolve));
  });

  expect(mockScrollToOffset).toHaveBeenCalledTimes(2);
});
