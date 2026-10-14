import * as THREE from 'three';
import { BlockType } from '../types/game';
import { getBlockFaceCanvas, FaceIndex } from './textures';

// 16x16 grid of 16x16 tiles = 256x256 atlas
const TILES_PER_ROW = 16;
const TILE_SIZE = 16;
const ATLAS_SIZE = 256;

// Mapping of (blockType, face) to atlas tile index [0..255]
const tileIndexMap = new Map<string, number>();
let nextTileIndex = 0;

// UV cache per (blockType, face)
export interface UVRect {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}
const uvCache = new Map<string, UVRect>();

let atlasCanvas: HTMLCanvasElement | null = null;
let atlasTexture: THREE.CanvasTexture | null = null;

export function initTextureAtlas(): { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture } {
  if (atlasTexture && atlasCanvas) {
    return { canvas: atlasCanvas, texture: atlasTexture };
  }

  atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = ATLAS_SIZE;
  atlasCanvas.height = ATLAS_SIZE;
  const ctx = atlasCanvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Clear transparent
  ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

  // Register all block types and faces
  const blockTypes = [
    BlockType.GRASS,
    BlockType.DIRT,
    BlockType.STONE,
    BlockType.COBBLESTONE,
    BlockType.OAK_LOG,
    BlockType.OAK_PLANKS,
    BlockType.OAK_LEAVES,
    BlockType.SAND,
    BlockType.GLASS,
    BlockType.WATER,
    BlockType.BEDROCK,
    BlockType.COAL_ORE,
    BlockType.IRON_ORE,
    BlockType.GOLD_ORE,
    BlockType.DIAMOND_ORE,
    BlockType.REDSTONE_ORE,
    BlockType.CRAFTING_TABLE,
    BlockType.FURNACE,
    BlockType.BRICKS,
    BlockType.TNT,
    BlockType.BOOKSHELF,
    BlockType.GLOWSTONE,
    BlockType.SNOW,
    BlockType.ICE,
    BlockType.POPPY,
    BlockType.DANDELION,
    BlockType.TORCH,
  ];

  for (const blockType of blockTypes) {
    for (let face = 0; face < 6; face++) {
      const key = `${blockType}_${face}`;
      const tileIndex = nextTileIndex++;
      tileIndexMap.set(key, tileIndex);

      const col = tileIndex % TILES_PER_ROW;
      const row = Math.floor(tileIndex / TILES_PER_ROW);

      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;

      const faceCanvas = getBlockFaceCanvas(blockType, face as FaceIndex);
      ctx.drawImage(faceCanvas, x, y, TILE_SIZE, TILE_SIZE);

      // Precalculate UV coordinates (Three.js UV: 0,0 is bottom-left, 1,1 is top-right)
      const u0 = (col * TILE_SIZE) / ATLAS_SIZE;
      const u1 = ((col + 1) * TILE_SIZE) / ATLAS_SIZE;
      const v0 = 1 - ((row + 1) * TILE_SIZE) / ATLAS_SIZE;
      const v1 = 1 - (row * TILE_SIZE) / ATLAS_SIZE;

      uvCache.set(key, { u0, v0, u1, v1 });
    }
  }

  atlasTexture = new THREE.CanvasTexture(atlasCanvas);
  atlasTexture.magFilter = THREE.NearestFilter;
  atlasTexture.minFilter = THREE.NearestFilter;
  atlasTexture.colorSpace = THREE.SRGBColorSpace;
  atlasTexture.generateMipmaps = false;

  return { canvas: atlasCanvas, texture: atlasTexture };
}

export function getBlockUV(blockType: BlockType, face: FaceIndex): UVRect {
  if (!atlasTexture) {
    initTextureAtlas();
  }
  const key = `${blockType}_${face}`;
  const uv = uvCache.get(key);
  if (uv) return uv;
  // Fallback to tile 0
  return { u0: 0, v0: 0, u1: 1 / 16, v1: 1 / 16 };
}

export function getAtlasTexture(): THREE.CanvasTexture {
  if (!atlasTexture) {
    initTextureAtlas();
  }
  return atlasTexture!;
}
