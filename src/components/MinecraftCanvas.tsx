import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  BlockType,
  WorldConfig,
  GameMode,
  InventoryItem,
  PlayerStats,
  GameSettings,
} from '../types/game';
import { VoxelWorld, isBlockSolid } from '../engine/world';
import { PhysicsEngine, PlayerPhysicsState } from '../engine/physics';
import { EntityManager } from '../engine/entities';
import { audio } from '../engine/audio';
import { getItemDisplayName } from '../engine/crafting';

// Pre-allocated math objects to avoid GC in animation loop
const _vec3 = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();

interface MinecraftCanvasProps {
  config: WorldConfig;
  settings: GameSettings;
  hotbar: (InventoryItem | null)[];
  selectedSlot: number;
  onSelectSlot: (slot: number) => void;
  stats: PlayerStats;
  onUpdateStats: (newStats: Partial<PlayerStats>) => void;
  onPickupItem: (blockType: BlockType) => void;
  onConsumeHeldItem: () => void;
  onOpenInventory: () => void;
  onOpenPauseMenu: () => void;
  onOpenChat: () => void;
  isUIOpen: boolean;
  onDebugUpdate: (pos: THREE.Vector3, yaw: number, pitch: number, fps: number, entities: number) => void;
  onTargetBlockChange: (blockName: string | null) => void;
  onBreakProgressChange: (prog: number) => void;
  onHeldItemSwingChange: (swing: number) => void;
  timeOfDay: number; // 0..1
  setTimeOfDay: React.Dispatch<React.SetStateAction<number>>;
  setWorldRef?: (world: VoxelWorld) => void;
  setEntityManagerRef?: (em: EntityManager) => void;
}

