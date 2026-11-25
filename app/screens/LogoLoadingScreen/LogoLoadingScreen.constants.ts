export const DOT_WIDTH = 107.667;
export const DOT_HEIGHT = 105.556;

export const FRAME_WIDTH = DOT_WIDTH * 3;
export const FRAME_HEIGHT = DOT_HEIGHT * 3;

export const LOGO_WIDTH = 112;

export interface Cell {
  column: number;
  row: number;
}

export const CENTER_CELL: Cell = { column: 1, row: 1 };

export const CORNER_CELLS: readonly Cell[] = [
  { column: 0, row: 0 },
  { column: 2, row: 0 },
  { column: 2, row: 2 },
  { column: 0, row: 2 },
];

export const cellViewBox = ({ column, row }: Cell) =>
  `${-column * DOT_WIDTH} ${-row * DOT_HEIGHT} ${FRAME_WIDTH} ${FRAME_HEIGHT}`;

export const cellOrigin = ({ column, row }: Cell) =>
  `${((column + 0.5) / 3) * 100}% ${((row + 0.5) / 3) * 100}%`;

export const CENTER_DELAY = 150;
export const FIRST_CORNER_DELAY = 500;
export const CORNER_INTERVAL = 180;
export const REVEAL_DELAY =
  FIRST_CORNER_DELAY + (CORNER_CELLS.length - 1) * CORNER_INTERVAL + 500;
export const REVEAL_DURATION = 450;
export const LOGO_HOLD = 400;
