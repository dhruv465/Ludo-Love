import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

interface DiceProps {
  value: number;
  isRolling: boolean;
  disabled: boolean;
  onClick: () => void;
  color: string;
}

export function Dice({ value, isRolling, disabled, onClick, color }: DiceProps) {
  const [rotation, setRotation] = React.useState({ x: 0, y: 0, z: 0 });
  const [jump, setJump] = React.useState(0);

  React.useEffect(() => {
    if (isRolling) {
      const interval = setInterval(() => {
        setRotation(prev => ({
          x: prev.x + 45 + Math.random() * 45,
          y: prev.y + 15 + Math.random() * 15,
          z: prev.z + 30 + Math.random() * 30
        }));
        setJump(Math.sin(Date.now() / 100) * 10);
      }, 50);
      return () => clearInterval(interval);
    } else {
      // Find the next rotation that lands correctly for the value
      // We want to land on the value with a slight 3D perspective (tilt)
      const targetRotations: Record<number, {x: number, y: number}> = {
        1: { x: 0, y: 0 },       // Front
        2: { x: 0, y: -90 },     // Right
        3: { x: -90, y: 0 },     // Bottom -> Top
        4: { x: 90, y: 0 },      // Top -> Top
        5: { x: 0, y: 180 },     // Back -> Front
        6: { x: 0, y: 90 },      // Left -> Front
      };

      const target = targetRotations[value] || { x: 0, y: 0 };
      
      // Calculate smooth landing - 3D perspective
      const tiltX = -15; 
      const tiltY = 15;
      
      const nextX = Math.ceil((rotation.x - target.x - tiltX) / 360) * 360 + target.x + tiltX;
      const nextY = Math.ceil((rotation.y - target.y - tiltY) / 360) * 360 + target.y + tiltY;
      
      setRotation({ 
        x: nextX, 
        y: nextY, 
        z: Math.round(rotation.z / 360) * 360 
      });
      setJump(0);
    }
  }, [isRolling, value]);

  const Face = ({ val, rotate, light }: { val: number, rotate: string, light: string }) => {
    const dots = {
      1: [[50, 50]],
      2: [[25, 25], [75, 75]],
      3: [[25, 25], [50, 50], [75, 75]],
      4: [[25, 25], [25, 75], [75, 25], [75, 75]],
      5: [[25, 25], [25, 75], [50, 50], [75, 25], [75, 75]],
      6: [[25, 25], [25, 50], [25, 75], [75, 25], [75, 50], [75, 75]],
    };

    return (
      <div 
        className={cn(
          "absolute inset-0 bg-white border-2 border-slate-200 rounded-xl flex items-center justify-center p-2 shadow-[inset_0_2px_12px_rgba(0,0,0,0.1)] overflow-hidden",
          light
        )}
        style={{ 
          transform: `${rotate} translateZ(24px)`, 
          backfaceVisibility: 'hidden',
          boxShadow: 'inset 0 0 15px rgba(0,0,0,0.05), 0 0 2px rgba(0,0,0,0.1)'
        }}
      >
        <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/80 to-transparent pointer-events-none" />
        <div className="w-full h-full relative">
          {(dots[val as keyof typeof dots] || []).map(([x, y], i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-slate-900 rounded-full shadow-[inset_-1px_-1px_1px_rgba(255,255,255,0.4)] border border-black/20"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-16 h-16 flex flex-col items-center justify-center [perspective:800px] group">
      {/* Shadow */}
      <motion.div 
        animate={{ 
          scale: isRolling ? [0.8, 1.2, 0.8] : 1,
          opacity: isRolling ? 0.3 : 0.1,
          y: 28
        }}
        transition={isRolling ? { repeat: Infinity, duration: 0.15 } : {}}
        className="absolute w-10 h-3 bg-black rounded-full blur-lg pointer-events-none"
      />

      <motion.button
        disabled={disabled}
        onClick={onClick}
        animate={{
          rotateX: rotation.x,
          rotateY: rotation.y,
          rotateZ: rotation.z,
          y: jump,
          scale: isRolling ? 1.15 : 1,
        }}
        transition={isRolling ? { duration: 0.04, ease: "linear" } : { 
          type: "spring", 
          stiffness: 120, 
          damping: 14,
          mass: 1.2
        }}
        className={cn(
          "w-12 h-12 relative [transform-style:preserve-3d] transition-opacity duration-300",
          disabled ? "opacity-40 grayscale" : "cursor-pointer"
        )}
      >
        <Face val={1} rotate="rotateY(0deg)" light="brightness-110" />
        <Face val={5} rotate="rotateY(180deg)" light="brightness-90" />
        <Face val={2} rotate="rotateY(90deg)" light="brightness-105" />
        <Face val={6} rotate="rotateY(-90deg)" light="brightness-95" />
        <Face val={3} rotate="rotateX(90deg)" light="brightness-115" />
        <Face val={4} rotate="rotateX(-90deg)" light="brightness-85" />
      </motion.button>
      
      {!disabled && !isRolling && (
         <div className="absolute -bottom-2 inset-x-0 flex justify-center">
            <div className="bg-rose-500 w-1 h-1 rounded-full animate-bounce shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
         </div>
      )}
    </div>
  );
}
