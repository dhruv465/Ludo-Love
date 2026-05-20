import React from 'react';
import { motion } from 'motion/react';
import { Trophy, Calendar, Heart, Camera } from 'lucide-react';

export interface MatchEntry {
  id: string;
  roomId: string;
  winner: string;
  players: any[];
  theme: string;
  messages?: any[];
  createdAt: any;
}

export function History({ matches, onClose }: { matches: MatchEntry[], onClose: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-[#FFF5F7]/80 backdrop-blur-xl p-4 overflow-y-auto"
    >
      <div className="max-w-4xl mx-auto py-12">
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-rose-500 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200">
                <Heart className="w-6 h-6 text-white fill-white" />
             </div>
             <div>
                <h2 className="text-4xl font-black text-slate-900 font-display">Match History</h2>
                <p className="text-rose-300 font-bold uppercase tracking-widest text-[10px]">Recent classic Ludo games</p>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="w-12 h-12 rounded-full bg-white border border-rose-100 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors shadow-sm"
          >
            ✕
          </button>
        </div>

        {matches.length === 0 ? (
          <div className="bg-white p-20 rounded-[3rem] text-center border-4 border-dashed border-rose-100">
             <Camera className="w-16 h-16 text-rose-100 mx-auto mb-6" />
             <h3 className="text-xl font-bold text-slate-400">No matches yet</h3>
             <p className="text-slate-300 text-sm">Finish a game to create match history.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {matches.map((match, i) => (
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.1 }}
                key={match.id}
                className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-rose-100 border border-white relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-bl-[5rem] -mr-8 -mt-8 opacity-50 group-hover:bg-rose-100 transition-colors" />
                
                <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
                   <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3 text-rose-300">
                         <Calendar className="w-4 h-4" />
                         <span className="text-xs font-black uppercase tracking-wider">
                           {match.createdAt?.seconds ? new Date(match.createdAt.seconds * 1000).toLocaleDateString() : 'Recent Match'}
                         </span>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="flex -space-x-3">
                           {match.players.map((p, j) => (
                              <div key={j} className="w-12 h-12 rounded-full border-4 border-white shadow-md overflow-hidden bg-rose-50">
                                 <img src={p.avatar} title={p.name} className="w-full h-full object-cover" />
                              </div>
                           ))}
                        </div>
                        <div className="h-8 w-px bg-slate-100" />
                        <div className="flex flex-col">
                           <span className="text-[10px] font-black text-rose-300 uppercase">Winner</span>
                           <div className="flex items-center gap-2">
                              <Trophy className="w-4 h-4 text-amber-500" />
                              <span className="font-black text-slate-800">{match.players.find(p => p.uid === match.winner)?.name || 'Someone'}</span>
                           </div>
                        </div>
                      </div>

                      <div className="bg-rose-50/50 p-6 rounded-3xl border border-rose-100/50">
                         <h4 className="text-[10px] font-black text-rose-300 uppercase tracking-widest mb-3">Match Events</h4>
                         <div className="flex flex-wrap gap-2">
                            {match.messages?.filter(m => m.type === 'reaction' || m.type === 'moment').slice(0, 8).map((m, k) => (
                               <div key={k} className="bg-white px-3 py-1.5 rounded-full shadow-sm text-lg border border-rose-100">
                                  {m.text}
                               </div>
                            ))}
                            {(!match.messages || match.messages.length === 0) && (
                               <span className="text-[10px] text-slate-400 font-bold italic">No events saved.</span>
                            )}
                         </div>
                      </div>
                   </div>

                   <div className="w-full md:w-64 space-y-4">
                      <h4 className="text-[10px] font-black text-rose-300 uppercase tracking-widest">Chat Moments</h4>
                      <div className="space-y-2 h-40 overflow-y-auto scrollbar-hide">
                         {match.messages?.filter(m => m.type === 'text').map((msg, k) => (
                            <div key={k} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs">
                               <span className="font-black text-rose-500 block text-[8px] uppercase">{msg.sender}</span>
                               <p className="text-slate-600 leading-tight">{msg.text}</p>
                            </div>
                         ))}
                         {(!match.messages || match.messages.filter(m => m.type === 'text').length === 0) && (
                            <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-50 rounded-2xl">
                               <span className="text-[10px] font-black text-slate-200">No chat saved</span>
                            </div>
                         )}
                      </div>
                   </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
