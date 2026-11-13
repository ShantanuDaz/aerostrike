import type { Team } from '../../ctf/types';
import type { HolodeckWeaponId, PlantSite, SpikeEntity } from '../core/types';
import { rayIntersectsAABB } from '../weapons/gunplayController';
import type { AABB } from '../physics/sweptAABB';

export interface Bot3DWaypoint {
  pos: [number, number, number];
  name: string;
}

export interface Bot3DState {
  id: string;
  name: string;
  team: Team;
  position: [number, number, number];
  velocity: [number, number, number];
  yaw: number;
  pitch: number;
  health: number;
  armor: number;
  isAlive: boolean;
  activeWeaponId: HolodeckWeaponId;
  targetWaypointIdx: number;
  lastShotTimeSec: number;
  seePlayerTimerSec: number; // reaction delay
  isDefusing: boolean;
  isCrouching?: boolean;
  tacticalTimer?: number;
  basePosition?: [number, number, number];
}

export const SITE_WAYPOINTS: Record<PlantSite, [number, number, number][]> = {
  A: [
    [0, 0, -45], // defender spawn
    [15, 0, -30],
    [35, 0.4, -20], // Site A platform
    [32, 1.5, -18], // Site A cover
  ],
  B: [
    [0, 0, -45],
    [-15, 0, -30],
    [-35, 0.4, -20], // Site B platform
    [-32, 1.4, -12],
  ],
};

