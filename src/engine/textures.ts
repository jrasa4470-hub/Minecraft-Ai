import * as THREE from 'three';
import { BlockType } from '../types/game';

// Face indices: 0 = +X (right), 1 = -X (left), 2 = +Y (top), 3 = -Y (bottom), 4 = +Z (front), 5 = -Z (back)
export type FaceIndex = 0 | 1 | 2 | 3 | 4 | 5;

// Helper to create a 16x16 canvas and draw pixels from a 16x16 hex/color grid or procedural generator
function createPixelCanvas(drawFn: (ctx: CanvasRenderingContext2D) => void, width = 16, height = 16): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  drawFn(ctx);
  return canvas;
}

// Pseudo-random deterministic noise based on coordinate for texture variety
function hashNoise(x: number, y: number, seed = 0): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return n - Math.floor(n);
}

// Color tint helper
function rgb(r: number, g: number, b: number): string {
  return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
}

// RGBA helper
function rgba(r: number, g: number, b: number, a: number): string {
  return `rgba(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)}, ${a})`;
}

// Pre-generated Canvas textures cache
const canvasCache = new Map<string, HTMLCanvasElement>();

export function getBlockFaceCanvas(blockType: BlockType, face: FaceIndex): HTMLCanvasElement {
  const cacheKey = `${blockType}_${face}`;
  if (canvasCache.has(cacheKey)) {
    return canvasCache.get(cacheKey)!;
  }

  const canvas = createPixelCanvas((ctx) => {
    switch (blockType) {
      case BlockType.GRASS: {
        if (face === 2) {
          // Top face: Lush green grass
          for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++) {
              const n = hashNoise(x, y, 10);
              const g = 135 + Math.floor(n * 50);
              const r = 70 + Math.floor(n * 30);
              const b = 35 + Math.floor(n * 20);
              ctx.fillStyle = rgb(r, g, b);
              ctx.fillRect(x, y, 1, 1);
            }
          }
        } else if (face === 3) {
          // Bottom face: Pure dirt
          drawDirt(ctx);
        } else {
          // Side faces: Dirt with grass overhang
          drawDirt(ctx);
          // Grass layer on top 2-4 pixels
          for (let x = 0; x < 16; x++) {
            const hang = 2 + (x % 3 === 0 ? 1 : 0) + (x % 5 === 0 ? 1 : 0);
            for (let y = 0; y < hang; y++) {
              const n = hashNoise(x, y, 12);
              ctx.fillStyle = rgb(70 + n * 30, 135 + n * 50, 35 + n * 20);
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }
        break;
      }

      case BlockType.DIRT:
        drawDirt(ctx);
        break;

      case BlockType.STONE:
        drawStone(ctx);
        break;

      case BlockType.COBBLESTONE:
        drawCobblestone(ctx);
        break;

      case BlockType.OAK_LOG: {
        if (face === 2 || face === 3) {
          // Tree rings
          drawLogRing(ctx);
        } else {
          // Bark vertical grain
          drawLogBark(ctx);
        }
        break;
      }

      case BlockType.OAK_PLANKS:
        drawPlanks(ctx);
        break;

      case BlockType.OAK_LEAVES:
        drawLeaves(ctx);
        break;

      case BlockType.SAND:
        drawSand(ctx);
        break;

      case BlockType.GLASS:
        drawGlass(ctx);
        break;

      case BlockType.WATER:
        drawWater(ctx);
        break;

      case BlockType.BEDROCK:
        drawBedrock(ctx);
        break;

      case BlockType.COAL_ORE:
        drawOre(ctx, rgb(30, 30, 30), rgb(50, 50, 50));
        break;

      case BlockType.IRON_ORE:
        drawOre(ctx, rgb(215, 175, 140), rgb(185, 145, 110));
        break;

      case BlockType.GOLD_ORE:
        drawOre(ctx, rgb(255, 220, 60), rgb(215, 175, 20));
        break;

      case BlockType.DIAMOND_ORE:
        drawOre(ctx, rgb(95, 245, 235), rgb(40, 195, 190));
        break;

      case BlockType.REDSTONE_ORE:
        drawOre(ctx, rgb(235, 30, 30), rgb(180, 20, 20));
        break;

      case BlockType.CRAFTING_TABLE:
        if (face === 2) {
          drawCraftingTableTop(ctx);
        } else if (face === 3) {
          drawPlanks(ctx);
        } else {
          drawCraftingTableSide(ctx);
        }
        break;

      case BlockType.FURNACE:
        if (face === 4) {
          drawFurnaceFront(ctx);
        } else if (face === 2 || face === 3) {
          drawCobblestone(ctx);
        } else {
          drawCobblestone(ctx);
        }
        break;

      case BlockType.BRICKS:
        drawBricks(ctx);
        break;

      case BlockType.TNT:
        if (face === 2 || face === 3) {
          drawTNTTop(ctx);
        } else {
          drawTNTSide(ctx);
        }
        break;

      case BlockType.BOOKSHELF:
        if (face === 2 || face === 3) {
          drawPlanks(ctx);
        } else {
          drawBookshelfSide(ctx);
        }
        break;

      case BlockType.GLOWSTONE:
        drawGlowstone(ctx);
        break;

      case BlockType.SNOW:
        drawSnow(ctx);
        break;

      case BlockType.ICE:
        drawIce(ctx);
        break;

      case BlockType.POPPY:
        drawPoppy(ctx);
        break;

      case BlockType.DANDELION:
        drawDandelion(ctx);
        break;

      case BlockType.TORCH:
        drawTorch(ctx);
        break;

      default:
        // Magenta/black missing texture fallback
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            ctx.fillStyle = (x < 8 !== y < 8) ? '#ff00ff' : '#000000';
            ctx.fillRect(x, y, 1, 1);
          }
        }
        break;
    }
  });

  canvasCache.set(cacheKey, canvas);
  return canvas;
}

