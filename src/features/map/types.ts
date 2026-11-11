export type ObstacleType = 'ground' | 'platform' | 'wall' | 'hazard';

export interface Obstacle {
  id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  type?: ObstacleType;
}

export interface BaseZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WeaponSpawnPoint {
  id: string;
  x: number;
  y: number;
  weaponType: 'rifle' | 'shotgun' | 'sniper' | 'rocket';
}

export interface BouncePad {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  launchVy: number;
  launchVx?: number;
  color?: string;
}

export type RefillStationType = 'medkit' | 'fuel' | 'supply';

export interface RefillStation {
  id: string;
  x: number;
  y: number;
  stationType: RefillStationType;
  cooldownSec?: number;
}

export interface ActiveRefillStation {
  id: string;
  x: number;
  y: number;
  stationType: RefillStationType;
  cooldownSec: number;
  respawnTimer: number; // 0 = available
}

export interface GameMap {
  id: string;
  name: string;
  width: number;
  height: number;
  backgroundColor: string;
  obstacles: Obstacle[];
  baseBlue: BaseZone;
  baseRed: BaseZone;
  flagBlue: { x: number; y: number };
  flagRed: { x: number; y: number };
  spawnPointsBlue: { x: number; y: number }[];
  spawnPointsRed: { x: number; y: number }[];
  weaponSpawns: WeaponSpawnPoint[];
  bouncePads?: BouncePad[];
  refillStations?: RefillStation[];
}