export const MinecraftCanvas: React.FC<MinecraftCanvasProps> = ({
  config,
  settings,
  hotbar,
  selectedSlot,
  onSelectSlot,
  stats,
  onUpdateStats,
  onPickupItem,
  onConsumeHeldItem,
  onOpenInventory,
  onOpenPauseMenu,
  onOpenChat,
  isUIOpen,
  onDebugUpdate,
  onTargetBlockChange,
  onBreakProgressChange,
  onHeldItemSwingChange,
  timeOfDay,
  setTimeOfDay,
  setWorldRef,
  setEntityManagerRef,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // References for game state across renders
  const stateRef = useRef({
    hotbar,
    selectedSlot,
    stats,
    settings,
    timeOfDay,
    isUIOpen,
  });

  useEffect(() => {
    stateRef.current = {
      hotbar,
      selectedSlot,
      stats,
      settings,
      timeOfDay,
      isUIOpen,
    };
  }, [hotbar, selectedSlot, stats, settings, timeOfDay, isUIOpen]);

  useEffect(() => {
    if (!mountRef.current) return;

    // --- Scene, Camera, Renderer Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x78a7ff);
    scene.fog = new THREE.FogExp2(0x78a7ff, 0.018);

    const camera = new THREE.PerspectiveCamera(
      settings.fov,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    const isHeadless = navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.1);
    sunLight.position.set(50, 80, 40);
    scene.add(sunLight);

    // Celestial Bodies: Sun and Moon
    const sunGeo = new THREE.PlaneGeometry(16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff6cf, side: THREE.DoubleSide });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sunMesh);

    const moonGeo = new THREE.PlaneGeometry(12, 12);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xe6e6f5, side: THREE.DoubleSide });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    scene.add(moonMesh);

    // --- Targeted Block Highlight Box Wireframe ---
    const wireGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002));
    const wireMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    const selectionWireframe = new THREE.LineSegments(wireGeo, wireMat);
    selectionWireframe.visible = false;
    scene.add(selectionWireframe);

    // --- Initialize World & Subsystems ---
    const world = new VoxelWorld(scene, config);
    if (setWorldRef) setWorldRef(world);

    const physics = new PhysicsEngine(world);
    const entityManager = new EntityManager(scene, world);
    if (setEntityManagerRef) setEntityManagerRef(entityManager);

    // Player State
    const player: PlayerPhysicsState = {
      pos: new THREE.Vector3(8, 26, 8),
      velocity: new THREE.Vector3(),
      stats: { ...stats },
      yaw: 0,
      pitch: 0,
    };

    // Keyboard state
    const keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sneak: false,
      sprint: false,
    };

    // Mining & Interaction State
    let isMouseDownLeft = false;
    let miningBlockPos: THREE.Vector3 | null = null;
    let miningProgress = 0;
    let swingProgress = 0;
    let footstepTimer = 0;

    // Start background ambient music
    audio.startAmbientMusic();

    // --- Input Event Handlers ---
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Pause with Escape
      if (e.key === 'Escape') {
        onOpenPauseMenu();
        return;
      }

      // If UI is open, don't capture gameplay keys
      if (stateRef.current.isUIOpen) return;

      if (e.code === 'KeyW') keys.forward = true;
      if (e.code === 'KeyS') keys.backward = true;
      if (e.code === 'KeyA') keys.left = true;
      if (e.code === 'KeyD') keys.right = true;
      if (e.code === 'Space') keys.jump = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.sneak = true;
      if (e.code === 'ControlLeft') keys.sprint = true;

      // Hotbar selection numbers 1-9
      if (e.code.startsWith('Digit')) {
        const num = parseInt(e.code.replace('Digit', ''), 10);
        if (num >= 1 && num <= 9) {
          audio.playClick();
          onSelectSlot(num - 1);
        }
      }

      // Inventory E
      if (e.code === 'KeyE') {
        onOpenInventory();
      }

      // Chat T or Slash
      if (e.code === 'KeyT' || e.code === 'Slash') {
        e.preventDefault();
        onOpenChat();
      }

      // Creative Flight Toggle (double tap or F key)
      if (e.code === 'KeyF' && config.gameMode === 'creative') {
        player.stats.isFlying = !player.stats.isFlying;
        onUpdateStats({ isFlying: player.stats.isFlying });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyW') keys.forward = false;
      if (e.code === 'KeyS') keys.backward = false;
      if (e.code === 'KeyA') keys.left = false;
      if (e.code === 'KeyD') keys.right = false;
      if (e.code === 'Space') keys.jump = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.sneak = false;
      if (e.code === 'ControlLeft') keys.sprint = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement || stateRef.current.isUIOpen) {
        return;
      }

      const sens = 0.0022 * (stateRef.current.settings.mouseSensitivity || 1.0);
      player.yaw -= e.movementX * sens;
      player.pitch -= e.movementY * sens;

      // Clamp pitch to ~[-89°, 89°]
      player.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, player.pitch));
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (stateRef.current.isUIOpen) return;

      // Lock pointer if not locked
      if (document.pointerLockElement !== renderer.domElement) {
        renderer.domElement.requestPointerLock();
        return;
      }

      // Left Click = Mine / Attack
      if (e.button === 0) {
        isMouseDownLeft = true;
        swingProgress = 0.01;
      }

      // Right Click = Place Block / Interact
      if (e.button === 2) {
        e.preventDefault();
        swingProgress = 0.01;

        // Raycast targeted block
        _rayOrigin.copy(player.pos).add(new THREE.Vector3(0, physics.eyeHeight, 0));
        camera.getWorldDirection(_rayDir);
        const hit = world.raycastBlock(_rayOrigin, _rayDir, 5.5);

        if (hit) {
          const { block, blockPos, normal } = hit;

          // Special interaction 1: TNT ignition!
          if (block === BlockType.TNT) {
            world.setBlock(blockPos.x, blockPos.y, blockPos.z, BlockType.AIR);
            entityManager.spawnPrimedTNT(blockPos.x, blockPos.y, blockPos.z);
            return;
          }

          // Special interaction 2: Crafting Table opens inventory
          if (block === BlockType.CRAFTING_TABLE) {
            onOpenInventory();
            return;
          }

          // Place held item block
          const curHeld = stateRef.current.hotbar[stateRef.current.selectedSlot];
          if (curHeld) {
            const blockTypeId = parseInt(curHeld.id, 10);
            if (!isNaN(blockTypeId) && blockTypeId > 0) {
              const placeX = blockPos.x + normal.x;
              const placeY = blockPos.y + normal.y;
              const placeZ = blockPos.z + normal.z;

              // Check that placing block does not collide with player
              const playerBox = physics.getPlayerBox(player.pos);
              const newBlockBox = new THREE.Box3(
                new THREE.Vector3(placeX, placeY, placeZ),
                new THREE.Vector3(placeX + 1, placeY + 1, placeZ + 1)
              );

              if (!playerBox.intersectsBox(newBlockBox)) {
                world.setBlock(placeX, placeY, placeZ, blockTypeId);
                audio.playBlockPlace();

                // Consume 1 item unless creative
                if (config.gameMode !== 'creative') {
                  onConsumeHeldItem();
                }
              }
            }
          }
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        isMouseDownLeft = false;
        miningProgress = 0;
        miningBlockPos = null;
        onBreakProgressChange(0);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('resize', handleResize);

    // --- Main Game Loop (Clock getDelta) ---
    const clock = new THREE.Clock();
    let animFrameId: number;
    let fpsFrames = 0;
    let fpsTime = 0;
    let currentFps = 60;
    let currentTimeOfDay = timeOfDay;

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      fpsFrames++;
      fpsTime += delta;
      if (fpsTime >= 0.5) {
        currentFps = Math.round((fpsFrames / fpsTime));
        fpsFrames = 0;
        fpsTime = 0;
      }

      // 1. Advance Day/Night Cycle
      if (stateRef.current.settings.dayNightSpeed > 0) {
        currentTimeOfDay = (currentTimeOfDay + delta * 0.005 * stateRef.current.settings.dayNightSpeed) % 1.0;
        setTimeOfDay(currentTimeOfDay);
      }

      // Update Sky & Lighting based on Time of Day
      const sunAngle = currentTimeOfDay * Math.PI * 2;
      const sunY = Math.sin(sunAngle);
      const sunX = Math.cos(sunAngle);

      sunLight.position.set(sunX * 90, sunY * 90, 40);
      sunLight.intensity = Math.max(0.1, sunY * 1.2);

      sunMesh.position.set(player.pos.x + sunX * 140, player.pos.y + sunY * 140, player.pos.z + 40);
      sunMesh.lookAt(player.pos);

      moonMesh.position.set(player.pos.x - sunX * 140, player.pos.y - sunY * 140, player.pos.z - 40);
      moonMesh.lookAt(player.pos);

      // Sky and Fog color interpolations
      if (sunY > 0.1) {
        // Day
        scene.background = new THREE.Color(0x78a7ff);
        (scene.fog as THREE.FogExp2).color.setHex(0x78a7ff);
        ambientLight.intensity = 0.55;
      } else if (sunY > -0.1) {
        // Dawn / Sunset
        scene.background = new THREE.Color(0xd47348);
        (scene.fog as THREE.FogExp2).color.setHex(0xd47348);
        ambientLight.intensity = 0.4;
      } else {
        // Night
        scene.background = new THREE.Color(0x0a0e1c);
        (scene.fog as THREE.FogExp2).color.setHex(0x0a0e1c);
        ambientLight.intensity = 0.22;
      }

      // 2. Physics & Movement (if UI is not blocking)
      if (!stateRef.current.isUIOpen) {
        const moveInput = {
          forward: (keys.forward ? 1 : 0) - (keys.backward ? 1 : 0),
          right: (keys.right ? 1 : 0) - (keys.left ? 1 : 0),
          jump: keys.jump,
          sneak: keys.sneak,
          sprint: keys.sprint,
        };

        physics.update(player, moveInput, delta);

        // Footstep sounds
        if (player.stats.isGrounded && (moveInput.forward !== 0 || moveInput.right !== 0)) {
          footstepTimer += delta;
          const interval = player.stats.isSprinting ? 0.28 : 0.42;
          if (footstepTimer >= interval) {
            footstepTimer = 0;
            const b = world.getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y - 0.2), Math.floor(player.pos.z));
            const materialType = b === BlockType.STONE || b === BlockType.COBBLESTONE ? 'stone' :
                                 b === BlockType.OAK_PLANKS || b === BlockType.OAK_LOG ? 'wood' :
                                 b === BlockType.SAND ? 'sand' : 'grass';
            audio.playFootstep(materialType);
          }
        }
      }

      // Camera position & orientation
      camera.position.set(player.pos.x, player.pos.y + physics.eyeHeight, player.pos.z);
      camera.rotation.order = 'YXZ';
      camera.rotation.y = player.yaw;
      camera.rotation.x = player.pitch;

      // 3. Raycast for Targeted Block & Mining Loop
      _rayOrigin.copy(camera.position);
      camera.getWorldDirection(_rayDir);
      const hit = world.raycastBlock(_rayOrigin, _rayDir, 5.5);

      if (hit) {
        const { block, blockPos } = hit;
        onTargetBlockChange(getItemDisplayName(`${block}`));

        selectionWireframe.visible = true;
        selectionWireframe.position.set(blockPos.x + 0.5, blockPos.y + 0.5, blockPos.z + 0.5);

        // Mining Progress logic
        if (isMouseDownLeft && !stateRef.current.isUIOpen) {
          swingProgress = (swingProgress + delta * 8) % 1.0;

          if (!miningBlockPos || !miningBlockPos.equals(blockPos)) {
            miningBlockPos = blockPos.clone();
            miningProgress = 0;
          }

          // In Creative: instant break
          if (config.gameMode === 'creative') {
            audio.playBlockBreak();
            world.setBlock(blockPos.x, blockPos.y, blockPos.z, BlockType.AIR);
            entityManager.spawnBlockBreakParticles(block, blockPos.x, blockPos.y, blockPos.z);
            miningProgress = 0;
            onBreakProgressChange(0);
          } else {
            // In Survival: break hardness calculation
            const breakDuration = 0.75; // seconds
            miningProgress += delta / breakDuration;
            onBreakProgressChange(Math.min(1, miningProgress));

            // Crunch sound tick
            if (Math.random() < 0.15) {
              audio.playFootstep('dirt');
            }

            if (miningProgress >= 1.0) {
              // Block broken!
              audio.playBlockBreak();
              world.setBlock(blockPos.x, blockPos.y, blockPos.z, BlockType.AIR);
              entityManager.spawnBlockBreakParticles(block, blockPos.x, blockPos.y, blockPos.z);
              entityManager.spawnDroppedItem(block, blockPos.x, blockPos.y, blockPos.z);

              miningProgress = 0;
              miningBlockPos = null;
              onBreakProgressChange(0);
            }
          }
        }
      } else {
        selectionWireframe.visible = false;
        onTargetBlockChange(null);
        miningProgress = 0;
        onBreakProgressChange(0);
      }

      // Hand swing damping
      if (swingProgress > 0) {
        swingProgress = Math.min(1, swingProgress + delta * 4);
        onHeldItemSwingChange(swingProgress);
        if (swingProgress >= 1) swingProgress = 0;
      } else {
        onHeldItemSwingChange(0);
      }

      // 4. Update Entities (dropped items, mobs, TNT, particles)
      entityManager.update(
        delta,
        player.pos,
        (droppedBlock) => {
          onPickupItem(droppedBlock);
        },
        (damage) => {
          audio.playPlayerHurt();
          const nextHealth = Math.max(0, player.stats.health - damage);
          player.stats.health = nextHealth;
          onUpdateStats({ health: nextHealth });
        }
      );

      // 5. Update F3 Debug data
      onDebugUpdate(
        player.pos,
        player.yaw,
        player.pitch,
        currentFps,
        entityManager.mobs.length + entityManager.droppedItems.length
      );

      // Render
      renderer.render(scene, camera);
    };

    animate();

    // Cleanup on unmount
    return () => {
      cancelAnimationFrame(animFrameId);
      audio.stopAmbientMusic();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('resize', handleResize);

      world.dispose();
      entityManager.dispose();
      renderer.dispose();
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [config]);

  return <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-crosshair" />;
};
