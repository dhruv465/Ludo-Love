import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { GameState, Piece, Player, PlayerColor } from '../lib/ludo-types';
import { playCaptureSound, playDiceRollSound } from '../lib/audio';
import {
  chooseBestLegalMove,
  checkCapture,
  getLegalMoves,
  getNextPlayerUid,
  getPlayerColorMap,
  movePiece,
  resolveNextTurn,
} from '../lib/ludo-engine';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function useGame(roomId: string, userUid?: string) {
  const [game, setGame] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;

    const gameRef = doc(db, 'rooms', roomId);
    const unsubscribe = onSnapshot(gameRef, (snapshot) => {
      if (snapshot.exists()) {
        setGame(snapshot.data() as GameState);
      } else {
        setGame(null);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `rooms/${roomId}`);
    });

    return () => unsubscribe();
  }, [roomId]);

  const [localRolling, setLocalRolling] = useState(false);
  const rollLockRef = useRef(false);

  const rollDice = async (uid: string) => {
    if (!game || game.currentTurn !== uid || game.diceRolled || localRolling || rollLockRef.current) return;
    const activePlayers = [game.player1, game.player2, game.player3, game.player4].filter(Boolean) as Player[];
    const player = activePlayers.find((candidate) => candidate.uid === uid);
    if (!player) return;
    
    rollLockRef.current = true;
    setLocalRolling(true);
    
    let diceValue = Math.floor(Math.random() * 6) + 1;
    
    try {
        const gameRef = doc(db, 'rooms', roomId);
        await updateDoc(gameRef, { isRolling: true });
        playDiceRollSound();
    } catch (e) {
        console.error("Failed to set isRolling", e);
    }

    // Simulate rolling delay for UI
    setTimeout(async () => {
      try {
        const gameRef = doc(db, 'rooms', roomId);
        const turnResult = resolveNextTurn({
          currentUid: uid,
          players: activePlayers,
          diceValue,
          consecutiveSixes: game.consecutiveSixes || 0,
        });
        const legalMoves = getLegalMoves(player.color, game.pieces[uid] || [], diceValue);
        const noLegalMoves = legalMoves.length === 0;
        const shouldPassTurn = turnResult.cancelsMove || noLegalMoves;
        const nextTurnUid = noLegalMoves ? getNextPlayerUid(uid, activePlayers) : shouldPassTurn ? turnResult.nextTurnUid : uid;

        await updateDoc(gameRef, {
          lastDiceValue: diceValue,
          diceRolled: !shouldPassTurn,
          isRolling: false,
          currentTurn: nextTurnUid,
          consecutiveSixes: noLegalMoves ? 0 : turnResult.consecutiveSixes,
          updatedAt: serverTimestamp()
        });

        setLocalRolling(false);
        rollLockRef.current = false;
      } catch (err) {
        console.error("Roll dice error:", err);
        setLocalRolling(false); // Make sure we unlock local roll state on error
        rollLockRef.current = false;
      }
    }, 1000);
  };

  const startGame = async () => {
    if (!game || game.status !== 'waiting') return;
    const gameRef = doc(db, 'rooms', roomId);
    await updateDoc(gameRef, {
      status: 'playing',
      updatedAt: serverTimestamp()
    });
  };

  const performMove = async (uid: string, pieceId: number, overrideDiceValue?: number) => {
    if (!game || game.currentTurn !== uid || localRolling) return;
    if (!overrideDiceValue && !game.diceRolled) return;

    const activePlayers = [game.player1, game.player2, game.player3, game.player4].filter(Boolean) as Player[];
    const player = activePlayers.find((candidate) => candidate.uid === uid);
    if (!player) return;

    const pieces = game.pieces[uid];
    const piece = pieces.find(p => p.id === pieceId);
    
    // Use the latest known dice value if passed, else fallback to game state
    const currentDiceValue = overrideDiceValue || game.lastDiceValue;
    if (!piece || !movePiece(player.color, piece, currentDiceValue)) return;
    
    const newPiece = movePiece(player.color, piece, currentDiceValue)!;

    const updatedPieces = { ...game.pieces };
    updatedPieces[uid] = pieces.map(p => p.id === pieceId ? newPiece : p);

    const playerColors = getPlayerColorMap(activePlayers);
    const collision = checkCapture(uid, newPiece, updatedPieces, playerColors);
    if (collision) {
      const victimPieces = updatedPieces[collision.victimUid];
      updatedPieces[collision.victimUid] = victimPieces.map(p => 
        p.id === collision.victimPieceId ? { ...p, position: -1, status: 'base' } : p
      );
      
      const victimName = [game.player1, game.player2, game.player3, game.player4].find(p => p?.uid === collision.victimUid)?.name || 'Someone';
      playCaptureSound();
      await sendMessage(uid, player.name, `Captured ${victimName}'s piece! ⚡`, 'moment');
      
      // Award points for capture
      try {
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const currentPoints = userSnap.data().points || 0;
          await updateDoc(userRef, { points: currentPoints + 10 });
        }
      } catch (e) {
        console.error("Failed to award capture points:", e);
      }
    }

    // Check win
    const isWinner = updatedPieces[uid].every(p => p.status === 'finished');
    if (isWinner) {
        await sendMessage(uid, player.name, `Victory! Completed the journey 🏆`, 'moment');
        
        // Award points for victory
        try {
          const userRef = doc(db, 'users', uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const currentPoints = userSnap.data().points || 0;
            await updateDoc(userRef, { points: currentPoints + 50 });
          }
        } catch (e) {
          console.error("Failed to award victory points:", e);
        }
    }
    
    const finishedPiece = newPiece.status === 'finished' && piece.status !== 'finished';
    const turnResult = resolveNextTurn({
      currentUid: uid,
      players: activePlayers,
      diceValue: currentDiceValue,
      consecutiveSixes: game.consecutiveSixes || 0,
      captured: !!collision,
      finishedPiece,
    });

    const gameRef = doc(db, 'rooms', roomId);
    try {
      await updateDoc(gameRef, {
        pieces: updatedPieces,
        currentTurn: isWinner ? null : turnResult.nextTurnUid,
        diceRolled: false,
        consecutiveSixes: isWinner ? 0 : turnResult.consecutiveSixes,
        winner: isWinner ? uid : null,
        status: isWinner ? 'finished' : 'playing',
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}`);
    }
  };

  const [isBotProcessing, setIsBotProcessing] = useState(false);
  useEffect(() => {
    if (!game || game.status !== 'playing' || game.winner || isBotProcessing || localRolling) return;
    if (userUid && game.hostId && userUid !== game.hostId) return; // Only host processes bot logic
    
    const currentPlayer = [game.player1, game.player2, game.player3, game.player4].find(p => p?.uid === game.currentTurn);
    if (currentPlayer?.isBot) {
        setIsBotProcessing(true);
        const botTurn = async () => {
            try {
                // Determine action based on diceRolled state
                if (!game.diceRolled) {
                    await new Promise(resolve => setTimeout(resolve, 1200));
                    await rollDice(currentPlayer.uid);
                } else {
                    await new Promise(resolve => setTimeout(resolve, 800));
                    const pieces = game.pieces[currentPlayer.uid] || [];
                    const playerColors = getPlayerColorMap([game.player1, game.player2, game.player3, game.player4].filter(Boolean) as Player[]);
                    const bestPiece = chooseBestLegalMove(
                      currentPlayer.uid,
                      currentPlayer.color,
                      pieces,
                      game.lastDiceValue,
                      game.pieces,
                      playerColors
                    );

                    if (bestPiece) {
                        await performMove(currentPlayer.uid, bestPiece.id);
                    }
                }
            } catch (err) {
                console.error("Bot turn error:", err);
            } finally {
                setIsBotProcessing(false);
            }
        };
        botTurn();
    }
  }, [game?.currentTurn, game?.diceRolled, game?.status, game?.winner, localRolling, userUid, game?.hostId, isBotProcessing]);

  const sendMessage = async (uid: string, sender: string, text: string, type: 'text' | 'reaction' | 'moment' = 'text') => {
    if (!roomId || !game) return;
    const gameRef = doc(db, 'rooms', roomId);
    const newMessage: any = {
      uid,
      sender,
      text,
      type,
      timestamp: Date.now()
    };
    
    await updateDoc(gameRef, {
      messages: [...(game.messages || []), newMessage],
      updatedAt: serverTimestamp()
    });
  };

  return { game, error, rollDice, performMove, startGame, sendMessage, isRolling: localRolling };
}
