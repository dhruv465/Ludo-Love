import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, increment, onSnapshot, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { createCoupleMoment, formatMomentMessage } from '../lib/couple-moments';
import { CoupleMoment, GameState, Message, Player } from '../lib/ludo-types';
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

  const updateRoomPreservingActiveMoment = async (
    gameRef: ReturnType<typeof doc>,
    buildUpdate: (latestRoom: GameState) => { updates: Record<string, unknown>; nextMoment: CoupleMoment | null } | null,
  ): Promise<boolean> => {
    return runTransaction(db, async (transaction) => {
      const roomSnap = await transaction.get(gameRef);
      if (!roomSnap.exists()) return false;

      const latestRoom = roomSnap.data() as GameState;
      const result = buildUpdate(latestRoom);
      if (!result) return false;

      transaction.update(gameRef, {
        ...result.updates,
        activeMoment: latestRoom.activeMoment || result.nextMoment || null,
        updatedAt: serverTimestamp(),
      });

      return true;
    });
  };

  const getRollingPlayerUid = (room: GameState): string | null => {
    return (room as GameState & { rollingPlayerUid?: string | null }).rollingPlayerUid || null;
  };

  const clearRollingClaimIfOwned = async (gameRef: ReturnType<typeof doc>, uid: string) => {
    await runTransaction(db, async (transaction) => {
      const roomSnap = await transaction.get(gameRef);
      if (!roomSnap.exists()) return;

      const latestRoom = roomSnap.data() as GameState;
      const rollingPlayerUid = getRollingPlayerUid(latestRoom);
      const ownsCurrentClaim = latestRoom.isRolling && rollingPlayerUid === uid;
      const ownsLegacyClaim = latestRoom.isRolling && !rollingPlayerUid && latestRoom.currentTurn === uid && !latestRoom.diceRolled;
      if (!ownsCurrentClaim && !ownsLegacyClaim) return;

      transaction.update(gameRef, {
        isRolling: false,
        rollingPlayerUid: null,
        updatedAt: serverTimestamp(),
      });
    });
  };

  const rollDice = async (uid: string) => {
    if (!game || game.currentTurn !== uid || game.diceRolled || localRolling || rollLockRef.current) return;
    const activePlayers = [game.player1, game.player2, game.player3, game.player4].filter(Boolean) as Player[];
    const player = activePlayers.find((candidate) => candidate.uid === uid);
    if (!player) return;

    rollLockRef.current = true;
    setLocalRolling(true);

    const diceValue = Math.floor(Math.random() * 6) + 1;

    const gameRef = doc(db, 'rooms', roomId);
    try {
      const claimedRoll = await runTransaction(db, async (transaction) => {
        const roomSnap = await transaction.get(gameRef);
        if (!roomSnap.exists()) return false;

        const latestRoom = roomSnap.data() as GameState;
        if (latestRoom.currentTurn !== uid || latestRoom.diceRolled || latestRoom.isRolling) return false;

        transaction.update(gameRef, {
          isRolling: true,
          rollingPlayerUid: uid,
          updatedAt: serverTimestamp(),
        });

        return true;
      });

      if (!claimedRoll) {
        setLocalRolling(false);
        rollLockRef.current = false;
        return;
      }
    } catch (e) {
      console.error("Failed to claim roll", e);
      setLocalRolling(false);
      rollLockRef.current = false;
      return;
    }

    // Simulate rolling delay for UI
    setTimeout(async () => {
      try {
        const appliedRoll = await updateRoomPreservingActiveMoment(gameRef, (latestRoom) => {
          if (
            latestRoom.currentTurn !== uid ||
            latestRoom.diceRolled ||
            !latestRoom.isRolling ||
            getRollingPlayerUid(latestRoom) !== uid
          ) {
            return null;
          }

          const latestPlayers = [latestRoom.player1, latestRoom.player2, latestRoom.player3, latestRoom.player4].filter(Boolean) as Player[];
          const latestPlayer = latestPlayers.find((candidate) => candidate.uid === uid);
          if (!latestPlayer) return null;

          const turnResult = resolveNextTurn({
            currentUid: uid,
            players: latestPlayers,
            diceValue,
            consecutiveSixes: latestRoom.consecutiveSixes || 0,
          });
          const legalMoves = getLegalMoves(latestPlayer.color, latestRoom.pieces[uid] || [], diceValue);
          const noLegalMoves = legalMoves.length === 0;
          const shouldPassTurn = turnResult.cancelsMove || noLegalMoves;
          const nextTurnUid = noLegalMoves ? getNextPlayerUid(uid, latestPlayers) : shouldPassTurn ? turnResult.nextTurnUid : uid;
          const nextMoment = diceValue === 6 && !turnResult.cancelsMove
              ? createCoupleMoment({
                event: 'roll_six',
                mood: latestRoom.momentMood,
                playerUid: uid,
              })
            : null;

          return {
            updates: {
              lastDiceValue: diceValue,
              diceRolled: !shouldPassTurn,
              isRolling: false,
              rollingPlayerUid: null,
              currentTurn: nextTurnUid,
              consecutiveSixes: noLegalMoves ? 0 : turnResult.consecutiveSixes,
            },
            nextMoment,
          };
        });

        if (!appliedRoll) {
          await clearRollingClaimIfOwned(gameRef, uid);
        }
      } catch (err) {
        console.error("Roll dice error:", err);
        await clearRollingClaimIfOwned(gameRef, uid);
      } finally {
        setLocalRolling(false);
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
    let appliedMoveEffects: {
      playerName: string;
      capturedVictimName?: string;
      isWinner: boolean;
    } | null = null;

    const gameRef = doc(db, 'rooms', roomId);
    try {
      const applied = await updateRoomPreservingActiveMoment(gameRef, (latestRoom) => {
        if (latestRoom.currentTurn !== uid) return null;
        if (!overrideDiceValue && !latestRoom.diceRolled) return null;

        const latestPlayers = [latestRoom.player1, latestRoom.player2, latestRoom.player3, latestRoom.player4].filter(Boolean) as Player[];
        const player = latestPlayers.find((candidate) => candidate.uid === uid);
        if (!player) return null;

        const pieces = latestRoom.pieces[uid] || [];
        const piece = pieces.find(p => p.id === pieceId);
        const currentDiceValue = overrideDiceValue || latestRoom.lastDiceValue;
        const newPiece = piece ? movePiece(player.color, piece, currentDiceValue) : null;
        if (!piece || !newPiece) return null;

        const landedOnSafeSquare = newPiece.status === 'board' && [0, 8, 13, 21, 26, 34, 39, 47].includes(newPiece.position);
        const updatedPieces = { ...latestRoom.pieces };
        updatedPieces[uid] = pieces.map(p => p.id === pieceId ? newPiece : p);

        const playerColors = getPlayerColorMap(latestPlayers);
        const collision = checkCapture(uid, newPiece, updatedPieces, playerColors);
        if (collision) {
          const victimPieces = updatedPieces[collision.victimUid] || [];
          updatedPieces[collision.victimUid] = victimPieces.map(p =>
            p.id === collision.victimPieceId ? { ...p, position: -1, status: 'base' } : p
          );
        }

        const isWinner = updatedPieces[uid].every(p => p.status === 'finished');
        const finishedPiece = newPiece.status === 'finished' && piece.status !== 'finished';
        const turnResult = resolveNextTurn({
          currentUid: uid,
          players: latestPlayers,
          diceValue: currentDiceValue,
          consecutiveSixes: latestRoom.consecutiveSixes || 0,
          captured: !!collision,
          finishedPiece,
        });
        const nextMomentEvent = isWinner
          ? 'victory'
          : finishedPiece
            ? 'finish_piece'
            : collision
              ? 'capture'
              : landedOnSafeSquare
                ? 'safe_square'
                : null;
        const nextMoment = nextMomentEvent
          ? createCoupleMoment({
              event: nextMomentEvent,
              mood: latestRoom.momentMood,
              playerUid: uid,
            })
          : null;
        const victimName = collision
          ? latestPlayers.find(p => p.uid === collision.victimUid)?.name || 'Someone'
          : undefined;

        appliedMoveEffects = {
          playerName: player.name,
          capturedVictimName: victimName,
          isWinner,
        };

        return {
          updates: {
            pieces: updatedPieces,
            currentTurn: isWinner ? null : turnResult.nextTurnUid,
            diceRolled: false,
            consecutiveSixes: isWinner ? 0 : turnResult.consecutiveSixes,
            winner: isWinner ? uid : null,
            status: isWinner ? 'finished' : 'playing',
          },
          nextMoment,
        };
      });

      if (!applied || !appliedMoveEffects) return;

      if (appliedMoveEffects.capturedVictimName) {
        await sendMessage(uid, appliedMoveEffects.playerName, `Captured ${appliedMoveEffects.capturedVictimName}'s piece! ⚡`, 'moment');

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

      if (appliedMoveEffects.isWinner) {
        await sendMessage(uid, appliedMoveEffects.playerName, `Victory! Completed the journey 🏆`, 'moment');

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
    const newMessage: Message = {
      uid,
      sender,
      text,
      type,
      timestamp: Date.now()
    };

    await runTransaction(db, async (transaction) => {
      const roomSnap = await transaction.get(gameRef);
      if (!roomSnap.exists()) return;

      const latestRoom = roomSnap.data() as GameState;
      transaction.update(gameRef, {
        messages: [...(latestRoom.messages || []), newMessage],
        updatedAt: serverTimestamp()
      });
    });
  };

  const submitMoment = async (uid: string, answer: string) => {
    if (!roomId || !game?.activeMoment || game.activeMoment.playerUid !== uid) return;
    const trimmed = answer.trim();
    if (!trimmed) return;

    const expectedMoment = game.activeMoment;
    const gameRef = doc(db, 'rooms', roomId);
    const submittedAt = Date.now();

    try {
      const claimSucceeded = await runTransaction(db, async (transaction) => {
        const roomSnap = await transaction.get(gameRef);
        if (!roomSnap.exists()) return false;

        const latestRoom = roomSnap.data() as GameState;
        const currentMoment = latestRoom.activeMoment;
        if (!currentMoment || currentMoment.id !== expectedMoment.id || currentMoment.playerUid !== uid) return false;

        const player = [latestRoom.player1, latestRoom.player2, latestRoom.player3, latestRoom.player4].find(p => p?.uid === uid);
        const momentMessage: Message = {
          uid,
          sender: player?.name || 'Player',
          text: formatMomentMessage(expectedMoment, trimmed),
          type: 'moment',
          timestamp: submittedAt,
        };

        transaction.update(gameRef, {
          messages: [...(latestRoom.messages || []), momentMessage],
          activeMoment: null,
          updatedAt: serverTimestamp(),
        });

        return true;
      });

      if (claimSucceeded) {
        try {
          const userRef = doc(db, 'users', uid);
          await updateDoc(userRef, { points: increment(expectedMoment.rewardCoins) });
        } catch (e) {
          console.error('Failed to award moment points:', e);
        }
      }
    } catch (e) {
      console.error('Failed to submit moment:', e);
    }
  };

  const skipMoment = async (uid: string) => {
    if (!roomId || !game?.activeMoment || game.activeMoment.playerUid !== uid) return;
    const expectedMoment = game.activeMoment;
    const gameRef = doc(db, 'rooms', roomId);

    try {
      await runTransaction(db, async (transaction) => {
        const roomSnap = await transaction.get(gameRef);
        if (!roomSnap.exists()) return;

        const latestRoom = roomSnap.data() as GameState;
        const currentMoment = latestRoom.activeMoment;
        if (!currentMoment || currentMoment.id !== expectedMoment.id || currentMoment.playerUid !== uid) return;

        transaction.update(gameRef, {
          activeMoment: null,
          updatedAt: serverTimestamp(),
        });
      });
    } catch (e) {
      console.error('Failed to skip moment:', e);
    }
  };

  return { game, error, rollDice, performMove, startGame, sendMessage, submitMoment, skipMoment, isRolling: localRolling };
}
