import * as THREE from 'three';
import { BlockType, BiomeType, WorldConfig } from '../types/game';
import { getBlockUV, getAtlasTexture } from './atlas';
import { FaceIndex } from './textures';

export const CHUNK_SIZE_X = 16;
export const CHUNK_SIZE_Z = 16;
export const CHUNK_HEIGHT = 48;
export const SEA_LEVEL = 12;

// Simple 2D Perlin/Simplex-style pseudo-random smooth noise
function pseudoNoise(x: number, z: number, seed: number): number {
  const n1 = Math.sin(x * 0.05 + seed) * Math.cos(z * 0.05 + seed * 1.3);
  const n2 = Math.sin(x * 0.12 - seed * 0.7) * Math.cos(z * 0.12 + seed * 0.4) * 0.5;
  const n3 = Math.sin(x * 0.25 + seed * 2.1) * Math.cos(z * 0.25 - seed * 1.5) * 0.25;
  return (n1 + n2 + n3) / 1.75;
}

// Check if block type is transparent
export function isBlockTransparent(type: BlockType): boolean {
  return (
    type === BlockType.AIR ||
    type === BlockType.GLASS ||
    type === BlockType.WATER ||
    type === BlockType.ICE ||
    type === BlockType.OAK_LEAVES ||
    type === BlockType.POPPY ||
    type === BlockType.DANDELION ||
    type === BlockType.TORCH
  );
}

// Check if block is solid for player physics
export function isBlockSolid(type: BlockType): boolean {
  return (
    type !== BlockType.AIR &&
    type !== BlockType.WATER &&
    type !== BlockType.POPPY &&
    type !== BlockType.DANDELION &&
    type !== BlockType.TORCH
  );
}

export interface ChunkKey {
  cx: number;
  cz: number;
}

export class Chunk {
  public cx: number;
  public cz: number;
  public blocks: Uint8Array;
  public opaqueMesh: THREE.Mesh | null = null;
  public transparentMesh: THREE.Mesh | null = null;
  public isDirty: boolean = true;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(CHUNK_SIZE_X * CHUNK_HEIGHT * CHUNK_SIZE_Z);
  }

  public getIndex(lx: number, ly: number, lz: number): number {
    return lx + lz * CHUNK_SIZE_X + ly * CHUNK_SIZE_X * CHUNK_SIZE_Z;
  }

  public getBlock(lx: number, ly: number, lz: number): BlockType {
    if (lx < 0 || lx >= CHUNK_SIZE_X || ly < 0 || ly >= CHUNK_HEIGHT || lz < 0 || lz >= CHUNK_SIZE_Z) {
      return BlockType.AIR;
    }
    return this.blocks[this.getIndex(lx, ly, lz)] as BlockType;
  }

  public setBlock(lx: number, ly: number, lz: number, type: BlockType) {
    if (lx < 0 || lx >= CHUNK_SIZE_X || ly < 0 || ly >= CHUNK_HEIGHT || lz < 0 || lz >= CHUNK_SIZE_Z) {
      return;
    }
    this.blocks[this.getIndex(lx, ly, lz)] = type;
    this.isDirty = true;
  }
}

export class VoxelWorld {
  public chunks = new Map<string, Chunk>();
  public scene: THREE.Scene;
  public config: WorldConfig;
  public opaqueMaterial: THREE.MeshLambertMaterial;
  public transparentMaterial: THREE.MeshLambertMaterial;
  public torchLights: THREE.PointLight[] = [];

  constructor(scene: THREE.Scene, config: WorldConfig) {
    this.scene = scene;
    this.config = config;

    const atlasTexture = getAtlasTexture();

    this.opaqueMaterial = new THREE.MeshLambertMaterial({
      map: atlasTexture,
      vertexColors: true,
      side: THREE.FrontSide,
    });

    this.transparentMaterial = new THREE.MeshLambertMaterial({
      map: atlasTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      alphaTest: 0.15,
      side: THREE.DoubleSide,
    });

    this.initWorld();
  }

  public getChunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  public getChunk(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(this.getChunkKey(cx, cz));
  }

