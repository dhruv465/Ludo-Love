import React from 'react';
import { motion } from 'motion/react';
import { PlayerColor, Piece, GameTheme, SAFE_ZONES } from '../../lib/ludo-types';
import { PATH_COORDS, STRETCH_COORDS } from '../../lib/ludo-board-layout';
import { cn } from '../../lib/utils';
import { Heart } from 'lucide-react';

interface BoardProps {
  pieces: { [uid: string]: Piece[] };
  players: { uid: string, color: PlayerColor }[];
  currentTurn: string | null;
  localPlayerUid?: string;
  diceRolled?: boolean;
  theme?: GameTheme;
  onPieceClick: (pieceId: number) => void;
}

const COLOR_MAP: Record<PlayerColor, string> = {
  red: 'bg-rose-500 shadow-rose-500/30',
  blue: 'bg-cyan-500 shadow-cyan-500/30',
  green: 'bg-emerald-500 shadow-emerald-500/30',
  yellow: 'bg-amber-500 shadow-amber-500/30',
};

const BASE_POSITIONS: Record<PlayerColor, {x: number, y: number}[]> = {
  red: [{x: 1, y: 1}, {x: 4, y: 1}, {x: 1, y: 4}, {x: 4, y: 4}],
  green: [{x: 10, y: 1}, {x: 13, y: 1}, {x: 10, y: 4}, {x: 13, y: 4}],
  yellow: [{x: 10, y: 10}, {x: 13, y: 10}, {x: 10, y: 13}, {x: 13, y: 13}],
  blue: [{x: 1, y: 10}, {x: 4, y: 10}, {x: 1, y: 13}, {x: 4, y: 13}],
};

const PIECE_COLORS: Record<PlayerColor, string> = {
  red: 'bg-rose-500 shadow-rose-500/50',
  green: 'bg-emerald-500 shadow-emerald-500/50',
  yellow: 'bg-amber-500 shadow-amber-500/50',
  blue: 'bg-cyan-500 shadow-cyan-500/50',
};

const THEME_CONFIG: Record<GameTheme, {
  bg: string;
  grid: string;
  boardBg: string;
  finishIcon: string;
}> = {
  vibrant: {
    bg: 'bg-[#FFF5F7]',
    grid: 'border-slate-100',
    boardBg: 'bg-white',
    finishIcon: '❤️',
  },
  neon: {
    bg: 'bg-slate-950',
    grid: 'border-slate-800',
    boardBg: 'bg-slate-900',
    finishIcon: '💠',
  },
  panda: {
    bg: 'bg-stone-100',
    grid: 'border-stone-200',
    boardBg: 'bg-white',
    finishIcon: '🐼',
  },
  romantic: {
    bg: 'bg-pink-50',
    grid: 'border-pink-100',
    boardBg: 'bg-white',
    finishIcon: '💖',
  }
};

import { PieceComponent } from './PieceComponent';

