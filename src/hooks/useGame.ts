import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, updateDoc, serverTimestamp, setDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { GameState, Piece, PlayerColor } from '../lib/ludo-types';
import { movePiece, checkCollision } from '../lib/ludo-engine';

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

import { playSubtleSound } from '../lib/audio';

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
    
    rollLockRef.current = true;
    setLocalRolling(true);
    
    const piecesForLuck = game.pieces[uid] || [];
    let diceValue = Math.floor(Math.random() * 6) + 1;
    
    // Slight luck boost if all pieces are in base
    const allInBase = piecesForLuck.length > 0 && piecesForLuck.every(p => p.status === 'base');
    if (allInBase && diceValue !== 6) {
        // High chance to get a 6 to quickly get them into the game
        if (Math.random() < 0.6) {
            diceValue = 6;
        }
    }
    
    try {
        const gameRef = doc(db, 'rooms', roomId);
        await updateDoc(gameRef, { isRolling: true });
    } catch (e) {
        console.error("Failed to set isRolling", e);
    }

    // Simulate rolling delay for UI
    setTimeout(async () => {
      try {
        const gameRef = doc(db, 'rooms', roomId);
        await updateDoc(gameRef, {
          lastDiceValue: diceValue,
          diceRolled: true,
          isRolling: false,
          updatedAt: serverTimestamp()
        });

        setLocalRolling(false);
        rollLockRef.current = false;

        // Auto-skip logic if no moves are possible
        const pieces = game.pieces[uid] || [];
        const playerColor = [game.player1, game.player2, game.player3, game.player4].find(p => p?.uid === uid)?.color || 'red';
        
        const validPieces = pieces.filter(p => !!movePiece(playerColor, p, diceValue));
        const hasValidMoves = validPieces.length > 0;
        
        if (!hasValidMoves) {
            await new Promise(r => setTimeout(r, 800));
            
            let nextTurnUid = uid;
            if (diceValue !== 6) {
                const colorOrder: PlayerColor[] = ['red', 'green', 'blue', 'yellow'];
                const players = ([game.player1, game.player2, game.player3, game.player4].filter(p => !!p) as any[])
                    .sort((a, b) => colorOrder.indexOf(a.color) - colorOrder.indexOf(b.color));
                
                const currentIndex = players.findIndex(p => p.uid === uid);
                const nextPlayer = players[(currentIndex + 1) % players.length];
                nextTurnUid = nextPlayer?.uid || uid;
            }
            
            await updateDoc(gameRef, {
                currentTurn: nextTurnUid,
                diceRolled: false,
                updatedAt: serverTimestamp()
            });
        } else if (validPieces.length === 1) {
            // Auto move if exactly 1 piece can be moved
            setTimeout(async () => {
                await performMove(uid, validPieces[0].id, diceValue);
            }, 600);
        }
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

    const player = game.player1?.uid === uid ? game.player1 : (game.player2?.uid === uid ? game.player2 : (game.player3?.uid === uid ? game.player3 : game.player4));
    if (!player) return;

    const pieces = game.pieces[uid];
    const piece = pieces.find(p => p.id === pieceId);
    
    // Use the latest known dice value if passed, else fallback to game state
    const currentDiceValue = overrideDiceValue || game.lastDiceValue;
    if (!piece || !movePiece(player.color, piece, currentDiceValue)) return;
    
    const newPiece = movePiece(player.color, piece, currentDiceValue)!;

    const updatedPieces = { ...game.pieces };
    updatedPieces[uid] = pieces.map(p => p.id === pieceId ? newPiece : p);

    const playerColors = {
        [game.player1?.uid || '']: game.player1?.color || 'red',
        [game.player2?.uid || '']: game.player2?.color || 'blue',
        [game.player3?.uid || '']: game.player3?.color || 'green',
        [game.player4?.uid || '']: game.player4?.color || 'yellow',
    } as Record<string, PlayerColor>;

    // Check collision
    const collision = checkCollision(uid, newPiece, updatedPieces, playerColors);
    if (collision) {
      playSubtleSound('capture');
      const victimPieces = updatedPieces[collision.victimUid];
      updatedPieces[collision.victimUid] = victimPieces.map(p => 
        p.id === collision.victimPieceId ? { ...p, position: -1, status: 'base' } : p
      );
      
      const victimName = [game.player1, game.player2, game.player3, game.player4].find(p => p?.uid === collision.victimUid)?.name || 'Someone';
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
        playSubtleSound('win');
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
    
    // Switch turn logic
    let nextTurn = game.currentTurn;
    if (game.lastDiceValue !== 6 && !collision && !isWinner) {
      const colorOrder: PlayerColor[] = ['red', 'green', 'blue', 'yellow'];
      const players = ([game.player1, game.player2, game.player3, game.player4].filter(p => !!p) as any[])
        .sort((a, b) => colorOrder.indexOf(a.color) - colorOrder.indexOf(b.color));
      
      const currentIndex = players.findIndex(p => p.uid === uid);
      const nextPlayer = players[(currentIndex + 1) % players.length];
      nextTurn = nextPlayer?.uid || uid;
    }

    const gameRef = doc(db, 'rooms', roomId);
    try {
      await updateDoc(gameRef, {
        pieces: updatedPieces,
        currentTurn: isWinner ? null : nextTurn,
        diceRolled: false,
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
                    const pieces = game.pieces[currentPlayer.uid];
                    const validPieces = pieces.filter(p => {
                        const next = movePiece(currentPlayer.color, p, game.lastDiceValue);
                        return !!next;
                    });

                    if (validPieces.length > 0) {
                        // Simple AI: Move the piece that is furthest along
                        const bestPiece = validPieces.sort((a, b) => b.position - a.position)[0];
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

  const sendMessage = async (uid: string, sender: string, text: string, type: 'text' | 'reaction' | 'moment' | 'voice' = 'text', audioData?: string) => {
    if (!roomId || !game) return;
    const gameRef = doc(db, 'rooms', roomId);
    const newMessage: any = {
      uid,
      sender,
      text,
      type,
      timestamp: Date.now()
    };
    
    if (audioData) {
      newMessage.audioData = audioData;
    }
    
    await updateDoc(gameRef, {
      messages: [...(game.messages || []), newMessage],
      updatedAt: serverTimestamp()
    });
  };

  return { game, error, rollDice, performMove, startGame, sendMessage, isRolling: localRolling };
}
