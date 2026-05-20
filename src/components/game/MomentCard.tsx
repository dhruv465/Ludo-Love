import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Heart, Send, X } from 'lucide-react';
import { CoupleMoment } from '../../lib/ludo-types';
import { cn } from '../../lib/utils';

const EVENT_LABEL: Record<CoupleMoment['event'], string> = {
  roll_six: 'Lucky Six',
  capture: 'Captured',
  safe_square: 'Safe Spot',
  finish_piece: 'Home Stretch',
  victory: 'Victory Moment',
};

const EVENT_STYLE: Record<CoupleMoment['event'], string> = {
  roll_six: 'from-rose-500 to-pink-500',
  capture: 'from-amber-500 to-rose-500',
  safe_square: 'from-emerald-500 to-cyan-500',
  finish_piece: 'from-cyan-500 to-blue-500',
  victory: 'from-fuchsia-500 to-rose-500',
};

interface MomentCardProps {
  moment: CoupleMoment;
  disabled?: boolean;
  onSend: (answer: string) => void | Promise<void>;
  onSkip: () => void | Promise<void>;
}

export function MomentCard({ moment, disabled, onSend, onSkip }: MomentCardProps) {
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const canSend = answer.trim().length > 0 && !busy && !disabled;

  const submit = async () => {
    if (!canSend) return;
    setBusy(true);
    try {
      await onSend(answer);
      setAnswer('');
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      await onSkip();
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 18, scale: 0.98 }}
      className="fixed inset-x-3 bottom-[128px] z-50 mx-auto w-[min(calc(100vw-24px),560px)] overflow-hidden rounded-[26px] border border-white/80 bg-white shadow-[0_18px_50px_rgba(244,63,94,0.22)]"
    >
      <div className={cn('h-1.5 bg-gradient-to-r', EVENT_STYLE[moment.event])} />
      <div className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white', EVENT_STYLE[moment.event])}>
            <Heart className="h-5 w-5 fill-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-black text-slate-900">{EVENT_LABEL[moment.event]}</h3>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-600">+{moment.rewardCoins} coins</span>
            </div>
            <p className="mt-1 text-sm font-semibold leading-snug text-slate-600">{moment.prompt}</p>
          </div>
        </div>

        <textarea
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          maxLength={160}
          rows={2}
          placeholder="Write something short..."
          className="w-full resize-none rounded-2xl border border-rose-100 bg-rose-50/50 px-3 py-2 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-300 focus:border-rose-300"
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={skip}
            disabled={busy || disabled}
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white text-xs font-black uppercase tracking-wider text-slate-400 active:scale-95 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            Skip
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            className="flex h-10 flex-[1.4] items-center justify-center gap-2 rounded-full bg-rose-500 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-rose-200 active:scale-95 disabled:bg-slate-200 disabled:shadow-none"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </div>
      </div>
    </motion.div>
  );
}
