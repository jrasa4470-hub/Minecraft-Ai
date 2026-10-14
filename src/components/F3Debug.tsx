import React from 'react';
import * as THREE from 'three';
import { BiomeType } from '../types/game';

interface F3DebugProps {
  visible: boolean;
  playerPos: THREE.Vector3;
  yaw: number;
  pitch: number;
  fps: number;
  biome: BiomeType;
  entityCount: number;
}

export const F3Debug: React.FC<F3DebugProps> = ({
  visible,
  playerPos,
  yaw,
  pitch,
  fps,
  biome,
  entityCount,
}) => {
  if (!visible) return null;

  const bx = Math.floor(playerPos.x);
  const by = Math.floor(playerPos.y);
  const bz = Math.floor(playerPos.z);

  const cx = Math.floor(bx / 16);
  const cz = Math.floor(bz / 16);

  // Normalize yaw to 0..360 deg
  let deg = ((yaw * 180) / Math.PI) % 360;
  if (deg < 0) deg += 360;

  let facing = 'south (Towards positive Z)';
  if (deg >= 45 && deg < 135) facing = 'west (Towards negative X)';
  else if (deg >= 135 && deg < 225) facing = 'north (Towards negative Z)';
  else if (deg >= 225 && deg < 315) facing = 'east (Towards positive X)';

  return (
    <div className="absolute top-2 left-2 z-20 pointer-events-none text-[11px] font-mono text-white bg-black/55 p-2.5 rounded border border-white/20 select-none leading-relaxed shadow-lg backdrop-blur-xs">
      <div className="font-bold text-amber-300">Minecraft 1.20 Web Edition (WebGL 2.0 Three.js)</div>
      <div>FPS: <span className="text-emerald-400 font-bold">{fps}</span></div>
      <div>
        XYZ: <span className="text-cyan-300">{playerPos.x.toFixed(3)}</span> /{' '}
        <span className="text-cyan-300">{playerPos.y.toFixed(3)}</span> /{' '}
        <span className="text-cyan-300">{playerPos.z.toFixed(3)}</span>
      </div>
      <div>Block: {bx} {by} {bz}</div>
      <div>Chunk: {bx % 16} {by} {bz % 16} in {cx} {cz}</div>
      <div>Facing: {facing} ({deg.toFixed(1)} / {((pitch * 180) / Math.PI).toFixed(1)})</div>
      <div>Biome: <span className="text-lime-300 capitalize">{biome}</span></div>
      <div>Client Light: 15 (15 sky, 0 block)</div>
      <div>Entities: {entityCount} active</div>
      <div className="text-[9px] text-zinc-400 mt-1">Press [F3] to toggle this debug screen</div>
    </div>
  );
};
