import React, { useEffect, useRef } from 'react';
import { motion, useAnimation } from 'motion/react';
import { PlayerColor, Piece, GameTheme, SAFE_ZONES, START_POSITIONS } from '../../lib/ludo-types';
import { getPieceCoords } from '../../lib/ludo-board-layout';
import { cn } from '../../lib/utils';
import { movePiece } from '../../lib/ludo-engine';
import { playSafeSound } from '../../lib/audio';
import confetti from 'canvas-confetti';

const PIECE_COLORS: Record<PlayerColor, string> = {
  red: 'bg-rose-500 shadow-rose-500/50',
  green: 'bg-emerald-500 shadow-emerald-500/50',
  yellow: 'bg-amber-500 shadow-amber-500/50',
  blue: 'bg-cyan-500 shadow-cyan-500/50',
};

const SAFE_AURA: Record<PlayerColor, string> = {
  red: 'border-rose-300/95 bg-rose-200/18 shadow-[0_0_14px_rgba(244,63,94,0.58)]',
  green: 'border-emerald-300/95 bg-emerald-200/18 shadow-[0_0_14px_rgba(16,185,129,0.58)]',
  yellow: 'border-amber-300/95 bg-amber-200/20 shadow-[0_0_14px_rgba(245,158,11,0.58)]',
  blue: 'border-cyan-300/95 bg-cyan-200/18 shadow-[0_0_14px_rgba(6,182,212,0.58)]',
};

const SAFE_CORE: Record<PlayerColor, string> = {
  red: 'bg-rose-300/20 shadow-[0_0_10px_rgba(244,63,94,0.45)]',
  green: 'bg-emerald-300/20 shadow-[0_0_10px_rgba(16,185,129,0.45)]',
  yellow: 'bg-amber-300/22 shadow-[0_0_10px_rgba(245,158,11,0.45)]',
  blue: 'bg-cyan-300/20 shadow-[0_0_10px_rgba(6,182,212,0.45)]',
};

function isSafeBoardPiece(playerColor: PlayerColor, piece: Piece) {
    if (piece.status !== 'board') return false;
    const absolutePosition = (START_POSITIONS[playerColor] + piece.position) % 52;
    return SAFE_ZONES.includes(absolutePosition);
}

interface PieceComponentProps {
    key?: string;
    player: { uid: string, color: PlayerColor };
    targetPiece: Piece;
    isMyTurn: boolean;
    theme: GameTheme;
    offsetX: number;
    offsetY: number;
    onClick: () => void;
}

