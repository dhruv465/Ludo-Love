import React, { useState, useEffect, useRef } from 'react';
import { motion, useAnimation } from 'motion/react';
import { PlayerColor, Piece, GameTheme } from '../../lib/ludo-types';
import { PATH_COORDS, STRETCH_COORDS } from '../../lib/ludo-board-layout';
import { cn } from '../../lib/utils';
import { movePiece } from '../../lib/ludo-engine';
import { playSubtleSound } from '../../lib/audio';
import confetti from 'canvas-confetti';

const PIECE_COLORS: Record<PlayerColor, string> = {
  red: 'bg-rose-500 shadow-rose-500/50',
  green: 'bg-emerald-500 shadow-emerald-500/50',
  yellow: 'bg-amber-500 shadow-amber-500/50',
  blue: 'bg-cyan-500 shadow-cyan-500/50',
};

const BASE_POSITIONS: Record<PlayerColor, {x: number, y: number}[]> = {
  red: [{x: 1, y: 1}, {x: 4, y: 1}, {x: 1, y: 4}, {x: 4, y: 4}],
  green: [{x: 10, y: 1}, {x: 13, y: 1}, {x: 10, y: 4}, {x: 13, y: 4}],
  yellow: [{x: 10, y: 10}, {x: 13, y: 10}, {x: 10, y: 13}, {x: 13, y: 13}],
  blue: [{x: 1, y: 10}, {x: 4, y: 10}, {x: 1, y: 13}, {x: 4, y: 13}],
};

const START_POSITIONS_BOARD = { red: 0, green: 13, yellow: 26, blue: 39 };

