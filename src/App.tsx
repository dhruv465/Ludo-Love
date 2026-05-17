/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Lobby } from './components/game/Lobby';
import { Board } from './components/game/Board';
import { Dice } from './components/game/Dice';
import { useGame } from './hooks/useGame';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Trophy, LogOut, Share2, Users, Camera, X, Volume2, Music } from 'lucide-react';
import confetti from 'canvas-confetti';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './lib/firebase';
import { PlayerColor, GameTheme } from './lib/ludo-types';
import { StatsSidebar } from './components/game/Sidebars';
import { History, MatchEntry } from './components/game/History';
import { cn } from './lib/utils';
import { collection, query, orderBy, limit, getDocs, addDoc } from 'firebase/firestore';

function GameContent() {
  const { user, userData, loading, error } = useAuth();
  const [activeRoomId, setActiveRoomId] = useState<string | null>(() => {
    return localStorage.getItem('ludo_active_room');
  });
  const { game, rollDice, performMove, startGame, isRolling } = useGame(activeRoomId || '', user?.uid);
  const [showHistory, setShowHistory] = useState(false);
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const lastPlayedRef = useRef<number>(0);

  // Sync room ID to localStorage
  useEffect(() => {
    if (activeRoomId) {
      localStorage.setItem('ludo_active_room', activeRoomId);
    } else {
      localStorage.removeItem('ludo_active_room');
    }
  }, [activeRoomId]);

  const isMyTurn = game?.currentTurn === user?.uid;

  // Auto-play voice messages
  useEffect(() => {
    if (game?.messages && game.messages.length > 0) {
      const lastMsg = game.messages[game.messages.length - 1];
      if (lastMsg.type === 'voice' && lastMsg.audioData && lastMsg.timestamp > lastPlayedRef.current) {
        lastPlayedRef.current = lastMsg.timestamp;
        const audio = new Audio(lastMsg.audioData);
        audio.play().catch(e => console.error("Auto-play blocked or error:", e));
      }
    }
  }, [game?.messages]);

  useEffect(() => {
     if (isMyTurn) {
        new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3').play().catch(() => {});
     }
  }, [isMyTurn]);

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
      
      const endSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2012/2012-preview.mp3');
      endSound.play().catch(() => {});
    }
  }, [game?.status, game?.winner]);

  const createRoom = async (color: PlayerColor, theme: GameTheme, playerCount: number, withBot: boolean = false) => {
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
      const allColors: PlayerColor[] = ['red', 'yellow', 'green', 'blue'];
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
      maxPlayers: playerCount,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      currentTurn: user!.uid,
      pieces: initialPieces,
      lastDiceValue: 1,
      diceRolled: false,
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
        <header className="h-16 flex items-center justify-between px-8 bg-white border-b border-rose-100 shadow-sm shrink-0">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-500 rounded-xl flex items-center justify-center shadow-lg transform rotate-3">
                 <Heart className="w-6 h-6 text-white fill-white" />
              </div>
              <h1 className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-rose-500 to-pink-600 font-display">LUDO LOVE</h1>
           </div>
           <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col items-end">
                 <span className="text-[10px] font-black text-rose-300 uppercase leading-none tracking-widest">Balance</span>
                 <span className="text-emerald-500 font-black text-lg">💰 {userData?.points || 0}</span>
              </div>
              <button 
                onClick={() => setShowHistory(true)}
                className="p-2 hover:bg-rose-50 rounded-full transition-colors text-rose-300 flex items-center gap-2 px-4 border border-rose-50"
              >
                 <Camera className="w-5 h-5" />
                 <span className="text-[10px] font-black uppercase tracking-widest hidden md:block">Scrapbook</span>
              </button>
              <div className="flex items-center gap-2">
                 <img src={userData?.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`} className="w-8 h-8 rounded-full border border-rose-200" alt="" />
                 <span className="text-sm font-bold text-slate-700">{userData?.name || 'Guest'}</span>
              </div>
           </div>
        </header>

        <AnimatePresence>
          {showHistory && (
             <History matches={matches} onClose={() => setShowHistory(false)} />
          )}
        </AnimatePresence>

        <Lobby 
          user={user} 
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
                     <h2 className="text-3xl font-black text-gray-900 font-display">Waiting for Partner</h2>
                     <p className="text-slate-400 font-medium tracking-tight">Share this code with your soulmate</p>
                  </div>

                  <div className="bg-rose-50 p-6 rounded-3xl border-2 border-dashed border-rose-200">
                     <span className="text-4xl font-black tracking-widest text-rose-500 font-mono">{activeRoomId}</span>
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
                        className="w-full py-5 bg-rose-500 text-white font-black rounded-2xl hover:bg-rose-600 transition-all shadow-xl shadow-rose-200 animate-bounce"
                      >
                         START THE JOURNEY
                      </button>
                  )}

                  <button onClick={() => setActiveRoomId(null)} className="text-[10px] font-black uppercase text-rose-300 tracking-widest hover:text-rose-500">Cancel Room</button>
              </motion.div>
          </div>
      );
  }

  const myPiecesFinished = game.pieces[user.uid]?.filter(p => p.status === 'finished').length || 0;

  return (
    <div className="min-h-screen bg-[#FFF5F7] text-gray-900 flex flex-col font-sans">
      <nav className="h-16 flex items-center justify-between px-4 sm:px-8 bg-white border-b border-rose-100 shadow-sm shrink-0 z-30">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-rose-500 rounded-xl flex items-center justify-center shadow-lg transform rotate-3 shrink-0">
            <Heart className="w-5 h-5 sm:w-6 sm:h-6 text-white fill-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-rose-500 to-pink-600 font-display">LUDO LOVE</h1>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4 text-sm font-semibold">
          <div className="flex items-center gap-2 bg-rose-50 px-3 sm:px-4 py-2 rounded-full border border-rose-100">
             <span className={cn("w-2 h-2 rounded-full", isMyTurn ? "bg-rose-500 animate-pulse" : "bg-slate-300")} />
             <span className="text-rose-600 font-mono text-[10px] sm:text-xs uppercase tracking-wider">{activeRoomId}</span>
          </div>
          
          <div className="hidden sm:flex flex-col items-end mr-2">
             <span className="text-[9px] font-black text-rose-300 uppercase leading-none tracking-widest">Balance</span>
             <span className="text-emerald-500 font-black text-sm">💰 {userData?.points || 0}</span>
          </div>

          <div className="hidden sm:flex items-center -space-x-3">
             {[game.player1, game.player2, game.player3, game.player4].filter(p => !!p).map((p, i) => (
                <div key={i} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-white p-0.5 bg-white z-10 overflow-hidden ring-2 ring-rose-100">
                   <img src={p!.avatar} title={p!.name} className="w-full h-full rounded-full bg-rose-100 object-cover" />
                </div>
             ))}
          </div>
          
          <button 
            onClick={() => setActiveRoomId(null)}
            className="p-1.5 sm:p-2 text-rose-300 hover:text-rose-500 transition-colors"
          >
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center gap-4 p-4 overflow-hidden relative">
        {/* Top Stats */}
        <div className="w-full max-w-[480px] sm:max-w-[560px] flex items-center justify-between px-2">
           <div className="flex items-center gap-2">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-lg border-2",
                isMyTurn ? "bg-rose-500 border-rose-300 animate-pulse" : "bg-slate-100 border-slate-200"
              )}>
                 {isMyTurn ? "🎲" : "⏳"}
              </div>
              <div className="flex flex-col">
                 <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Current Turn</span>
                 <span className="text-sm font-black text-slate-700">
                    {isMyTurn ? "Your Turn" : [game.player1, game.player2, game.player3, game.player4].find(p => p?.uid === game.currentTurn)?.name || 'Partner'}
                 </span>
              </div>
           </div>
           
           <div className="flex items-center gap-4">
              <div className="text-right">
                 <span className="text-[9px] font-black uppercase tracking-widest text-rose-300">Victory Goal</span>
                 <div className="flex items-center gap-1 justify-end">
                    {[1,2,3,4].map(i => (
                       <div key={i} className={cn("w-1.5 h-1.5 rounded-full", i <= myPiecesFinished ? "bg-rose-500" : "bg-rose-100")} />
                    ))}
                 </div>
              </div>
           </div>
        </div>

        {/* Center: The Board */}
        <section className="flex-1 flex flex-col items-center justify-center overflow-auto min-h-0 relative px-0 md:px-2">
           <div className="w-full max-w-[480px] sm:max-w-[560px] relative rounded-[2rem]">
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

        {/* Mobile View Indicators */}
        <AnimatePresence mode="popLayout">
             <motion.div 
               key={game.currentTurn}
               initial={{ y: 100, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               exit={{ y: 100, opacity: 0 }}
               className="fixed bottom-6 inset-x-0 p-4 flex justify-center z-40"
             >
                <div className={cn(
                  "bg-white rounded-3xl shadow-2xl border-4 flex items-center justify-between px-3 gap-3 relative overflow-hidden h-[80px]",
                  isMyTurn ? "border-rose-500 w-[224px]" : "border-slate-300 w-[180px]"
                )}>
                   <Dice 
                    value={game.lastDiceValue}
                    isRolling={isRolling}
                    disabled={!isMyTurn || game.diceRolled}
                    color={myColor}
                    onClick={() => isMyTurn && !isRolling && rollDice(user.uid)}
                   />
                   {isMyTurn ? (
                     <div className="flex flex-col gap-1 pr-2">
                        <button 
                          disabled={!isMyTurn || game.diceRolled || isRolling}
                          onClick={() => rollDice(user.uid)}
                          className={cn(
                            "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-tighter transition-all shadow-md active:scale-95",
                            !game.diceRolled && !isRolling ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-400 grayscale"
                          )}
                        >
                           {isRolling ? "Rolling..." : "Roll Now"}
                        </button>
                     </div>
                   ) : (
                     <div className="pr-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center flex flex-col leading-tight">
                         <span className="text-slate-500">{[game.player1, game.player2, game.player3, game.player4].find(p => p?.uid === game.currentTurn)?.name || 'Player'}</span>
                         <span>Turn</span>
                     </div>
                   )}
                </div>
             </motion.div>
        </AnimatePresence>
      </main>

      <footer className="h-12 flex items-center justify-center gap-12 text-[10px] text-rose-300 font-bold tracking-[0.2em] uppercase shrink-0 border-t border-rose-50 bg-white/50">
        <span>Memory Mode: Level 5</span>
        <span className="opacity-30">•</span>
        <span>Lofi Love Beats</span>
      </footer>
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
