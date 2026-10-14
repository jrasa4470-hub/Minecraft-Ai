import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  WorldConfig,
  GameMode,
  InventoryItem,
  PlayerStats,
  GameSettings,
  ChatMessage,
  BlockType,
} from './types/game';
import { MinecraftCanvas } from './components/MinecraftCanvas';
import { HUD } from './components/HUD';
import { InventoryModal } from './components/InventoryModal';
import { PauseMenu } from './components/PauseMenu';
import { TitleScreen } from './components/TitleScreen';
import { F3Debug } from './components/F3Debug';
import { ChatBox } from './components/ChatBox';
import { getItemDisplayName } from './engine/crafting';
import { audio } from './engine/audio';
import { VoxelWorld } from './engine/world';
import { EntityManager } from './engine/entities';

export default function App() {
  // Game Screen: 'title' | 'playing'
  const [screen, setScreen] = useState<'title' | 'playing'>('title');

  // World Config
  const [worldConfig, setWorldConfig] = useState<WorldConfig>({
    worldName: 'My Voxel World',
    gameMode: 'survival',
    biome: 'plains',
    seed: 421337,
    chunkRadius: 3,
  });

  // Settings
  const [settings, setSettings] = useState<GameSettings>({
    fov: 75,
    renderDistance: 3,
    soundVolume: 0.7,
    musicVolume: 0.3,
    mouseSensitivity: 1.0,
    dayNightSpeed: 1.0,
    showF3: false,
    enableShaders: true,
    bobbing: true,
  });

  // 9 Hotbar Slots
  const [hotbar, setHotbar] = useState<(InventoryItem | null)[]>([
    { id: `${BlockType.OAK_LOG}`, count: 16 },
    { id: `${BlockType.COBBLESTONE}`, count: 32 },
    { id: `${BlockType.DIRT}`, count: 64 },
    { id: `${BlockType.TORCH}`, count: 16 },
    { id: `${BlockType.TNT}`, count: 5 },
    { id: 'tool_wooden_pickaxe', count: 1 },
    null,
    null,
    null,
  ]);

  // 27 Inventory Slots
  const [inventory, setInventory] = useState<(InventoryItem | null)[]>(() => {
    const arr: (InventoryItem | null)[] = new Array(27).fill(null);
    arr[0] = { id: `${BlockType.OAK_PLANKS}`, count: 32 };
    arr[1] = { id: `${BlockType.GLASS}`, count: 16 };
    arr[2] = { id: `${BlockType.CRAFTING_TABLE}`, count: 1 };
    arr[3] = { id: 'item_stick', count: 8 };
    return arr;
  });

  const [selectedSlot, setSelectedSlot] = useState(0);

  // Player Stats
  const [playerStats, setPlayerStats] = useState<PlayerStats>({
    health: 20,
    maxHealth: 20,
    hunger: 20,
    oxygen: 20,
    level: 5,
    exp: 0.45,
    isFlying: false,
    isGrounded: true,
    isSneaking: false,
    isSprinting: false,
    isUnderwater: false,
  });

  // UI Modals
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isPauseMenuOpen, setIsPauseMenuOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isBottomDockCollapsed, setIsBottomDockCollapsed] = useState(false);

  // HUD & Interaction Feedback
  const [targetedBlockName, setTargetedBlockName] = useState<string | null>(null);
  const [breakProgress, setBreakProgress] = useState(0);
  const [heldItemSwing, setHeldItemSwing] = useState(0);
  const [recentPickups, setRecentPickups] = useState<{ name: string; count: number; time: number }[]>([]);

  // Time of Day (0..1: 0=dawn, 0.25=noon, 0.5=sunset, 0.75=midnight)
  const [timeOfDay, setTimeOfDay] = useState(0.25);

  // F3 Debug Info
  const [debugPos, setDebugPos] = useState(new THREE.Vector3(8, 20, 8));
  const [debugYaw, setDebugYaw] = useState(0);
  const [debugPitch, setDebugPitch] = useState(0);
  const [debugFps, setDebugFps] = useState(60);
  const [debugEntities, setDebugEntities] = useState(4);

  // Chat Messages
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'Server',
      text: 'Welcome to Minecraft Web Emulator! Press [E] for inventory, [T] for chat, [ESC] for pause.',
      isSystem: true,
      timestamp: Date.now(),
    },
  ]);

  // World & Entity Manager references for command executions
  const worldRef = useRef<VoxelWorld | null>(null);
  const emRef = useRef<EntityManager | null>(null);

  // Any modal open?
  const isUIOpen = isInventoryOpen || isPauseMenuOpen || isChatOpen;

  // Global keybind for F3 debug and UI closing
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault();
        setSettings((prev) => ({ ...prev, showF3: !prev.showF3 }));
      }
      if (e.key === 'KeyH' && !isChatOpen) {
        setIsBottomDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isChatOpen]);

  // Item pickup notification helper
  const handlePickupItem = (blockType: BlockType) => {
    const name = getItemDisplayName(`${blockType}`);
    const now = Date.now();
    setRecentPickups((prev) => [...prev.filter((p) => now - p.time < 3000), { name, count: 1, time: now }]);

    // Add to hotbar or inventory
    const blockKey = `${blockType}`;
    let added = false;

    // Check existing stacks in hotbar
    setHotbar((prev) => {
      const next = [...prev];
      for (let i = 0; i < next.length; i++) {
        if (next[i] && next[i]!.id === blockKey && next[i]!.count < 64) {
          next[i] = { id: blockKey, count: next[i]!.count + 1 };
          added = true;
          return next;
        }
      }
      // Put in empty hotbar slot
      if (!added) {
        for (let i = 0; i < next.length; i++) {
          if (!next[i]) {
            next[i] = { id: blockKey, count: 1 };
            added = true;
            return next;
          }
        }
      }
      return next;
    });

    // If not added to hotbar, add to main inventory
    if (!added) {
      setInventory((prev) => {
        const next = [...prev];
        for (let i = 0; i < next.length; i++) {
          if (next[i] && next[i]!.id === blockKey && next[i]!.count < 64) {
            next[i] = { id: blockKey, count: next[i]!.count + 1 };
            return next;
          }
        }
        for (let i = 0; i < next.length; i++) {
          if (!next[i]) {
            next[i] = { id: blockKey, count: 1 };
            return next;
          }
        }
        return next;
      });
    }
  };

  // Consume 1 from currently selected hotbar item (when placing block)
  const handleConsumeHeldItem = () => {
    setHotbar((prev) => {
      const next = [...prev];
      const cur = next[selectedSlot];
      if (cur) {
        if (cur.count > 1) {
          next[selectedSlot] = { ...cur, count: cur.count - 1 };
        } else {
          next[selectedSlot] = null;
        }
      }
      return next;
    });
  };

  // Launch world from Title Screen
  const handleStartGame = (cfg: WorldConfig) => {
    setWorldConfig(cfg);
    setPlayerStats((prev) => ({
      ...prev,
      isFlying: cfg.gameMode === 'creative',
      health: 20,
    }));
    setScreen('playing');
  };

  // Chat Commands handler
  const handleExecuteCommand = (cmd: string, args: string[]) => {
    const addSysMsg = (text: string) => {
      setChatMessages((prev) => [
        ...prev,
        { id: `sys_${Date.now()}_${Math.random()}`, sender: 'System', text, isSystem: true, timestamp: Date.now() },
      ]);
    };

    switch (cmd) {
      case 'help':
        addSysMsg('Available commands:');
        addSysMsg('/gamemode <survival|creative> - Switch mode');
        addSysMsg('/time set <day|night|noon|sunset> - Change time');
        addSysMsg('/give <item_name> [amount] - e.g. /give diamond 64');
        addSysMsg('/tp <x> <y> <z> - Teleport player');
        addSysMsg('/summon <sheep|pig|creeper> - Spawn a mob');
        addSysMsg('/seed - Show current world seed');
        addSysMsg('/clear - Empty inventory');
        break;

      case 'gamemode': {
        const mode = args[0]?.toLowerCase();
        if (mode === 'creative' || mode === 'c' || mode === '1') {
          setWorldConfig((prev) => ({ ...prev, gameMode: 'creative' }));
          setPlayerStats((prev) => ({ ...prev, isFlying: true }));
          addSysMsg('Game mode updated to Creative mode');
        } else if (mode === 'survival' || mode === 's' || mode === '0') {
          setWorldConfig((prev) => ({ ...prev, gameMode: 'survival' }));
          setPlayerStats((prev) => ({ ...prev, isFlying: false }));
          addSysMsg('Game mode updated to Survival mode');
        } else {
          addSysMsg('Usage: /gamemode <survival|creative>');
        }
        break;
      }

      case 'time': {
        if (args[0] === 'set') {
          const val = args[1]?.toLowerCase();
          if (val === 'day') setTimeOfDay(0.2);
          else if (val === 'noon') setTimeOfDay(0.35);
          else if (val === 'sunset') setTimeOfDay(0.7);
          else if (val === 'night') setTimeOfDay(0.85);
          else setTimeOfDay(Number(val) || 0.25);
          addSysMsg(`Set the time to ${val}`);
        } else {
          addSysMsg('Usage: /time set <day|night|noon|sunset>');
        }
        break;
      }

      case 'give': {
        const item = args[0]?.toLowerCase() || 'diamond';
        const count = Math.min(64, parseInt(args[1], 10) || 64);
        let blockId = BlockType.DIAMOND_ORE;
        if (item.includes('tnt')) blockId = BlockType.TNT;
        if (item.includes('gold')) blockId = BlockType.GOLD_ORE;
        if (item.includes('iron')) blockId = BlockType.IRON_ORE;
        if (item.includes('stone')) blockId = BlockType.STONE;
        if (item.includes('wood') || item.includes('log')) blockId = BlockType.OAK_LOG;
        if (item.includes('glow')) blockId = BlockType.GLOWSTONE;
        if (item.includes('glass')) blockId = BlockType.GLASS;
        if (item.includes('brick')) blockId = BlockType.BRICKS;

        // Place in hotbar
        setHotbar((prev) => {
          const next = [...prev];
          next[selectedSlot] = { id: `${blockId}`, count };
          return next;
        });
        addSysMsg(`Gave [${getItemDisplayName(`${blockId}`)}] x${count} to player`);
        audio.playLevelUp();
        break;
      }

      case 'summon': {
        const mob = (args[0]?.toLowerCase() || 'sheep') as 'sheep' | 'pig' | 'creeper';
        if (emRef.current) {
          emRef.current.spawnMob(mob, debugPos.x + 2, debugPos.y + 1, debugPos.z + 2);
          addSysMsg(`Summoned new ${mob} entity`);
          audio.playClick();
        }
        break;
      }

      case 'seed':
        addSysMsg(`World Seed: ${worldConfig.seed}`);
        break;

      case 'clear':
        setInventory(new Array(27).fill(null));
        setHotbar(new Array(9).fill(null));
        addSysMsg('Cleared inventory and hotbar');
        break;

      default:
        addSysMsg(`Unknown command: /${cmd}. Type /help for available commands.`);
        break;
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      {screen === 'title' ? (
        <TitleScreen onStartGame={handleStartGame} />
      ) : (
        <>
          {/* Core 3D Minecraft Engine Viewport */}
          <MinecraftCanvas
            config={worldConfig}
            settings={settings}
            hotbar={hotbar}
            selectedSlot={selectedSlot}
            onSelectSlot={setSelectedSlot}
            stats={playerStats}
            onUpdateStats={(newSt) => setPlayerStats((prev) => ({ ...prev, ...newSt }))}
            onPickupItem={handlePickupItem}
            onConsumeHeldItem={handleConsumeHeldItem}
            onOpenInventory={() => setIsInventoryOpen(true)}
            onOpenPauseMenu={() => setIsPauseMenuOpen(true)}
            onOpenChat={() => setIsChatOpen(true)}
            isUIOpen={isUIOpen}
            onDebugUpdate={(pos, yaw, pitch, fps, entities) => {
              setDebugPos(pos.clone());
              setDebugYaw(yaw);
              setDebugPitch(pitch);
              setDebugFps(fps);
              setDebugEntities(entities);
            }}
            onTargetBlockChange={setTargetedBlockName}
            onBreakProgressChange={setBreakProgress}
            onHeldItemSwingChange={setHeldItemSwing}
            timeOfDay={timeOfDay}
            setTimeOfDay={setTimeOfDay}
            setWorldRef={(w) => (worldRef.current = w)}
            setEntityManagerRef={(em) => (emRef.current = em)}
          />

          {/* Minecraft Java F3 Debug Screen */}
          <F3Debug
            visible={settings.showF3}
            playerPos={debugPos}
            yaw={debugYaw}
            pitch={debugPitch}
            fps={debugFps}
            biome={worldConfig.biome}
            entityCount={debugEntities}
          />

          {/* Minecraft In-Game HUD (Hotbar, Health, Hunger, EXP, Crosshair) */}
          <HUD
            hotbar={hotbar}
            selectedSlot={selectedSlot}
            stats={playerStats}
            gameMode={worldConfig.gameMode}
            targetedBlockName={targetedBlockName}
            heldItemSwing={heldItemSwing}
            breakProgress={breakProgress}
            recentPickups={recentPickups}
          />

          {/* Minecraft Chat & Command Console */}
          <ChatBox
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            messages={chatMessages}
            onSendMessage={(text) => {
              setChatMessages((prev) => [
                ...prev,
                { id: `${Date.now()}`, sender: 'Steve', text, timestamp: Date.now() },
              ]);
            }}
            onExecuteCommand={handleExecuteCommand}
          />

          {/* Full Inventory & Crafting Window */}
          <InventoryModal
            isOpen={isInventoryOpen}
            onClose={() => setIsInventoryOpen(false)}
            inventory={inventory}
            hotbar={hotbar}
            onUpdateInventory={(newInv, newHotbar) => {
              setInventory(newInv);
              setHotbar(newHotbar);
            }}
            gameMode={worldConfig.gameMode}
          />

          {/* In-Game Pause Menu */}
          <PauseMenu
            isOpen={isPauseMenuOpen}
            onResume={() => setIsPauseMenuOpen(false)}
            gameMode={worldConfig.gameMode}
            onToggleGameMode={() => {
              const nextMode: GameMode = worldConfig.gameMode === 'survival' ? 'creative' : 'survival';
              setWorldConfig((prev) => ({ ...prev, gameMode: nextMode }));
              setPlayerStats((prev) => ({ ...prev, isFlying: nextMode === 'creative' }));
            }}
            onSetTimeOfDay={setTimeOfDay}
            settings={settings}
            onUpdateSettings={(newS) => setSettings((prev) => ({ ...prev, ...newS }))}
            onSaveWorld={() => {
              try {
                localStorage.setItem(
                  'mc_world_save',
                  JSON.stringify({
                    worldConfig,
                    hotbar,
                    inventory,
                    playerStats,
                    timestamp: Date.now(),
                  })
                );
              } catch (e) {
                console.warn('Could not save to localStorage:', e);
              }
            }}
            onSpawnMob={(type) => {
              if (emRef.current) {
                emRef.current.spawnMob(type, debugPos.x + 2, debugPos.y + 1, debugPos.z + 2);
              }
            }}
            onQuitToTitle={() => {
              setIsPauseMenuOpen(false);
              setScreen('title');
            }}
          />

          {/* Unified Collapsible Bottom Dock (Zero Viewport Occlusion as mandated by skill) */}
          <div
            className={`fixed bottom-2.5 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center transition-transform duration-300 pointer-events-auto ${
              isBottomDockCollapsed ? 'translate-y-[calc(100%-24px)]' : 'translate-y-0'
            }`}
          >
            {/* Collapse / Expand Tab Button */}
            <button
              onClick={() => {
                audio.playClick();
                setIsBottomDockCollapsed(!isBottomDockCollapsed);
              }}
              className="bg-black/75 hover:bg-black/90 text-[10px] text-zinc-300 px-3 py-0.5 rounded-t border-t border-x border-white/20 backdrop-blur-xs cursor-pointer shadow-md flex items-center gap-1.5"
            >
              <span>{isBottomDockCollapsed ? '▴ Show Toolbar [H]' : '▾ Hide Toolbar [H]'}</span>
            </button>

            {/* Dock Content */}
            <div className="bg-[#2a2a2a]/90 backdrop-blur-md px-3 py-1.5 rounded-b border border-white/20 shadow-2xl flex items-center gap-2 text-xs">
              {/* Gamemode quick toggle */}
              <button
                onClick={() => {
                  audio.playClick();
                  const next = worldConfig.gameMode === 'survival' ? 'creative' : 'survival';
                  setWorldConfig((prev) => ({ ...prev, gameMode: next }));
                  setPlayerStats((prev) => ({ ...prev, isFlying: next === 'creative' }));
                }}
                className="mc-button px-2 py-1 text-[11px] font-bold"
                title="Switch Gamemode"
              >
                {worldConfig.gameMode === 'survival' ? '⚔️ Survival' : '🕊️ Creative'}
              </button>

              {/* Inventory button */}
              <button
                onClick={() => {
                  audio.playClick();
                  setIsInventoryOpen(true);
                }}
                className="mc-button px-2 py-1 text-[11px] font-bold"
                title="Open Inventory [E]"
              >
                🎒 Bag [E]
              </button>

              {/* Time presets */}
              <div className="flex gap-0.5 bg-black/40 p-0.5 rounded border border-white/10">
                <button
                  onClick={() => {
                    audio.playClick();
                    setTimeOfDay(0.35);
                  }}
                  className="px-1.5 py-0.5 hover:bg-white/10 rounded text-[10px]"
                  title="Noon"
                >
                  ☀️
                </button>
                <button
                  onClick={() => {
                    audio.playClick();
                    setTimeOfDay(0.7);
                  }}
                  className="px-1.5 py-0.5 hover:bg-white/10 rounded text-[10px]"
                  title="Sunset"
                >
                  🌇
                </button>
                <button
                  onClick={() => {
                    audio.playClick();
                    setTimeOfDay(0.85);
                  }}
                  className="px-1.5 py-0.5 hover:bg-white/10 rounded text-[10px]"
                  title="Night"
                >
                  🌙
                </button>
              </div>

              {/* F3 Toggle */}
              <button
                onClick={() => {
                  audio.playClick();
                  setSettings((prev) => ({ ...prev, showF3: !prev.showF3 }));
                }}
                className={`px-2 py-1 mc-button text-[11px] font-bold ${
                  settings.showF3 ? 'brightness-125 ring-1 ring-amber-300' : ''
                }`}
                title="Toggle Debug Info"
              >
                F3 Debug
              </button>

              {/* Chat trigger */}
              <button
                onClick={() => {
                  audio.playClick();
                  setIsChatOpen(true);
                }}
                className="mc-button px-2 py-1 text-[11px] font-bold"
                title="Chat & Commands [T]"
              >
                💬 Chat [T]
              </button>

              {/* Pause menu */}
              <button
                onClick={() => {
                  audio.playClick();
                  setIsPauseMenuOpen(true);
                }}
                className="mc-button px-2 py-1 text-[11px] font-bold text-amber-200"
                title="Pause Menu [ESC]"
              >
                ⚙ Menu
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
