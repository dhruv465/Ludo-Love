import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

interface DiceProps {
  value: number;
  isRolling: boolean;
  disabled: boolean;
  onClick: () => void;
  color: string;
}

const DOTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[30, 30], [50, 50], [70, 70]],
  4: [[30, 30], [30, 70], [70, 30], [70, 70]],
  5: [[30, 30], [30, 70], [50, 50], [70, 30], [70, 70]],
  6: [[30, 24], [30, 50], [30, 76], [70, 24], [70, 50], [70, 76]],
};

const DICE_ACCENT: Record<string, string> = {
  red: 'shadow-rose-200/80 ring-rose-200',
  green: 'shadow-emerald-200/80 ring-emerald-200',
  yellow: 'shadow-amber-200/90 ring-amber-200',
  blue: 'shadow-cyan-200/80 ring-cyan-200',
};

const DICE_EDGE: Record<string, string> = {
  red: 'from-rose-100 to-rose-200',
  green: 'from-emerald-100 to-emerald-200',
  yellow: 'from-amber-100 to-amber-200',
  blue: 'from-cyan-100 to-cyan-200',
};

function useReducedMotionPreference() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(query.matches);
    const onChange = () => setReducedMotion(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reducedMotion;
}

function DiceFace({ value }: { value: number }) {
  return (
    <div className="absolute inset-0 rounded-[14px] border border-white/80 bg-gradient-to-br from-white via-white to-slate-100 shadow-[inset_-7px_-8px_12px_rgba(15,23,42,0.12),inset_4px_4px_8px_rgba(255,255,255,0.95)]">
      <div className="absolute inset-x-1 top-1 h-1/2 rounded-t-[12px] bg-white/70" />
      {(DOTS[value] || DOTS[1]).map(([x, y], index) => (
        <span
          key={`${value}-${index}`}
          className="absolute h-[7px] w-[7px] rounded-full bg-slate-950 shadow-[inset_1px_1px_1px_rgba(255,255,255,0.24)]"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
    </div>
  );
}

export function Dice({ value, isRolling, disabled, onClick, color }: DiceProps) {
  const shownValue = Math.min(6, Math.max(1, value || 1));
  const reducedMotion = useReducedMotionPreference();
  const edgeColor = DICE_EDGE[color] || DICE_EDGE.red;

  return (
    <div className="relative flex h-[56px] w-[56px] items-center justify-center [perspective:560px]">
      <motion.div
        animate={{
          scale: isRolling ? [0.92, 1.08, 0.96] : 1,
          opacity: isRolling ? [0.12, 0.22, 0.12] : 0.14,
        }}
        transition={isRolling ? { repeat: Infinity, duration: 0.34 } : { duration: 0.2 }}
        className="absolute bottom-0 h-3 w-10 rounded-full bg-slate-950 blur-lg"
      />

      <motion.button
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-label={`Dice showing ${shownValue}`}
        animate={reducedMotion
          ? { opacity: isRolling ? [0.72, 1] : 1 }
          : {
              rotateX: isRolling ? [-12, 230, 510, 708] : -12,
              rotateY: isRolling ? [14, 198, 402, 734] : 14,
              rotateZ: isRolling ? [0, 22, -18, 0] : 0,
              y: isRolling ? [0, -5, 0] : 0,
            }}
        transition={isRolling
          ? { duration: 0.9, ease: 'easeInOut' }
          : { type: 'spring', stiffness: 260, damping: 20 }}
        className={cn(
          "relative h-12 w-12 rounded-[14px] outline-none ring-[3px] transition-transform duration-200 active:scale-95 [transform-style:preserve-3d]",
          DICE_ACCENT[color] || DICE_ACCENT.red,
          disabled ? "cursor-default opacity-95" : "cursor-pointer"
        )}
        style={{ transformStyle: 'preserve-3d' }}
      >
        <div
          className="absolute inset-0"
          style={{
            transform: 'translateZ(24px)',
            transformStyle: 'preserve-3d',
          }}
        >
          <DiceFace value={shownValue} />
        </div>
        <div
          className={cn("absolute inset-0 rounded-[14px] bg-gradient-to-br opacity-95", edgeColor)}
          style={{
            transform: 'rotateX(90deg) translateZ(24px)',
            transformOrigin: 'center',
          }}
        />
        <div
          className={cn("absolute inset-0 rounded-[14px] bg-gradient-to-br opacity-90", edgeColor)}
          style={{
            transform: 'rotateY(90deg) translateZ(24px)',
            transformOrigin: 'center',
          }}
        />
      </motion.button>
    </div>
  );
}
