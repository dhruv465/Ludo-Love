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

const FACE_TRANSFORMS: Record<number, string> = {
  1: 'translateZ(24px)',
  2: 'rotateY(90deg) translateZ(24px)',
  3: 'rotateX(90deg) translateZ(24px)',
  4: 'rotateX(-90deg) translateZ(24px)',
  5: 'rotateY(-90deg) translateZ(24px)',
  6: 'rotateY(180deg) translateZ(24px)',
};

const FINAL_ROTATION: Record<number, { x: number; y: number; z: number }> = {
  1: { x: -14, y: 18, z: 0 },
  2: { x: -14, y: -72, z: 0 },
  3: { x: -104, y: 18, z: 0 },
  4: { x: 76, y: 18, z: 0 },
  5: { x: -14, y: 108, z: 0 },
  6: { x: -14, y: 198, z: 0 },
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

function DiceFace({ value, transform }: { value: number; transform: string }) {
  return (
    <div
      className="absolute left-0 top-0 h-12 w-12 rounded-[13px] border border-slate-200 bg-white [backface-visibility:hidden]"
      style={{ transform }}
    >
      {(DOTS[value] || DOTS[1]).map(([x, y], index) => (
        <span
          key={`${value}-${index}`}
          className="absolute h-[7px] w-[7px] rounded-full bg-slate-950"
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
  const final = FINAL_ROTATION[shownValue] || FINAL_ROTATION[1];

  return (
    <div className="relative flex h-[58px] w-[58px] items-center justify-center [perspective:720px]">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-label={`Dice showing ${shownValue}`}
        className={cn(
          "relative h-[62px] w-[62px] rounded-[20px] outline-none transition-transform duration-200 active:scale-95",
          disabled ? "cursor-default opacity-95" : "cursor-pointer"
        )}
      >
        <motion.div
          className="absolute left-[7px] top-[7px] h-12 w-12 [transform-style:preserve-3d]"
          animate={reducedMotion
            ? { opacity: isRolling ? [0.65, 1] : 1 }
            : {
                rotateX: isRolling ? [final.x, final.x + 180, final.x + 360, final.x + 540, final.x + 720] : final.x,
                rotateY: final.y,
                rotateZ: final.z,
                y: isRolling ? [0, -7, 1, -3, 0] : 0,
              }}
          transition={isRolling
            ? { duration: 0.92, ease: [0.22, 0.8, 0.2, 1] }
            : { type: 'spring', stiffness: 240, damping: 22 }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          <DiceFace value={1} transform={FACE_TRANSFORMS[1]} />
          <DiceFace value={2} transform={FACE_TRANSFORMS[2]} />
          <DiceFace value={3} transform={FACE_TRANSFORMS[3]} />
          <DiceFace value={4} transform={FACE_TRANSFORMS[4]} />
          <DiceFace value={5} transform={FACE_TRANSFORMS[5]} />
          <DiceFace value={6} transform={FACE_TRANSFORMS[6]} />
        </motion.div>
      </button>
    </div>
  );
}
