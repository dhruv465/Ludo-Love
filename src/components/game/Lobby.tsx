import { useState } from 'react';
import { motion } from 'motion/react';
import { Zap, ArrowRight, Heart } from 'lucide-react';
import { PlayerColor, MomentMood } from '../../lib/ludo-types';
import { cn } from '../../lib/utils';

interface LobbyProps {
  onCreate: (color: PlayerColor, playerCount: number, withBot: boolean, momentMood: MomentMood) => void | Promise<void>;
  onJoin: (roomId: string) => void | Promise<void>;
}

export function Lobby({ onCreate, onJoin }: LobbyProps) {
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [selectedColor, setSelectedColor] = useState<PlayerColor>('red');
  const [selectedMood, setSelectedMood] = useState<MomentMood>('romantic');

  const [playerCount, setPlayerCount] = useState(2);
  const [withBots, setWithBots] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      await onCreate(selectedColor, playerCount, withBots, selectedMood);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!roomCode) return;
    setLoading(true);
    try {
      await onJoin(roomCode);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const colors: PlayerColor[] = ['red', 'blue', 'green', 'yellow'];
  const moods: { id: MomentMood; label: string; helper: string }[] = [
    { id: 'cute', label: 'Cute', helper: 'Sweet and wholesome' },
    { id: 'romantic', label: 'Romantic', helper: 'Flirty and warm' },
    { id: 'spicy', label: 'Spicy', helper: 'Bolder text prompts' },
  ];

  return (
    <div className="flex flex-col items-center justify-center p-6 min-h-[calc(100vh-64px-48px)] text-[#000]">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-xl space-y-8 bg-white p-10 rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(244,63,94,0.1)] border border-rose-50 overflow-hidden relative"
      >
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-500 via-pink-500 to-emerald-500" />
        <div className="text-center space-y-2">
           <h2 className="text-4xl font-black text-gray-900 font-display">Ludo Love</h2>
           <p className="text-slate-400 font-medium tracking-tight">Play proper Ludo with friends or bots.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
           <div className="space-y-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-rose-300 px-1">Room Settings</h3>
              <div className="space-y-4 bg-rose-50/50 p-4 sm:p-6 rounded-3xl border border-rose-100">
                 <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Players</label>
                    <div className="flex bg-white rounded-xl p-1 border border-rose-100">
                        {[2, 3, 4].map(n => (
                            <button 
                                key={n}
                                onClick={() => setPlayerCount(n)}
                                className={cn(
                                    "flex-1 py-2 text-xs font-black rounded-lg transition-all",
                                    playerCount === n ? "bg-rose-500 text-white shadow-md shadow-rose-200" : "text-slate-400 hover:text-rose-500"
                                )}
                            >
                                {n}P
                            </button>
                        ))}
                    </div>
                 </div>

                 <div className="flex items-center justify-between py-1">
                    <label className="text-[10px] font-black uppercase text-slate-400">Add Bots</label>
                    <button 
                        onClick={() => setWithBots(!withBots)}
                        className={cn(
                            "w-10 h-6 rounded-full transition-all relative flex items-center px-1",
                            withBots ? "bg-emerald-500" : "bg-slate-200"
                        )}
                    >
                        <div className={cn(
                            "w-4 h-4 bg-white rounded-full shadow-sm transition-all transform",
                            withBots ? "translate-x-4" : "translate-x-0"
                        )} />
                    </button>
                 </div>

                 <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Your Color</label>
                    <div className="flex gap-2">
                       {colors.map(c => (
                          <button 
                            key={c}
                            onClick={() => setSelectedColor(c)}
                            className={cn(
                                "w-8 h-8 rounded-full border-2 transition-all",
                                c === 'red' ? 'bg-rose-500' : c === 'blue' ? 'bg-cyan-500' : c === 'green' ? 'bg-emerald-500' : 'bg-amber-500',
                                selectedColor === c ? 'border-gray-900 scale-125' : 'border-transparent scale-100'
                            )}
                          />
                       ))}
                    </div>
                 </div>
                 <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Couple Mood</label>
                    <div className="grid grid-cols-3 gap-2">
                       {moods.map((mood) => (
                          <button
                            key={mood.id}
                            type="button"
                            onClick={() => setSelectedMood(mood.id)}
                            className={cn(
                              "rounded-2xl border px-2 py-3 text-left transition-all",
                              selectedMood === mood.id
                                ? "border-rose-400 bg-white shadow-md shadow-rose-100"
                                : "border-rose-100 bg-white/70"
                            )}
                          >
                            <span className="block text-[11px] font-black text-slate-800">{mood.label}</span>
                            <span className="mt-1 block text-[9px] font-bold leading-tight text-slate-400">{mood.helper}</span>
                          </button>
                       ))}
                    </div>
                 </div>
                 <button
                    onClick={handleCreate}
                    disabled={loading}
                    className="w-full py-4 bg-rose-500 text-white font-black rounded-2xl shadow-xl shadow-rose-200 hover:bg-rose-600 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                 >
                    HOST ROOM <ArrowRight className="w-4 h-4" />
                 </button>
              </div>
           </div>

           <div className="space-y-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-emerald-300">Enter Room</h3>
              <div className="h-full bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100 flex flex-col justify-center gap-4">
                 <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    placeholder="ENTER CODE"
                    className="w-full px-4 py-4 bg-white border border-emerald-100 rounded-2xl text-emerald-900 font-mono text-center focus:outline-none focus:border-emerald-500 uppercase font-black"
                 />
                 <button
                    onClick={handleJoin}
                    disabled={loading || !roomCode}
                    className="w-full py-4 bg-emerald-500 text-white font-black rounded-2xl shadow-xl shadow-emerald-200 hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-50"
                 >
                    JOIN GAME
                 </button>
              </div>
           </div>
        </div>

        <div className="pt-8 border-t border-rose-50 flex items-center justify-center gap-8 text-slate-400 text-[10px] font-black uppercase tracking-widest">
           <div className="flex items-center gap-2">
              <Zap className="w-3 h-3 text-rose-500" />
              <span>Real-time</span>
           </div>
           <div className="flex items-center gap-2">
              <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
              <span>Moments</span>
           </div>
        </div>
      </motion.div>
    </div>
  );
}