export function PieceComponent({ player, targetPiece, isMyTurn, theme, offsetX, offsetY, onClick }: PieceComponentProps) {
    const controls = useAnimation();
    const prevTargetRef = useRef(targetPiece);
    const prevColorRef = useRef(player.color);
    const movementKey = `${targetPiece.status}:${targetPiece.position}`;
    const isOnSafeSquare = isSafeBoardPiece(player.color, targetPiece);
    const offsetStyle = {
      '--piece-offset-x': `${offsetX}px`,
      '--piece-offset-y': `${offsetY}px`,
    } as React.CSSProperties;

    useEffect(() => {
        const prev = prevTargetRef.current;
        const prevColor = prevColorRef.current;
        
        if (prev.position === targetPiece.position && prev.status === targetPiece.status && prevColor === player.color) {
            return;
        }

        prevTargetRef.current = targetPiece;
        prevColorRef.current = player.color;
        const landedOnSafeSquare = isSafeBoardPiece(player.color, targetPiece);

        const animateStepByStep = async () => {
            if (prevColor !== player.color && prev.position === targetPiece.position && prev.status === targetPiece.status) {
                const coords = getPieceCoords(player.color, targetPiece);
                await controls.start({
                    left: `${((coords.x + 0.5) / 15) * 100}%`,
                    top: `${((coords.y + 0.5) / 15) * 100}%`,
                    transition: { duration: 0.2 }
                });
                return;
            }

            if (prev.status === 'base' && targetPiece.status === 'board') {
                const coords = getPieceCoords(player.color, targetPiece);
                await controls.start({
                    left: `${((coords.x + 0.5) / 15) * 100}%`,
                    top: `${((coords.y + 0.5) / 15) * 100}%`,
                    scale: 1,
                    transition: { duration: 0.4, type: 'spring' }
                });
                if (landedOnSafeSquare) playSafeSound();
                return;
            }

            if ((prev.status === 'board' || prev.status === 'home_stretch') && 
                (targetPiece.status === 'board' || targetPiece.status === 'home_stretch' || targetPiece.status === 'finished') &&
                prev.position !== targetPiece.position && targetPiece.position > prev.position) {
                
                let currentPiece = { ...prev };
                const steps: Piece[] = [];
                let safetyCount = 0;
                
                while (
                    (currentPiece.status !== targetPiece.status || currentPiece.position !== targetPiece.position) &&
                    safetyCount < 10
                ) {
                    safetyCount++;
                    const next = movePiece(player.color, currentPiece, 1);
                    if (!next) break; // Should not happen if path is valid
                    currentPiece = next;
                    steps.push({ ...currentPiece });
                }

                // If somehow it fails to step (e.g., jumping back due to capture), just jump
                if (steps.length === 0 || targetPiece.position < prev.position) {
                    const coords = getPieceCoords(player.color, targetPiece);
                    await controls.start({
                        left: `${((coords.x + 0.5) / 15) * 100}%`,
                        top: `${((coords.y + 0.5) / 15) * 100}%`,
                        transition: { duration: 0.3 }
                    });
                    if (landedOnSafeSquare) playSafeSound();
                    return;
                }

                // Animate each step
                for (const stepPiece of steps) {
                    const coords = getPieceCoords(player.color, stepPiece);

                    await controls.start({
                        left: `${((coords.x + 0.5) / 15) * 100}%`,
                        top: `${((coords.y + 0.5) / 15) * 100}%`,
                        transition: { duration: 0.2, ease: "linear" }
                    });
                }
                
                // Final scale
                if (targetPiece.status === 'finished') {
                    confetti({
                        particleCount: 100,
                        spread: 70,
                        origin: { y: 0.6 }
                    });
                }
                controls.start({
                    scale: targetPiece.status === 'finished' ? 0.7 : 1,
                    opacity: 1,
                    z: targetPiece.status === 'finished' ? 5 : 10,
                });
                if (landedOnSafeSquare) playSafeSound();
                return;
            }
            
            // Default straight animation (e.g. captured and returning to base)
            const defaultCoords = getPieceCoords(player.color, targetPiece);
            if (targetPiece.status === 'finished' && prev.status !== 'finished') {
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 }
                });
            }
            controls.start({
                left: `${((defaultCoords.x + 0.5) / 15) * 100}%`,
                top: `${((defaultCoords.y + 0.5) / 15) * 100}%`,
                scale: targetPiece.status === 'finished' ? 0.7 : 1,
                opacity: 1,
                z: targetPiece.status === 'finished' ? 5 : 10,
                transition: { duration: 0.3 }
            });
            if (landedOnSafeSquare) playSafeSound();
            
        };

        animateStepByStep();
    }, [movementKey, player.color, controls]);

    // Initial mount styling without animation
    const initialCoords = getPieceCoords(player.color, targetPiece);

    return (
        <motion.div
            animate={controls}
            initial={{
              left: `${((initialCoords.x + 0.5) / 15) * 100}%`,
              top: `${((initialCoords.y + 0.5) / 15) * 100}%`,
              scale: targetPiece.status === 'finished' ? 0.7 : 1,
              opacity: 1,
              z: targetPiece.status === 'finished' ? 5 : 10,
            }}
            style={offsetStyle}
            transformTemplate={(_latest, generated) => `translate(calc(-50% + var(--piece-offset-x)), calc(-50% + var(--piece-offset-y))) ${generated}`}
            className={cn(
              "absolute w-[5.75%] h-[5.75%] z-10 [transform-style:preserve-3d] pointer-events-auto",
              isMyTurn && "cursor-pointer"
            )}
            onClick={onClick}
          >
          <div className={cn(
            "w-full h-full relative [transform-style:preserve-3d] transition-transform duration-300"
          )}>
            {isMyTurn && (
              <motion.div
                initial={{ opacity: 0.35, scale: 1 }}
                animate={{ opacity: [0.48, 0.82, 0.48], scale: [1.02, 1.09, 1.02] }}
                transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                className="absolute -inset-[2px] rounded-full border border-dashed border-white shadow-[0_0_0_2px_rgba(244,63,94,0.64),0_0_8px_rgba(244,63,94,0.42)]"
              />
            )}

            {isOnSafeSquare && (
              <div className="pointer-events-none absolute -inset-[22%] z-0 flex items-center justify-center">
                <motion.div
                  initial={{ opacity: 0.4, scale: 0.96 }}
                  animate={{ opacity: [0.42, 0.88, 0.42], scale: [0.96, 1.08, 0.96] }}
                  transition={{ repeat: Infinity, duration: 1.35, ease: "easeInOut" }}
                  className={cn(
                    "absolute inset-0 rounded-full border-2",
                    SAFE_AURA[player.color]
                  )}
                />

                <motion.div
                  initial={{ opacity: 0.28, scale: 0.86 }}
                  animate={{ opacity: [0.3, 0.62, 0.3], scale: [0.86, 1.0, 0.86] }}
                  transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
                  className={cn(
                    "absolute inset-[14%] rounded-full",
                    SAFE_CORE[player.color]
                  )}
                />
              </div>
            )}

            {/* 3D Pawn Shape */}
            <div className="w-full h-full relative z-10 [transform-style:preserve-3d]">
              {/* Pawn Base */}
              <div className={cn(
                "absolute inset-[5%] rounded-full shadow-[0_4px_8px_rgba(0,0,0,0.4)]",
                PIECE_COLORS[player.color],
                "translate-y-[2px]"
              )} />
              
              {/* Pawn Body (Cylinder-like) */}
              <div className={cn(
                "absolute inset-[15%] rounded-full border-b-[4px] border-black/20 shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]",
                PIECE_COLORS[player.color],
                "brightness-90 translate-y-[-2px]"
              )} />

              {/* Pawn Neck */}
              <div className={cn(
                "absolute inset-[25%] rounded-full border-black/10 shadow-sm",
                PIECE_COLORS[player.color],
                "translate-y-[-4px] brightness-110"
              )} />

              {/* Pawn Head with Theme Icon */}
              <div className={cn(
                "absolute inset-[20%] rounded-full border-2 border-white/40 shadow-xl flex items-center justify-center overflow-hidden",
                PIECE_COLORS[player.color],
                "brightness-125 translate-y-[-8px]"
              )}>
                <span className="text-[10px] font-black text-white drop-shadow-md">{targetPiece.id + 1}</span>
              </div>
            </div>

          </div>
        </motion.div>
    );
}
