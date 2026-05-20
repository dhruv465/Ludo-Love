/**
 * Ludo Game Constants and Types
 */

export type PlayerColor = 'red' | 'blue' | 'green' | 'yellow';
export type GameTheme = 'vibrant' | 'neon' | 'panda' | 'romantic';

export interface Piece {
  id: number;
  position: number; // -1: base, 0-51: outer path, 0-4: home stretch, 58: finished
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

export type MomentMood = 'cute' | 'romantic' | 'spicy';
export type MomentEvent = 'roll_six' | 'capture' | 'safe_square' | 'finish_piece' | 'victory';

export interface CoupleMoment {
  id: string;
  event: MomentEvent;
  mood: MomentMood;
  prompt: string;
  rewardCoins: number;
  playerUid: string;
  createdAt: number;
}

export interface Message {
  uid: string;
  sender: string;
  text: string;
  type: 'text' | 'reaction' | 'moment';
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
  consecutiveSixes?: number;
  isRolling?: boolean;
  momentMood?: MomentMood;
  activeMoment?: CoupleMoment | null;
  winner: string | null;
  messages?: Message[];
  updatedAt: any;
}

// Board constants
export const BOARD_SIZE = 15;
export const PATH_LENGTH = 52;
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
