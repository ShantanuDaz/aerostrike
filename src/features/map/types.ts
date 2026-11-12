export type ObstacleType = 'ground' | 'platform' | 'wall' | 'hazard';

export type MapThemeId =
  | 'caldera_orbital'
  | 'canyon_outpost'
  | 'sky_citadel'
  | 'cryo_reactor'
  | 'bunker_vault'
  | 'training_deck';

export type TerrainSurfaceStyle = 'rock' | 'alloy' | 'crystal' | 'deflector' | 'ice';

export interface TerrainPoint {
  x: number;
  y: number;
}

export interface PolygonTerrainShape {
  kind: 'polygon';
  id?: string;
  type?: 'ground' | 'wall';
  points: TerrainPoint[];
  color?: string;
  trimColor?: string;
  style?: TerrainSurfaceStyle;
}

export interface SplineFloorTerrainShape {
  kind: 'spline_floor';
  id?: string;
  type?: 'ground' | 'wall';
  /** Ordered control points defining the upper surface spline */
  topPoints: TerrainPoint[];
  /** Baseline Y used when bottomPoints is omitted */
  bottomY?: number;
  /** Optional lower surface spline points for arched domes & half-pipes */
  bottomPoints?: TerrainPoint[];
  /** Number of spline subdivisions along each curve */
  samples?: number;
  color?: string;
  trimColor?: string;
  style?: TerrainSurfaceStyle;
}

export type TerrainShape = PolygonTerrainShape | SplineFloorTerrainShape;

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
  theme?: MapThemeId;
  obstacles: Obstacle[];
  terrainShapes?: TerrainShape[];
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