// Generators for specific block faces
function drawDirt(ctx: CanvasRenderingContext2D) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const n = hashNoise(x, y, 20);
      const r = 115 + Math.floor(n * 40);
      const g = 75 + Math.floor(n * 30);
      const b = 45 + Math.floor(n * 20);
      ctx.fillStyle = rgb(r, g, b);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawStone(ctx: CanvasRenderingContext2D) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const n = hashNoise(x, y, 30);
      const v = 110 + Math.floor(n * 50);
      ctx.fillStyle = rgb(v, v, v);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawCobblestone(ctx: CanvasRenderingContext2D) {
  drawStone(ctx);
  // Add dark cracks and lighter edges
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const n = hashNoise(x, y, 40);
      if ((x + y) % 4 === 0 || (x * 3 + y * 2) % 7 === 0) {
        ctx.fillStyle = n > 0.5 ? '#3a3a3a' : '#525252';
        ctx.fillRect(x, y, 1, 1);
      } else if (n > 0.8) {
        ctx.fillStyle = '#b5b5b5';
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

function drawLogRing(ctx: CanvasRenderingContext2D) {
  // Wood core with rings and dark bark border
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = x - 7.5;
      const dy = y - 7.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= 6.8) {
        // Dark bark
        const n = hashNoise(x, y, 50);
        ctx.fillStyle = rgb(70 + n * 20, 50 + n * 15, 30 + n * 10);
      } else {
        // Rings
        const ring = Math.floor(dist * 1.5) % 2 === 0;
        const n = hashNoise(x, y, 51);
        const base = ring ? 165 : 185;
        ctx.fillStyle = rgb(base + n * 15, base - 35 + n * 15, base - 75 + n * 10);
      }
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawLogBark(ctx: CanvasRenderingContext2D) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const col = (x % 4 === 0 || (x + (y % 3)) % 5 === 0);
      const n = hashNoise(x, y, 60);
      if (col) {
        ctx.fillStyle = rgb(60 + n * 20, 42 + n * 15, 25 + n * 10);
      } else {
        ctx.fillStyle = rgb(105 + n * 30, 75 + n * 20, 45 + n * 15);
      }
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawPlanks(ctx: CanvasRenderingContext2D) {
  for (let y = 0; y < 16; y++) {
    const isGroove = y % 4 === 0;
    for (let x = 0; x < 16; x++) {
      const isNail = (x === 2 || x === 13) && (y % 4 === 1);
      const n = hashNoise(x, y, 70);
      if (isGroove) {
        ctx.fillStyle = '#614624';
      } else if (isNail) {
        ctx.fillStyle = '#4a3317';
      } else {
        const r = 168 + Math.floor(n * 25);
        const g = 132 + Math.floor(n * 20);
        const b = 82 + Math.floor(n * 15);
        ctx.fillStyle = rgb(r, g, b);
      }
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawLeaves(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, 16, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const n = hashNoise(x, y, 80);
      // Cutout foliage style
      if (n < 0.25) {
        // Transparent hole
        continue;
      }
      const g = 110 + Math.floor(n * 75);
      const r = 25 + Math.floor(n * 35);
      const b = 15 + Math.floor(n * 25);
      ctx.fillStyle = rgb(r, g, b);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawSand(ctx: CanvasRenderingContext2D) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const n = hashNoise(x, y, 90);
      const r = 220 + Math.floor(n * 25);
      const g = 205 + Math.floor(n * 25);
      const b = 150 + Math.floor(n * 30);
      ctx.fillStyle = rgb(r, g, b);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawGlass(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, 16, 16);
  // Glass border
  ctx.fillStyle = 'rgba(235, 245, 255, 0.7)';
  for (let i = 0; i < 16; i++) {
    ctx.fillRect(i, 0, 1, 1);
    ctx.fillRect(i, 15, 1, 1);
    ctx.fillRect(0, i, 1, 1);
    ctx.fillRect(15, i, 1, 1);
  }
  // Subtle white streaks / glints
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.fillRect(3, 3, 2, 1);
  ctx.fillRect(4, 4, 2, 1);
  ctx.fillRect(11, 10, 2, 1);
  ctx.fillRect(12, 11, 2, 1);
  // Subtle tint
  ctx.fillStyle = 'rgba(200, 230, 255, 0.12)';
  ctx.fillRect(1, 1, 14, 14);
}

function drawWater(ctx: CanvasRenderingContext2D) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const n = hashNoise(x, y, 100);
      const b = 210 + Math.floor(n * 35);
      const g = 80 + Math.floor(n * 40);
      const r = 30 + Math.floor(n * 20);
      ctx.fillStyle = rgba(r, g, b, 0.75);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawBedrock(ctx: CanvasRenderingContext2D) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const n = hashNoise(x, y, 110);
      const v = 20 + Math.floor(n * 60);
      ctx.fillStyle = rgb(v, v, v);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawOre(ctx: CanvasRenderingContext2D, oreColor1: string, oreColor2: string) {
  drawStone(ctx);
  // Gem speckles
  const spots = [
    [3, 4], [4, 4], [4, 5], [11, 3], [12, 3],
    [7, 8], [8, 8], [8, 9], [9, 9],
    [3, 11], [4, 12], [11, 11], [12, 12], [12, 11]
  ];
  spots.forEach(([x, y], idx) => {
    ctx.fillStyle = idx % 2 === 0 ? oreColor1 : oreColor2;
    ctx.fillRect(x, y, 1, 1);
  });
}

function drawCraftingTableTop(ctx: CanvasRenderingContext2D) {
  drawPlanks(ctx);
  // Darker center grid 3x3
  ctx.fillStyle = '#4c3318';
  ctx.fillRect(2, 2, 12, 12);
  ctx.fillStyle = '#9e7543';
  ctx.fillRect(3, 3, 10, 10);
  ctx.fillStyle = '#4c3318';
  // Grid lines
  ctx.fillRect(6, 3, 1, 10);
  ctx.fillRect(9, 3, 1, 10);
  ctx.fillRect(3, 6, 10, 1);
  ctx.fillRect(3, 9, 10, 1);
}

function drawCraftingTableSide(ctx: CanvasRenderingContext2D) {
  drawPlanks(ctx);
  // Tool hanging on side
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(4, 5, 2, 6);
  ctx.fillRect(3, 6, 4, 2);
  ctx.fillStyle = '#b0b0b0';
  ctx.fillRect(4, 4, 2, 2);
}

function drawFurnaceFront(ctx: CanvasRenderingContext2D) {
  drawCobblestone(ctx);
  // Oven opening
  ctx.fillStyle = '#222222';
  ctx.fillRect(3, 6, 10, 7);
  // Grate / warm ember
  ctx.fillStyle = '#111111';
  ctx.fillRect(4, 7, 8, 5);
  ctx.fillStyle = '#404040';
  ctx.fillRect(5, 4, 6, 1);
}

function drawBricks(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#cfcfcf'; // Mortar
  ctx.fillRect(0, 0, 16, 16);
  // Brick rows
  const brickColor = '#9a4738';
  const brickDark = '#7e3528';
  for (let r = 0; r < 4; r++) {
    const y = r * 4 + 1;
    const shift = (r % 2) * 4;
    for (let c = -1; c < 3; c++) {
      const x = c * 8 + shift + 1;
      ctx.fillStyle = (r + c) % 2 === 0 ? brickColor : brickDark;
      ctx.fillRect(Math.max(0, x), y, Math.min(7, 16 - Math.max(0, x)), 3);
    }
  }
}

function drawTNTTop(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#ba2818';
  ctx.fillRect(0, 0, 16, 16);
  // Center fuse
  ctx.fillStyle = '#8a8a8a';
  ctx.fillRect(7, 7, 2, 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(7, 6, 2, 1);
}

function drawTNTSide(ctx: CanvasRenderingContext2D) {
  // Red base
  ctx.fillStyle = '#ba2818';
  ctx.fillRect(0, 0, 16, 16);
  // White middle band
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, 5, 16, 6);
  // "TNT" black lettering
  ctx.fillStyle = '#111111';
  // T
  ctx.fillRect(2, 6, 3, 1);
  ctx.fillRect(3, 7, 1, 3);
  // N
  ctx.fillRect(6, 6, 1, 4);
  ctx.fillRect(7, 7, 1, 1);
  ctx.fillRect(8, 8, 1, 1);
  ctx.fillRect(9, 6, 1, 4);
  // T
  ctx.fillRect(11, 6, 3, 1);
  ctx.fillRect(12, 7, 1, 3);
}

function drawBookshelfSide(ctx: CanvasRenderingContext2D) {
  drawPlanks(ctx);
  // Two shelves with colorful books
  const colors = ['#8a2218', '#254e85', '#247a32', '#917924', '#592978'];
  // Top shelf
  ctx.fillStyle = '#3a2312';
  ctx.fillRect(1, 2, 14, 5);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(2 + i * 2, 2, 2, 5);
    ctx.fillStyle = '#dcdcdc'; // Pages
    ctx.fillRect(2 + i * 2, 2, 2, 1);
  }
  // Bottom shelf
  ctx.fillStyle = '#3a2312';
  ctx.fillRect(1, 9, 14, 5);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = colors[(i + 2) % colors.length];
    ctx.fillRect(2 + i * 2, 9, 2, 5);
    ctx.fillStyle = '#dcdcdc'; // Pages
    ctx.fillRect(2 + i * 2, 9, 2, 1);
  }
}

function drawGlowstone(ctx: CanvasRenderingContext2D) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const n = hashNoise(x, y, 120);
      const r = 240 + Math.floor(n * 15);
      const g = 195 + Math.floor(n * 40);
      const b = 100 + Math.floor(n * 50);
      ctx.fillStyle = rgb(r, g, b);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawSnow(ctx: CanvasRenderingContext2D) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const n = hashNoise(x, y, 130);
      const v = 235 + Math.floor(n * 20);
      ctx.fillStyle = rgb(v, v, 245 + Math.floor(n * 10));
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawIce(ctx: CanvasRenderingContext2D) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const n = hashNoise(x, y, 140);
      ctx.fillStyle = rgba(145 + n * 30, 195 + n * 40, 245 + n * 10, 0.85);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawPoppy(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, 16, 16);
  // Stem
  ctx.fillStyle = '#2d6d1b';
  ctx.fillRect(7, 8, 2, 8);
  ctx.fillRect(5, 10, 2, 1);
  ctx.fillRect(9, 12, 2, 1);
  // Red flower petals
  ctx.fillStyle = '#d62020';
  ctx.fillRect(5, 4, 6, 5);
  ctx.fillStyle = '#f54545';
  ctx.fillRect(6, 3, 4, 1);
  // Dark center
  ctx.fillStyle = '#220808';
  ctx.fillRect(7, 5, 2, 2);
}

function drawDandelion(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, 16, 16);
  // Stem
  ctx.fillStyle = '#2d6d1b';
  ctx.fillRect(7, 7, 2, 9);
  // Yellow flower head
  ctx.fillStyle = '#f5c618';
  ctx.fillRect(5, 3, 6, 5);
  ctx.fillStyle = '#ffea52';
  ctx.fillRect(6, 2, 4, 1);
  ctx.fillRect(6, 4, 4, 3);
}

function drawTorch(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, 16, 16);
  // Wooden stick
  ctx.fillStyle = '#614624';
  ctx.fillRect(7, 5, 2, 10);
  // Flame
  ctx.fillStyle = '#e67300';
  ctx.fillRect(6, 2, 4, 4);
  ctx.fillStyle = '#ffcc00';
  ctx.fillRect(7, 1, 2, 3);
}

