import { BlockType } from '../types/game';

export interface CraftingRecipe {
  id: string;
  name: string;
  resultId: string;
  resultCount: number;
  ingredients: { id: string; count: number }[];
  pattern?: (string | null)[][]; // 2x2 or 3x3 pattern if shaped
}

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  {
    id: 'oak_planks',
    name: 'Oak Planks',
    resultId: `${BlockType.OAK_PLANKS}`,
    resultCount: 4,
    ingredients: [{ id: `${BlockType.OAK_LOG}`, count: 1 }],
  },
  {
    id: 'sticks',
    name: 'Sticks',
    resultId: 'item_stick',
    resultCount: 4,
    ingredients: [{ id: `${BlockType.OAK_PLANKS}`, count: 2 }],
  },
  {
    id: 'crafting_table',
    name: 'Crafting Table',
    resultId: `${BlockType.CRAFTING_TABLE}`,
    resultCount: 1,
    ingredients: [{ id: `${BlockType.OAK_PLANKS}`, count: 4 }],
  },
  {
    id: 'furnace',
    name: 'Furnace',
    resultId: `${BlockType.FURNACE}`,
    resultCount: 1,
    ingredients: [{ id: `${BlockType.COBBLESTONE}`, count: 8 }],
  },
  {
    id: 'torches',
    name: 'Torches',
    resultId: `${BlockType.TORCH}`,
    resultCount: 4,
    ingredients: [
      { id: `${BlockType.COAL_ORE}`, count: 1 },
      { id: 'item_stick', count: 1 },
    ],
  },
  {
    id: 'wooden_pickaxe',
    name: 'Wooden Pickaxe',
    resultId: 'tool_wooden_pickaxe',
    resultCount: 1,
    ingredients: [
      { id: `${BlockType.OAK_PLANKS}`, count: 3 },
      { id: 'item_stick', count: 2 },
    ],
  },
  {
    id: 'stone_pickaxe',
    name: 'Stone Pickaxe',
    resultId: 'tool_stone_pickaxe',
    resultCount: 1,
    ingredients: [
      { id: `${BlockType.COBBLESTONE}`, count: 3 },
      { id: 'item_stick', count: 2 },
    ],
  },
  {
    id: 'iron_pickaxe',
    name: 'Iron Pickaxe',
    resultId: 'tool_iron_pickaxe',
    resultCount: 1,
    ingredients: [
      { id: `${BlockType.IRON_ORE}`, count: 3 },
      { id: 'item_stick', count: 2 },
    ],
  },
  {
    id: 'diamond_pickaxe',
    name: 'Diamond Pickaxe',
    resultId: 'tool_diamond_pickaxe',
    resultCount: 1,
    ingredients: [
      { id: `${BlockType.DIAMOND_ORE}`, count: 3 },
      { id: 'item_stick', count: 2 },
    ],
  },
  {
    id: 'diamond_sword',
    name: 'Diamond Sword',
    resultId: 'tool_diamond_sword',
    resultCount: 1,
    ingredients: [
      { id: `${BlockType.DIAMOND_ORE}`, count: 2 },
      { id: 'item_stick', count: 1 },
    ],
  },
  {
    id: 'tnt',
    name: 'TNT',
    resultId: `${BlockType.TNT}`,
    resultCount: 1,
    ingredients: [
      { id: `${BlockType.SAND}`, count: 4 },
      { id: `${BlockType.REDSTONE_ORE}`, count: 5 },
    ],
  },
  {
    id: 'bookshelf',
    name: 'Bookshelf',
    resultId: `${BlockType.BOOKSHELF}`,
    resultCount: 1,
    ingredients: [
      { id: `${BlockType.OAK_PLANKS}`, count: 6 },
    ],
  },
];

export function getItemDisplayName(itemId: string): string {
  const numeric = parseInt(itemId, 10);
  if (!isNaN(numeric)) {
    switch (numeric) {
      case BlockType.GRASS: return 'Grass Block';
      case BlockType.DIRT: return 'Dirt';
      case BlockType.STONE: return 'Stone';
      case BlockType.COBBLESTONE: return 'Cobblestone';
      case BlockType.OAK_LOG: return 'Oak Log';
      case BlockType.OAK_PLANKS: return 'Oak Planks';
      case BlockType.OAK_LEAVES: return 'Oak Leaves';
      case BlockType.SAND: return 'Sand';
      case BlockType.GLASS: return 'Glass';
      case BlockType.WATER: return 'Water Bucket';
      case BlockType.BEDROCK: return 'Bedrock';
      case BlockType.COAL_ORE: return 'Coal Ore';
      case BlockType.IRON_ORE: return 'Iron Ore';
      case BlockType.GOLD_ORE: return 'Gold Ore';
      case BlockType.DIAMOND_ORE: return 'Diamond Ore';
      case BlockType.REDSTONE_ORE: return 'Redstone Ore';
      case BlockType.CRAFTING_TABLE: return 'Crafting Table';
      case BlockType.FURNACE: return 'Furnace';
      case BlockType.BRICKS: return 'Bricks';
      case BlockType.TNT: return 'TNT';
      case BlockType.BOOKSHELF: return 'Bookshelf';
      case BlockType.GLOWSTONE: return 'Glowstone';
      case BlockType.SNOW: return 'Snow Block';
      case BlockType.ICE: return 'Ice';
      case BlockType.POPPY: return 'Poppy';
      case BlockType.DANDELION: return 'Dandelion';
      case BlockType.TORCH: return 'Torch';
      default: return `Block #${numeric}`;
    }
  }

  if (itemId === 'item_stick') return 'Stick';
  if (itemId === 'tool_wooden_pickaxe') return 'Wooden Pickaxe';
  if (itemId === 'tool_stone_pickaxe') return 'Stone Pickaxe';
  if (itemId === 'tool_iron_pickaxe') return 'Iron Pickaxe';
  if (itemId === 'tool_diamond_pickaxe') return 'Diamond Pickaxe';
  if (itemId === 'tool_diamond_sword') return 'Diamond Sword';

  return itemId;
}
