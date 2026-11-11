import { create } from 'zustand';
import type { InputState, Player } from './types';
import type { GameMap } from '../map/types';
import { getOrCreatePlayerId, loadStoredAvatar } from '../avatar/avatarConfig';
import type { Team } from '../ctf/types';
import { useCTFStore } from '../ctf/ctfStore';
import { engineWorld } from '../game/engineWorld';

export function pickTeamSpawn(
  map: GameMap,
  team: Team,
  seedId?: string,
): { x: number; y: number } {
  const spawns = team === 'blue' ? map.spawnPointsBlue : map.spawnPointsRed;
  if (!spawns || spawns.length === 0) {
    return team === 'blue' ? { x: 220, y: 1300 } : { x: map.width - 220, y: 1300 };
  }
  if (seedId && spawns.length > 1) {
    let hash = 0;
    for (let i = 0; i < seedId.length; i++) {
      hash = (hash * 31 + seedId.charCodeAt(i)) >>> 0;
    }
    return spawns[hash % spawns.length];
  }
  return spawns[Math.floor(Math.random() * spawns.length)];
}

const INITIAL_PLAYER: Player = {
  id: getOrCreatePlayerId(),
  team: 'blue',
  x: 280,
  y: 1250,
  vx: 0,
  vy: 0,
  radius: 16,
  boostFuel: 100,
  maxFuel: 100,
  health: 100,
  maxHealth: 100,
  aimAngle: 0,
  color: '#3b82f6',
  avatar: loadStoredAvatar(),
  isDead: false,
  respawnTimer: 0,
  invulnerableTimer: 0,
  carryingFlag: false,
  isGrounded: false,
  fuelOverheated: false,
  dropThroughTimer: 0,
  coyoteTimer: 0,
  wasBoostInput: false,
  dashCooldown: 0,
  dashActiveTimer: 0,
  bounceCooldownTimer: 0,
};

const INITIAL_INPUT: InputState = {
  moveX: 0,
  moveY: 0,
  boosting: false,
  aimAngle: 0,
  shooting: false,
  dash: false,
};

interface PlayerState {
  player: Player;
  input: InputState;
  setPlayer: (player: Player) => void;
  setInput: (input: Partial<InputState>) => void;
  setTeam: (team: Team) => void;
  applyDamage: (damage: number, knockbackX?: number, knockbackY?: number) => boolean; // returns true if killed
  respawn: (spawnX: number, spawnY: number) => void;
  spawnAtTeamBase: (map: GameMap, seedId?: string) => void;
  resetPlayer: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  player: INITIAL_PLAYER,
  input: INITIAL_INPUT,

  setPlayer: (player) => {
    engineWorld.setLocalPlayer(player);
    set({ player });
  },

  setInput: (input) =>
    set((state) => ({ input: { ...state.input, ...input } })),

  setTeam: (team) => {
    const base = engineWorld.localPlayer ?? get().player;
    const next: Player = {
      ...base,
      team,
      color: team === 'blue' ? '#3b82f6' : '#ef4444',
    };
    engineWorld.setLocalPlayer(next);
    set({ player: next });
  },

  applyDamage: (damage, knockbackX = 0, knockbackY = 0) => {
    const player = engineWorld.localPlayer ?? get().player;
    if (player.isDead || player.invulnerableTimer > 0) return false;
    if (!Number.isFinite(damage) || damage <= 0) return false;

    const safeKbX = Number.isFinite(knockbackX) ? knockbackX : 0;
    const safeKbY = Number.isFinite(knockbackY) ? knockbackY : 0;
    const nextHealth = Math.max(0, player.health - damage);
    const isDead = nextHealth <= 0;
    const configuredDelay = useCTFStore.getState().matchRules.respawnDelaySec;

    const nextPlayer: Player = {
      ...player,
      health: nextHealth,
      isDead,
      respawnTimer: isDead ? configuredDelay : 0,
      carryingFlag: isDead ? false : player.carryingFlag,
      vx: player.vx + safeKbX,
      vy: player.vy + safeKbY,
    };

    engineWorld.setLocalPlayer(nextPlayer);
    set({ player: nextPlayer });
    engineWorld.notifyUrgentLocalStateChange();

    return isDead;
  },

  respawn: (spawnX, spawnY) => {
    const player = engineWorld.localPlayer ?? get().player;
    const nextPlayer: Player = {
      ...player,
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      health: player.maxHealth,
      boostFuel: player.maxFuel,
      isDead: false,
      respawnTimer: 0,
      invulnerableTimer: 2.5,
      carryingFlag: false,
      isGrounded: false,
      fuelOverheated: false,
      dropThroughTimer: 0,
      coyoteTimer: 0,
      wasBoostInput: false,
      dashCooldown: 0,
      dashActiveTimer: 0,
      bounceCooldownTimer: 0,
    };
    engineWorld.setLocalPlayer(nextPlayer);
    set({ player: nextPlayer });
    engineWorld.notifyUrgentLocalStateChange();
  },

  spawnAtTeamBase: (map, seedId) => {
    const player = engineWorld.localPlayer ?? get().player;
    const spawn = pickTeamSpawn(map, player.team, seedId);
    const nextPlayer: Player = {
      ...player,
      id: seedId || player.id,
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      health: player.maxHealth,
      boostFuel: player.maxFuel,
      isDead: false,
      respawnTimer: 0,
      invulnerableTimer: 2.0,
      carryingFlag: false,
      isGrounded: false,
      fuelOverheated: false,
      dropThroughTimer: 0,
      coyoteTimer: 0,
      wasBoostInput: false,
      dashCooldown: 0,
      dashActiveTimer: 0,
      bounceCooldownTimer: 0,
    };
    engineWorld.setLocalPlayer(nextPlayer);
    set({ player: nextPlayer });
    engineWorld.notifyUrgentLocalStateChange();
  },

  resetPlayer: () => {
    const fresh: Player = {
      ...INITIAL_PLAYER,
      id: getOrCreatePlayerId(),
      avatar: loadStoredAvatar(),
    };
    engineWorld.setLocalPlayer(fresh);
    set({ player: fresh, input: INITIAL_INPUT });
  },
}));
