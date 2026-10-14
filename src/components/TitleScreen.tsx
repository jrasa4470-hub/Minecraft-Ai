import React, { useState, useEffect } from 'react';
import { WorldConfig, GameMode, BiomeType } from '../types/game';
import { audio } from '../engine/audio';

interface TitleScreenProps {
  onStartGame: (config: WorldConfig) => void;
}

const SPLASHES = [
  'Now with procedural voxels!',
  "Don't dig straight down!",
  '100% WebGL & Three.js!',
  'Crafting table included!',
  'Beware of Creepers at night!',
  'Infinite building freedom!',
  'Zero external dependencies!',
  'Runs in any browser!',
  'C418 ambient vibes!',
  'Pure TypeScript voxel engine!',
];

export const TitleScreen: React.FC<TitleScreenProps> = ({ onStartGame }) => {
  const [splashText, setSplashText] = useState(SPLASHES[0]);
  const [showWorldModal, setShowWorldModal] = useState(false);
  const [showControlsModal, setShowControlsModal] = useState(false);

  // New World Form state
  const [worldName, setWorldName] = useState('New Voxel World');
  const [gameMode, setGameMode] = useState<GameMode>('survival');
  const [biome, setBiome] = useState<BiomeType>('plains');
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 999999));

  useEffect(() => {
    // Pick random splash
    setSplashText(SPLASHES[Math.floor(Math.random() * SPLASHES.length)]);
  }, []);

  const handleLaunch = () => {
    audio.playLevelUp();
    onStartGame({
      worldName,
      gameMode,
      biome,
      seed,
      chunkRadius: 3,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between p-8 bg-[#18120b] select-none overflow-hidden">
      {/* Retro Dirt Pattern Background */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(#4d3216 15%, transparent 16%), radial-gradient(#3a230d 15%, transparent 16%)`,
          backgroundSize: '32px 32px',
          backgroundPosition: '0 0, 16px 16px',
        }}
      ></div>

      {/* Atmospheric Vignette */}
      <div className="absolute inset-0 bg-radial from-transparent via-black/40 to-black/90 pointer-events-none"></div>

      {/* Header / Logo */}
      <div className="relative mt-8 flex flex-col items-center z-10">
        {/* Minecraft 3D styled banner */}
        <div className="relative">
          <h1 className="text-4xl sm:text-6xl font-extrabold mc-font text-stone-200 tracking-wider text-center drop-shadow-[0_8px_0_rgba(0,0,0,0.9)] border-b-4 border-stone-600 pb-2">
            MINECRAFT
          </h1>
          <div className="text-center text-xs sm:text-sm font-bold text-amber-400 tracking-widest uppercase mt-1">
            WEB EMULATOR &bull; VOXEL EDITION
          </div>

          {/* Yellow Bouncing Splash Text */}
          <div className="absolute -bottom-6 -right-12 sm:-right-20 mc-splash text-yellow-300 font-bold text-xs sm:text-sm whitespace-nowrap drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">
            {splashText}
          </div>
        </div>
      </div>

      {/* Main Buttons */}
      <div className="relative z-10 flex flex-col items-center gap-3 w-80 max-w-full">
        {/* Instant Play */}
        <button
          onClick={() => {
            audio.playClick();
            handleLaunch();
          }}
          className="w-full py-3 mc-button text-sm font-bold text-emerald-300 shadow-xl"
        >
          ► Instant Play
        </button>

        {/* Create Custom World */}
        <button
          onClick={() => {
            audio.playClick();
            setShowWorldModal(true);
          }}
          className="w-full py-3 mc-button text-sm font-bold text-white shadow-xl"
        >
          Create New World...
        </button>

        {/* Controls & Help */}
        <button
          onClick={() => {
            audio.playClick();
            setShowControlsModal(true);
          }}
          className="w-full py-2.5 mc-button text-xs font-bold text-zinc-300 shadow-xl"
        >
          Controls & Guide
        </button>

        {/* Biome Quick Chips */}
        <div className="flex gap-1.5 mt-2">
          {(['plains', 'mountains', 'desert', 'snow', 'superflat'] as BiomeType[]).map((b) => (
            <button
              key={b}
              onClick={() => {
                audio.playClick();
                setBiome(b);
                setSeed(Math.floor(Math.random() * 999999));
                onStartGame({
                  worldName: `${b.toUpperCase()} World`,
                  gameMode,
                  biome: b,
                  seed: Math.floor(Math.random() * 999999),
                  chunkRadius: 3,
                });
              }}
              className="px-2 py-1 mc-button text-[9px] capitalize"
              title={`Play in ${b} biome`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* Footer Info */}
      <div className="relative z-10 text-center text-[10px] text-stone-400 font-mono">
        Minecraft Web Emulator &bull; Procedural Voxel Sandbox &bull; Three.js &bull; Web Audio API
      </div>

      {/* New World Modal */}
      {showWorldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs">
          <div className="mc-panel p-6 rounded w-[420px] max-w-[95vw] shadow-2xl">
            <h2 className="text-base font-bold text-zinc-900 mb-4 text-center">Create New World</h2>

            {/* World Name */}
            <div className="mb-3">
              <label className="block text-xs font-bold text-zinc-800 mb-1">World Name:</label>
              <input
                type="text"
                value={worldName}
                onChange={(e) => setWorldName(e.target.value)}
                className="w-full bg-[#373737] text-white p-2 text-xs border border-white/40 rounded-xs font-mono"
              />
            </div>

            {/* Game Mode */}
            <div className="mb-3">
              <label className="block text-xs font-bold text-zinc-800 mb-1">Game Mode:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setGameMode('survival')}
                  className={`py-2 mc-button text-xs font-bold ${gameMode === 'survival' ? 'ring-2 ring-emerald-400 brightness-125' : ''}`}
                >
                  ⚔️ Survival
                </button>
                <button
                  onClick={() => setGameMode('creative')}
                  className={`py-2 mc-button text-xs font-bold ${gameMode === 'creative' ? 'ring-2 ring-amber-400 brightness-125' : ''}`}
                >
                  🕊️ Creative
                </button>
              </div>
            </div>

            {/* Biome Choice */}
            <div className="mb-3">
              <label className="block text-xs font-bold text-zinc-800 mb-1">Biome Preset:</label>
              <select
                value={biome}
                onChange={(e) => setBiome(e.target.value as BiomeType)}
                className="w-full bg-[#373737] text-white p-2 text-xs border border-white/40 rounded-xs font-mono"
              >
                <option value="plains">Plains & Oak Forests (Lakes, flowers, rolling hills)</option>
                <option value="mountains">Epic Mountains (High peaks, steep cliffs, exposed ores)</option>
                <option value="desert">Desert Dunes (Vast sand, sandstone)</option>
                <option value="snow">Snowy Taiga (Frozen lakes, snow cover)</option>
                <option value="superflat">Superflat (Builder flat terrain)</option>
              </select>
            </div>

            {/* Seed */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-zinc-800">World Seed:</label>
                <button
                  onClick={() => setSeed(Math.floor(Math.random() * 999999))}
                  className="text-[10px] text-blue-800 underline cursor-pointer"
                >
                  🎲 Randomize
                </button>
              </div>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
                className="w-full bg-[#373737] text-white p-2 text-xs border border-white/40 rounded-xs font-mono"
              />
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleLaunch}
                className="py-2.5 mc-button text-xs font-bold text-emerald-300"
              >
                Create World
              </button>
              <button
                onClick={() => setShowWorldModal(false)}
                className="py-2.5 mc-button text-xs font-bold text-zinc-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Controls & Guide Modal */}
      {showControlsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs">
          <div className="mc-panel p-6 rounded w-[480px] max-w-[95vw] shadow-2xl">
            <h2 className="text-base font-bold text-zinc-900 mb-3 text-center">Controls & Keybinds</h2>

            <div className="grid grid-cols-2 gap-2 text-xs text-zinc-800 font-mono mb-4 bg-[#a5a5a5] p-3 border border-[#666666]">
              <div><strong className="text-black">W, A, S, D</strong> : Walk</div>
              <div><strong className="text-black">Mouse Look</strong> : Aim view</div>
              <div><strong className="text-black">Left Click</strong> : Mine block / Attack</div>
              <div><strong className="text-black">Right Click</strong> : Place block / TNT</div>
              <div><strong className="text-black">Space</strong> : Jump / Fly up</div>
              <div><strong className="text-black">Left Shift</strong> : Sneak / Fly down</div>
              <div><strong className="text-black">Left Ctrl</strong> : Sprint</div>
              <div><strong className="text-black">1 - 9</strong> : Select hotbar slot</div>
              <div><strong className="text-black">E</strong> : Open Inventory & Crafting</div>
              <div><strong className="text-black">F3</strong> : Debug info & coordinates</div>
              <div><strong className="text-black">T or /</strong> : Chat & Console commands</div>
              <div><strong className="text-black">ESC</strong> : Pause Menu</div>
            </div>

            <button
              onClick={() => setShowControlsModal(false)}
              className="w-full py-2 mc-button text-xs font-bold text-zinc-100"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