function getCoordsForPiece(player: {uid: string, color: PlayerColor}, piece: Piece) {
    let coords = { x: 0, y: 0 };
    if (piece.status === 'base') {
      coords = BASE_POSITIONS[player.color][piece.id];
    } else if (piece.status === 'board') {
      const idx = (START_POSITIONS_BOARD[player.color] + piece.position) % 52;
      coords = PATH_COORDS[idx];
    } else if (piece.status === 'home_stretch') {
      coords = STRETCH_COORDS[player.color][piece.position];
    } else if (piece.status === 'finished') {
      // Offset slightly towards the triangle of their color
      const offsets = {
        red: [{x: 6.7, y: 6.7}, {x: 6.7, y: 7.3}, {x: 6.4, y: 7.0}, {x: 6.2, y: 7.0}],
        green: [{x: 6.7, y: 6.7}, {x: 7.3, y: 6.7}, {x: 7.0, y: 6.4}, {x: 7.0, y: 6.2}],
        amber: [{x: 7.3, y: 6.7}, {x: 7.3, y: 7.3}, {x: 7.6, y: 7.0}, {x: 7.8, y: 7.0}],
        cyan: [{x: 6.7, y: 7.3}, {x: 7.3, y: 7.3}, {x: 7.0, y: 7.6}, {x: 7.0, y: 7.8}],
      };
      // fallback to object map for backward compatibility with 'yellow'/'blue' values
      const colorOffsets = offsets[player.color as keyof typeof offsets] || 
        (player.color === 'yellow' ? offsets.amber : offsets.cyan);
      coords = colorOffsets[piece.id] || { x: 7, y: 7 };
    }
    return coords;
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

    useEffect(() => {
        const prev = prevTargetRef.current;
        
        if (prev.position === targetPiece.position && prev.status === targetPiece.status) {
            // Only update non-positional properties if it hasn't moved, so we don't cancel a running movement animation
            controls.start({
                scale: targetPiece.status === 'finished' ? 0.7 : (isMyTurn ? 1.15 : 1),
                opacity: 1,
                z: targetPiece.status === 'finished' ? 5 : (isMyTurn ? 30 : 10),
                x: `calc(-50% + ${offsetX}px)`,
                y: `calc(-50% + ${offsetY}px)`,
                transition: { duration: 0.3 }
            });
            return;
        }

        prevTargetRef.current = targetPiece;

        const animateStepByStep = async () => {
            if (prev.status === 'base' && targetPiece.status === 'board') {
                // Instantly to start position
                const coords = getCoordsForPiece(player, targetPiece);
                playSubtleSound('spawn');
                await controls.start({
                    left: `${((coords.x + 0.5) / 15) * 100}%`,
                    top: `${((coords.y + 0.5) / 15) * 100}%`,
                    x: `calc(-50% + ${offsetX}px)`,
                    y: `calc(-50% + ${offsetY}px)`,
                    scale: isMyTurn ? 1.15 : 1,
                    transition: { duration: 0.4, type: 'spring' }
                });
                return;
            }

            if ((prev.status === 'board' || prev.status === 'home_stretch') && 
                (targetPiece.status === 'board' || targetPiece.status === 'home_stretch' || targetPiece.status === 'finished') &&
                prev.position !== targetPiece.position && targetPiece.position > prev.position) {
                
                // Calculate steps
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
                    const coords = getCoordsForPiece(player, targetPiece);
                    await controls.start({
                        left: `${((coords.x + 0.5) / 15) * 100}%`,
                        top: `${((coords.y + 0.5) / 15) * 100}%`,
                        x: `calc(-50% + ${offsetX}px)`,
                        y: `calc(-50% + ${offsetY}px)`,
                        transition: { duration: 0.3 }
                    });
                    return;
                }

                // Animate each step
                for (const stepPiece of steps) {
                    const coords = getCoordsForPiece(player, stepPiece);
                    
                    // PLAY SOUND EFFECT for piece movement step
                    playSubtleSound('step');

                    await controls.start({
                        left: `${((coords.x + 0.5) / 15) * 100}%`,
                        top: `${((coords.y + 0.5) / 15) * 100}%`,
                        x: `calc(-50% + ${offsetX}px)`,
                        y: `calc(-50% + ${offsetY}px)`,
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
                    scale: targetPiece.status === 'finished' ? 0.7 : (isMyTurn ? 1.15 : 1),
                    opacity: 1,
                    z: targetPiece.status === 'finished' ? 5 : (isMyTurn ? 30 : 10),
                });
                return;
            }
            
            // Default straight animation (e.g. captured and returning to base)
            const defaultCoords = getCoordsForPiece(player, targetPiece);
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
                x: `calc(-50% + ${offsetX}px)`,
                y: `calc(-50% + ${offsetY}px)`,
                scale: targetPiece.status === 'finished' ? 0.7 : (isMyTurn ? 1.15 : 1),
                opacity: 1,
                z: targetPiece.status === 'finished' ? 5 : (isMyTurn ? 30 : 10),
                transition: { duration: 0.3 }
            });
            
        };

        animateStepByStep();
    }, [targetPiece, player, offsetX, offsetY, isMyTurn, controls]);

    // Initial mount styling without animation
    const initialCoords = getCoordsForPiece(player, targetPiece);

    return (
        <motion.div
            layoutId={`${player.uid}-${targetPiece.id}`}
            animate={controls}
            initial={{
              left: `${((initialCoords.x + 0.5) / 15) * 100}%`,
              top: `${((initialCoords.y + 0.5) / 15) * 100}%`,
              x: `calc(-50% + ${offsetX}px)`,
              y: `calc(-50% + ${offsetY}px)`,
              scale: targetPiece.status === 'finished' ? 0.7 : (isMyTurn ? 1.15 : 1),
              opacity: 1,
              z: targetPiece.status === 'finished' ? 5 : (isMyTurn ? 30 : 10),
            }}
            className={cn(
              "absolute w-[5.5%] h-[5.5%] z-10 [transform-style:preserve-3d] pointer-events-auto",
              isMyTurn && "cursor-pointer"
            )}
            onClick={onClick}
          >
          <div className={cn(
            "w-full h-full relative [transform-style:preserve-3d] transition-transform duration-300",
            isMyTurn && "scale-110"
          )}>
            {/* 3D Pawn Shape */}
            <div className="w-full h-full relative [transform-style:preserve-3d]">
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
                {theme === 'romantic' || theme === 'vibrant' ? (
                  <span className="text-[10px] drop-shadow-md">❤️</span>
                ) : theme === 'panda' ? (
                  <span className="text-[10px] drop-shadow-md">🐾</span>
                ) : (
                  <span className="text-[10px] drop-shadow-md">✨</span>
                )}
              </div>
            </div>

            {/* Turn Indicator Glow */}
            {isMyTurn && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.2, 0.4, 0.2], scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute -inset-1 rounded-full bg-white/30 blur-sm"
                />
            )}
          </div>
        </motion.div>
    );
}

