import test from 'node:test';
import assert from 'node:assert/strict';
import { Piece, PlayerColor, Player } from './ludo-types';
import {
  chooseBestLegalMove,
  checkCapture,
  getLegalMoves,
  movePiece,
  resolveNextTurn,
} from './ludo-engine';

const basePiece = (id = 0): Piece => ({ id, position: -1, status: 'base' });
const boardPiece = (position: number, id = 0): Piece => ({ id, position, status: 'board' });
const stretchPiece = (position: number, id = 0): Piece => ({ id, position, status: 'home_stretch' });

const players: Player[] = [
  { uid: 'red', name: 'Red', avatar: '', color: 'red', ready: true },
  { uid: 'green', name: 'Green', avatar: '', color: 'green', ready: true },
  { uid: 'yellow', name: 'Yellow', avatar: '', color: 'yellow', ready: true },
  { uid: 'blue', name: 'Blue', avatar: '', color: 'blue', ready: true },
];

test('base piece cannot open without a six', () => {
  assert.equal(movePiece('red', basePiece(), 5), null);
});

test('base piece opens on a six onto start square', () => {
  assert.deepEqual(movePiece('red', basePiece(), 6), {
    id: 0,
    position: 0,
    status: 'board',
  });
});

test('piece enters home stretch from the arrow entry square', () => {
  assert.deepEqual(movePiece('red', boardPiece(49), 1), boardPiece(50));
  assert.deepEqual(movePiece('red', boardPiece(50), 1), stretchPiece(0));
});

test('piece must roll exact value to finish', () => {
  assert.deepEqual(movePiece('red', stretchPiece(5), 1), {
    id: 0,
    position: 58,
    status: 'finished',
  });
  assert.equal(movePiece('red', stretchPiece(5), 2), null);
});

test('legal moves exclude pieces that would overshoot finish', () => {
  const legal = getLegalMoves('red', [stretchPiece(5), boardPiece(4, 1)], 2);
  assert.deepEqual(legal.map((piece) => piece.id), [1]);
});

test('capture returns opponent on same unsafe absolute square', () => {
  const pieces = {
    red: [boardPiece(1)],
    green: [boardPiece(40)],
  };
  const capture = checkCapture('red', pieces.red[0], pieces, {
    red: 'red',
    green: 'green',
  });
  assert.deepEqual(capture, { victimUid: 'green', victimPieceId: 0 });
});

test('safe square prevents capture', () => {
  const pieces = {
    red: [boardPiece(0)],
    green: [boardPiece(39)],
  };
  const capture = checkCapture('red', pieces.red[0], pieces, {
    red: 'red',
    green: 'green',
  });
  assert.equal(capture, null);
});

test('bonus turn is granted after six, capture, or finish', () => {
  assert.equal(resolveNextTurn({ currentUid: 'red', players, diceValue: 6 }).nextTurnUid, 'red');
  assert.equal(resolveNextTurn({ currentUid: 'red', players, diceValue: 4, captured: true }).nextTurnUid, 'red');
  assert.equal(resolveNextTurn({ currentUid: 'red', players, diceValue: 4, finishedPiece: true }).nextTurnUid, 'red');
});

test('third consecutive six cancels move and passes turn', () => {
  assert.deepEqual(resolveNextTurn({
    currentUid: 'red',
    players,
    diceValue: 6,
    consecutiveSixes: 2,
  }), {
    nextTurnUid: 'green',
    consecutiveSixes: 0,
    cancelsMove: true,
  });
});

test('best legal move prefers a capture', () => {
  const pieces = {
    red: [boardPiece(0, 0), boardPiece(5, 1)],
    green: [boardPiece(40, 0)],
  };

  const bestPiece = chooseBestLegalMove(
    'red',
    'red',
    pieces.red,
    1,
    pieces,
    { red: 'red', green: 'green' }
  );

  assert.equal(bestPiece?.id, 0);
});
