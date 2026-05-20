import { BOARD_SIZE, Piece, PlayerColor, SAFE_ZONES, START_POSITIONS } from './ludo-types';

export const CELL_SIZE = 100 / BOARD_SIZE;

export type CellType = 'path' | 'base' | 'home_stretch' | 'safe' | 'finish' | 'empty';

export interface BoardCell {
  x: number;
  y: number;
  type: CellType;
  color?: PlayerColor;
  absPos?: number;
}

export const COLOR_ORDER: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

export const BASE_POSITIONS: Record<PlayerColor, { x: number; y: number }[]> = {
  red: [{ x: 1, y: 1 }, { x: 4, y: 1 }, { x: 1, y: 4 }, { x: 4, y: 4 }],
  green: [{ x: 10, y: 1 }, { x: 13, y: 1 }, { x: 10, y: 4 }, { x: 13, y: 4 }],
  yellow: [{ x: 10, y: 10 }, { x: 13, y: 10 }, { x: 10, y: 13 }, { x: 13, y: 13 }],
  blue: [{ x: 1, y: 10 }, { x: 4, y: 10 }, { x: 1, y: 13 }, { x: 4, y: 13 }],
};

export const PATH_COORDS: { x: number; y: number }[] = [
  { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 },
  { x: 6, y: 5 }, { x: 6, y: 4 }, { x: 6, y: 3 }, { x: 6, y: 2 }, { x: 6, y: 1 }, { x: 6, y: 0 },
  { x: 7, y: 0 },
  { x: 8, y: 0 }, { x: 8, y: 1 }, { x: 8, y: 2 }, { x: 8, y: 3 }, { x: 8, y: 4 }, { x: 8, y: 5 },
  { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 11, y: 6 }, { x: 12, y: 6 }, { x: 13, y: 6 }, { x: 14, y: 6 },
  { x: 14, y: 7 },
  { x: 14, y: 8 }, { x: 13, y: 8 }, { x: 12, y: 8 }, { x: 11, y: 8 }, { x: 10, y: 8 }, { x: 9, y: 8 },
  { x: 8, y: 9 }, { x: 8, y: 10 }, { x: 8, y: 11 }, { x: 8, y: 12 }, { x: 8, y: 13 }, { x: 8, y: 14 },
  { x: 7, y: 14 },
  { x: 6, y: 14 }, { x: 6, y: 13 }, { x: 6, y: 12 }, { x: 6, y: 11 }, { x: 6, y: 10 }, { x: 6, y: 9 },
  { x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }, { x: 1, y: 8 }, { x: 0, y: 8 },
  { x: 0, y: 7 }, { x: 0, y: 6 },
];

export const STRETCH_COORDS: Record<PlayerColor, { x: number; y: number }[]> = {
  red: [{ x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 }],
  green: [{ x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 }, { x: 7, y: 5 }, { x: 7, y: 6 }],
  yellow: [{ x: 13, y: 7 }, { x: 12, y: 7 }, { x: 11, y: 7 }, { x: 10, y: 7 }, { x: 9, y: 7 }, { x: 8, y: 7 }],
  blue: [{ x: 7, y: 13 }, { x: 7, y: 12 }, { x: 7, y: 11 }, { x: 7, y: 10 }, { x: 7, y: 9 }, { x: 7, y: 8 }],
};

const FINISHED_POSITIONS: Record<PlayerColor, { x: number; y: number }[]> = {
  red: [{ x: 6.65, y: 6.65 }, { x: 6.35, y: 7 }, { x: 6.65, y: 7.35 }, { x: 6.95, y: 7 }],
  green: [{ x: 7, y: 6.35 }, { x: 7.35, y: 6.65 }, { x: 7, y: 6.95 }, { x: 6.65, y: 6.65 }],
  yellow: [{ x: 7.35, y: 6.65 }, { x: 7.65, y: 7 }, { x: 7.35, y: 7.35 }, { x: 7.05, y: 7 }],
  blue: [{ x: 6.65, y: 7.35 }, { x: 7, y: 7.65 }, { x: 7.35, y: 7.35 }, { x: 7, y: 7.05 }],
};

export function getBaseColorAt(x: number, y: number): PlayerColor | undefined {
  if (x < 6 && y < 6) return 'red';
  if (x > 8 && y < 6) return 'green';
  if (x > 8 && y > 8) return 'yellow';
  if (x < 6 && y > 8) return 'blue';
  return undefined;
}

export function getStretchColorAt(x: number, y: number): PlayerColor | undefined {
  return COLOR_ORDER.find((color) => STRETCH_COORDS[color].some((coord) => coord.x === x && coord.y === y));
}

export function getStartColorAt(x: number, y: number): PlayerColor | undefined {
  return COLOR_ORDER.find((color) => {
    const coord = PATH_COORDS[START_POSITIONS[color]];
    return coord.x === x && coord.y === y;
  });
}

export function getHomeEntryColorAt(x: number, y: number): PlayerColor | undefined {
  return COLOR_ORDER.find((color) => {
    const coord = PATH_COORDS[(START_POSITIONS[color] + PATH_COORDS.length - 2) % PATH_COORDS.length];
    return coord.x === x && coord.y === y;
  });
}

export function generateBoard(): BoardCell[] {
  const cells: BoardCell[] = [];

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const baseColor = getBaseColorAt(x, y);
      const stretchColor = getStretchColorAt(x, y);
      const absPos = PATH_COORDS.findIndex((coord) => coord.x === x && coord.y === y);
      const isCenter = x >= 6 && x <= 8 && y >= 6 && y <= 8;

      if (x === 7 && y === 7) {
        cells.push({ x, y, type: 'finish' });
      } else if (stretchColor) {
        cells.push({ x, y, type: 'home_stretch', color: stretchColor });
      } else if (absPos >= 0) {
        cells.push({
          x,
          y,
          type: SAFE_ZONES.includes(absPos) ? 'safe' : 'path',
          color: getStartColorAt(x, y),
          absPos,
        });
      } else if (baseColor) {
        cells.push({ x, y, type: 'base', color: baseColor });
      } else if (isCenter) {
        cells.push({ x, y, type: 'finish' });
      } else {
        cells.push({ x, y, type: 'empty' });
      }
    }
  }

  return cells;
}

export function getPieceCoords(playerColor: PlayerColor, piece: Piece) {
  if (piece.status === 'base') return BASE_POSITIONS[playerColor][piece.id] || BASE_POSITIONS[playerColor][0];
  if (piece.status === 'board') return PATH_COORDS[(START_POSITIONS[playerColor] + piece.position) % PATH_COORDS.length];
  if (piece.status === 'home_stretch') return STRETCH_COORDS[playerColor][piece.position];
  return FINISHED_POSITIONS[playerColor][piece.id] || { x: 7, y: 7 };
}

export function getPieceCellKey(playerColor: PlayerColor, piece: Piece) {
  if (piece.status === 'base') return `${playerColor}:base:${piece.id}`;
  if (piece.status === 'board') return `board:${(START_POSITIONS[playerColor] + piece.position) % PATH_COORDS.length}`;
  if (piece.status === 'home_stretch') return `${playerColor}:stretch:${piece.position}`;
  return `${playerColor}:finished`;
}
