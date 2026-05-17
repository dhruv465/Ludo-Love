import { Piece, PlayerColor, START_POSITIONS, PATH_LENGTH, HOME_STRETCH_LENGTH, SAFE_ZONES } from './ludo-types';

export function movePiece(
  playerColor: PlayerColor,
  piece: Piece,
  diceValue: number
): Piece | null {
  const newPiece = { ...piece };

  if (piece.status === 'base') {
    if (diceValue === 6) {
      newPiece.status = 'board';
      newPiece.position = 0; // Starts at 0 relative to START_POSITIONS[color]
      return newPiece;
    }
    return null;
  }

  if (piece.status === 'board') {
    const nextPos = piece.position + diceValue;
    if (nextPos < PATH_LENGTH) {
      newPiece.position = nextPos;
      return newPiece;
    } else {
      const stretchPos = nextPos - PATH_LENGTH;
      if (stretchPos < HOME_STRETCH_LENGTH) {
        newPiece.status = 'home_stretch';
        newPiece.position = stretchPos;
        return newPiece;
      } else if (stretchPos === HOME_STRETCH_LENGTH) {
        newPiece.status = 'finished';
        newPiece.position = 58;
        return newPiece;
      }
    }
  }

  if (piece.status === 'home_stretch') {
    const nextPos = piece.position + diceValue;
    if (nextPos < HOME_STRETCH_LENGTH) {
      newPiece.position = nextPos;
      return newPiece;
    } else if (nextPos === HOME_STRETCH_LENGTH) {
      newPiece.status = 'finished';
      newPiece.position = 58;
      return newPiece;
    }
  }

  return null;
}

export function getAbsolutePosition(playerColor: PlayerColor, relativePos: number, status: string): number {
  if (status !== 'board') return -1;
  return (START_POSITIONS[playerColor] + relativePos) % 52;
}

export function checkCollision(
  movingPlayerUid: string,
  newPiece: Piece,
  allPieces: { [uid: string]: Piece[] },
  playerColors: { [uid: string]: PlayerColor }
): { victimUid: string, victimPieceId: number } | null {
  if (newPiece.status !== 'board') return null;

  const movingColor = playerColors[movingPlayerUid];
  const absPos = getAbsolutePosition(movingColor, newPiece.position, 'board');

  // SAFE ZONE CHECK
  if (SAFE_ZONES.includes(absPos)) return null;

  for (const [uid, pieces] of Object.entries(allPieces)) {
    if (uid === movingPlayerUid) continue;

    const otherColor = playerColors[uid];
    for (const p of pieces) {
      if (p.status === 'board') {
        const otherAbsPos = getAbsolutePosition(otherColor, p.position, 'board');
        if (absPos === otherAbsPos) {
          return { victimUid: uid, victimPieceId: p.id };
        }
      }
    }
  }

  return null;
}
