import {
  HOME_STRETCH_LENGTH,
  PATH_LENGTH,
  Piece,
  Player,
  PlayerColor,
  SAFE_ZONES,
  START_POSITIONS,
} from './ludo-types';
import { COLOR_ORDER } from './ludo-board-layout';

const HOME_ENTRY_POSITION = PATH_LENGTH - 2;
const HOME_FINISH_POSITION = HOME_STRETCH_LENGTH - 1;

export function movePiece(
  _playerColor: PlayerColor,
  piece: Piece,
  diceValue: number
): Piece | null {
  if (piece.status === 'finished') return null;

  if (piece.status === 'base') {
    if (diceValue !== 6) return null;
    return { ...piece, status: 'board', position: 0 };
  }

  if (piece.status === 'board') {
    const nextPos = piece.position + diceValue;
    if (nextPos <= HOME_ENTRY_POSITION) {
      return { ...piece, position: nextPos };
    }

    const distanceToHomeEntry = HOME_ENTRY_POSITION - piece.position + 1;
    if (diceValue === distanceToHomeEntry) {
      return { ...piece, status: 'home_stretch', position: 0 };
    }
    return null;
  }

  const nextPos = piece.position + diceValue;
  if (nextPos < HOME_FINISH_POSITION) {
    return { ...piece, position: nextPos };
  }
  if (nextPos === HOME_FINISH_POSITION) {
    return { ...piece, status: 'finished', position: 58 };
  }

  return null;
}

export function getLegalMoves(playerColor: PlayerColor, pieces: Piece[], diceValue: number): Piece[] {
  return pieces.filter((piece) => movePiece(playerColor, piece, diceValue) !== null);
}

export function getAbsolutePosition(playerColor: PlayerColor, relativePos: number, status: string): number {
  if (status !== 'board') return -1;
  return (START_POSITIONS[playerColor] + relativePos) % PATH_LENGTH;
}

export function checkCapture(
  movingPlayerUid: string,
  newPiece: Piece,
  allPieces: { [uid: string]: Piece[] },
  playerColors: { [uid: string]: PlayerColor }
): { victimUid: string; victimPieceId: number } | null {
  if (newPiece.status !== 'board') return null;

  const movingColor = playerColors[movingPlayerUid];
  if (!movingColor) return null;

  const absPos = getAbsolutePosition(movingColor, newPiece.position, 'board');
  if (SAFE_ZONES.includes(absPos)) return null;

  for (const [uid, pieces] of Object.entries(allPieces)) {
    if (uid === movingPlayerUid) continue;

    const otherColor = playerColors[uid];
    if (!otherColor) continue;

    for (const piece of pieces) {
      if (piece.status !== 'board') continue;
      const otherAbsPos = getAbsolutePosition(otherColor, piece.position, 'board');
      if (absPos === otherAbsPos) {
        return { victimUid: uid, victimPieceId: piece.id };
      }
    }
  }

  return null;
}

export const checkCollision = checkCapture;

export interface ResolveNextTurnInput {
  currentUid: string;
  players: Player[];
  diceValue: number;
  consecutiveSixes?: number;
  captured?: boolean;
  finishedPiece?: boolean;
}

export interface ResolveNextTurnResult {
  nextTurnUid: string;
  consecutiveSixes: number;
  cancelsMove: boolean;
}

export function getOrderedPlayers(players: Player[]): Player[] {
  return players
    .filter(Boolean)
    .sort((a, b) => COLOR_ORDER.indexOf(a.color) - COLOR_ORDER.indexOf(b.color));
}

export function getNextPlayerUid(currentUid: string, players: Player[]): string {
  const orderedPlayers = getOrderedPlayers(players);
  const currentIndex = orderedPlayers.findIndex((player) => player.uid === currentUid);
  if (currentIndex < 0 || orderedPlayers.length === 0) return currentUid;
  return orderedPlayers[(currentIndex + 1) % orderedPlayers.length]?.uid || currentUid;
}

export function resolveNextTurn({
  currentUid,
  players,
  diceValue,
  consecutiveSixes = 0,
  captured = false,
  finishedPiece = false,
}: ResolveNextTurnInput): ResolveNextTurnResult {
  const nextSixCount = diceValue === 6 ? consecutiveSixes + 1 : 0;

  if (nextSixCount >= 3) {
    return {
      nextTurnUid: getNextPlayerUid(currentUid, players),
      consecutiveSixes: 0,
      cancelsMove: true,
    };
  }

  if (diceValue === 6 || captured || finishedPiece) {
    return {
      nextTurnUid: currentUid,
      consecutiveSixes: nextSixCount,
      cancelsMove: false,
    };
  }

  return {
    nextTurnUid: getNextPlayerUid(currentUid, players),
    consecutiveSixes: 0,
    cancelsMove: false,
  };
}

export function getPlayerColorMap(players: Player[]): Record<string, PlayerColor> {
  return players.reduce<Record<string, PlayerColor>>((acc, player) => {
    acc[player.uid] = player.color;
    return acc;
  }, {});
}

export function chooseBestLegalMove(
  uid: string,
  color: PlayerColor,
  pieces: Piece[],
  diceValue: number,
  allPieces: { [uid: string]: Piece[] },
  playerColors: { [uid: string]: PlayerColor }
): Piece | null {
  const legalPieces = getLegalMoves(color, pieces, diceValue);
  if (legalPieces.length === 0) return null;

  return legalPieces
    .map((piece) => {
      const moved = movePiece(color, piece, diceValue);
      if (!moved) return { piece, score: -1 };

      const updatedPieces = {
        ...allPieces,
        [uid]: pieces.map((candidate) => candidate.id === piece.id ? moved : candidate),
      };
      const capture = checkCapture(uid, moved, updatedPieces, playerColors);
      const progress = moved.status === 'board' || moved.status === 'home_stretch' ? moved.position : 0;

      return {
        piece,
        score:
          (moved.status === 'finished' ? 1000 : 0)
          + (capture ? 500 : 0)
          + (piece.status === 'base' ? 250 : 0)
          + progress,
      };
    })
    .sort((a, b) => b.score - a.score)[0].piece;
}
