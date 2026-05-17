import React from 'react';
import { motion } from 'motion/react';
import { Flame, Film, Tv, Coffee } from 'lucide-react';
import { cn } from '../../lib/utils';

import { Mic, Square, Volume2 } from 'lucide-react';
import { Piece, PlayerColor, START_POSITIONS, PATH_LENGTH, HOME_STRETCH_LENGTH, SAFE_ZONES, Message } from '../../lib/ludo-types';

export function StatsSidebar({ name, wins, streak }: { name: string, wins: number, streak: number }) {
  return (
    <div className="bg-white p-5 rounded-3xl shadow-md border border-rose-50 flex flex-col gap-6">
      <div>
        <h3 className="text-[10px] font-black text-rose-300 uppercase tracking-[0.2em] mb-4">My Stats</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 font-semibold text-sm">Wins</span>
            <span className="text-xl font-black text-rose-500">{wins}</span>
          </div>
          <div className="h-1.5 bg-rose-50 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (wins / 20) * 100)}%` }}
              className="h-full bg-rose-500"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400 font-semibold text-sm">Streak</span>
            <span className="text-xl font-black text-rose-500 flex items-center gap-1">
              <Flame className="w-5 h-5 fill-rose-500" /> {streak}
            </span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-[10px] font-black text-rose-300 uppercase tracking-[0.2em] mb-4">Punishment Pot</h3>
        <div className="bg-rose-50/50 rounded-2xl p-4 border border-rose-100/50 text-sm italic text-rose-800 leading-relaxed">
          "Winner gets to pick the next movie tonight!" 🍿
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
         {[Film, Tv, Coffee].map((Icon, i) => (
            <button key={i} className="p-3 bg-white border border-rose-100 rounded-xl hover:bg-rose-50 transition-colors flex items-center justify-center">
               <Icon className="w-4 h-4 text-rose-300" />
            </button>
         ))}
      </div>
    </div>
  );
}

export function ReactionSidebar({ messages, onSend }: { messages: Message[], onSend: (text: string, type: 'text' | 'reaction' | 'moment' | 'voice', audioData?: string) => void }) {
  const reactions = ['❤️', '😂', '😡', '😘', '🔥', '😭'];
  const [input, setInput] = React.useState('');
  const [isRecording, setIsRecording] = React.useState(false);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input, 'text');
    setInput('');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          onSend('Voice Reaction 🎙️', 'voice', base64data);
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };
  
  return (
    <div className="bg-white p-5 rounded-3xl shadow-md border border-rose-50 flex flex-col h-full overflow-hidden">
      <h3 className="text-[10px] font-black text-rose-300 uppercase tracking-[0.2em] mb-4 text-[#000]">Reaction Chat</h3>
      
      <div className="flex-1 space-y-4 overflow-y-auto pr-1 mb-4 scrollbar-hide">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-300 text-[10px] font-black uppercase text-center mt-12">
            No memories yet...
          </div>
        ) : (
          messages.map((msg, i) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={i} 
              className={cn("flex gap-2", i % 2 === 0 ? "" : "justify-end")}
            >
              <div className={cn(
                "p-3 rounded-2xl text-xs font-medium leading-relaxed max-w-[80%] flex items-center gap-2",
                i % 2 === 0 ? "bg-rose-50 text-rose-700 rounded-tl-none" : "bg-pink-100 text-pink-700 rounded-tr-none"
              )}>
                {msg.type === 'voice' && <Volume2 className="w-3 h-3 animate-pulse" />}
                {msg.text}
              </div>
            </motion.div>
          ))
        )}
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-6 gap-1">
          {reactions.map((emoji, i) => (
            <button 
              key={i} 
              disabled={isRecording}
              onClick={() => onSend(emoji, 'reaction')}
              className="p-1.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 rounded-lg transition-all hover:scale-110 active:scale-95 text-lg flex items-center justify-center"
            >
              {emoji}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <input 
              type="text"
              value={input}
              disabled={isRecording}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isRecording ? "Recording..." : "Type a note..."}
              className="w-full bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-rose-300 pr-10"
            />
            <button 
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                className={cn(
                    "absolute right-1 top-1 bottom-1 px-2 rounded-lg transition-all",
                    isRecording ? "bg-rose-500 text-white animate-pulse" : "text-rose-300 hover:text-rose-500"
                )}
            >
                {isRecording ? <Square className="w-3 h-3 fill-current" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>
          <button 
            onClick={handleSend}
            disabled={isRecording}
            className="p-2 bg-rose-500 text-white rounded-xl shadow-md active:scale-95 transition-transform disabled:opacity-50"
          >
            <Film className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