export function createInitialBots3D(
  mapId: string = 'holodeck-alpha',
  playerTeam: Team = 'red',
): Bot3DState[] {
  const enemyTeam: Team = playerTeam === 'blue' ? 'red' : 'blue';

  if (mapId === 'holodeck-bravo') {
    if (enemyTeam === 'red') {
      return [
        {
          id: 'bot_alpha',
          name: 'Viper (Bot)',
          team: 'red',
          position: [12, 0.5, 28],
          velocity: [0, 0, 0],
          yaw: 0,
          pitch: 0,
          health: 100,
          armor: 50,
          isAlive: true,
          activeWeaponId: 'vandal',
          targetWaypointIdx: 0,
          lastShotTimeSec: 0,
          seePlayerTimerSec: 0,
          isDefusing: false,
          isCrouching: false,
          tacticalTimer: 0.5,
          basePosition: [12, 0.5, 28],
        },
        {
          id: 'bot_bravo',
          name: 'Ghost (Bot)',
          team: 'red',
          position: [-12, 0.5, 28],
          velocity: [0, 0, 0],
          yaw: 0,
          pitch: 0,
          health: 100,
          armor: 50,
          isAlive: true,
          activeWeaponId: 'vandal',
          targetWaypointIdx: 0,
          lastShotTimeSec: 0,
          seePlayerTimerSec: 0,
          isDefusing: false,
          isCrouching: false,
          tacticalTimer: 1.8,
          basePosition: [-12, 0.5, 28],
        },
        {
          id: 'bot_charlie',
          name: 'Titan (Bot)',
          team: 'red',
          position: [0, 2.5, 18],
          velocity: [0, 0, 0],
          yaw: 0,
          pitch: 0,
          health: 100,
          armor: 50,
          isAlive: true,
          activeWeaponId: 'operator',
          targetWaypointIdx: 0,
          lastShotTimeSec: 0,
          seePlayerTimerSec: 0,
          isDefusing: false,
          isCrouching: false,
          tacticalTimer: 0.0,
          basePosition: [0, 2.5, 18],
        },
      ];
    }
    return [
      {
        id: 'bot_alpha',
        name: 'Viper (Bot)',
        team: 'blue',
        position: [36, 0.5, 0], // Guarding Site A (Emerald Dais)
        velocity: [0, 0, 0],
        yaw: Math.PI,
        pitch: 0,
        health: 100,
        armor: 50,
        isAlive: true,
        activeWeaponId: 'vandal',
        targetWaypointIdx: 0,
        lastShotTimeSec: 0,
        seePlayerTimerSec: 0,
        isDefusing: false,
        isCrouching: false,
        tacticalTimer: 0.5,
        basePosition: [36, 0.5, 0],
      },
      {
        id: 'bot_bravo',
        name: 'Ghost (Bot)',
        team: 'blue',
        position: [-36, 0.5, 0], // Guarding Site B (Ruby Reactor)
        velocity: [0, 0, 0],
        yaw: Math.PI,
        pitch: 0,
        health: 100,
        armor: 50,
        isAlive: true,
        activeWeaponId: 'vandal',
        targetWaypointIdx: 0,
        lastShotTimeSec: 0,
        seePlayerTimerSec: 0,
        isDefusing: false,
        isCrouching: false,
        tacticalTimer: 1.8,
        basePosition: [-36, 0.5, 0],
      },
      {
        id: 'bot_charlie',
        name: 'Titan (Bot)',
        team: 'blue',
        position: [0, 3.6, 0], // Catwalk Sniper
        velocity: [0, 0, 0],
        yaw: Math.PI,
        pitch: 0,
        health: 100,
        armor: 50,
        isAlive: true,
        activeWeaponId: 'operator',
        targetWaypointIdx: 0,
        lastShotTimeSec: 0,
        seePlayerTimerSec: 0,
        isDefusing: false,
        isCrouching: false,
        tacticalTimer: 0.0,
        basePosition: [0, 3.6, 0],
      },
    ];
  }

  if (enemyTeam === 'red') {
    return [
      {
        id: 'bot_alpha',
        name: 'Viper (Bot)',
        team: 'red',
        position: [12, 0.4, 35], // Red Ingress A
        velocity: [0, 0, 0],
        yaw: 0,
        pitch: 0,
        health: 100,
        armor: 50,
        isAlive: true,
        activeWeaponId: 'vandal',
        targetWaypointIdx: 2,
        lastShotTimeSec: 0,
        seePlayerTimerSec: 0,
        isDefusing: false,
        isCrouching: false,
        tacticalTimer: 0.5,
        basePosition: [12, 0.4, 35],
      },
      {
        id: 'bot_bravo',
        name: 'Ghost (Bot)',
        team: 'red',
        position: [-12, 0.4, 35], // Red Ingress B
        velocity: [0, 0, 0],
        yaw: 0,
        pitch: 0,
        health: 100,
        armor: 50,
        isAlive: true,
        activeWeaponId: 'vandal',
        targetWaypointIdx: 2,
        lastShotTimeSec: 0,
        seePlayerTimerSec: 0,
        isDefusing: false,
        isCrouching: false,
        tacticalTimer: 1.8,
        basePosition: [-12, 0.4, 35],
      },
      {
        id: 'bot_charlie',
        name: 'Titan (Bot)',
        team: 'red',
        position: [0, 2.5, 20], // Mid Platform
        velocity: [0, 0, 0],
        yaw: 0,
        pitch: 0,
        health: 100,
        armor: 50,
        isAlive: true,
        activeWeaponId: 'operator',
        targetWaypointIdx: 1,
        lastShotTimeSec: 0,
        seePlayerTimerSec: 0,
        isDefusing: false,
        isCrouching: false,
        tacticalTimer: 0.0,
        basePosition: [0, 2.5, 20],
      },
    ];
  }

  return [
    {
      id: 'bot_alpha',
      name: 'Viper (Bot)',
      team: 'blue',
      position: [35, 0.4, -20], // Guarding Site A
      velocity: [0, 0, 0],
      yaw: Math.PI,
      pitch: 0,
      health: 100,
      armor: 50,
      isAlive: true,
      activeWeaponId: 'vandal',
      targetWaypointIdx: 2,
      lastShotTimeSec: 0,
      seePlayerTimerSec: 0,
      isDefusing: false,
      isCrouching: false,
      tacticalTimer: 0.5,
      basePosition: [35, 0.4, -20],
    },
    {
      id: 'bot_bravo',
      name: 'Ghost (Bot)',
      team: 'blue',
      position: [-35, 0.4, -20], // Guarding Site B
      velocity: [0, 0, 0],
      yaw: Math.PI,
      pitch: 0,
      health: 100,
      armor: 50,
      isAlive: true,
      activeWeaponId: 'vandal',
      targetWaypointIdx: 2,
      lastShotTimeSec: 0,
      seePlayerTimerSec: 0,
      isDefusing: false,
      isCrouching: false,
      tacticalTimer: 1.8,
      basePosition: [-35, 0.4, -20],
    },
    {
      id: 'bot_charlie',
      name: 'Titan (Bot)',
      team: 'blue',
      position: [0, 2.6, -10], // Sniper in Mid Nest
      velocity: [0, 0, 0],
      yaw: Math.PI,
      pitch: 0,
      health: 100,
      armor: 50,
      isAlive: true,
      activeWeaponId: 'operator',
      targetWaypointIdx: 0,
      lastShotTimeSec: 0,
      seePlayerTimerSec: 0,
      isDefusing: false,
      isCrouching: false,
      tacticalTimer: 0.0,
      basePosition: [0, 2.6, -10],
    },
  ];
}

export interface BotUpdateResult {
  bot: Bot3DState;
  shouldShoot: boolean;
  damageDealtToPlayer: number;
}

/**
 * Checks if bot has unobstructed line of sight to player.
 */
export function hasLineOfSight(
  botPos: [number, number, number],
  playerPos: [number, number, number],
  colliders: readonly AABB[],
): boolean {
  const dx = playerPos[0] - botPos[0];
  const dy = playerPos[1] + 1.2 - (botPos[1] + 1.5);
  const dz = playerPos[2] - botPos[2];
  const dist = Math.hypot(dx, dy, dz);

  if (dist > 65) return false; // sight range cap

  const rayOrigin: [number, number, number] = [botPos[0], botPos[1] + 1.5, botPos[2]];
  const rayDir: [number, number, number] = [dx / dist, dy / dist, dz / dist];

  for (const box of colliders) {
    // Ignore floor boxes below eye level
    if (box.max[1] <= Math.min(botPos[1], playerPos[1]) + 0.3) continue;

    const hit = rayIntersectsAABB(rayOrigin, rayDir, box);
    if (hit.hit && hit.distance < dist - 0.5) {
      return false; // blocked by wall
    }
  }

  return true;
}

