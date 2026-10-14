import React, { useState } from 'react';
import { GameMode, GameSettings } from '../types/game';
import { audio } from '../engine/audio';

interface PauseMenuProps {
  isOpen: boolean;
  onResume: () => void;
  gameMode: GameMode;
  onToggleGameMode: () => void;
  onSetTimeOfDay: (timeNormalized: number) => void;
  settings: GameSettings;
  onUpdateSettings: (newSettings: Partial<GameSettings>) => void;
  onSaveWorld: () => void;
  onSpawnMob: (type: 'sheep' | 'pig' | 'creeper') => void;
  onQuitToTitle: () => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  isOpen,
  onResume,
  gameMode,
  onToggleGameMode,
  onSetTimeOfDay,
  settings,
  onUpdateSettings,
  onSaveWorld,
  onSpawnMob,
  onQuitToTitle,
}) => {
  const [activeTab, setActiveTab] = useState<'main' | 'settings'>('main');
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    audio.playLevelUp();
    onSaveWorld();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs select-none">
      <div className="w-[420px] flex flex-col items-center">
        {/* Title */}
        <h2 className="text-2xl font-bold mb-6 mc-font tracking-wide text-zinc-100 drop-shadow-md">
          Game Paused
        </h2>

        {activeTab === 'main' ? (
          <div className="w-full flex flex-col gap-2.5">
            {/* Resume */}
            <button
              onClick={() => {
                audio.playClick();
                onResume();
              }}
              className="w-full py-2.5 mc-button text-sm font-bold"
            >
              Back to Game
            </button>

            {/* Gamemode Toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  audio.playClick();
                  onToggleGameMode();
                }}
                className="py-2.5 mc-button text-xs font-bold"
              >
                Mode: <span className="text-amber-300 capitalize">{gameMode}</span>
              </button>

              <button
                onClick={() => {
                  audio.playClick();
                  setActiveTab('settings');
                }}
                className="py-2.5 mc-button text-xs font-bold"
              >
                Options...
              </button>
            </div>

            {/* Time of Day quick presets */}
            <div className="bg-[#444444] p-2 border-2 border-[#222222] rounded-xs">
              <div className="text-[10px] text-zinc-300 font-bold mb-1.5 text-center">Set Time of Day</div>
              <div className="grid grid-cols-4 gap-1">
                <button
                  onClick={() => {
                    audio.playClick();
                    onSetTimeOfDay(0.2); // Dawn
                  }}
                  className="py-1 mc-button text-[10px]"
                >
                  🌅 Dawn
                </button>
                <button
                  onClick={() => {
                    audio.playClick();
                    onSetTimeOfDay(0.35); // Noon
                  }}
                  className="py-1 mc-button text-[10px]"
                >
                  ☀️ Noon
                </button>
                <button
                  onClick={() => {
                    audio.playClick();
                    onSetTimeOfDay(0.7); // Sunset
                  }}
                  className="py-1 mc-button text-[10px]"
                >
                  🌇 Sunset
                </button>
                <button
                  onClick={() => {
                    audio.playClick();
                    onSetTimeOfDay(0.85); // Midnight
                  }}
                  className="py-1 mc-button text-[10px]"
                >
                  🌙 Night
                </button>
              </div>
            </div>

            {/* Spawn Mobs helper */}
            <div className="bg-[#444444] p-2 border-2 border-[#222222] rounded-xs">
              <div className="text-[10px] text-zinc-300 font-bold mb-1.5 text-center">Spawn Entity</div>
              <div className="grid grid-cols-3 gap-1">
                <button
                  onClick={() => {
                    audio.playClick();
                    onSpawnMob('sheep');
                  }}
                  className="py-1 mc-button text-[10px]"
                >
                  🐑 Sheep
                </button>
                <button
                  onClick={() => {
                    audio.playClick();
                    onSpawnMob('pig');
                  }}
                  className="py-1 mc-button text-[10px]"
                >
                  🐷 Pig
                </button>
                <button
                  onClick={() => {
                    audio.playClick();
                    onSpawnMob('creeper');
                  }}
                  className="py-1 mc-button text-[10px]"
                >
                  💥 Creeper
                </button>
              </div>
            </div>

            {/* Save World */}
            <button
              onClick={handleSave}
              className="w-full py-2 mc-button text-xs font-bold text-emerald-300"
            >
              {saveSuccess ? '✓ World Saved to Browser!' : 'Save World'}
            </button>

            {/* Quit to Title */}
            <button
              onClick={() => {
                audio.playClick();
                onQuitToTitle();
              }}
              className="w-full py-2.5 mc-button text-xs font-bold text-red-300 mt-2"
            >
              Save and Quit to Title
            </button>
          </div>
        ) : (
          /* Options / Video & Sound Settings */
          <div className="w-full bg-[#333333] p-4 border-2 border-[#555555] rounded-xs flex flex-col gap-3">
            <h3 className="text-sm font-bold text-center text-zinc-200">Video & Audio Settings</h3>

            {/* FOV */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Field of View (FOV)</span>
                <span className="font-mono text-amber-300">{settings.fov}°</span>
              </div>
              <input
                type="range"
                min={60}
                max={100}
                value={settings.fov}
                onChange={(e) => onUpdateSettings({ fov: Number(e.target.value) })}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            {/* Render Distance */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Render Distance (Chunks)</span>
                <span className="font-mono text-amber-300">{settings.renderDistance} chunks</span>
              </div>
              <input
                type="range"
                min={2}
                max={5}
                value={settings.renderDistance}
                onChange={(e) => onUpdateSettings({ renderDistance: Number(e.target.value) })}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            {/* Sound Volume */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Sound FX Volume</span>
                <span className="font-mono text-amber-300">{Math.round(settings.soundVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.soundVolume}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onUpdateSettings({ soundVolume: val });
                  audio.setSoundVolume(val);
                }}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            {/* Music Volume */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Ambient Music</span>
                <span className="font-mono text-amber-300">{Math.round(settings.musicVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.musicVolume}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onUpdateSettings({ musicVolume: val });
                  audio.setMusicVolume(val);
                }}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            {/* Day / Night speed */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Day/Night Speed</span>
                <span className="font-mono text-amber-300">{settings.dayNightSpeed}x</span>
              </div>
              <input
                type="range"
                min={0}
                max={4}
                step={0.5}
                value={settings.dayNightSpeed}
                onChange={(e) => onUpdateSettings({ dayNightSpeed: Number(e.target.value) })}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            {/* Done button */}
            <button
              onClick={() => {
                audio.playClick();
                setActiveTab('main');
              }}
              className="mt-2 py-2 mc-button text-xs font-bold"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