// Three.js Material and Texture Cache
const threeTextureCache = new Map<string, THREE.CanvasTexture>();

export function getThreeTexture(blockType: BlockType, face: FaceIndex): THREE.CanvasTexture {
  const key = `${blockType}_${face}`;
  if (threeTextureCache.has(key)) {
    return threeTextureCache.get(key)!;
  }
  const canvas = getBlockFaceCanvas(blockType, face);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  threeTextureCache.set(key, texture);
  return texture;
}

// Materials Cache for standard 6-sided blocks
const blockMaterialsCache = new Map<BlockType, THREE.Material[] | THREE.Material>();

export function getBlockMaterial(blockType: BlockType): THREE.Material[] | THREE.Material {
  if (blockMaterialsCache.has(blockType)) {
    return blockMaterialsCache.get(blockType)!;
  }

  const isTransparent =
    blockType === BlockType.GLASS ||
    blockType === BlockType.WATER ||
    blockType === BlockType.ICE ||
    blockType === BlockType.OAK_LEAVES;

  const materials: THREE.Material[] = [];
  // Three.js BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z
  for (let face = 0; face < 6; face++) {
    const texture = getThreeTexture(blockType, face as FaceIndex);
    const mat = new THREE.MeshLambertMaterial({
      map: texture,
      transparent: isTransparent,
      opacity: blockType === BlockType.WATER ? 0.75 : blockType === BlockType.ICE ? 0.85 : 1.0,
      alphaTest: blockType === BlockType.OAK_LEAVES ? 0.2 : blockType === BlockType.GLASS ? 0.1 : 0,
      side: blockType === BlockType.WATER ? THREE.DoubleSide : THREE.FrontSide,
    });
    materials.push(mat);
  }

  blockMaterialsCache.set(blockType, materials);
  return materials;
}

