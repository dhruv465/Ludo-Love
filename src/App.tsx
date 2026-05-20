/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Lobby } from './components/game/Lobby';
import { Board } from './components/game/Board';
import { Dice } from './components/game/Dice';
import { MomentCard } from './components/game/MomentCard';
import { useGame } from './hooks/useGame';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Trophy, LogOut, Users, Camera, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './lib/firebase';
import { PlayerColor, GameTheme, MomentMood } from './lib/ludo-types';
import { History, MatchEntry } from './components/game/History';
import { cn } from './lib/utils';
import { collection, query, orderBy, limit, getDocs, addDoc } from 'firebase/firestore';
import { getLegalMoves } from './lib/ludo-engine';

function GameContent() {
  const { user, userData, loading, error } = useAuth();
  const [activeRoomId, setActiveRoomId] = useState<string | null>(() => {
    return localStorage.getItem('ludo_active_room');
  });
  const { game, rollDice, performMove, startGame, submitMoment, skipMoment, isRolling } = useGame(activeRoomId || '', user?.uid);
  const [showHistory, setShowHistory] = useState(false);
  const [matches, setMatches] = useState<MatchEntry[]>([]);

  // Sync room ID to localStorage
  useEffect(() => {
    if (activeRoomId) {
      localStorage.setItem('ludo_active_room', activeRoomId);
    } else {
      localStorage.removeItem('ludo_active_room');
    }
  }, [activeRoomId]);

  const isMyTurn = game?.currentTurn === user?.uid;

  // Load matches
  useEffect(() => {
    if (user && showHistory) {
      const loadMatches = async () => {
        const q = query(collection(db, 'matches'), orderBy('createdAt', 'desc'), limit(10));
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MatchEntry));
        setMatches(data);
      };
      loadMatches();
    }
  }, [user, showHistory]);

  // Save match when finished
  useEffect(() => {
    if (game?.status === 'finished' && game.winner) {
      if (game.player1?.uid === user?.uid) {
        const saveResult = async () => {
          const matchData = {
            roomId: activeRoomId,
            winner: game.winner,
            players: [game.player1, game.player2, game.player3, game.player4].filter(p => !!p),
            theme: game.theme,
            createdAt: serverTimestamp()
          };
          await addDoc(collection(db, 'matches'), matchData);
        };
        saveResult();
      }

      // Celebratory confetti: Professional burst
      const count = 200;
      const defaults = { origin: { y: 0.7 }, zIndex: 1000 };

      const fire = (particleRatio: number, opts: any) => {
        confetti({
          ...defaults,
          ...opts,
          particleCount: Math.floor(count * particleRatio)
        });
      };

      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2, { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
      fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fire(0.1, { spread: 120, startVelocity: 45 });
      
    }
  }, [game?.status, game?.winner]);

  const createRoom = async (color: PlayerColor, theme: GameTheme, playerCount: number, withBot: boolean = false, momentMood: MomentMood = 'romantic') => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const roomRef = doc(db, 'rooms', roomId);
    
    const initialPieces: Record<string, any> = {
      [user!.uid]: Array.from({ length: 4 }, (_, i) => ({ id: i, position: -1, status: 'base' as const }))
    };

    const hostPlayer = { 
      uid: user!.uid, 
      name: userData?.name || 'Guest', 
      avatar: userData?.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user!.uid}`, 
      color,
      ready: true
    };

    const players: any = {
      player1: hostPlayer,
      player2: null,
      player3: null,
      player4: null,
    };

    if (withBot) {
      const allColors: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];
      const botColors: PlayerColor[] = allColors.filter(c => c !== color);
      
      // For 2 player bot game, ensure cross positioning
      let assignedColors = [color];
      if (playerCount === 2) {
        const opposite: Record<string, PlayerColor> = { red: 'yellow', yellow: 'red', green: 'blue', blue: 'green' };
        assignedColors.push(opposite[color]);
      } else {
        assignedColors.push(...botColors.slice(0, playerCount - 1));
      }

      for (let i = 2; i <= playerCount; i++) {
        const botUid = `bot-${i}`;
        const botColor = assignedColors[i-1];
        players[`player${i}`] = {
          uid: botUid,
          name: `Bot ${i}`,
          avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${botUid}`,
          color: botColor,
          ready: true,
          isBot: true
        };
        initialPieces[botUid] = Array.from({ length: 4 }, (_, i) => ({ id: i, position: -1, status: 'base' as const }));
      }
    }

    await setDoc(roomRef, {
      id: roomId,
      hostId: user!.uid,
      ...players,
      status: withBot ? 'playing' : 'waiting',
      theme,
      momentMood,
      activeMoment: null,
      maxPlayers: playerCount,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      currentTurn: user!.uid,
      pieces: initialPieces,
      lastDiceValue: 1,
      diceRolled: false,
      consecutiveSixes: 0,
      winner: null
    });
    setActiveRoomId(roomId);
  };

  const joinRoom = async (id: string) => {
    const roomRef = doc(db, 'rooms', id);
    const snap = await getDoc(roomRef);
    if (snap.exists() && snap.data().status === 'waiting') {
      const data = snap.data();
      const players = [data.player1, data.player2, data.player3, data.player4];
      const nextSlot = players.findIndex(p => p === null) + 1;
      
      if (nextSlot === 0) {
        alert("Room is full!");
        return;
      }

      const usedColors = players.filter(p => !!p).map(p => p.color);
      const hostColor = data.player1.color;
      let nextColor: PlayerColor = 'blue';

      if (data.maxPlayers === 2) {
        const opposites: Record<string, PlayerColor> = { red: 'yellow', yellow: 'red', green: 'blue', blue: 'green' };
        nextColor = opposites[hostColor] || 'yellow';
      } else {
        const colorOrder: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];
        nextColor = colorOrder.find(c => !usedColors.includes(c)) || 'blue';
      }

      await updateDoc(roomRef, {
        [`player${nextSlot}`]: { 
          uid: user!.uid, 
          name: userData?.name || 'Guest', 
          avatar: userData?.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user!.uid}`, 
          color: nextColor,
          ready: true
        },
        updatedAt: serverTimestamp(),
        [`pieces.${user!.uid}`]: Array.from({ length: 4 }, (_, i) => ({ id: i, position: -1, status: 'base' as const }))
      });
      setActiveRoomId(id);
    } else {
      alert("Room not found or game already started.");
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[#FFF5F7] flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center">
          <X className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Connection Error</h2>
        <p className="text-slate-600 max-w-md">{error}</p>
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#FFF5F7] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!activeRoomId) {
    return (
      <div className="min-h-screen bg-[#FFF5F7] text-gray-900">
        <header className="h-16 flex items-center justify-between px-4 sm:px-8 bg-white border-b border-rose-100 shadow-sm shrink-0">
           <div className="flex min-w-0 items-center gap-3">
              <div className="w-10 h-10 shrink-0 bg-rose-500 rounded-xl flex items-center justify-center shadow-lg transform rotate-3">
                 <Heart className="w-6 h-6 text-white fill-white" />
              </div>
              <h1 className="min-w-0 truncate text-xl sm:text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-rose-500 to-pink-600 font-display">LUDO LOVE</h1>
           </div>
           <div className="flex shrink-0 items-center gap-2 sm:gap-4">
              <div className="hidden sm:flex flex-col items-end">
                 <span className="text-[10px] font-black text-rose-300 uppercase leading-none tracking-widest">Balance</span>
                 <span className="text-emerald-500 font-black text-lg">💰 {userData?.points || 0}</span>
              </div>
              <button 
                onClick={() => setShowHistory(true)}
                className="p-2 hover:bg-rose-50 rounded-full transition-colors text-rose-300 flex items-center gap-2 px-4 border border-rose-50"
              >
                 <Camera className="w-5 h-5" />
                 <span className="text-[10px] font-black uppercase tracking-widest hidden md:block">History</span>
              </button>
              <div className="flex items-center gap-2">
                 <img src={userData?.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`} className="w-8 h-8 rounded-full border border-rose-200" alt="" />
                 <span className="hidden sm:inline max-w-32 truncate text-sm font-bold text-slate-700">{userData?.name || 'Guest'}</span>
              </div>
           </div>
        </header>

        <AnimatePresence>
          {showHistory && (
             <History matches={matches} onClose={() => setShowHistory(false)} />
          )}
        </AnimatePresence>

        <Lobby 
          onCreate={createRoom}
          onJoin={joinRoom}
        />
      </div>
    );
  }

  if (!game) {
    return (
       <div className="min-h-screen bg-[#FFF5F7] flex flex-col items-center justify-center p-4 text-rose-500 gap-4">
          <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Connecting...</p>
       </div>
    );
  }

  const isHost = game.player1?.uid === user.uid;
  const myPlayer = [game.player1, game.player2, game.player3, game.player4].find(p => p?.uid === user.uid);
  const myColor = myPlayer?.color || 'red';
  const otherPlayers = [game.player1, game.player2, game.player3, game.player4].filter(p => p && p.uid !== user.uid);

  if (game.status === 'waiting') {
      return (
          <div className="min-h-screen bg-[#FFF5F7] flex flex-col items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-12 rounded-[3rem] shadow-2xl border border-rose-50 text-center space-y-8 w-full max-w-md"
              >
                  <div className="space-y-2">
                     <h2 className="text-3xl font-black text-gray-900 font-display">Waiting for Players</h2>
                     <p className="text-slate-400 font-medium tracking-tight">Share this room code with other players.</p>
                  </div>

                  <div className="bg-rose-50 p-6 rounded-3xl border-2 border-dashed border-rose-200">
                     <span className="text-4xl font-black tracking-widest text-rose-500 font-mono">{activeRoomId}</span>
                  </div>

                  <div className="rounded-2xl border border-rose-100 bg-rose-50/70 px-4 py-3">
                    <span className="block text-[9px] font-black uppercase tracking-widest text-rose-300">Couple Mood</span>
                    <span className="text-sm font-black capitalize text-slate-800">{game.momentMood || 'romantic'}</span>
                  </div>

                  <div className="flex justify-center items-center gap-4 flex-wrap">
                      {[game.player1, game.player2, game.player3, game.player4].map((p, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-2">
                            {p ? (
                                <>
                                    <img src={p.avatar} className={cn("w-12 h-12 rounded-full border-4", p.uid === user.uid ? "border-rose-500" : "border-emerald-500")} />
                                    <span className={cn("text-[10px] font-black uppercase text-center w-16 truncate", p.uid === user.uid ? "text-rose-500" : "text-emerald-500")}>{p.name}</span>
                                    <span className={cn("text-[8px] text-white px-2 py-0.5 rounded-full font-black", p.uid === game.player1?.uid ? 'bg-rose-500' : 'bg-emerald-500')}>{p.uid === game.player1?.uid ? 'HOST' : 'READY'}</span>
                                </>
                            ) : (
                                <>
                                    <div className="w-12 h-12 rounded-full bg-slate-50 border-4 border-dashed border-slate-200 flex items-center justify-center text-rose-200">
                                        <Users className="w-5 h-5" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase text-slate-300">Slot {idx + 1}</span>
                                </>
                            )}
                        </div>
                      ))}
                  </div>

                  {isHost && otherPlayers.length > 0 && (
                      <button 
                        onClick={startGame}
                        className="w-full py-5 bg-rose-500 text-white font-black rounded-2xl hover:bg-rose-600 transition-all shadow-xl shadow-rose-200 active:scale-95"
                      >
                         START GAME
                      </button>
                  )}

                  <button onClick={() => setActiveRoomId(null)} className="text-[10px] font-black uppercase text-rose-300 tracking-widest hover:text-rose-500">Cancel Room</button>
              </motion.div>
          </div>
      );
  }

  const myPiecesFinished = game.pieces[user.uid]?.filter(p => p.status === 'finished').length || 0;
  const legalPieceIds = myPlayer && isMyTurn && game.diceRolled
    ? getLegalMoves(myPlayer.color, game.pieces[user.uid] || [], game.lastDiceValue).map(piece => piece.id)
    : [];
  const activePlayers = [game.player1, game.player2, game.player3, game.player4].filter(Boolean);
  const currentTurnPlayer = activePlayers.find(p => p?.uid === game.currentTurn);
  const canRoll = isMyTurn && !game.diceRolled && !isRolling && !game.isRolling;

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#FFF6F8] text-gray-900 font-sans">
      <nav className="h-[clamp(54px,14vw,62px)] flex items-center justify-between px-[clamp(12px,4vw,18px)] bg-white/96 border-b border-rose-100 shadow-sm shrink-0 z-30">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="w-[clamp(34px,10vw,42px)] h-[clamp(34px,10vw,42px)] bg-rose-500 rounded-[14px] flex items-center justify-center shadow-lg shadow-rose-200/80 transform rotate-3 shrink-0">
            <Heart className="w-[clamp(18px,5vw,23px)] h-[clamp(18px,5vw,23px)] text-white fill-white" />
          </div>
          <h1 className="text-[clamp(20px,6vw,27px)] font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-rose-500 to-pink-600 font-display">LUDO LOVE</h1>
        </div>
        
        <div className="flex items-center gap-2 text-sm font-semibold">
          <div className="flex items-center gap-2 bg-rose-50 px-3 py-1.5 rounded-full border border-rose-100">
             <span className={cn("w-2 h-2 rounded-full", isMyTurn ? "bg-rose-500 animate-pulse" : "bg-slate-300")} />
             <span className="text-rose-600 font-mono text-[10px] uppercase tracking-wider">{activeRoomId}</span>
          </div>
          
          <button 
            onClick={() => setActiveRoomId(null)}
            className="p-2 text-rose-300 hover:text-rose-500 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-start gap-[clamp(8px,2.4vw,16px)] px-[clamp(10px,3vw,20px)] pt-[clamp(10px,3vw,18px)] pb-[clamp(118px,18svh,150px)] overflow-hidden relative">
        <div className="grid w-full max-w-[620px] grid-cols-[1fr_auto] items-center gap-3 rounded-[22px] border border-rose-100 bg-white/72 px-3 py-2 shadow-sm shadow-rose-100/70">
           <div className="flex min-w-0 items-center gap-2">
              <div className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center text-lg shadow-md border-2",
                isMyTurn ? "bg-rose-500 border-rose-200 text-white" : "bg-slate-100 border-slate-200"
              )}>
                 {isMyTurn ? "🎲" : "⏳"}
              </div>
              <div className="flex min-w-0 flex-col">
                 <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Current Turn</span>
                 <span className="truncate text-[clamp(13px,3.8vw,16px)] font-black text-slate-800">
                    {isMyTurn ? "Your Turn" : currentTurnPlayer?.name || 'Player'}
                 </span>
              </div>
           </div>
           
           <div className="text-right">
                 <span className="text-[9px] font-black uppercase tracking-widest text-rose-300">Goal</span>
                 <div className="flex items-center gap-1 justify-end">
                    {[1,2,3,4].map(i => (
                       <div key={i} className={cn("w-2 h-2 rounded-full", i <= myPiecesFinished ? "bg-rose-500" : "bg-rose-100")} />
                    ))}
                 </div>
                 <div className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-300">
                   {(game.momentMood || 'romantic')} mood
                 </div>
           </div>
        </div>

        {/* Center: The Board */}
        <section className="flex-1 flex w-full flex-col items-center justify-start overflow-auto min-h-0 relative px-0">
           <div className="relative w-[min(calc(100vw-20px),calc(100svh-210px),620px)] rounded-[1.6rem]">
              <Board 
                theme={game.theme}
                pieces={game.pieces}
                players={[
                    ...(game.player1 ? [{ uid: game.player1.uid, color: game.player1.color }] : []),
                    ...(game.player2 ? [{ uid: game.player2.uid, color: game.player2.color }] : []),
                    ...(game.player3 ? [{ uid: game.player3.uid, color: game.player3.color }] : []),
                    ...(game.player4 ? [{ uid: game.player4.uid, color: game.player4.color }] : []),
                ]}
                currentTurn={game.currentTurn}
                localPlayerUid={user.uid}
                diceRolled={game.diceRolled || false}
                legalPieceIds={legalPieceIds}
                onPieceClick={(id) => performMove(user.uid, id)}
              />
              
              <AnimatePresence>
                {/* Winner Overlay (Centered on Board) */}
                {game.status === 'finished' && game.winner && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl p-4 sm:p-8"
                  >
                    <motion.div 
                      initial={{ scale: 0.8, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      className="bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-2xl flex flex-col items-center text-center gap-6 border-[6px] border-rose-500 w-full max-w-sm"
                    >
                       <div className="relative">
                          <Trophy className="w-20 h-20 text-amber-500 drop-shadow-xl" />
                          <Heart className="absolute -top-2 -right-2 w-8 h-8 text-rose-500 fill-rose-500 animate-bounce" />
                       </div>
                       <div>
                          <h2 className="text-3xl font-black text-slate-800 mb-2 italic tracking-tight">VICTORY!</h2>
                          <p className="text-slate-600 font-medium px-4 text-sm">
                             <span className="text-rose-500 font-black text-lg block mb-1">
                                {[game.player1, game.player2, game.player3, game.player4].find(p => p?.uid === game.winner)?.name}
                             </span> 
                             has conquered the board!
                          </p>
                       </div>
                       <button 
                         onClick={() => setActiveRoomId(null)}
                         className="w-full py-4 bg-rose-500 text-white rounded-2xl font-black text-xl shadow-[0_6px_0_rgb(225,29,72)] hover:translate-y-1 hover:shadow-[0_4px_0_rgb(225,29,72)] transition-all active:scale-95"
                       >
                          BACK TO LOBBY
                       </button>
                    </motion.div>
                  </motion.div>
                )}

                {isMyTurn && !game.diceRolled && !isRolling && !game.isRolling && (
                   <></>
                )}
              </AnimatePresence>
           </div>
        </section>

        <AnimatePresence>
          {game.activeMoment && game.activeMoment.playerUid === user.uid && (
            <MomentCard
              moment={game.activeMoment}
              onSend={(answer) => submitMoment(user.uid, answer)}
              onSkip={() => skipMoment(user.uid)}
            />
          )}
        </AnimatePresence>

        <div className="fixed bottom-0 left-0 right-0 z-40 w-full border-t border-rose-100 bg-white/96 backdrop-blur-xl shadow-[0_-18px_50px_rgba(244,63,94,0.14)]">
          <div className="relative mx-auto grid min-h-[112px] w-full max-w-[620px] grid-cols-[minmax(0,1fr)_86px_minmax(0,1fr)] items-center gap-2 px-[clamp(10px,3.4vw,18px)] pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
            <div className="flex min-w-0 items-center gap-2 rounded-[22px] border border-rose-100 bg-rose-50/75 px-2 py-2 shadow-sm">
              <div className="relative h-[clamp(42px,12vw,50px)] w-[clamp(42px,12vw,50px)] shrink-0 rounded-2xl border-2 border-white bg-white shadow-md">
                <img
                  src={userData?.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`}
                  className="h-full w-full rounded-2xl object-cover"
                  alt=""
                />
                <span className={cn(
                  "absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white",
                  myColor === 'red' ? 'bg-rose-500' : myColor === 'green' ? 'bg-emerald-500' : myColor === 'yellow' ? 'bg-amber-400' : 'bg-cyan-500'
                )} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[clamp(12px,3.7vw,15px)] font-black text-slate-800">
                  {userData?.name || myPlayer?.name || 'You'}
                </div>
                <div className="text-[clamp(9px,2.8vw,11px)] font-black uppercase tracking-wider text-emerald-500">
                  Coins {userData?.points || 0}
                </div>
              </div>
            </div>

            <div className="flex min-w-0 flex-col items-center gap-1">
              <div className="relative flex h-[72px] w-[72px] items-center justify-center rounded-[22px] bg-transparent">
                <div className="flex h-full w-full items-center justify-center rounded-[19px] bg-transparent">
                <Dice
                  value={game.lastDiceValue}
                  isRolling={isRolling || !!game.isRolling}
                  disabled={!canRoll}
                  color={myColor}
                  onClick={() => canRoll && rollDice(user.uid)}
                />
                </div>
              </div>
              <button
                disabled={!canRoll}
                onClick={() => rollDice(user.uid)}
                className={cn(
                  "h-8 min-w-[76px] rounded-full px-3 text-[11px] font-black uppercase tracking-wider shadow-md transition-all active:scale-95",
                  canRoll ? "bg-rose-500 text-white shadow-rose-200" : "bg-slate-100 text-slate-400 shadow-none"
                )}
              >
                {isRolling || game.isRolling ? "Rolling" : game.diceRolled ? "Move" : "Roll"}
              </button>
            </div>

            <div className="flex min-w-0 flex-col items-end rounded-[20px] border border-slate-100 bg-white px-2 py-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Turn</span>
              <span className="max-w-full truncate text-[clamp(12px,3.5vw,15px)] font-black text-slate-800">
                {isMyTurn ? "You" : currentTurnPlayer?.name || 'Player'}
              </span>
              <span className="mt-0.5 text-[10px] font-black uppercase tracking-wider text-rose-400">
                {game.diceRolled ? 'Move' : game.isRolling || isRolling ? 'Rolling' : 'Ready'}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <GameContent />
    </AuthProvider>
  );
}