/**
 * Steps bot AI: navigation, aiming, line-of-sight reaction, shooting, and defusal.
 */
export function stepBot3D(
  current: Bot3DState,
  playerPos: [number, number, number],
  isPlayerAlive: boolean,
  spike: SpikeEntity,
  colliders: readonly AABB[],
  dt: number,
  nowSec: number,
): BotUpdateResult {
  const bot: Bot3DState = { ...current };
  let shouldShoot = false;
  let damageDealtToPlayer = 0;

  if (!bot.isAlive) {
    return { bot, shouldShoot: false, damageDealtToPlayer: 0 };
  }

  // 1. Defusal Behavior if Defender and Spike is Planted
  const isSpikePlanted = spike.state === 'planted' || spike.state === 'defusing';
  if (bot.team === 'blue' && isSpikePlanted && spike.position) {
    bot.isCrouching = false;
    const distToSpike = Math.hypot(
      bot.position[0] - spike.position[0],
      bot.position[2] - spike.position[2],
    );

    if (distToSpike > 2.0) {
      // Walk toward spike
      const dx = spike.position[0] - bot.position[0];
      const dz = spike.position[2] - bot.position[2];
      bot.yaw = Math.atan2(-dx, -dz);
      const speed = 4.2;
      bot.position[0] += (dx / distToSpike) * speed * dt;
      bot.position[2] += (dz / distToSpike) * speed * dt;
      bot.isDefusing = false;
    } else {
      // Close enough to defuse (crouch while defusing)
      bot.isDefusing = true;
      bot.isCrouching = true;
      return { bot, shouldShoot: false, damageDealtToPlayer: 0 };
    }
  }

  // 2. Line of Sight & Player Combat
  const canSeePlayer = isPlayerAlive && hasLineOfSight(bot.position, playerPos, colliders);

  if (canSeePlayer) {
    bot.seePlayerTimerSec += dt;

    // Aim toward player
    const dx = playerPos[0] - bot.position[0];
    const dy = playerPos[1] + 1.2 - (bot.position[1] + 1.5);
    const dz = playerPos[2] - bot.position[2];
    const distH = Math.hypot(dx, dz);

    // Yaw: In Three.js forward is -Z, so Math.atan2(-dx, -dz)
    bot.yaw = Math.atan2(-dx, -dz);
    bot.pitch = Math.atan2(dy, distH);

    // Combat crouch ducking between rifle bursts
    const timeSinceShot = nowSec - bot.lastShotTimeSec;
    if (timeSinceShot > 0.08 && timeSinceShot < 0.38 && bot.activeWeaponId !== 'operator') {
      bot.isCrouching = true;
    } else {
      bot.isCrouching = false;
    }

    // Tactical Retreat if low health (< 45 HP)
    if (bot.health < 45 && bot.armor <= 0 && distH < 35 && distH > 5) {
      const retreatSpeed = 2.2;
      bot.position[0] -= (dx / distH) * retreatSpeed * dt;
      bot.position[2] -= (dz / distH) * retreatSpeed * dt;
    }

    // Humanized reaction delay (0.35s before firing)
    if (bot.seePlayerTimerSec >= 0.35) {
      const minInterval = bot.activeWeaponId === 'operator' ? 1.4 : 0.22;
      if (nowSec - bot.lastShotTimeSec >= minInterval) {
        bot.lastShotTimeSec = nowSec;
        shouldShoot = true;
        bot.isCrouching = false; // Stand up to shoot

        // Inaccuracy cone based on distance (bots hit ~40% of shots at mid-range)
        const hitChance = Math.max(0.2, 0.7 - distH / 60);
        if (Math.random() < hitChance) {
          const isSniper = bot.activeWeaponId === 'operator';
          damageDealtToPlayer = isSniper ? 75 : 24;
        }
      }
    }
  } else {
    bot.seePlayerTimerSec = 0;
    bot.isDefusing = false;

    // Jiggle Peeking & Lane Scouting when guarding
    if (!isSpikePlanted && bot.basePosition) {
      bot.tacticalTimer = (bot.tacticalTimer || 0) + dt;
      const cycleTime = 4.0;
      const phase = bot.tacticalTimer % cycleTime;

      if (phase < 1.0) {
        // Step out to peek (1.4m lateral strafe)
        const strafeTarget = bot.basePosition[0] + (bot.basePosition[0] > 0 ? -1.4 : 1.4);
        bot.position[0] += (strafeTarget - bot.position[0]) * Math.min(1, dt * 4.0);
        bot.isCrouching = false;
      } else if (phase < 1.8) {
        // Hold angle and scout (crouch duck)
        bot.isCrouching = phase > 1.3;
      } else {
        // Return to cover
        bot.position[0] += (bot.basePosition[0] - bot.position[0]) * Math.min(1, dt * 4.0);
        bot.isCrouching = false;
      }
    }
  }

  return { bot, shouldShoot, damageDealtToPlayer };
}