  public getOrCreateChunk(cx: number, cz: number): Chunk {
    const key = this.getChunkKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Chunk(cx, cz);
      this.chunks.set(key, chunk);
      this.generateChunkTerrain(chunk);
    }
    return chunk;
  }

  public initWorld() {
    const radius = this.config.chunkRadius || 3;
    for (let cx = -radius; cx <= radius; cx++) {
      for (let cz = -radius; cz <= radius; cz++) {
        this.getOrCreateChunk(cx, cz);
      }
    }
    // Build meshes for all chunks
    for (const chunk of this.chunks.values()) {
      this.buildChunkMesh(chunk);
    }
  }

  private generateChunkTerrain(chunk: Chunk) {
    const { cx, cz } = chunk;
    const seed = this.config.seed;
    const biome = this.config.biome;

    if (biome === 'superflat') {
      for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
          chunk.setBlock(lx, 0, lz, BlockType.BEDROCK);
          chunk.setBlock(lx, 1, lz, BlockType.DIRT);
          chunk.setBlock(lx, 2, lz, BlockType.DIRT);
          chunk.setBlock(lx, 3, lz, BlockType.GRASS);
        }
      }
      return;
    }

    const worldStartX = cx * CHUNK_SIZE_X;
    const worldStartZ = cz * CHUNK_SIZE_Z;

    // Height and block population
    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      const wx = worldStartX + lx;
      for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
        const wz = worldStartZ + lz;

        // Base height calculation depending on biome
        let baseHeight = 16;
        let amp = 6;
        if (biome === 'mountains') {
          baseHeight = 20;
          amp = 14;
        } else if (biome === 'desert') {
          baseHeight = 15;
          amp = 4;
        }

        const noiseVal = pseudoNoise(wx, wz, seed);
        const surfaceHeight = Math.max(3, Math.min(CHUNK_HEIGHT - 6, Math.floor(baseHeight + noiseVal * amp)));

        // Bedrock at bottom
        chunk.setBlock(lx, 0, lz, BlockType.BEDROCK);

        // Subsurface stone & ores
        for (let y = 1; y < surfaceHeight - 3; y++) {
          // Ore generation
          const oreNoise = pseudoNoise(wx * 2 + y, wz * 2 - y, seed + 100);
          if (y < 10 && oreNoise > 0.42) {
            chunk.setBlock(lx, y, lz, BlockType.DIAMOND_ORE);
          } else if (y < 16 && oreNoise > 0.35) {
            chunk.setBlock(lx, y, lz, BlockType.GOLD_ORE);
          } else if (y < 22 && oreNoise > 0.28) {
            chunk.setBlock(lx, y, lz, BlockType.REDSTONE_ORE);
          } else if (oreNoise > 0.2) {
            chunk.setBlock(lx, y, lz, BlockType.IRON_ORE);
          } else if (oreNoise < -0.25) {
            chunk.setBlock(lx, y, lz, BlockType.COAL_ORE);
          } else {
            chunk.setBlock(lx, y, lz, BlockType.STONE);
          }
        }

        // Subsurface dirt (or sand in desert)
        for (let y = Math.max(1, surfaceHeight - 3); y < surfaceHeight; y++) {
          chunk.setBlock(lx, y, lz, biome === 'desert' ? BlockType.SAND : BlockType.DIRT);
        }

        // Surface block
        if (surfaceHeight < SEA_LEVEL) {
          // Under water lake bed is sand or dirt
          chunk.setBlock(lx, surfaceHeight, lz, BlockType.SAND);
          // Fill water up to sea level
          for (let y = surfaceHeight + 1; y <= SEA_LEVEL; y++) {
            chunk.setBlock(lx, y, lz, BlockType.WATER);
          }
        } else {
          if (biome === 'desert') {
            chunk.setBlock(lx, surfaceHeight, lz, BlockType.SAND);
          } else if (biome === 'snow') {
            chunk.setBlock(lx, surfaceHeight, lz, BlockType.SNOW);
          } else {
            chunk.setBlock(lx, surfaceHeight, lz, BlockType.GRASS);
          }

          // Foliage & decorations on land
          const decorNoise = pseudoNoise(wx * 3, wz * 3, seed + 50);
          if (biome === 'plains' || biome === 'mountains') {
            if (decorNoise > 0.35 && decorNoise < 0.38) {
              chunk.setBlock(lx, surfaceHeight + 1, lz, BlockType.POPPY);
            } else if (decorNoise > 0.38 && decorNoise < 0.41) {
              chunk.setBlock(lx, surfaceHeight + 1, lz, BlockType.DANDELION);
            }
          }
        }
      }
    }

    // Tree generation for plains or snow biome
    if (biome === 'plains' || biome === 'snow') {
      const treeNoise = pseudoNoise(cx * 10, cz * 10, seed + 77);
      if (treeNoise > 0.1) {
        // Plant 1-2 trees in this chunk
        const treeX = Math.floor(4 + ((Math.abs(cx * 7) + 3) % 8));
        const treeZ = Math.floor(4 + ((Math.abs(cz * 11) + 5) % 8));

        // Find surface y
        let surfaceY = 0;
        for (let y = CHUNK_HEIGHT - 7; y >= 2; y--) {
          const b = chunk.getBlock(treeX, y, treeZ);
          if (b === BlockType.GRASS || b === BlockType.SNOW || b === BlockType.DIRT) {
            surfaceY = y;
            break;
          }
        }

        if (surfaceY > SEA_LEVEL) {
          // Tree trunk (4 blocks high)
          for (let ty = 1; ty <= 4; ty++) {
            chunk.setBlock(treeX, surfaceY + ty, treeZ, BlockType.OAK_LOG);
          }

          // Leaves canopy (5x5 on bottom 2 layers, 3x3 on top)
          const leavesY = surfaceY + 3;
          for (let dy = 0; dy <= 2; dy++) {
            const rad = dy === 2 ? 1 : 2;
            for (let dx = -rad; dx <= rad; dx++) {
              for (let dz = -rad; dz <= rad; dz++) {
                if (dy === 2 && Math.abs(dx) === 1 && Math.abs(dz) === 1) continue; // round corners
                const cur = chunk.getBlock(treeX + dx, leavesY + dy, treeZ + dz);
                if (cur === BlockType.AIR) {
                  chunk.setBlock(treeX + dx, leavesY + dy, treeZ + dz, BlockType.OAK_LEAVES);
                }
              }
            }
          }
        }
      }
    }
  }

  // Global block getter
  public getBlock(wx: number, wy: number, wz: number): BlockType {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return BlockType.AIR;
    const cx = Math.floor(wx / CHUNK_SIZE_X);
    const cz = Math.floor(wz / CHUNK_SIZE_Z);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return BlockType.AIR;

    let lx = wx % CHUNK_SIZE_X;
    if (lx < 0) lx += CHUNK_SIZE_X;
    let lz = wz % CHUNK_SIZE_Z;
    if (lz < 0) lz += CHUNK_SIZE_Z;

    return chunk.getBlock(lx, wy, lz);
  }

  // Global block setter with chunk boundary awareness
  public setBlock(wx: number, wy: number, wz: number, type: BlockType) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return;
    const cx = Math.floor(wx / CHUNK_SIZE_X);
    const cz = Math.floor(wz / CHUNK_SIZE_Z);
    const chunk = this.getOrCreateChunk(cx, cz);

    let lx = wx % CHUNK_SIZE_X;
    if (lx < 0) lx += CHUNK_SIZE_X;
    let lz = wz % CHUNK_SIZE_Z;
    if (lz < 0) lz += CHUNK_SIZE_Z;

    chunk.setBlock(lx, wy, lz, type);
    this.buildChunkMesh(chunk);

    // If on boundary, update neighbor chunk mesh too
    if (lx === 0) {
      const neighbor = this.getChunk(cx - 1, cz);
      if (neighbor) this.buildChunkMesh(neighbor);
    } else if (lx === CHUNK_SIZE_X - 1) {
      const neighbor = this.getChunk(cx + 1, cz);
      if (neighbor) this.buildChunkMesh(neighbor);
    }

    if (lz === 0) {
      const neighbor = this.getChunk(cx, cz - 1);
      if (neighbor) this.buildChunkMesh(neighbor);
    } else if (lz === CHUNK_SIZE_Z - 1) {
      const neighbor = this.getChunk(cx, cz + 1);
      if (neighbor) this.buildChunkMesh(neighbor);
    }
  }

  // High performance face-culled mesh builder for a single chunk
  public buildChunkMesh(chunk: Chunk) {
    const { cx, cz } = chunk;
    const worldStartX = cx * CHUNK_SIZE_X;
    const worldStartZ = cz * CHUNK_SIZE_Z;

    // Separate opaque and transparent geometry arrays
    const opaquePositions: number[] = [];
    const opaqueNormals: number[] = [];
    const opaqueUVs: number[] = [];
    const opaqueColors: number[] = [];

    const transPositions: number[] = [];
    const transNormals: number[] = [];
    const transUVs: number[] = [];
    const transColors: number[] = [];

    // Face definitions: normal, vertices, faceIndex, lightMultiplier
    const faces = [
      // 0: +X (Right)
      {
        normal: [1, 0, 0],
        verts: [
          [1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1],
        ],
        faceIdx: 0 as FaceIndex,
        light: 0.65,
      },
      // 1: -X (Left)
      {
        normal: [-1, 0, 0],
        verts: [
          [0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0],
        ],
        faceIdx: 1 as FaceIndex,
        light: 0.65,
      },
      // 2: +Y (Top)
      {
        normal: [0, 1, 0],
        verts: [
          [0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0],
        ],
        faceIdx: 2 as FaceIndex,
        light: 1.0,
      },
      // 3: -Y (Bottom)
      {
        normal: [0, -1, 0],
        verts: [
          [0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1],
        ],
        faceIdx: 3 as FaceIndex,
        light: 0.5,
      },
      // 4: +Z (Front)
      {
        normal: [0, 0, 1],
        verts: [
          [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
        ],
        faceIdx: 4 as FaceIndex,
        light: 0.82,
      },
      // 5: -Z (Back)
      {
        normal: [0, 0, -1],
        verts: [
          [1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0],
        ],
        faceIdx: 5 as FaceIndex,
        light: 0.82,
      },
    ];

    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      const wx = worldStartX + lx;
      for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
        const wz = worldStartZ + lz;
        for (let wy = 0; wy < CHUNK_HEIGHT; wy++) {
          const block = chunk.getBlock(lx, wy, lz);
          if (block === BlockType.AIR) continue;

          // Cross-model sprites for flowers and torches
          if (block === BlockType.POPPY || block === BlockType.DANDELION || block === BlockType.TORCH) {
            this.addCrossGeometry(
              block,
              wx, wy, wz,
              transPositions, transNormals, transUVs, transColors
            );
            continue;
          }

          const isBlockTrans = isBlockTransparent(block);

          for (const f of faces) {
            const nx = wx + f.normal[0];
            const ny = wy + f.normal[1];
            const nz = wz + f.normal[2];

            const neighbor = this.getBlock(nx, ny, nz);
            const neighborTrans = isBlockTransparent(neighbor);

            // Face is rendered if neighbor is transparent, or if neighbor is air,
            // or if both are transparent but different (e.g. water next to air, but not water next to water)
            let renderFace = false;
            if (neighbor === BlockType.AIR) {
              renderFace = true;
            } else if (isBlockTrans && !neighborTrans) {
              renderFace = false;
            } else if (!isBlockTrans && neighborTrans) {
              renderFace = true;
            } else if (isBlockTrans && neighborTrans && block !== neighbor) {
              renderFace = true;
            }

            if (!renderFace) continue;

            const targetPos = isBlockTrans ? transPositions : opaquePositions;
            const targetNorm = isBlockTrans ? transNormals : opaqueNormals;
            const targetUV = isBlockTrans ? transUVs : opaqueUVs;
            const targetCol = isBlockTrans ? transColors : opaqueColors;

            const uv = getBlockUV(block, f.faceIdx);
            const l = f.light;

            // Two triangles for the quad (0, 1, 2) and (0, 2, 3)
            const v = f.verts;
            const quadIndices = [0, 1, 2, 0, 2, 3];
            const uvCoords = [
              [uv.u0, uv.v0],
              [uv.u1, uv.v0],
              [uv.u1, uv.v1],
              [uv.u0, uv.v1],
            ];

            for (const idx of quadIndices) {
              const vert = v[idx];
              targetPos.push(wx + vert[0], wy + vert[1], wz + vert[2]);
              targetNorm.push(f.normal[0], f.normal[1], f.normal[2]);
              targetUV.push(uvCoords[idx][0], uvCoords[idx][1]);
              targetCol.push(l, l, l);
            }
          }
        }
      }
    }

    // Update Opaque Mesh
    if (chunk.opaqueMesh) {
      this.scene.remove(chunk.opaqueMesh);
      chunk.opaqueMesh.geometry.dispose();
      chunk.opaqueMesh = null;
    }
    if (opaquePositions.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(opaquePositions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(opaqueNormals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(opaqueUVs, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(opaqueColors, 3));
      chunk.opaqueMesh = new THREE.Mesh(geo, this.opaqueMaterial);
      chunk.opaqueMesh.castShadow = true;
      chunk.opaqueMesh.receiveShadow = true;
      this.scene.add(chunk.opaqueMesh);
    }

    // Update Transparent Mesh
    if (chunk.transparentMesh) {
      this.scene.remove(chunk.transparentMesh);
      chunk.transparentMesh.geometry.dispose();
      chunk.transparentMesh = null;
    }
    if (transPositions.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(transPositions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(transNormals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(transUVs, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(transColors, 3));
      chunk.transparentMesh = new THREE.Mesh(geo, this.transparentMaterial);
      this.scene.add(chunk.transparentMesh);
    }

    chunk.isDirty = false;
  }

  // Cross-quad sprite for flowers & torches (X shape)
  private addCrossGeometry(
    block: BlockType,
    wx: number, wy: number, wz: number,
    positions: number[], normals: number[], uvs: number[], colors: number[]
  ) {
    const uv = getBlockUV(block, 4 as FaceIndex);
    const quads = [
      // Diagonal 1
      [[0, 0, 0], [1, 0, 1], [1, 1, 1], [0, 1, 0]],
      // Diagonal 2
      [[0, 0, 1], [1, 0, 0], [1, 1, 0], [0, 1, 1]],
    ];

    for (const quad of quads) {
      const quadIndices = [0, 1, 2, 0, 2, 3];
      const uvCoords = [
        [uv.u0, uv.v0],
        [uv.u1, uv.v0],
        [uv.u1, uv.v1],
        [uv.u0, uv.v1],
      ];
      for (const idx of quadIndices) {
        const v = quad[idx];
        positions.push(wx + v[0], wy + v[1], wz + v[2]);
        normals.push(0, 1, 0);
        uvs.push(uvCoords[idx][0], uvCoords[idx][1]);
        colors.push(0.9, 0.9, 0.9);
      }
    }
  }

  // Raycast against voxel grid to find targeted block and face normal
  public raycastBlock(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance = 6
  ): { hit: boolean; block: BlockType; blockPos: THREE.Vector3; normal: THREE.Vector3; distance: number } | null {
    const step = 0.05;
    const curPos = origin.clone();
    const prevPos = origin.clone();

    for (let d = 0; d < maxDistance; d += step) {
      curPos.addScaledVector(direction, step);
      const bx = Math.floor(curPos.x);
      const by = Math.floor(curPos.y);
      const bz = Math.floor(curPos.z);

      const block = this.getBlock(bx, by, bz);
      if (block !== BlockType.AIR && block !== BlockType.WATER) {
        // Compute normal from previous step
        const pbx = Math.floor(prevPos.x);
        const pby = Math.floor(prevPos.y);
        const pbz = Math.floor(prevPos.z);

        const normal = new THREE.Vector3(pbx - bx, pby - by, pbz - bz);
        // Normalize to cardinal axis
        if (normal.lengthSq() === 0) {
          normal.set(0, 1, 0);
        } else {
          // If diagonal, pick the largest axis difference
          const ax = Math.abs(prevPos.x - (bx + 0.5));
          const ay = Math.abs(prevPos.y - (by + 0.5));
          const az = Math.abs(prevPos.z - (bz + 0.5));
          if (ax >= ay && ax >= az) {
            normal.set(prevPos.x > bx + 0.5 ? 1 : -1, 0, 0);
          } else if (ay >= ax && ay >= az) {
            normal.set(0, prevPos.y > by + 0.5 ? 1 : -1, 0);
          } else {
            normal.set(0, 0, prevPos.z > bz + 0.5 ? 1 : -1);
          }
        }

        return {
          hit: true,
          block,
          blockPos: new THREE.Vector3(bx, by, bz),
          normal,
          distance: d,
        };
      }
      prevPos.copy(curPos);
    }

    return null;
  }

  public dispose() {
    for (const chunk of this.chunks.values()) {
      if (chunk.opaqueMesh) {
        this.scene.remove(chunk.opaqueMesh);
        chunk.opaqueMesh.geometry.dispose();
      }
      if (chunk.transparentMesh) {
        this.scene.remove(chunk.transparentMesh);
        chunk.transparentMesh.geometry.dispose();
      }
    }
    this.chunks.clear();
    this.opaqueMaterial.dispose();
    this.transparentMaterial.dispose();
  }
}
