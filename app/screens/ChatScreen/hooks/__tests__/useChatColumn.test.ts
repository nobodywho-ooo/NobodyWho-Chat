import { chatColumn } from '../useChatColumn';

const RAIL = 84;

test('fills a phone window edge to edge', () => {
  expect(chatColumn({ areaWidth: 393, insetLeft: 0, insetRight: 0 })).toEqual({
    paddingLeft: 0,
    paddingRight: 0,
    insetLeft: 0,
    insetRight: 0,
  });
});

test('keeps clear of the vertical bar on its own side only (folded Duo)', () => {
  expect(
    chatColumn({ areaWidth: 466, insetLeft: 0, insetRight: RAIL }),
  ).toEqual({
    paddingLeft: 0,
    paddingRight: RAIL,
    insetLeft: 0,
    insetRight: RAIL,
  });
});

test('centres the content on 80% of a wide window (open Duo, sidebar hidden)', () => {
  const column = chatColumn({ areaWidth: 951, insetLeft: 0, insetRight: RAIL });
  const available = 951 - RAIL;
  const width = available - column.paddingLeft - column.paddingRight + RAIL;

  expect(width).toBe(Math.round(available * 0.8));
  expect(column.paddingLeft).toBe(column.paddingRight - RAIL);
});

test('never narrows below the readable width beside the sidebar', () => {
  const column = chatColumn({ areaWidth: 600, insetLeft: 0, insetRight: 0 });

  expect(600 - column.paddingLeft - column.paddingRight).toBe(560);
});
