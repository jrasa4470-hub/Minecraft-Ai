import React from 'react';
import { InventoryItem, PlayerStats, BlockType } from '../types/game';
import { getItemIconDataUrl } from '../engine/textures';
import { getItemDisplayName } from '../engine/crafting';

interface HUDProps {
  hotbar: (InventoryItem | null)[];
  selectedSlot: number;
  stats: PlayerStats;
  gameMode: 'survival' | 'creative';
  targetedBlockName: string | null;
  heldItemSwing: number; // 0..1 swing animation
  breakProgress: number; // 0..1
  recentPickups: { name: string; count: number; time: number }[];
}

export const HUD: React.FC<HUDProps> = ({
  hotbar,
  selectedSlot,
  stats,
  gameMode,
  targetedBlockName,
  heldItemSwing,
  breakProgress,
  recentPickups,
}) => {
  const currentItem = hotbar[selectedSlot];

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between select-none">
      {/* Top Bar / Target info */}
      <div className="p-4 flex justify-between items-start">
        {targetedBlockName && (
          <div className="bg-black/60 backdrop-blur-xs px-3 py-1.5 rounded border border-white/20 text-xs tracking-wider text-amber-300 font-mono">
            Target: <span className="text-white font-bold">{targetedBlockName}</span>
          </div>
        )}
      </div>

      {/* Center Crosshair & Break Crack Reticle */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Classic Crosshair */}
        <div className="relative w-5 h-5 flex items-center justify-center">
          <div className="absolute w-4 h-0.5 bg-white mix-blend-difference"></div>
          <div className="absolute h-4 w-0.5 bg-white mix-blend-difference"></div>
        </div>

        {/* Break Progress Ring / Crack overlay */}
        {breakProgress > 0 && (
          <div className="absolute w-8 h-8 rounded-full border-2 border-dashed border-red-500 animate-spin opacity-80"
               style={{ animationDuration: `${Math.max(0.2, (1 - breakProgress) * 0.8)}s` }}>
          </div>
        )}
      </div>

      {/* Recent pickup toasts */}
      <div className="absolute left-6 bottom-28 flex flex-col-reverse gap-1.5 pointer-events-none">
        {recentPickups.slice(-3).map((item, idx) => (
          <div
            key={idx}
            className="bg-black/75 border border-amber-400/40 px-3 py-1.5 rounded text-xs text-amber-200 font-mono flex items-center gap-2 shadow-lg animate-fade-in"
          >
            <span className="text-emerald-400 font-bold">+{item.count}</span>
            <span>{item.name}</span>
          </div>
        ))}
      </div>

      {/* First-person Hand / Held Item Model in bottom right */}
      <div
        className="absolute bottom-0 right-12 w-40 h-40 origin-bottom-right transition-transform"
        style={{
          transform: `translate(${Math.sin(heldItemSwing * Math.PI) * -30}px, ${
            Math.sin(heldItemSwing * Math.PI) * 20
          }px) rotate(${Math.sin(heldItemSwing * Math.PI) * -35}deg)`,
        }}
      >
        {currentItem ? (
          <img
            src={getItemIconDataUrl(currentItem.id)}
            alt="Held Item"
            className="w-28 h-28 pixelated drop-shadow-[0_10px_10px_rgba(0,0,0,0.7)]"
            style={{ transform: 'rotate(-15deg)' }}
          />
        ) : (
          /* Steve's classic blocky pixel arm */
          <div className="w-20 h-32 bg-[#c98e68] border-2 border-[#804e33] rounded-t-sm rotate-12 shadow-2xl opacity-90"></div>
        )}
      </div>

      {/* Bottom Area: Health, Hunger, EXP, Hotbar */}
      <div className="w-full flex flex-col items-center pb-3">
        {/* Survival Status: Hearts & Hunger */}
        {gameMode === 'survival' && (
          <div className="w-96 flex justify-between items-center px-1 mb-1.5 text-xs">
            {/* Health Hearts (10) */}
            <div className="flex gap-0.5">
              {Array.from({ length: 10 }).map((_, i) => {
                const heartVal = stats.health - i * 2;
                return (
                  <div key={i} className="w-4 h-4 relative flex items-center justify-center">
                    <span className="text-black/60 text-sm absolute">♥</span>
                    {heartVal >= 2 ? (
                      <span className="text-red-600 text-sm drop-shadow-md">♥</span>
                    ) : heartVal === 1 ? (
                      <span className="text-red-400 text-sm opacity-80">♥</span>
                    ) : (
                      <span className="text-zinc-700 text-sm">♡</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Hunger Drumsticks (10) */}
            <div className="flex gap-0.5">
              {Array.from({ length: 10 }).map((_, i) => {
                const drumVal = stats.hunger - i * 2;
                return (
                  <div key={i} className="w-4 h-4 flex items-center justify-center">
                    {drumVal >= 2 ? (
                      <span className="text-amber-700 text-xs">🍗</span>
                    ) : (
                      <span className="text-zinc-700 text-xs">🍗</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* EXP Bar */}
        {gameMode === 'survival' && (
          <div className="w-96 h-2 bg-black/80 border border-black rounded-xs overflow-hidden relative mb-1.5 flex items-center">
            <div
              className="h-full bg-linear-to-r from-lime-500 to-green-400 transition-all duration-150"
              style={{ width: `${Math.floor(stats.exp * 100)}%` }}
            ></div>
            {stats.level > 0 && (
              <span className="absolute inset-0 flex items-center justify-center text-[10px] text-lime-300 font-bold drop-shadow">
                {stats.level}
              </span>
            )}
          </div>
        )}

        {/* Hotbar (9 slots) */}
        <div className="flex bg-[#8f8f8f]/90 p-1 border-3 border-[#373737] rounded-sm shadow-2xl backdrop-blur-xs">
          {hotbar.map((item, idx) => {
            const isSelected = selectedSlot === idx;
            return (
              <div
                key={idx}
                className={`w-12 h-12 flex items-center justify-center relative mc-slot transition-all ${
                  isSelected ? 'mc-slot-active bg-[#9e9e9e] ring-2 ring-white z-10' : ''
                }`}
              >
                {/* Slot index number label */}
                <span className="absolute top-0.5 left-1 text-[9px] text-white/40 font-mono pointer-events-none">
                  {idx + 1}
                </span>

                {item && (
                  <>
                    <img
                      src={getItemIconDataUrl(item.id)}
                      alt={`Item ${item.id}`}
                      className="w-8 h-8 pixelated pointer-events-none"
                    />
                    {item.count > 1 && (
                      <span className="absolute bottom-0.5 right-1 text-xs text-white font-mono font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">
                        {item.count}
                      </span>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Selected Item Name toast */}
        {currentItem && (
          <div className="mt-1 text-xs text-white font-bold drop-shadow-md tracking-wider">
            {getItemDisplayName(currentItem.id)}
          </div>
        )}
      </div>
    </div>
  );
};
