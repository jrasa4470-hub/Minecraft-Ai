import * as THREE from 'three';
import { BlockType, MobEntity, DroppedItemEntity, PrimedTNTEntity, Particle } from '../types/game';
import { VoxelWorld, isBlockSolid } from './world';
import { getBlockMaterial } from './textures';
import { audio } from './audio';

export class EntityManager {
  public scene: THREE.Scene;
  public world: VoxelWorld;

  public droppedItems: DroppedItemEntity[] = [];
  public droppedItemMeshes = new Map<string, THREE.Mesh>();

  public mobs: MobEntity[] = [];
  public mobGroups = new Map<string, THREE.Group>();

  public primedTNTs: PrimedTNTEntity[] = [];
  public tntMeshes = new Map<string, THREE.Mesh>();

  public particles: Particle[] = [];
  public particleInstancedMesh: THREE.InstancedMesh | null = null;
  private maxParticles = 600;
  private particleDummy = new THREE.Object3D();

  constructor(scene: THREE.Scene, world: VoxelWorld) {
    this.scene = scene;
    this.world = world;
    this.initParticleSystem();
    this.spawnInitialMobs();
  }

  private initParticleSystem() {
    const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleInstancedMesh = new THREE.InstancedMesh(geo, mat, this.maxParticles);
    this.particleInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.particleInstancedMesh);
  }

  // Spawn initial passive & fun mobs near world center
  private spawnInitialMobs() {
    this.spawnMob('sheep', 3, 20, 3);
    this.spawnMob('pig', -4, 20, 2);
    this.spawnMob('sheep', -2, 20, -5);
    this.spawnMob('creeper', 7, 20, -6);
  }

  // --- Dropped Items ---
  public spawnDroppedItem(blockType: BlockType, x: number, y: number, z: number) {
    const id = `item_${Date.now()}_${Math.random()}`;
    const item: DroppedItemEntity = {
      id,
      blockType,
      x: x + 0.5,
      y: y + 0.5,
      z: z + 0.5,
      vx: (Math.random() - 0.5) * 2.0,
      vy: 3.5 + Math.random() * 1.5,
      vz: (Math.random() - 0.5) * 2.0,
      age: 0,
    };
    this.droppedItems.push(item);

    // Create mini 3D block mesh
    const geo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
    const mat = getBlockMaterial(blockType);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(item.x, item.y, item.z);
    this.scene.add(mesh);
    this.droppedItemMeshes.set(id, mesh);
  }

  // --- Primed TNT ---
  public spawnPrimedTNT(x: number, y: number, z: number) {
    const id = `tnt_${Date.now()}_${Math.random()}`;
    const tnt: PrimedTNTEntity = {
      id,
      x: x + 0.5,
      y: y + 0.5,
      z: z + 0.5,
      vx: (Math.random() - 0.5) * 1.5,
      vy: 4.0,
      vz: (Math.random() - 0.5) * 1.5,
      fuse: 70, // ~3.5 seconds
    };
    this.primedTNTs.push(tnt);

    const geo = new THREE.BoxGeometry(0.98, 0.98, 0.98);
    const mat = getBlockMaterial(BlockType.TNT);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(tnt.x, tnt.y, tnt.z);
    this.scene.add(mesh);
    this.tntMeshes.set(id, mesh);

    audio.playTNTFuse();
  }

  // --- Mobs ---
  public spawnMob(type: 'sheep' | 'pig' | 'creeper', x: number, y: number, z: number) {
    const id = `mob_${type}_${Date.now()}_${Math.random()}`;
    const mob: MobEntity = {
      id,
      type,
      x,
      y,
      z,
      yaw: Math.random() * Math.PI * 2,
      vx: 0,
      vy: 0,
      vz: 0,
      health: type === 'creeper' ? 20 : 10,
      maxHealth: type === 'creeper' ? 20 : 10,
      walkTimer: 0,
      isHurt: 0,
      explodeTimer: type === 'creeper' ? 0 : undefined,
    };
    this.mobs.push(mob);

    const group = new THREE.Group();
    group.position.set(x, y, z);

    if (type === 'sheep') {
      this.buildSheepModel(group);
    } else if (type === 'pig') {
      this.buildPigModel(group);
    } else if (type === 'creeper') {
      this.buildCreeperModel(group);
    }

    this.scene.add(group);
    this.mobGroups.set(id, group);
  }

  private buildSheepModel(group: THREE.Group) {
    // Wool body
    const bodyGeo = new THREE.BoxGeometry(0.8, 0.7, 1.1);
    const woolMat = new THREE.MeshLambertMaterial({ color: 0xefefef });
    const body = new THREE.Mesh(bodyGeo, woolMat);
    body.position.set(0, 0.75, 0);
    group.add(body);

    // Head
    const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.5);
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xe5c5a0 });
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, 1.05, 0.65);
    group.add(head);

    // 4 Legs
    const legGeo = new THREE.BoxGeometry(0.2, 0.5, 0.2);
    const legMat = new THREE.MeshLambertMaterial({ color: 0xdfcfb8 });
    const legPositions = [
      [-0.25, 0.25, 0.35],
      [0.25, 0.25, 0.35],
      [-0.25, 0.25, -0.35],
      [0.25, 0.25, -0.35],
    ];
    legPositions.forEach((pos, idx) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(pos[0], pos[1], pos[2]);
      leg.name = `leg_${idx}`;
      group.add(leg);
    });
  }

  private buildPigModel(group: THREE.Group) {
    // Pink body
    const bodyGeo = new THREE.BoxGeometry(0.7, 0.6, 1.0);
    const pigMat = new THREE.MeshLambertMaterial({ color: 0xf5a5a0 });
    const body = new THREE.Mesh(bodyGeo, pigMat);
    body.position.set(0, 0.65, 0);
    group.add(body);

    // Head
    const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
    const head = new THREE.Mesh(headGeo, pigMat);
    head.position.set(0, 0.85, 0.6);
    group.add(head);

    // Snout
    const snoutGeo = new THREE.BoxGeometry(0.25, 0.15, 0.1);
    const snoutMat = new THREE.MeshLambertMaterial({ color: 0xeb8282 });
    const snout = new THREE.Mesh(snoutGeo, snoutMat);
    snout.position.set(0, 0.8, 0.85);
    group.add(snout);

    // 4 Legs
    const legGeo = new THREE.BoxGeometry(0.2, 0.4, 0.2);
    const legPositions = [
      [-0.22, 0.2, 0.3],
      [0.22, 0.2, 0.3],
      [-0.22, 0.2, -0.3],
      [0.22, 0.2, -0.3],
    ];
    legPositions.forEach((pos, idx) => {
      const leg = new THREE.Mesh(legGeo, pigMat);
      leg.position.set(pos[0], pos[1], pos[2]);
      leg.name = `leg_${idx}`;
      group.add(leg);
    });
  }

  private buildCreeperModel(group: THREE.Group) {
    // Green tall body
    const bodyGeo = new THREE.BoxGeometry(0.45, 0.8, 0.3);
    const creeperMat = new THREE.MeshLambertMaterial({ color: 0x3ab33a });
    const body = new THREE.Mesh(bodyGeo, creeperMat);
    body.position.set(0, 0.75, 0);
    group.add(body);

    // Head
    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const head = new THREE.Mesh(headGeo, creeperMat);
    head.position.set(0, 1.35, 0);
    group.add(head);

    // 4 Feet
    const footGeo = new THREE.BoxGeometry(0.2, 0.35, 0.2);
    const footPositions = [
      [-0.18, 0.17, 0.15],
      [0.18, 0.17, 0.15],
      [-0.18, 0.17, -0.15],
      [0.18, 0.17, -0.15],
    ];
    footPositions.forEach((pos, idx) => {
      const foot = new THREE.Mesh(footGeo, creeperMat);
      foot.position.set(pos[0], pos[1], pos[2]);
      foot.name = `leg_${idx}`;
      group.add(foot);
    });
  }

  // --- Particle Effects ---
  public spawnBlockBreakParticles(blockType: BlockType, x: number, y: number, z: number) {
    // Pick average color based on block type
    let color = 0x888888;
    if (blockType === BlockType.GRASS) color = 0x5a9e32;
    if (blockType === BlockType.DIRT) color = 0x865935;
    if (blockType === BlockType.OAK_LOG || blockType === BlockType.OAK_PLANKS) color = 0xa37542;
    if (blockType === BlockType.OAK_LEAVES) color = 0x387820;
    if (blockType === BlockType.SAND) color = 0xdbca88;
    if (blockType === BlockType.DIAMOND_ORE) color = 0x5ff5eb;
    if (blockType === BlockType.GOLD_ORE) color = 0xffdc3c;
    if (blockType === BlockType.REDSTONE_ORE) color = 0xe62020;
    if (blockType === BlockType.TNT) color = 0xba2818;

    for (let i = 0; i < 18; i++) {
      if (this.particles.length >= this.maxParticles) break;
      this.particles.push({
        x: x + 0.2 + Math.random() * 0.6,
        y: y + 0.2 + Math.random() * 0.6,
        z: z + 0.2 + Math.random() * 0.6,
        vx: (Math.random() - 0.5) * 3.5,
        vy: 1.5 + Math.random() * 3.0,
        vz: (Math.random() - 0.5) * 3.5,
        color,
        size: 0.08 + Math.random() * 0.06,
        life: 0.8 + Math.random() * 0.4,
        maxLife: 1.2,
      });
    }
  }

  public spawnExplosionParticles(x: number, y: number, z: number) {
    for (let i = 0; i < 60; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const angle = Math.random() * Math.PI * 2;
      const pitch = (Math.random() - 0.5) * Math.PI;
      const speed = 4 + Math.random() * 9;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 0.5,
        y: y + (Math.random() - 0.5) * 0.5,
        z: z + (Math.random() - 0.5) * 0.5,
        vx: Math.cos(angle) * Math.cos(pitch) * speed,
        vy: Math.sin(pitch) * speed + 3,
        vz: Math.sin(angle) * Math.cos(pitch) * speed,
        color: Math.random() > 0.4 ? 0xff6600 : 0x444444,
        size: 0.15 + Math.random() * 0.15,
        life: 1.0 + Math.random() * 0.5,
        maxLife: 1.5,
      });
    }
  }

  // --- Main Update Loop ---
  public update(
    delta: number,
    playerPos: THREE.Vector3,
    onPickupItem: (blockType: BlockType) => void,
    onDamagePlayer?: (amount: number) => void
  ) {
    const dt = Math.min(delta, 0.05);

    // 1. Update Dropped Items
    for (let i = this.droppedItems.length - 1; i >= 0; i--) {
      const item = this.droppedItems[i];
      const mesh = this.droppedItemMeshes.get(item.id);
      item.age += dt;

      // Magnetism toward player
      const dx = playerPos.x - item.x;
      const dy = (playerPos.y + 0.8) - item.y;
      const dz = playerPos.z - item.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < 1.4 * 1.4) {
        // Collect!
        audio.playItemPop();
        onPickupItem(item.blockType);
        if (mesh) {
          this.scene.remove(mesh);
          mesh.geometry.dispose();
        }
        this.droppedItemMeshes.delete(item.id);
        this.droppedItems.splice(i, 1);
        continue;
      } else if (distSq < 3.5 * 3.5) {
        // Fly towards player
        item.vx += dx * 8.0 * dt;
        item.vy += dy * 8.0 * dt;
        item.vz += dz * 8.0 * dt;
      } else {
        // Gravity & ground collision
        item.vy -= 18.0 * dt;
        const groundY = Math.floor(item.y);
        const blockBelow = this.world.getBlock(Math.floor(item.x), groundY, Math.floor(item.z));
        if (isBlockSolid(blockBelow) && item.y - groundY <= 1.15) {
          item.y = groundY + 1.15;
          item.vy = 0;
          item.vx *= 0.8;
          item.vz *= 0.8;
        }
      }

      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.z += item.vz * dt;

      if (mesh) {
        mesh.position.set(item.x, item.y + Math.sin(item.age * 4) * 0.08, item.z);
        mesh.rotation.y += dt * 2.5;
      }
    }

    // 2. Update Primed TNTs
    for (let i = this.primedTNTs.length - 1; i >= 0; i--) {
      const tnt = this.primedTNTs[i];
      const mesh = this.tntMeshes.get(tnt.id);
      tnt.fuse--;

      tnt.vy -= 20.0 * dt;
      tnt.x += tnt.vx * dt;
      tnt.y += tnt.vy * dt;
      tnt.z += tnt.vz * dt;

      // Ground collision
      const groundY = Math.floor(tnt.y);
      const bBelow = this.world.getBlock(Math.floor(tnt.x), groundY, Math.floor(tnt.z));
      if (isBlockSolid(bBelow) && tnt.y - groundY <= 0.6) {
        tnt.y = groundY + 0.5;
        tnt.vy = 0;
        tnt.vx *= 0.7;
        tnt.vz *= 0.7;
      }

      if (mesh) {
        mesh.position.set(tnt.x, tnt.y, tnt.z);
        // Flash scale & color when fuse is low
        const flash = Math.sin(tnt.fuse * 0.8) > 0;
        const s = 1.0 + (flash ? 0.08 : 0);
        mesh.scale.set(s, s, s);
      }

      // Detonate!
      if (tnt.fuse <= 0) {
        audio.playExplosion();
        this.spawnExplosionParticles(tnt.x, tnt.y, tnt.z);

        // Crater explosion: destroy blocks in radius 3.5
        const blastRadius = 3.5;
        const bx0 = Math.floor(tnt.x - blastRadius);
        const bx1 = Math.floor(tnt.x + blastRadius);
        const by0 = Math.floor(tnt.y - blastRadius);
        const by1 = Math.floor(tnt.y + blastRadius);
        const bz0 = Math.floor(tnt.z - blastRadius);
        const bz1 = Math.floor(tnt.z + blastRadius);

        for (let bx = bx0; bx <= bx1; bx++) {
          for (let by = by0; by <= by1; by++) {
            for (let bz = bz0; bz <= bz1; bz++) {
              const dSq = (bx - tnt.x) ** 2 + (by - tnt.y) ** 2 + (bz - tnt.z) ** 2;
              if (dSq <= blastRadius * blastRadius) {
                const b = this.world.getBlock(bx, by, bz);
                if (b !== BlockType.AIR && b !== BlockType.BEDROCK) {
                  this.world.setBlock(bx, by, bz, BlockType.AIR);
                  if (Math.random() < 0.35) {
                    this.spawnDroppedItem(b, bx, by, bz);
                  }
                }
              }
            }
          }
        }

        // Check player damage
        const distToPlayer = playerPos.distanceTo(new THREE.Vector3(tnt.x, tnt.y, tnt.z));
        if (distToPlayer < 6 && onDamagePlayer) {
          const dmg = Math.floor(Math.max(1, (6 - distToPlayer) * 3));
          onDamagePlayer(dmg);
        }

        if (mesh) {
          this.scene.remove(mesh);
          mesh.geometry.dispose();
        }
        this.tntMeshes.delete(tnt.id);
        this.primedTNTs.splice(i, 1);
      }
    }

    // 3. Update Mobs
    for (const mob of this.mobs) {
      const group = this.mobGroups.get(mob.id);
      mob.walkTimer += dt;

      // Random wander AI
      if (Math.random() < 0.02) {
        mob.yaw += (Math.random() - 0.5) * 1.5;
      }

      // Check distance to player for creeper
      if (mob.type === 'creeper') {
        const distToPlayer = playerPos.distanceTo(new THREE.Vector3(mob.x, mob.y, mob.z));
        if (distToPlayer < 4.0) {
          mob.explodeTimer = (mob.explodeTimer || 0) + dt;
          if (mob.explodeTimer === dt) {
            audio.playTNTFuse();
          }
          if (mob.explodeTimer > 1.8) {
            // Detonate creeper!
            this.spawnPrimedTNT(mob.x, mob.y, mob.z);
            mob.health = 0;
          }
        } else {
          mob.explodeTimer = 0;
        }
      }

      // Move mob forward gently
      const speed = 0.8;
      mob.vx = -Math.sin(mob.yaw) * speed;
      mob.vz = -Math.cos(mob.yaw) * speed;

      // Gravity & simple obstacle hop
      mob.vy -= 18.0 * dt;
      const blockUnder = this.world.getBlock(Math.floor(mob.x), Math.floor(mob.y), Math.floor(mob.z));
      const groundY = Math.floor(mob.y);
      if (isBlockSolid(blockUnder) || mob.y < groundY + 0.1) {
        mob.y = groundY + 1.0;
        mob.vy = 0;

        // Jump over 1 block obstacles
        const frontBlock = this.world.getBlock(
          Math.floor(mob.x + mob.vx * 0.5),
          groundY + 1,
          Math.floor(mob.z + mob.vz * 0.5)
        );
        if (isBlockSolid(frontBlock)) {
          mob.vy = 5.0;
        }
      }

      mob.x += mob.vx * dt;
      mob.y += mob.vy * dt;
      mob.z += mob.vz * dt;

      if (group) {
        group.position.set(mob.x, mob.y, mob.z);
        group.rotation.y = mob.yaw;

        // Animate legs
        const legSwing = Math.sin(mob.walkTimer * 8) * 0.4;
        const leg0 = group.getObjectByName('leg_0');
        const leg1 = group.getObjectByName('leg_1');
        const leg2 = group.getObjectByName('leg_2');
        const leg3 = group.getObjectByName('leg_3');
        if (leg0) leg0.rotation.x = legSwing;
        if (leg1) leg1.rotation.x = -legSwing;
        if (leg2) leg2.rotation.x = -legSwing;
        if (leg3) leg3.rotation.x = legSwing;
      }
    }

    // 4. Update Particle System
    if (this.particleInstancedMesh) {
      let activeCount = 0;
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }

        p.vy -= 16.0 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;

        this.particleDummy.position.set(p.x, p.y, p.z);
        const scale = (p.life / p.maxLife) * p.size;
        this.particleDummy.scale.set(scale, scale, scale);
        this.particleDummy.updateMatrix();

        this.particleInstancedMesh.setMatrixAt(activeCount, this.particleDummy.matrix);
        activeCount++;
      }

      this.particleInstancedMesh.count = activeCount;
      this.particleInstancedMesh.instanceMatrix.needsUpdate = true;
    }
  }

  public dispose() {
    for (const mesh of this.droppedItemMeshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    for (const group of this.mobGroups.values()) {
      this.scene.remove(group);
    }
    for (const mesh of this.tntMeshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    if (this.particleInstancedMesh) {
      this.scene.remove(this.particleInstancedMesh);
      this.particleInstancedMesh.geometry.dispose();
    }
  }
}
