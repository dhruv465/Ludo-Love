import React from 'react';
import { PlayerColor, Piece, GameTheme } from '../../lib/ludo-types';
import {
  BASE_POSITIONS,
  generateBoard,
  getHomeEntryColorAt,
  getPieceCellKey,
  getStartColorAt,
} from '../../lib/ludo-board-layout';
import { cn } from '../../lib/utils';
import { ShieldCheck } from 'lucide-react';
import { PieceComponent } from './PieceComponent';

interface BoardProps {
  pieces: { [uid: string]: Piece[] };
  players: { uid: string, color: PlayerColor }[];
  currentTurn: string | null;
  localPlayerUid?: string;
  diceRolled?: boolean;
  theme?: GameTheme;
  legalPieceIds?: number[];
  onPieceClick: (pieceId: number) => void;
}

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
    finishIcon: '★',
  },
  neon: {
    bg: 'bg-slate-950',
    grid: 'border-slate-800',
    boardBg: 'bg-slate-900',
    finishIcon: '★',
  },
  panda: {
    bg: 'bg-stone-100',
    grid: 'border-stone-200',
    boardBg: 'bg-white',
    finishIcon: '★',
  },
  romantic: {
    bg: 'bg-pink-50',
    grid: 'border-pink-100',
    boardBg: 'bg-white',
    finishIcon: '★',
  }
};

const CELL_COLOR: Record<PlayerColor, string> = {
  red: 'bg-rose-500 border-rose-600',
  green: 'bg-emerald-500 border-emerald-600',
  yellow: 'bg-amber-400 border-amber-500',
  blue: 'bg-cyan-500 border-cyan-600',
};

const CELL_TINT: Record<PlayerColor, string> = {
  red: 'bg-rose-50 border-rose-100',
  green: 'bg-emerald-50 border-emerald-100',
  yellow: 'bg-amber-50 border-amber-100',
  blue: 'bg-cyan-50 border-cyan-100',
};

const NEON_CELL_TINT: Record<PlayerColor, string> = {
  red: 'bg-rose-950 border-rose-900',
  green: 'bg-emerald-950 border-emerald-900',
  yellow: 'bg-amber-950 border-amber-900',
  blue: 'bg-cyan-950 border-cyan-900',
};

const ENTRY_ARROW: Record<PlayerColor, string> = {
  red: '→',
  green: '↓',
  yellow: '←',
  blue: '↑',
};

const ENTRY_TEXT: Record<PlayerColor, string> = {
  red: 'text-rose-500',
  green: 'text-emerald-500',
  yellow: 'text-amber-500',
  blue: 'text-cyan-500',
};

export function Board({ pieces, players, currentTurn, localPlayerUid, diceRolled, theme = 'vibrant', legalPieceIds = [], onPieceClick }: BoardProps) {
  const config = THEME_CONFIG[theme];
  const cells = React.useMemo(() => generateBoard(), []);
  const playerColorByUid = React.useMemo(
    () => Object.fromEntries(players.map((player) => [player.uid, player.color])) as Record<string, PlayerColor>,
    [players]
  );

  const renderCell = (x: number, y: number) => {
    const cell = cells.find((candidate) => candidate.x === x && candidate.y === y);
    let baseColor = `${config.boardBg} ${config.grid}`;
    let content = null;

    if (cell?.type === 'base' && cell.color) {
      baseColor = theme === 'neon' ? NEON_CELL_TINT[cell.color] : CELL_TINT[cell.color];
      if (BASE_POSITIONS[cell.color].some((coord) => coord.x === x && coord.y === y)) {
        baseColor = theme === 'neon' ? 'bg-white/10 border-white/10' : 'bg-white border-slate-300';
        content = <div className="h-[62%] w-[62%] rounded-full border-2 border-slate-300 bg-white/70" />;
      }
    }

    if (cell?.type === 'home_stretch' && cell.color) {
      baseColor = `${CELL_COLOR[cell.color]} text-white`;
    }

    if (cell?.type === 'path' || cell?.type === 'safe') {
      baseColor = `${config.boardBg} ${config.grid}`;
    }

    const startColor = getStartColorAt(x, y);
    const entryColor = getHomeEntryColorAt(x, y);
    if (startColor) {
      baseColor = `${CELL_COLOR[startColor]} text-white shadow-inner`;
      content = <span className="text-[10px] font-black">★</span>;
    } else if (entryColor) {
      baseColor = `${config.boardBg} ${config.grid}`;
      content = <span className={cn("text-[clamp(14px,3vw,20px)] font-black leading-none", ENTRY_TEXT[entryColor])}>{ENTRY_ARROW[entryColor]}</span>;
    } else if (cell?.type === 'safe') {
      baseColor = theme === 'neon' ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200';
      content = <ShieldCheck className="w-3 h-3 text-slate-400" />;
    }

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
            <span className="text-lg z-10 text-white drop-shadow-lg">{config.finishIcon}</span>
          </div>
        );
      } else {
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
 
  return (
    <div className={cn(
        "relative aspect-square w-full max-w-[620px] rounded-lg p-2 md:p-3 overflow-hidden",
        config.boardBg,
        theme === 'neon' && "border-slate-800"
    )}>
      <div className={cn("grid grid-cols-15 grid-rows-15 w-full h-full border ring-1 ring-black/5", config.grid)}>
        {boardCells}
      </div>

      <div className="absolute inset-2 md:inset-3 pointer-events-none">
        {players.map(player => (
          pieces[player.uid]?.map(piece => {
            const cellKey = getPieceCellKey(player.color, piece);

            const piecesInSameCell = Object.entries(pieces).flatMap(([uid, ps]) => 
              ps.filter(p => {
                const color = playerColorByUid[uid];
                return color ? getPieceCellKey(color, p) === cellKey : false;
              }).map(p => ({ uid, id: p.id }))
            );

            const myIndexInCell = piecesInSameCell.findIndex(p => p.uid === player.uid && p.id === piece.id);
            const totalInCell = piecesInSameCell.length;
            
            let offsetX = 0;
            let offsetY = 0;
            if (totalInCell > 1) {
              const angle = (myIndexInCell / totalInCell) * Math.PI * 2;
              offsetX = Math.cos(angle) * 5;
              offsetY = Math.sin(angle) * 5;
            }

            const isLegalLocalMove = currentTurn === player.uid
              && player.uid === localPlayerUid
              && !!diceRolled
              && legalPieceIds.includes(piece.id);

            return (
              <PieceComponent
                key={`${player.uid}-${piece.id}`}
                player={player}
                targetPiece={piece}
                isMyTurn={isLegalLocalMove}
                theme={theme}
                offsetX={offsetX}
                offsetY={offsetY}
                onClick={() => isLegalLocalMove && onPieceClick(piece.id)}
              />
          );
        })
      ))}
      </div>
    </div>
  );
}