export function Board({ pieces, players, currentTurn, localPlayerUid, diceRolled, theme = 'vibrant', onPieceClick }: BoardProps) {
  const config = THEME_CONFIG[theme];

  const renderCell = (x: number, y: number) => {
    let baseColor = `${config.boardBg} ${config.grid}`;
    let content = null;
    
    // Home Bases
    const isBase = (x < 6 && y < 6) || (x > 8 && y < 6) || (x < 6 && y > 8) || (x > 8 && y > 8);
    if (isBase) {
      if (x < 6 && y < 6) baseColor = theme === 'neon' ? 'bg-rose-950 border-rose-900' : theme === 'romantic' ? 'bg-rose-50 border-rose-100' : 'bg-rose-50 border-rose-100'; // RED
      if (x > 8 && y < 6) baseColor = theme === 'neon' ? 'bg-emerald-950 border-emerald-900' : theme === 'romantic' ? 'bg-emerald-50 border-emerald-100' : 'bg-green-50 border-green-100'; // GREEN
      if (x > 8 && y > 8) baseColor = theme === 'neon' ? 'bg-amber-950 border-amber-900' : theme === 'romantic' ? 'bg-amber-50 border-amber-100' : 'bg-amber-50 border-amber-100'; // YELLOW
      if (x < 6 && y > 8) baseColor = theme === 'neon' ? 'bg-cyan-950 border-cyan-900' : theme === 'romantic' ? 'bg-cyan-50 border-cyan-100' : 'bg-blue-50 border-blue-100'; // BLUE
      
      const spotCoords = [
          [1, 1], [4, 1], [1, 4], [4, 4],
          [10, 1], [13, 1], [10, 4], [13, 4],
          [1, 10], [4, 10], [1, 13], [4, 13],
          [10, 10], [13, 10], [10, 13], [13, 13]
      ];
      if (spotCoords.some(([sx, sy]) => sx === x && sy === y)) {
          baseColor = theme === 'neon' ? 'bg-white/10' : 'bg-white opacity-80';
          content = <div className="w-4 h-4 rounded-full border-2 border-slate-100/30" />;
      }
    }

    // Home Stretches
    if (y === 7 && x > 0 && x < 7) baseColor = 'bg-rose-500/20 border-rose-200/50';
    if (x === 7 && y > 0 && y < 7) baseColor = 'bg-emerald-500/20 border-emerald-200/50';
    if (y === 7 && x > 7 && x < 14) baseColor = 'bg-amber-500/20 border-amber-200/50';
    if (x === 7 && y > 7 && y < 14) baseColor = 'bg-cyan-500/20 border-cyan-200/50';

    // Start Squares (Stars/Hearts)
    const isStar = (x === 1 && y === 6) || (x === 8 && y === 1) || (x === 13 && y === 8) || (x === 6 && y === 13);
    if (isStar) {
       baseColor = x === 1 && y === 6 ? 'bg-rose-500 shadow-lg' : 
                   x === 8 && y === 1 ? 'bg-emerald-500 shadow-lg' :
                   x === 13 && y === 8 ? 'bg-amber-500 shadow-lg' : 'bg-cyan-500 shadow-lg';
       content = <span className="text-[10px] text-white drop-shadow-md">{theme === 'romantic' ? '❤️' : '⭐'}</span>;
    }

    // Other safe zones
    const otherSafes = [
      [6, 2], [12, 6], [8, 12], [2, 8]
    ];
    if (otherSafes.some(([sx, sy]) => sx === x && sy === y)) {
      baseColor = 'bg-slate-100/50';
      content = <Heart className="w-2.5 h-2.5 text-slate-400 fill-slate-200" />;
    }

    // Center Square (Finish Area)
    if (x >= 6 && x <= 8 && y >= 6 && y <= 8) {
      if (x === 7 && y === 7) {
        baseColor = theme === 'neon' ? 'bg-indigo-500' : 'bg-white';
        content = (
          <div className="w-full h-full relative overflow-hidden flex items-center justify-center">
            {/* 4 Triangles for finish */}
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 opacity-80">
               <div className="bg-rose-500/80 [clip-path:polygon(0%_0%,100%_100%,0%_100%)]" />
               <div className="bg-emerald-500/80 [clip-path:polygon(100%_0%,100%_100%,0%_100%)]" />
               <div className="bg-cyan-500/80 [clip-path:polygon(0%_0%,100%_0%,100%_100%)]" />
               <div className="bg-amber-500/80 [clip-path:polygon(0%_0%,100%_0%,0%_100%)]" />
            </div>
            <span className="text-xl z-10 drop-shadow-lg">{config.finishIcon}</span>
          </div>
        );
      } else {
        // Correctly colored entry triangles
        if (x === 6 && y === 7) baseColor = 'bg-rose-500/40 rounded-l-full border-transparent';
        if (x === 7 && y === 6) baseColor = 'bg-emerald-500/40 rounded-t-full border-transparent';
        if (x === 8 && y === 7) baseColor = 'bg-amber-500/40 rounded-r-full border-transparent';
        if (x === 7 && y === 8) baseColor = 'bg-cyan-500/40 rounded-b-full border-transparent';
        
        if ((x === 6 || x === 8) && (y === 6 || y === 8)) baseColor = 'bg-slate-100/10 border-transparent';
      }
    }

    return (
      <div 
        key={`${x}-${y}`} 
        className={cn("w-full h-full border flex items-center justify-center transition-colors relative", baseColor)}
      >
        {content}
      </div>
    );
  };

  const boardCells = [];
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      boardCells.push(renderCell(x, y));
    }
  }
 
  const START_POSITIONS_BOARD = { red: 0, green: 13, yellow: 26, blue: 39 };

  return (
    <div className={cn(
        "relative aspect-square w-full max-w-[560px] rounded-2xl p-2 md:p-3 overflow-hidden",
        config.boardBg,
        theme === 'neon' && "border-slate-800"
    )} style={{ marginBottom: '80px' }}>
      <div className={cn("grid grid-cols-15 grid-rows-15 w-full h-full border ring-1 ring-black/5", config.grid)}>
        {boardCells}
      </div>

      {/* Piece Layer - perfectly matched to grid */}
      <div className="absolute inset-2 md:inset-3 pointer-events-none">
        {players.map(player => (
          pieces[player.uid]?.map(piece => {
            let coords = { x: 0, y: 0 };
            if (piece.status === 'base') {
              coords = BASE_POSITIONS[player.color][piece.id];
            } else if (piece.status === 'board') {
              const startIdx = START_POSITIONS_BOARD[player.color];
              const idx = (startIdx + piece.position) % 52;
              coords = PATH_COORDS[idx];
            } else if (piece.status === 'home_stretch') {
              coords = STRETCH_COORDS[player.color][piece.position];
            } else if (piece.status === 'finished') {
              coords = { x: 7, y: 7 };
            }

            // Handle piece overlaps in the same cell
            const piecesInSameCell = Object.entries(pieces).flatMap(([uid, ps]) => 
              ps.filter(p => {
                if (p.status === 'base' || p.status === 'finished') return false;
                if (p.status !== piece.status) return false;
                
                if (p.status === 'board') {
                  const myStart = START_POSITIONS_BOARD[player.color];
                  const myIdx = (myStart + piece.position) % 52;
                  const pl = players.find(x => x.uid === uid);
                  if (!pl) return false;
                  const otherStart = START_POSITIONS_BOARD[pl.color];
                  const otherIdx = (otherStart + p.position) % 52;
                  return myIdx === otherIdx;
                }
                
                if (p.status === 'home_stretch') {
                  return uid === player.uid && p.position === piece.position;
                }
                
                return false;
              }).map(p => ({ uid, id: p.id }))
            );

            const myIndexInCell = piecesInSameCell.findIndex(p => p.uid === player.uid && p.id === piece.id);
            const totalInCell = piecesInSameCell.length;
            
            let offsetX = 0;
            let offsetY = 0;
            if (totalInCell > 1) {
              const angle = (myIndexInCell / totalInCell) * Math.PI * 2;
              offsetX = Math.cos(angle) * 4;
              offsetY = Math.sin(angle) * 4;
            }

            const isMyTurn = currentTurn === player.uid && player.uid === localPlayerUid && !!diceRolled;

            return (
              <PieceComponent
                key={`${player.uid}-${piece.id}`}
                player={player}
                targetPiece={piece}
                isMyTurn={isMyTurn}
                theme={theme}
                offsetX={offsetX}
                offsetY={offsetY}
                onClick={() => isMyTurn && onPieceClick(piece.id)}
              />
          );
        })
      ))}
      </div>
    </div>
  );
}
