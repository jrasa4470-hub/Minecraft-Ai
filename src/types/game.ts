/**
 * Minecraft Web Emulator - Core Types
 */

export enum BlockType {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  COBBLESTONE = 4,
  OAK_LOG = 5,
  OAK_PLANKS = 6,
  OAK_LEAVES = 7,
  SAND = 8,
  GLASS = 9,
  WATER = 10,
  BEDROCK = 11,
  COAL_ORE = 12,
  IRON_ORE = 13,
  GOLD_ORE = 14,
  DIAMOND_ORE = 15,
  REDSTONE_ORE = 16,
  CRAFTING_TABLE = 17,
  FURNACE = 18,
  BRICKS = 19,
  TNT = 20,
  BOOKSHELF = 21,
  GLOWSTONE = 22,
  SNOW = 23,
  ICE = 24,
  POPPY = 25,
  DANDELION = 26,
  TORCH = 27,
}

export interface BlockDef {
  id: BlockType;
  name: string;
  isTransparent?: boolean;
  isLightSource?: boolean;
  lightLevel?: number;
  isSolid?: boolean;
  isBreakable?: boolean;
  hardness: number; // break time in seconds with fist
  soundType: 'grass' | 'dirt' | 'stone' | 'wood' | 'sand' | 'glass' | 'cloth';
  dropItem?: BlockType | string;
  dropCount?: number;
}

export interface InventoryItem {
  id: string; // BlockType number as string or tool name e.g. "tool_diamond_pickaxe"
  count: number;
}

export type GameMode = 'survival' | 'creative';
export type CameraPerspective = 'first' | 'third_back' | 'third_front';
export type BiomeType = 'plains' | 'mountains' | 'desert' | 'snow' | 'superflat';

export interface WorldConfig {
  seed: number;
  biome: BiomeType;
  worldName: string;
  gameMode: GameMode;
  chunkRadius: number; // typically 3 to 6
}

export interface GameSettings {
  fov: number;
  renderDistance: number;
  soundVolume: number;
  musicVolume: number;
  mouseSensitivity: number;
  dayNightSpeed: number; // 1 = normal (~10 min), 0 = frozen, 4 = fast
  showF3: boolean;
  enableShaders: boolean;
  bobbing: boolean;
}

export interface MobEntity {
  id: string;
  type: 'sheep' | 'pig' | 'creeper';
  x: number;
  y: number;
  z: number;
  yaw: number;
  vx: number;
  vy: number;
  vz: number;
  health: number;
  maxHealth: number;
  walkTimer: number;
  isHurt: number; // flash red counter
  explodeTimer?: number; // for creeper
}

export interface DroppedItemEntity {
  id: string;
  blockType: BlockType;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
}

export interface PrimedTNTEntity {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  fuse: number; // ticks left (e.g. 80 ticks = ~4 seconds)
}

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: number;
  size: number;
  life: number;
  maxLife: number;
}

export interface PlayerStats {
  health: number; // 0 to 20
  maxHealth: number;
  hunger: number; // 0 to 20
  oxygen: number; // 0 to 20
  level: number;
  exp: number; // 0 to 1
  isFlying: boolean;
  isGrounded: boolean;
  isSneaking: boolean;
  isSprinting: boolean;
  isUnderwater: boolean;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  isSystem?: boolean;
  timestamp: number;
}
