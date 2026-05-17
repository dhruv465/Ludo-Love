/**
 * Ludo Game Constants and Types
 */

export type PlayerColor = 'red' | 'blue' | 'green' | 'yellow';
export type GameTheme = 'vibrant' | 'neon' | 'panda' | 'romantic';

export interface Piece {
  id: number;
  position: number; // -1: base, 0-51: path, 52-57: home stretch, 58: finished
  status: 'base' | 'board' | 'home_stretch' | 'finished';
}

export interface Player {
  uid: string;
  name: string;
  avatar: string;
  color: PlayerColor;
  ready: boolean;
  isBot?: boolean;
}

export type GameStatus = 'waiting' | 'playing' | 'finished';

export interface Message {
  uid: string;
  sender: string;
  text: string;
  type: 'text' | 'reaction' | 'moment' | 'voice';
  audioData?: string; // base64 encoded audio
  timestamp: number;
}

export interface GameState {
  id?: string;
  hostId?: string;
  status: GameStatus;
  theme: GameTheme;
  player1: Player | null;
  player2: Player | null;
  player3: Player | null;
  player4: Player | null;
  pieces: { [uid: string]: Piece[] };
  currentTurn: string | null;
  lastDiceValue: number;
  diceRolled: boolean;
  isRolling?: boolean;
  winner: string | null;
  messages?: Message[];
  updatedAt: any;
}

// Board constants
export const BOARD_SIZE = 15;
export const PATH_LENGTH = 51;
export const HOME_STRETCH_LENGTH = 6;

// Starting positions for colors
export const START_POSITIONS: Record<PlayerColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

// Safe zones (standard)
export const SAFE_ZONES = [0, 8, 13, 21, 26, 34, 39, 47];

export function getPieceCoordinate(playerColor: PlayerColor, piece: Piece) {
  // Logic to convert piece position to X,Y grid coordinate (0-14)
  // This will be used by the Board component
  if (piece.status === 'base') {
    // Return relative base coordinates
    const baseCoords: Record<PlayerColor, {x: number, y: number}[]> = {
      red: [{x: 1, y: 1}, {x: 4, y: 1}, {x: 1, y: 4}, {x: 4, y: 4}],
      green: [{x: 10, y: 1}, {x: 13, y: 1}, {x: 10, y: 4}, {x: 13, y: 4}],
      yellow: [{x: 10, y: 10}, {x: 13, y: 10}, {x: 10, y: 13}, {x: 13, y: 13}],
      blue: [{x: 1, y: 10}, {x: 4, y: 10}, {x: 1, y: 13}, {x: 4, y: 13}],
    };
    return baseCoords[playerColor][piece.id];
  }
  
  if (piece.status === 'finished') {
    return { x: 7, y: 7 }; // Center
  }

  // Path mapping logic ...
  // (Full board path mapping will be needed in the component)
}
