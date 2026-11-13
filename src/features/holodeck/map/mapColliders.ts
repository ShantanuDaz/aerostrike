import type { AABB } from '../physics/sweptAABB';
import type { PlantSite } from '../core/types';

export interface MapBlockDef {
  id: string;
  name: string;
  position: [number, number, number]; // center [x, y, z]
  size: [number, number, number]; // dimensions [width, height, depth]
  materialType?: 'slate' | 'site_a' | 'site_b' | 'accent' | 'glass';
  isClimbable?: boolean;
}

export interface PlantZoneDef {
  site: PlantSite;
  center: [number, number, number];
  size: [number, number, number];
  label: string;
}

export interface MapSpawnDef {
  team: 'blue' | 'red'; // blue = defender, red = attacker
  position: [number, number, number];
  yaw: number;
}

export function blockToAABB(block: MapBlockDef): AABB {
  const [px, py, pz] = block.position;
  const [sx, sy, sz] = block.size;
  const halfX = sx / 2;
  const halfY = sy / 2;
  const halfZ = sz / 2;

  return {
    min: [px - halfX, py - halfY, pz - halfZ],
    max: [px + halfX, py + halfY, pz + halfZ],
  };
}

export function isPointInsideZone(point: [number, number, number], zone: PlantZoneDef): boolean {
  const [px, py, pz] = point;
  const [zx, zy, zz] = zone.center;
  const [sx, sy, sz] = zone.size;

  return (
    Math.abs(px - zx) <= sx / 2 &&
    Math.abs(py - zy) <= sy / 2 + 1.5 && // generous vertical tolerance
    Math.abs(pz - zz) <= sz / 2
  );
}
