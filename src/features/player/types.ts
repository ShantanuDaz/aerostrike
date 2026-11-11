import type { AvatarConfig } from '../avatar/types';
import type { Team } from '../ctf/types';

export interface Player {
  id: string;
  team: Team;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  boostFuel: number;
  maxFuel: number;
  health: number;
  maxHealth: number;
  aimAngle: number;
  color: string;
  avatar: AvatarConfig;
  isDead: boolean;
  respawnTimer: number;
  invulnerableTimer: number;
  carryingFlag: boolean;
  isGrounded?: boolean;
  fuelOverheated?: boolean;
  dropThroughTimer?: number;
  coyoteTimer?: number;
  wasBoostInput?: boolean;
  dashCooldown?: number;
  dashActiveTimer?: number;
  bounceCooldownTimer?: number;
}

export interface InputState {
  moveX: number; // -1 to 1
  moveY?: number;
  boosting: boolean; // jetpack thrust
  aimAngle: number;
  shooting: boolean;
  switchWeapon?: boolean;
  dash?: boolean;
}
