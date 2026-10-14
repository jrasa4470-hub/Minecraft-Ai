import React, { useState } from 'react';
import { InventoryItem, BlockType, GameMode } from '../types/game';
import { getItemIconDataUrl } from '../engine/textures';
import { getItemDisplayName, CRAFTING_RECIPES, CraftingRecipe } from '../engine/crafting';
import { audio } from '../engine/audio';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: (InventoryItem | null)[]; // 27 slots
  hotbar: (InventoryItem | null)[]; // 9 slots
  onUpdateInventory: (newInv: (InventoryItem | null)[], newHotbar: (InventoryItem | null)[]) => void;
  gameMode: GameMode;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  isOpen,
  onClose,
  inventory,
  hotbar,
  onUpdateInventory,
  gameMode,
}) => {
  // 2x2 Crafting Grid (4 slots)
  const [craftGrid, setCraftGrid] = useState<(InventoryItem | null)[]>([null, null, null, null]);
  // Cursor item currently held by mouse
  const [cursorItem, setCursorItem] = useState<InventoryItem | null>(null);
  // Active Tab: 'crafting' | 'creative'
  const [activeTab, setActiveTab] = useState<'crafting' | 'creative'>('crafting');

  if (!isOpen) return null;

  // Determine crafting result from 2x2 grid
  const getCraftResult = (): { item: InventoryItem; recipe: CraftingRecipe } | null => {
    // Count items in grid
    const counts = new Map<string, number>();
    craftGrid.forEach((slot) => {
      if (slot) {
        counts.set(slot.id, (counts.get(slot.id) || 0) + 1);
      }
    });

    for (const recipe of CRAFTING_RECIPES) {
      if (recipe.ingredients.length === 1) {
        // Shapeless single ingredient (e.g. 1 log -> 4 planks)
        const req = recipe.ingredients[0];
        if (counts.size === 1 && counts.get(req.id) === req.count) {
          return {
            item: { id: recipe.resultId, count: recipe.resultCount },
            recipe,
          };
        }
      } else if (recipe.ingredients.length === 2) {
        // Two ingredients (e.g. sticks, torches)
        const req0 = recipe.ingredients[0];
        const req1 = recipe.ingredients[1];
        if (
          counts.size === 2 &&
          counts.get(req0.id) === req0.count &&
          counts.get(req1.id) === req1.count
        ) {
          return {
            item: { id: recipe.resultId, count: recipe.resultCount },
            recipe,
          };
        }
      }
    }
    return null;
  };

  const craftResult = getCraftResult();

  // Click on a slot in inventory or hotbar
  const handleSlotClick = (
    array: (InventoryItem | null)[],
    index: number,
    isHotbar: boolean,
    isCraftGrid = false
  ) => {
    audio.playClick();
    const currentSlot = array[index];

    if (!cursorItem && currentSlot) {
      // Pick up item
      setCursorItem({ ...currentSlot });
      const next = [...array];
      next[index] = null;
      commitUpdate(next, isHotbar, isCraftGrid);
    } else if (cursorItem && !currentSlot) {
      // Place item down
      const next = [...array];
      next[index] = { ...cursorItem };
      setCursorItem(null);
      commitUpdate(next, isHotbar, isCraftGrid);
    } else if (cursorItem && currentSlot) {
      // If same id, merge stacks
      if (cursorItem.id === currentSlot.id) {
        const next = [...array];
        next[index] = {
          id: currentSlot.id,
          count: currentSlot.count + cursorItem.count,
        };
        setCursorItem(null);
        commitUpdate(next, isHotbar, isCraftGrid);
      } else {
        // Swap
        const next = [...array];
        next[index] = { ...cursorItem };
        setCursorItem({ ...currentSlot });
        commitUpdate(next, isHotbar, isCraftGrid);
      }
    }
  };

  const commitUpdate = (newArr: (InventoryItem | null)[], isHotbar: boolean, isCraftGrid: boolean) => {
    if (isCraftGrid) {
      setCraftGrid(newArr);
    } else if (isHotbar) {
      onUpdateInventory(inventory, newArr);
    } else {
      onUpdateInventory(newArr, hotbar);
    }
  };

  // Collect craft output
  const handleTakeCraftResult = () => {
    if (!craftResult) return;
    audio.playItemPop();

    // Consume 1 item from each used slot in craft grid
    const nextGrid = craftGrid.map((slot) => {
      if (!slot) return null;
      if (slot.count > 1) {
        return { ...slot, count: slot.count - 1 };
      }
      return null;
    });
    setCraftGrid(nextGrid);

    // Give result to cursor or inventory
    if (!cursorItem) {
      setCursorItem(craftResult.item);
    } else if (cursorItem.id === craftResult.item.id) {
      setCursorItem({
        id: cursorItem.id,
        count: cursorItem.count + craftResult.item.count,
      });
    }
  };

  // Quick craft directly from recipe book
  const handleQuickCraft = (recipe: CraftingRecipe) => {
    // Check if player has required ingredients in inventory or hotbar
    const allSlots = [...inventory, ...hotbar];
    let canCraft = true;

    for (const req of recipe.ingredients) {
      let found = 0;
      allSlots.forEach((s) => {
        if (s && s.id === req.id) found += s.count;
      });
      if (found < req.count) {
        canCraft = false;
        break;
      }
    }

    if (!canCraft) return;

    audio.playItemPop();

    // Deduct ingredients
    const newInv = [...inventory];
    const newHotbar = [...hotbar];

    recipe.ingredients.forEach((req) => {
      let remaining = req.count;
      // Deduct from inv first
      for (let i = 0; i < newInv.length; i++) {
        const s = newInv[i];
        if (s && s.id === req.id) {
          const deduct = Math.min(s.count, remaining);
          remaining -= deduct;
          s.count -= deduct;
          if (s.count <= 0) newInv[i] = null;
          if (remaining <= 0) break;
        }
      }
      // Then hotbar
      if (remaining > 0) {
        for (let i = 0; i < newHotbar.length; i++) {
          const s = newHotbar[i];
          if (s && s.id === req.id) {
            const deduct = Math.min(s.count, remaining);
            remaining -= deduct;
            s.count -= deduct;
            if (s.count <= 0) newHotbar[i] = null;
            if (remaining <= 0) break;
          }
        }
      }
    });

    // Add result to hotbar or inv
    let added = false;
    for (let i = 0; i < newHotbar.length; i++) {
      if (!newHotbar[i]) {
        newHotbar[i] = { id: recipe.resultId, count: recipe.resultCount };
        added = true;
        break;
      }
    }
    if (!added) {
      for (let i = 0; i < newInv.length; i++) {
        if (!newInv[i]) {
          newInv[i] = { id: recipe.resultId, count: recipe.resultCount };
          break;
        }
      }
    }

    onUpdateInventory(newInv, newHotbar);
  };

  // Creative Mode Palette block list
  const creativeBlocks = [
    BlockType.GRASS, BlockType.DIRT, BlockType.STONE, BlockType.COBBLESTONE,
    BlockType.OAK_LOG, BlockType.OAK_PLANKS, BlockType.OAK_LEAVES, BlockType.GLASS,
    BlockType.SAND, BlockType.BRICKS, BlockType.BOOKSHELF, BlockType.TNT,
    BlockType.COAL_ORE, BlockType.IRON_ORE, BlockType.GOLD_ORE, BlockType.DIAMOND_ORE,
    BlockType.REDSTONE_ORE, BlockType.CRAFTING_TABLE, BlockType.FURNACE,
    BlockType.GLOWSTONE, BlockType.SNOW, BlockType.ICE, BlockType.TORCH,
    BlockType.POPPY, BlockType.DANDELION,
  ];

  const handleCreativeSelect = (block: BlockType) => {
    audio.playClick();
    setCursorItem({ id: `${block}`, count: 64 });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none">
      {/* Main Minecraft Panel */}
      <div className="mc-panel p-5 rounded-xs w-[540px] shadow-2xl relative">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 border-b-2 border-[#555555] pb-2">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('crafting')}
              className={`px-3 py-1 text-xs font-bold mc-button ${activeTab === 'crafting' ? 'brightness-125' : ''}`}
            >
              Inventory & Crafting
            </button>
            <button
              onClick={() => setActiveTab('creative')}
              className={`px-3 py-1 text-xs font-bold mc-button ${activeTab === 'creative' ? 'brightness-125' : ''}`}
            >
              Creative Palette
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-6 h-6 mc-button flex items-center justify-center text-xs font-bold"
          >
            ✕
          </button>
        </div>

        {activeTab === 'crafting' ? (
          <div>
            {/* Top row: Character & 2x2 Crafting Grid */}
            <div className="flex justify-between items-center mb-4 bg-[#b0b0b0] p-3 border-2 border-[#777777]">
              {/* Character Doll Box */}
              <div className="w-24 h-24 bg-[#555555] border-2 border-[#333333] flex flex-col items-center justify-center text-[10px] text-zinc-300">
                <span className="text-2xl mb-1">🧑</span>
                <span>Player</span>
              </div>

              {/* 2x2 Crafting Area */}
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-[10px] font-bold text-zinc-800 mb-1">Crafting</div>
                  <div className="grid grid-cols-2 gap-1 bg-[#8b8b8b] p-1 border-2 border-[#373737]">
                    {craftGrid.map((slot, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSlotClick(craftGrid, idx, false, true)}
                        className="w-9 h-9 mc-slot flex items-center justify-center cursor-pointer hover:bg-[#a0a0a0] relative"
                      >
                        {slot && (
                          <>
                            <img
                              src={getItemIconDataUrl(slot.id)}
                              alt="Item"
                              className="w-7 h-7 pixelated"
                            />
                            {slot.count > 1 && (
                              <span className="absolute bottom-0 right-0.5 text-[10px] text-white font-mono font-bold drop-shadow">
                                {slot.count}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Arrow */}
                <span className="text-xl text-zinc-700 font-bold">➔</span>

                {/* Result Slot */}
                <div>
                  <div className="text-[10px] font-bold text-zinc-800 mb-1">Result</div>
                  <div
                    onClick={handleTakeCraftResult}
                    className="w-11 h-11 mc-slot bg-[#9e9e9e] border-2 border-white flex items-center justify-center cursor-pointer hover:bg-emerald-700/20 relative"
                  >
                    {craftResult && (
                      <>
                        <img
                          src={getItemIconDataUrl(craftResult.item.id)}
                          alt="Result"
                          className="w-8 h-8 pixelated"
                        />
                        {craftResult.item.count > 1 && (
                          <span className="absolute bottom-0 right-1 text-xs text-white font-mono font-bold drop-shadow">
                            {craftResult.item.count}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Craft Recipe Recommendations */}
            <div className="mb-3">
              <div className="text-[10px] font-bold text-zinc-800 mb-1">Quick Recipes:</div>
              <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto bg-[#a0a0a0] p-1.5 border border-[#555555]">
                {CRAFTING_RECIPES.map((recipe) => (
                  <button
                    key={recipe.id}
                    onClick={() => handleQuickCraft(recipe)}
                    className="flex items-center gap-1 mc-button px-2 py-0.5 text-[10px]"
                    title={`Craft ${recipe.name}`}
                  >
                    <img
                      src={getItemIconDataUrl(recipe.resultId)}
                      alt={recipe.name}
                      className="w-4 h-4 pixelated"
                    />
                    <span>{recipe.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Main 27 Inventory Slots */}
            <div className="mb-3">
              <div className="text-[10px] font-bold text-zinc-800 mb-1">Inventory</div>
              <div className="grid grid-cols-9 gap-1 bg-[#8b8b8b] p-1 border-2 border-[#373737]">
                {inventory.map((slot, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSlotClick(inventory, idx, false)}
                    className="w-10 h-10 mc-slot flex items-center justify-center cursor-pointer hover:bg-[#a0a0a0] relative"
                  >
                    {slot && (
                      <>
                        <img
                          src={getItemIconDataUrl(slot.id)}
                          alt="Item"
                          className="w-8 h-8 pixelated"
                        />
                        {slot.count > 1 && (
                          <span className="absolute bottom-0.5 right-1 text-[10px] text-white font-mono font-bold drop-shadow">
                            {slot.count}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 9 Hotbar Slots */}
            <div>
              <div className="text-[10px] font-bold text-zinc-800 mb-1">Hotbar</div>
              <div className="grid grid-cols-9 gap-1 bg-[#8b8b8b] p-1 border-2 border-[#373737]">
                {hotbar.map((slot, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSlotClick(hotbar, idx, true)}
                    className="w-10 h-10 mc-slot flex items-center justify-center cursor-pointer hover:bg-[#a0a0a0] relative"
                  >
                    {slot && (
                      <>
                        <img
                          src={getItemIconDataUrl(slot.id)}
                          alt="Item"
                          className="w-8 h-8 pixelated"
                        />
                        {slot.count > 1 && (
                          <span className="absolute bottom-0.5 right-1 text-[10px] text-white font-mono font-bold drop-shadow">
                            {slot.count}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Creative Mode Item Picker */
          <div>
            <div className="text-xs font-bold text-zinc-800 mb-2">
              Select any block to grab a full stack of 64:
            </div>
            <div className="grid grid-cols-5 gap-2 max-h-[340px] overflow-y-auto bg-[#8b8b8b] p-2 border-2 border-[#373737]">
              {creativeBlocks.map((b) => (
                <button
                  key={b}
                  onClick={() => handleCreativeSelect(b)}
                  className="mc-button flex flex-col items-center justify-center p-2 gap-1 text-[10px]"
                >
                  <img
                    src={getItemIconDataUrl(b)}
                    alt={`Block ${b}`}
                    className="w-8 h-8 pixelated"
                  />
                  <span className="truncate w-full text-center">{getItemDisplayName(`${b}`)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cursor floating item indicator */}
        {cursorItem && (
          <div className="mt-3 p-2 bg-amber-900/30 border border-amber-600/50 rounded flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <span>Holding:</span>
              <img
                src={getItemIconDataUrl(cursorItem.id)}
                alt="Holding"
                className="w-6 h-6 pixelated"
              />
              <span className="font-bold">{getItemDisplayName(cursorItem.id)} (x{cursorItem.count})</span>
            </div>
            <span className="text-[10px] text-zinc-600">Click any slot to place</span>
          </div>
        )}

        <div className="mt-4 text-center text-[10px] text-zinc-600 font-mono">
          Press [E] or [ESC] to close inventory
        </div>
      </div>
    </div>
  );
};
