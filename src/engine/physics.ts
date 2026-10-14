import * as THREE from 'three';
import { VoxelWorld, isBlockSolid } from './world';
import { BlockType, PlayerStats } from '../types/game';

export interface PlayerPhysicsState {
  pos: THREE.Vector3;
  velocity: THREE.Vector3;
  stats: PlayerStats;
  yaw: number;
  pitch: number;
}

export class PhysicsEngine {
  public world: VoxelWorld;
  public playerWidth = 0.6;
  public playerHeight = 1.8;
  public eyeHeight = 1.62;

  // Constants
  public gravity = 28.0;
  public walkSpeed = 4.3;
  public sprintSpeed = 6.8;
  public sneakSpeed = 1.8;
  public flySpeed = 12.0;
  public jumpVelocity = 8.5;

  constructor(world: VoxelWorld) {
    this.world = world;
  }

  // Check if an AABB intersects any solid block in the world
  public checkAABBCollision(box: THREE.Box3): boolean {
    const minX = Math.floor(box.min.x);
    const maxX = Math.floor(box.max.x);
    const minY = Math.floor(box.min.y);
    const maxY = Math.floor(box.max.y);
    const minZ = Math.floor(box.min.z);
    const maxZ = Math.floor(box.max.z);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const block = this.world.getBlock(x, y, z);
          if (isBlockSolid(block)) {
            // Check true bounding box intersection
            const blockBox = new THREE.Box3(
              new THREE.Vector3(x, y, z),
              new THREE.Vector3(x + 1, y + 1, z + 1)
            );
            if (box.intersectsBox(blockBox)) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  // Get current player AABB at given position
  public getPlayerBox(pos: THREE.Vector3): THREE.Box3 {
    const halfW = this.playerWidth / 2;
    return new THREE.Box3(
      new THREE.Vector3(pos.x - halfW, pos.y, pos.z - halfW),
      new THREE.Vector3(pos.x + halfW, pos.y + this.playerHeight, pos.z + halfW)
    );
  }

  // Update physics for one frame
  public update(
    player: PlayerPhysicsState,
    moveInput: { forward: number; right: number; jump: boolean; sneak: boolean; sprint: boolean },
    delta: number
  ) {
    // Clamp delta to avoid tunneling
    const dt = Math.min(delta, 0.05);

    const pos = player.pos;
    const vel = player.velocity;
    const stats = player.stats;

    // Check if player is in water
    const eyeBlock = this.world.getBlock(Math.floor(pos.x), Math.floor(pos.y + 1.0), Math.floor(pos.z));
    stats.isUnderwater = (eyeBlock === BlockType.WATER);

    // Calculate movement vector from yaw
    const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)).normalize();
    const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw)).normalize();

    let targetMove = new THREE.Vector3();
    targetMove.addScaledVector(forward, moveInput.forward);
    targetMove.addScaledVector(right, moveInput.right);

    if (targetMove.lengthSq() > 0) {
      targetMove.normalize();
    }

    // Determine current speed
    let currentSpeed = this.walkSpeed;
    if (stats.isFlying) {
      currentSpeed = moveInput.sprint ? this.flySpeed * 1.8 : this.flySpeed;
    } else if (moveInput.sprint && !moveInput.sneak && moveInput.forward > 0) {
      currentSpeed = this.sprintSpeed;
      stats.isSprinting = true;
    } else if (moveInput.sneak) {
      currentSpeed = this.sneakSpeed;
      stats.isSneaking = true;
      stats.isSprinting = false;
    } else {
      stats.isSprinting = false;
      stats.isSneaking = false;
    }

    if (stats.isFlying) {
      // Free flight mode
      vel.x = targetMove.x * currentSpeed;
      vel.z = targetMove.z * currentSpeed;

      if (moveInput.jump) {
        vel.y = this.flySpeed;
      } else if (moveInput.sneak) {
        vel.y = -this.flySpeed;
      } else {
        vel.y = 0;
      }

      pos.x += vel.x * dt;
      pos.y += vel.y * dt;
      pos.z += vel.z * dt;
      stats.isGrounded = false;
      return;
    }

    // Ground / Normal Physics
    const accel = stats.isGrounded ? 15.0 : 4.0;
    const friction = stats.isGrounded ? 10.0 : 1.5;

    const desiredVx = targetMove.x * currentSpeed;
    const desiredVz = targetMove.z * currentSpeed;

    vel.x = THREE.MathUtils.damp(vel.x, desiredVx, accel, dt);
    vel.z = THREE.MathUtils.damp(vel.z, desiredVz, accel, dt);

    if (stats.isUnderwater) {
      // Water drag & swim
      vel.y -= this.gravity * 0.15 * dt;
      vel.y = Math.max(-4, vel.y * 0.85);
      if (moveInput.jump) {
        vel.y = 3.5;
      }
    } else {
      // Normal Gravity
      vel.y -= this.gravity * dt;
      vel.y = Math.max(-35, vel.y);

      // Jump
      if (moveInput.jump && stats.isGrounded) {
        vel.y = this.jumpVelocity;
        stats.isGrounded = false;
      }
    }

    // Multi-axis collision resolution
    // 1. Resolve Y axis first
    const nextY = pos.y + vel.y * dt;
    const boxY = this.getPlayerBox(new THREE.Vector3(pos.x, nextY, pos.z));
    if (this.checkAABBCollision(boxY)) {
      if (vel.y < 0) {
        // Fall landing
        const fallDistance = -vel.y * dt;
        pos.y = Math.floor(nextY) + 1.0;
        stats.isGrounded = true;
        vel.y = 0;
      } else if (vel.y > 0) {
        // Head hit
        pos.y = Math.floor(boxY.max.y) - this.playerHeight - 0.001;
        vel.y = 0;
      }
    } else {
      pos.y = nextY;
      stats.isGrounded = false;
    }

    // 2. Resolve X axis
    const nextX = pos.x + vel.x * dt;
    const boxX = this.getPlayerBox(new THREE.Vector3(nextX, pos.y, pos.z));
    if (this.checkAABBCollision(boxX)) {
      // Try step-up (half block or smooth step)
      let stepped = false;
      if (stats.isGrounded) {
        const stepBox = this.getPlayerBox(new THREE.Vector3(nextX, pos.y + 0.6, pos.z));
        if (!this.checkAABBCollision(stepBox)) {
          pos.y += 0.6;
          pos.x = nextX;
          stepped = true;
        }
      }
      if (!stepped) {
        vel.x = 0;
      }
    } else {
      pos.x = nextX;
    }

    // 3. Resolve Z axis
    const nextZ = pos.z + vel.z * dt;
    const boxZ = this.getPlayerBox(new THREE.Vector3(pos.x, pos.y, nextZ));
    if (this.checkAABBCollision(boxZ)) {
      let stepped = false;
      if (stats.isGrounded) {
        const stepBox = this.getPlayerBox(new THREE.Vector3(pos.x, pos.y + 0.6, nextZ));
        if (!this.checkAABBCollision(stepBox)) {
          pos.y += 0.6;
          pos.z = nextZ;
          stepped = true;
        }
      }
      if (!stepped) {
        vel.z = 0;
      }
    } else {
      pos.z = nextZ;
    }

    // Prevent falling below world
    if (pos.y < -5) {
      pos.set(0, 30, 0);
      vel.set(0, 0, 0);
    }
  }
}