// Helper to get an icon data URL for UI hotbar & inventory
const iconCache = new Map<BlockType | string, string>();

export function getItemIconDataUrl(itemKey: BlockType | string): string {
  if (iconCache.has(itemKey)) {
    return iconCache.get(itemKey)!;
  }

  // Draw 32x32 isometric preview or flat canvas
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  if (typeof itemKey === 'number') {
    // Block: Render front or top face
    const faceCanvas = getBlockFaceCanvas(itemKey, 4);
    ctx.drawImage(faceCanvas, 2, 2, 28, 28);
  } else {
    // Tool or item: Draw tool pixel art
    drawToolIcon(ctx, itemKey);
  }

  const dataUrl = canvas.toDataURL();
  iconCache.set(itemKey, dataUrl);
  return dataUrl;
}

function drawToolIcon(ctx: CanvasRenderingContext2D, toolKey: string) {
  let headColor = '#dcdcdc'; // Iron default
  if (toolKey.includes('diamond')) headColor = '#5ff5eb';
  if (toolKey.includes('gold')) headColor = '#ffdc3c';
  if (toolKey.includes('wood')) headColor = '#9a6b38';
  if (toolKey.includes('stone')) headColor = '#808080';

  const stickColor = '#5c3a1b';

  // Stick handle diagonal
  ctx.fillStyle = stickColor;
  for (let i = 0; i < 14; i++) {
    ctx.fillRect(8 + i, 22 - i, 2, 2);
  }

  // Tool head
  ctx.fillStyle = headColor;
  if (toolKey.includes('pickaxe')) {
    ctx.fillRect(16, 6, 12, 3);
    ctx.fillRect(20, 9, 6, 2);
    ctx.fillRect(25, 4, 4, 3);
  } else if (toolKey.includes('sword')) {
    // Blade
    for (let i = 0; i < 12; i++) {
      ctx.fillRect(14 + i, 16 - i, 3, 3);
    }
    // Guard
    ctx.fillStyle = '#3a200b';
    ctx.fillRect(11, 18, 5, 2);
    ctx.fillRect(13, 16, 2, 5);
  } else if (toolKey.includes('axe')) {
    ctx.fillRect(18, 6, 8, 8);
    ctx.fillRect(16, 8, 10, 4);
  } else {
    // Generic ingot or item
    ctx.fillRect(6, 10, 20, 12);
  }
}
