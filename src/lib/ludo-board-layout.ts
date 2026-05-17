import { PlayerColor } from './ludo-types';

export const CELL_SIZE = 100 / 15; // Percent

export type CellType = 'path' | 'base' | 'home_stretch' | 'safe' | 'finish' | 'empty';

export interface BoardCell {
  x: number;
  y: number;
  type: CellType;
  color?: PlayerColor;
  absPos?: number; // 0-51 for path
}

export function generateBoard() {
  const cells: BoardCell[] = [];

  // Home bases
  // Red (Top Left): 0,0 - 5,5
  // Green (Top Right): 9,0 - 14,5
  // Yellow (Bottom Left): 0,9 - 5,14
  // Blue (Bottom Right): 9,9 - 14,14

  // Centered paths:
  // Col 6, 7, 8
  // Row 6, 7, 8

  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      let type: CellType = 'empty';
      let color: PlayerColor | undefined;

      // Finish Area
      if (x >= 6 && x <= 8 && y >= 6 && y <= 8) {
          if (x === 7 && y === 7) type = 'finish';
          else if (x === 7 && y < 6) { type = 'home_stretch'; color = 'red'; }
          else if (x === 7 && y > 8) { type = 'home_stretch'; color = 'blue'; }
          else if (y === 7 && x < 6) { type = 'home_stretch'; color = 'yellow'; }
          else if (y === 7 && x > 8) { type = 'home_stretch'; color = 'green'; }
      }

      // Paths and Bases...
      // (This is tedious, I'll simplify the rendering by using a static mapping or conditions)
    }
  }
}

// Fixed mapping for the path (0-51)
// Red starts at (6,1) -> (6,0) -> (7,0)...
// This mapping is specific to how coordinates are indexed.
export const PATH_COORDS: {x: number, y: number}[] = [
    // Red quadrant path (starts at start block)
    {x: 1, y: 6}, {x: 2, y: 6}, {x: 3, y: 6}, {x: 4, y: 6}, {x: 5, y: 6},
    {x: 6, y: 5}, {x: 6, y: 4}, {x: 6, y: 3}, {x: 6, y: 2}, {x: 6, y: 1}, {x: 6, y: 0},
    {x: 7, y: 0},
    // Green start -> down to right
    {x: 8, y: 0}, {x: 8, y: 1}, {x: 8, y: 2}, {x: 8, y: 3}, {x: 8, y: 4}, {x: 8, y: 5},
    {x: 9, y: 6}, {x: 10, y: 6}, {x: 11, y: 6}, {x: 12, y: 6}, {x: 13, y: 6}, {x: 14, y: 6},
    // Right vertical across Yellow
    {x: 14, y: 7},
    // Yellow start -> left to bottom
    {x: 14, y: 8}, {x: 13, y: 8}, {x: 12, y: 8}, {x: 11, y: 8}, {x: 10, y: 8}, {x: 9, y: 8},
    {x: 8, y: 9}, {x: 8, y: 10}, {x: 8, y: 11}, {x: 8, y: 12}, {x: 8, y: 13}, {x: 8, y: 14},
    // Bottom horizontal across Blue
    {x: 7, y: 14},
    // Blue start -> right to left
    {x: 6, y: 14}, {x: 6, y: 13}, {x: 6, y: 12}, {x: 6, y: 11}, {x: 6, y: 10}, {x: 6, y: 9},
    {x: 5, y: 8}, {x: 4, y: 8}, {x: 3, y: 8}, {x: 2, y: 8}, {x: 1, y: 8}, {x: 0, y: 8},
    // Left vertical across Red
    {x: 0, y: 7}, {x: 0, y: 6}
];

export const STRETCH_COORDS: Record<PlayerColor, {x: number, y: number}[]> = {
    red: [{x: 1, y: 7}, {x: 2, y: 7}, {x: 3, y: 7}, {x: 4, y: 7}, {x: 5, y: 7}, {x: 6, y: 7}],
    green: [{x: 7, y: 1}, {x: 7, y: 2}, {x: 7, y: 3}, {x: 7, y: 4}, {x: 7, y: 5}, {x: 7, y: 6}],
    yellow: [{x: 13, y: 7}, {x: 12, y: 7}, {x: 11, y: 7}, {x: 10, y: 7}, {x: 9, y: 7}, {x: 8, y: 7}],
    blue: [{x: 7, y: 13}, {x: 7, y: 12}, {x: 7, y: 11}, {x: 7, y: 10}, {x: 7, y: 9}, {x: 7, y: 8}],
};
