import type { AvatarConfig } from '../avatar/types';
import type { ActiveWeaponPickup, Bullet, WeaponType } from '../combat/types';
import { WEAPONS } from '../combat/weaponsConfig';
import { getSafeMuzzlePoint } from '../combat/updateBullets';
import { hasSolidLineOfSight, isPointInSolidTerrain } from '../map/terrainGeometry';
import type { GameMode, Team, Flag, MatchStatus } from '../ctf/types';
import type { ActiveRefillStation, GameMap } from '../map/types';
import { pickSpawnForMode } from '../player/playerStore';
import { updatePlayer } from '../player/updatePlayer';
import type { InputState, Player } from '../player/types';
import { sounds } from '../audio/soundEngine';

export type SoloSquadSize = '1v1' | '2v2' | '3v3';
export type BotDifficulty = 'cadet' | 'veteran' | 'ace';

export interface SoloBot {
  id: string;
  team: Team;
  player: Player;
  weaponType: WeaponType;
  ammo: number;
  lastFiredAtMs: number;
  aiRole: 'assault' | 'defender';
  difficulty: BotDifficulty;
  strafeDir: number;
  nextStrafeSwitchMs: number;
  aimPhase: number;
  isBoostingNow: boolean;
  lastDamagedBy?: {
    dealerId: string;
    weaponType: WeaponType;
    atMs?: number;
  } | null;
  input: InputState;
}

interface TargetCandidate {
  id: string;
  team: Team;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isDead: boolean;
  isInvulnerable: boolean;
  carryingFlag: boolean;
}

const BOT_BLUE_PRESETS: {
  id: string;
  callsign: string;
  role: 'assault' | 'defender';
  avatar: AvatarConfig;
}[] = [
  {
    id: 'bot_blue_falcon',
    callsign: 'FALCON-AI',
    role: 'defender',
    avatar: {
      callsign: 'FALCON-AI',
      bodyColor: '#0284c7',
      skinTone: '#fed7aa',
      headgear: 'robo_visor',
      headgearColor: '#0f172a',
      visorStyle: 'cyborg',
      visorColor: '#00f0ff',
      jetpackStyle: 'single_heavy',
    },
  },
  {
    id: 'bot_blue_nova',
    callsign: 'NOVA-AI',
    role: 'assault',
    avatar: {
      callsign: 'NOVA-AI',
      bodyColor: '#2563eb',
      skinTone: '#fdba74',
      headgear: 'soldier_helmet',
      headgearColor: '#1e293b',
      visorStyle: 'neon',
      visorColor: '#38bdf8',
      jetpackStyle: 'falcon_wings',
    },
  },
  {
    id: 'bot_blue_kestrel',
    callsign: 'KESTREL-AI',
    role: 'assault',
    avatar: {
      callsign: 'KESTREL-AI',
      bodyColor: '#0ea5e9',
      skinTone: '#fed7aa',
      headgear: 'beret',
      headgearColor: '#0f172a',
      visorStyle: 'sunglasses',
      visorColor: '#22d3ee',
      jetpackStyle: 'dual_tank',
    },
  },
];

const BOT_RED_PRESETS: {
  id: string;
  callsign: string;
  role: 'assault' | 'defender';
  avatar: AvatarConfig;
}[] = [
  {
    id: 'bot_red_spectre',
    callsign: 'SPECTRE-AI',
    role: 'assault',
    avatar: {
      callsign: 'SPECTRE-AI',
      bodyColor: '#e11d48',
      skinTone: '#fed7aa',
      headgear: 'horns',
      headgearColor: '#1e1b4b',
      visorStyle: 'goggles',
      visorColor: '#fb7185',
      jetpackStyle: 'falcon_wings',
    },
  },
  {
    id: 'bot_red_apex',
    callsign: 'APEX-AI',
    role: 'defender',
    avatar: {
      callsign: 'APEX-AI',
      bodyColor: '#b91c1c',
      skinTone: '#cbd5e1',
      headgear: 'gas_mask',
      headgearColor: '#0f172a',
      visorStyle: 'classic',
      visorColor: '#f59e0b',
      jetpackStyle: 'dual_tank',
    },
  },
  {
    id: 'bot_red_viper',
    callsign: 'VIPER-AI',
    role: 'assault',
    avatar: {
      callsign: 'VIPER-AI',
      bodyColor: '#9f1239',
      skinTone: '#fdba74',
      headgear: 'robo_visor',
      headgearColor: '#18181b',
      visorStyle: 'neon',
      visorColor: '#fbbf24',
      jetpackStyle: 'single_heavy',
    },
  },
];

let botBulletSeq = 0;

function createBotEntity(
  preset: (typeof BOT_BLUE_PRESETS)[number],
  team: Team,
  map: GameMap,
  idx: number,
  difficulty: BotDifficulty = 'veteran',
  mode: GameMode = 'ctf',
): SoloBot {
  const spawn = pickSpawnForMode(map, team, mode, preset.id);
  const player: Player = {
    id: preset.id,
    team,
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    radius: 16,
    boostFuel: 100,
    maxFuel: 100,
    health: 100,
    maxHealth: 100,
    aimAngle: team === 'blue' ? 0 : Math.PI,
    color: team === 'blue' ? '#3b82f6' : '#ef4444',
    avatar: preset.avatar,
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

  return {
    id: preset.id,
    team,
    player,
    weaponType: 'rifle',
    ammo: WEAPONS.rifle.maxAmmo,
    lastFiredAtMs: 0,
    aiRole: preset.role,
    difficulty,
    strafeDir: idx % 2 === 0 ? 1 : -1,
    nextStrafeSwitchMs: 1200 + idx * 400,
    aimPhase: idx * 1.7,
    isBoostingNow: false,
    lastDamagedBy: null,
    input: {
      moveX: 0,
      moveY: 0,
      boosting: false,
      aimAngle: player.aimAngle,
      shooting: false,
      dash: false,
    },
  };
}

export interface CreateSoloBotSquadOptions {
  squadSize?: SoloSquadSize;
  difficulty?: BotDifficulty;
  mode?: GameMode;
}

/**
 * Creates a balanced Solo Skirmish squad (defaults to 2v2 / veteran).
 */
export function createSoloBotSquad(
  map: GameMap,
  localTeam: Team,
  options?: CreateSoloBotSquadOptions,
): SoloBot[] {
  const squadSize = options?.squadSize ?? '2v2';
  const difficulty = options?.difficulty ?? 'veteran';
  const mode = options?.mode ?? 'ctf';
  const bots: SoloBot[] = [];

  if (mode === 'ffa') {
    const ffaCount = squadSize === '1v1' ? 1 : squadSize === '3v3' ? 5 : 3;
    const pool = [
      { preset: BOT_RED_PRESETS[0], team: 'red' as Team },
      { preset: BOT_BLUE_PRESETS[0], team: 'blue' as Team },
      { preset: BOT_RED_PRESETS[1], team: 'red' as Team },
      { preset: BOT_BLUE_PRESETS[1], team: 'blue' as Team },
      { preset: BOT_RED_PRESETS[2], team: 'red' as Team },
      { preset: BOT_BLUE_PRESETS[2], team: 'blue' as Team },
    ];
    for (let i = 0; i < ffaCount && i < pool.length; i++) {
      bots.push(
        createBotEntity(pool[i].preset, pool[i].team, map, i, difficulty, 'ffa'),
      );
    }
    return bots;
  }

  const enemyTeam: Team = localTeam === 'blue' ? 'red' : 'blue';

  const allyPresets = localTeam === 'blue' ? BOT_BLUE_PRESETS : BOT_RED_PRESETS;
  const enemyPresets = enemyTeam === 'blue' ? BOT_BLUE_PRESETS : BOT_RED_PRESETS;

  const allyCount = squadSize === '1v1' ? 0 : squadSize === '3v3' ? 2 : 1;
  const enemyCount = squadSize === '1v1' ? 1 : squadSize === '3v3' ? 3 : 2;

  let slotIdx = 0;
  for (let i = 0; i < allyCount && i < allyPresets.length; i++) {
    bots.push(createBotEntity(allyPresets[i], localTeam, map, slotIdx++, difficulty, mode));
  }
  for (let i = 0; i < enemyCount && i < enemyPresets.length; i++) {
    bots.push(createBotEntity(enemyPresets[i], enemyTeam, map, slotIdx++, difficulty, mode));
  }

  return bots;
}

function hasLineOfSight(
  map: GameMap,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): boolean {
  return hasSolidLineOfSight(map, x1, y1, x2, y2);
}

function hasWallAhead(map: GameMap, x: number, y: number, dirX: number): boolean {
  if (dirX === 0) return false;
  const probeX = x + dirX * 42;
  // Walkable slopes rise gradually (free at head/upper-torso level), whereas real walls block torso/head
  if (isPointInSolidTerrain(probeX, y - 16, map)) {
    return true;
  }
  if (isPointInSolidTerrain(probeX, y + 6, map) && isPointInSolidTerrain(x + dirX * 22, y - 14, map)) {
    return true;
  }
  return false;
}

function isOverHazard(map: GameMap, x: number, y: number, dirX: number): boolean {
  const lookX = x + dirX * 54;
  for (let i = 0; i < map.obstacles.length; i++) {
    const obs = map.obstacles[i];
    if (obs.type !== 'hazard') continue;
    if (
      (lookX >= obs.x - 45 && lookX <= obs.x + obs.width + 45) ||
      (x >= obs.x - 28 && x <= obs.x + obs.width + 28)
    ) {
      if (y > obs.y - 250) {
        return true;
      }
    }
  }
  return false;
}

export function hasCeilingAbove(map: GameMap, x: number, y: number, height: number = 80): boolean {
  for (let dy = 24; dy <= height; dy += 20) {
    const probeY = y - dy;
    if (
      isPointInSolidTerrain(x, probeY, map) ||
      isPointInSolidTerrain(x - 14, probeY, map) ||
      isPointInSolidTerrain(x + 14, probeY, map)
    ) {
      return true;
    }
  }
  return false;
}

export function findCeilingEscapeDirection(
  map: GameMap,
  x: number,
  y: number,
  preferredDir: number,
): number {
  if (!hasCeilingAbove(map, x, y, 80)) return 0;

  const maxProbe = 320;
  let leftClearDist = Infinity;
  let rightClearDist = Infinity;

  for (let offset = 24; offset <= maxProbe; offset += 24) {
    if (leftClearDist === Infinity && !hasCeilingAbove(map, x - offset, y, 80)) {
      leftClearDist = offset;
    }
    if (rightClearDist === Infinity && !hasCeilingAbove(map, x + offset, y, 80)) {
      rightClearDist = offset;
    }
    if (leftClearDist !== Infinity && rightClearDist !== Infinity) break;
  }

  if (leftClearDist === Infinity && rightClearDist !== Infinity) return 1;
  if (rightClearDist === Infinity && leftClearDist !== Infinity) return -1;
  if (leftClearDist === Infinity && rightClearDist === Infinity) {
    return preferredDir !== 0 ? preferredDir : 1;
  }

  if (preferredDir < 0 && leftClearDist <= rightClearDist + 48) return -1;
  if (preferredDir > 0 && rightClearDist <= leftClearDist + 48) return 1;
  return leftClearDist < rightClearDist ? -1 : 1;
}

export interface StepSoloBotsResult {
  spawnedBullets: Bullet[];
  newlyDeadBots: {
    bot: SoloBot;
    droppedFlagTeam: Team | null;
  }[];
  flagEvents: {
    action: 'pickup' | 'return' | 'capture';
    team: Team;
    carrierId: string;
    carrierName: string;
    x?: number;
    y?: number;
  }[];
  stationEffects: {
    x: number;
    y: number;
    color: string;
  }[];
}

export function stepSoloBots(params: {
  bots: SoloBot[];
  localPlayer: Player;
  map: GameMap;
  flags: Record<Team, Flag>;
  matchStatus: MatchStatus;
  pickups: ActiveWeaponPickup[];
  stations?: ActiveRefillStation[];
  respawnDelaySec?: number;
  mode?: GameMode;
  nowMs: number;
  dt: number;
}): StepSoloBotsResult {
  const {
    bots,
    localPlayer,
    map,
    flags,
    matchStatus,
    pickups,
    stations = [],
    respawnDelaySec = 4.5,
    mode = 'ctf',
    nowMs,
    dt,
  } = params;
  const isCTF = mode === 'ctf';
  const isFFA = mode === 'ffa';
  const spawnedBullets: Bullet[] = [];
  const newlyDeadBots: StepSoloBotsResult['newlyDeadBots'] = [];
  const flagEvents: StepSoloBotsResult['flagEvents'] = [];
  const stationEffects: StepSoloBotsResult['stationEffects'] = [];

  for (let i = 0; i < bots.length; i++) {
    const bot = bots[i];
    const p = bot.player;
    const wasDead = p.isDead;
    const prevCarryingFlag = p.carryingFlag;

    if (p.isDead) {
      bot.input.moveX = 0;
      bot.input.moveY = 0;
      bot.input.boosting = false;
      bot.input.shooting = false;
      bot.input.dash = false;
      bot.isBoostingNow = false;

      const updated = updatePlayer(p, bot.input, map, dt, false, respawnDelaySec, mode);
      bot.player = updated;
      if (wasDead && !updated.isDead) {
        bot.weaponType = 'rifle';
        bot.ammo = WEAPONS.rifle.maxAmmo;
        bot.lastDamagedBy = null;
      }
      continue;
    }

    const friendlyTeam = bot.team;
    const enemyTeam: Team = friendlyTeam === 'blue' ? 'red' : 'blue';
    const friendlyFlag = flags[friendlyTeam];
    const enemyFlag = flags[enemyTeam];

    // Collect potential opposing combat targets
    const targetAcc: {
      target: TargetCandidate | null;
      dist: number;
      hasLOS: boolean;
      score: number;
    } = {
      target: null,
      dist: Infinity,
      hasLOS: false,
      score: Infinity,
    };

    const considerCandidate = (cand: TargetCandidate) => {
      if (cand.isDead || (!isFFA && cand.team === bot.team)) return;
      const dist = Math.hypot(cand.x - p.x, cand.y - p.y);
      const los = dist < 660 && hasLineOfSight(map, p.x, p.y - 5, cand.x, cand.y - 5);
      const effectiveScore = dist - (los ? 280 : 0) - (isCTF && cand.carryingFlag ? 220 : 0);
      if (!targetAcc.target || effectiveScore < targetAcc.score) {
        targetAcc.target = cand;
        targetAcc.dist = dist;
        targetAcc.hasLOS = los;
        targetAcc.score = effectiveScore;
      }
    };

    considerCandidate({
      id: localPlayer.id,
      team: localPlayer.team,
      x: localPlayer.x,
      y: localPlayer.y,
      vx: localPlayer.vx,
      vy: localPlayer.vy,
      isDead: localPlayer.isDead,
      isInvulnerable: localPlayer.invulnerableTimer > 0,
      carryingFlag: localPlayer.carryingFlag,
    });

    for (let j = 0; j < bots.length; j++) {
      if (i === j) continue;
      const other = bots[j].player;
      considerCandidate({
        id: other.id,
        team: other.team,
        x: other.x,
        y: other.y,
        vx: other.vx,
        vy: other.vy,
        isDead: other.isDead,
        isInvulnerable: other.invulnerableTimer > 0,
        carryingFlag: other.carryingFlag,
      });
    }

    const activeTarget = targetAcc.target;
    const bestTargetDist = targetAcc.dist;
    const bestHasLOS = targetAcc.hasLOS;

    // Choose tactical waypoint (X, Y)
    let objX: number;
    let objY: number;

    if (!isCTF) {
      if (activeTarget) {
        objX = activeTarget.x;
        objY = activeTarget.y;
      } else {
        objX = map.width * 0.5;
        objY = map.height * 0.52;
      }

      if (bot.weaponType === 'pistol' || (bot.weaponType === 'rifle' && bot.ammo <= 10)) {
        for (let k = 0; k < pickups.length; k++) {
          const pk = pickups[k];
          if (pk.respawnTimer <= 0 && Math.hypot(pk.x - p.x, pk.y - p.y) < 280) {
            objX = pk.x;
            objY = pk.y;
            break;
          }
        }
      }
    } else if (p.carryingFlag) {
      objX = friendlyFlag.baseX;
      objY = friendlyFlag.baseY;
    } else if (
      friendlyFlag.status === 'dropped' &&
      (bot.aiRole === 'defender' ||
        Math.hypot(friendlyFlag.x - p.x, friendlyFlag.y - p.y) < 750)
    ) {
      objX = friendlyFlag.x;
      objY = friendlyFlag.y;
    } else if (
      bot.aiRole === 'defender' &&
      activeTarget &&
      bestTargetDist < 680 &&
      Math.hypot(activeTarget.x - friendlyFlag.baseX, activeTarget.y - friendlyFlag.baseY) < 980
    ) {
      objX = activeTarget.x;
      objY = activeTarget.y;
    } else if (enemyFlag.status !== 'carried') {
      objX = enemyFlag.x;
      objY = enemyFlag.y;

      // Opportunistic detour for nearby weapon crates
      if (bot.weaponType === 'pistol' || (bot.weaponType === 'rifle' && bot.ammo <= 10)) {
        for (let k = 0; k < pickups.length; k++) {
          const pk = pickups[k];
          if (pk.respawnTimer <= 0 && Math.hypot(pk.x - p.x, pk.y - p.y) < 250) {
            objX = pk.x;
            objY = pk.y;
            break;
          }
        }
      }
    } else if (activeTarget) {
      objX = activeTarget.x;
      objY = activeTarget.y;
    } else {
      objX = map.width * 0.5;
      objY = map.height * 0.52;
    }

    // Tactical refill detour when injured or low on jetpack fuel
    if (
      !p.carryingFlag &&
      stations.length > 0 &&
      (p.health < 62 || p.boostFuel < 30 || p.fuelOverheated)
    ) {
      let bestStationDist = 340;
      for (let sIdx = 0; sIdx < stations.length; sIdx++) {
        const st = stations[sIdx];
        if (st.respawnTimer > 0) continue;
        const qualifies =
          (st.stationType === 'medkit' && p.health < 80) ||
          (st.stationType === 'fuel' && (p.boostFuel < 45 || p.fuelOverheated)) ||
          (st.stationType === 'supply' && (p.health < 85 || p.boostFuel < 50 || p.fuelOverheated));
        if (!qualifies) continue;
        const d = Math.hypot(st.x - p.x, st.y - p.y);
        if (d < bestStationDist) {
          bestStationDist = d;
          objX = st.x;
          objY = st.y;
        }
      }
    }

    if (nowMs >= bot.nextStrafeSwitchMs) {
      bot.strafeDir = -bot.strafeDir;
      bot.nextStrafeSwitchMs = nowMs + 950 + ((i * 370 + Math.floor(nowMs)) % 900);
    }

    const dx = objX - p.x;
    const dy = objY - p.y;

    let moveX = 0;
    if (activeTarget && bestHasLOS && bestTargetDist < 360 && !p.carryingFlag) {
      if (bestTargetDist < 170) {
        moveX = Math.sign(p.x - activeTarget.x) || bot.strafeDir;
      } else {
        moveX = bot.strafeDir;
      }
    } else if (Math.abs(dx) > 22) {
      moveX = Math.sign(dx);
    }

    // Overhead ceiling & bridge overhang navigation:
    // If an overhead ceiling is blocking upward travel toward the objective, route horizontally toward the open edge!
    const initialHazard = isOverHazard(map, p.x, p.y, moveX);
    const ceilingBlocked = hasCeilingAbove(map, p.x, p.y);
    if (ceilingBlocked && dy < -30 && !initialHazard) {
      const escapeDir = findCeilingEscapeDirection(
        map,
        p.x,
        p.y,
        moveX || Math.sign(dx) || bot.strafeDir,
      );
      if (escapeDir !== 0) {
        moveX = escapeDir;
      }
    }

    // Bounce strafe away from arena edges
    if (p.x < 110 && moveX < 0) moveX = 1;
    else if (p.x > map.width - 110 && moveX > 0) moveX = -1;

    const wallBlocked = hasWallAhead(map, p.x, p.y, moveX);
    const hazardDanger = isOverHazard(map, p.x, p.y, moveX);

    // Opportunistically step onto nearby Bounce Pads when climbing or traversing obstacles
    let usingBouncePad = false;
    if ((dy < -75 || wallBlocked) && map.bouncePads && map.bouncePads.length > 0 && !hazardDanger) {
      let bestPadDist = 175;
      let targetPadCenter = 0;
      for (let pIdx = 0; pIdx < map.bouncePads.length; pIdx++) {
        const pad = map.bouncePads[pIdx];
        const padCx = pad.x + pad.width * 0.5;
        const horizDist = Math.abs(padCx - p.x);
        const vertDist = Math.abs(pad.y - (p.y + 20));
        const compatibleVx =
          !pad.launchVx || Math.abs(dx) < 80 || Math.sign(pad.launchVx) === Math.sign(dx);
        if (horizDist < bestPadDist && vertDist < 95 && compatibleVx) {
          bestPadDist = horizDist;
          targetPadCenter = padCx;
          usingBouncePad = true;
        }
      }
      if (usingBouncePad) {
        const diff = targetPadCenter - p.x;
        moveX = Math.abs(diff) > 8 ? Math.sign(diff) : 0;
      }
    }

    let boosting = false;
    if (hazardDanger) {
      boosting = !p.fuelOverheated && p.boostFuel > 4;
    } else if (usingBouncePad && Math.abs(dx) > 30) {
      boosting = false;
    } else if (ceilingBlocked && !hazardDanger) {
      // NEVER thrust straight into an overhead ceiling/bridge! Save fuel and walk horizontally out
      boosting = false;
    } else if (wallBlocked) {
      boosting = !p.fuelOverheated && p.boostFuel > 4;
    } else if (dy < -42 && !p.fuelOverheated && p.boostFuel > (p.isGrounded ? 20 : 10)) {
      boosting = true;
    } else if (!p.isGrounded && p.vy > 3.6 && !p.fuelOverheated && p.boostFuel > 18) {
      boosting = true;
    }

    const moveY = !hazardDanger && dy > 68 && p.isGrounded ? 1 : 0;

    // Occasional evasive dash during close duel or carrying flag
    const wantsDash =
      (p.dashCooldown ?? 0) <= 0 &&
      !p.fuelOverheated &&
      p.boostFuel >= 32 &&
      ((bestHasLOS && bestTargetDist < 310 && Math.random() < 0.015) ||
        (p.carryingFlag && bestTargetDist < 360 && Math.random() < 0.02));

    // Aim & combat evaluation scaled by difficulty
    const diff = bot.difficulty ?? 'veteran';
    const swayAmp = diff === 'cadet' ? 0.15 : diff === 'ace' ? 0.055 : 0.085;
    const engageRange = diff === 'cadet' ? 490 : diff === 'ace' ? 680 : 600;
    let aimAngle = p.aimAngle;
    let shouldShoot = false;
    if (matchStatus === 'playing' && activeTarget) {
      const cfg = WEAPONS[bot.weaponType];
      const leadSec = Math.min(0.45, bestTargetDist / Math.max(1, cfg.speed * 60));
      const aimX = activeTarget.x + activeTarget.vx * leadSec * 36;
      const aimY = activeTarget.y - 6 + activeTarget.vy * leadSec * 20;
      const sway = Math.sin(nowMs * 0.0045 + bot.aimPhase) * swayAmp;
      aimAngle = Math.atan2(aimY - (p.y - 5), aimX - p.x) + sway;

      const safeFromSelfBlast = !(bot.weaponType === 'rocket' && bestTargetDist < 135);
      if (bestHasLOS && bestTargetDist < engageRange && !activeTarget.isInvulnerable && safeFromSelfBlast) {
        shouldShoot = true;
      }
    } else if (moveX !== 0) {
      aimAngle = moveX > 0 ? -0.1 : Math.PI + 0.1;
    }

    bot.input.moveX = moveX;
    bot.input.moveY = moveY;
    bot.input.boosting = boosting;
    bot.input.aimAngle = aimAngle;
    bot.input.shooting = shouldShoot;
    bot.input.dash = wantsDash;

    const nextPlayer = updatePlayer(p, bot.input, map, dt, false, respawnDelaySec, mode);
    bot.player = nextPlayer;
    bot.isBoostingNow =
      boosting && !nextPlayer.fuelOverheated && nextPlayer.boostFuel > 0 && !nextPlayer.isDead;

    if (!wasDead && nextPlayer.isDead) {
      newlyDeadBots.push({
        bot,
        droppedFlagTeam: isCTF && prevCarryingFlag ? enemyTeam : null,
      });
      continue;
    }

    // Weapon Crate Pickups
    if (!nextPlayer.isDead) {
      for (let k = 0; k < pickups.length; k++) {
        const pickup = pickups[k];
        if (pickup.respawnTimer <= 0) {
          const d = Math.hypot(nextPlayer.x - pickup.x, nextPlayer.y - pickup.y);
          if (d < nextPlayer.radius + 18) {
            bot.weaponType = pickup.weaponType;
            bot.ammo = WEAPONS[pickup.weaponType].maxAmmo;
            pickup.respawnTimer = 20;
            break;
          }
        }
      }

      // Refill Stations (Medkit / Jetpack Fuel / Tactical Supply)
      for (let k = 0; k < stations.length; k++) {
        const st = stations[k];
        if (st.respawnTimer > 0) continue;
        const d = Math.hypot(nextPlayer.x - st.x, nextPlayer.y - st.y);
        if (d < nextPlayer.radius + 18) {
          const needsHealth = nextPlayer.health < nextPlayer.maxHealth - 0.5;
          const needsFuel =
            nextPlayer.boostFuel < nextPlayer.maxFuel - 1 ||
            Boolean(nextPlayer.fuelOverheated);

          if (st.stationType === 'medkit' && needsHealth) {
            nextPlayer.health = Math.min(nextPlayer.maxHealth, nextPlayer.health + 55);
            st.respawnTimer = st.cooldownSec;
            stationEffects.push({ x: st.x, y: st.y, color: '#34d399' });
            break;
          } else if (st.stationType === 'fuel' && needsFuel) {
            nextPlayer.boostFuel = nextPlayer.maxFuel;
            nextPlayer.fuelOverheated = false;
            nextPlayer.dashCooldown = 0;
            st.respawnTimer = st.cooldownSec;
            stationEffects.push({ x: st.x, y: st.y, color: '#38bdf8' });
            break;
          } else if (st.stationType === 'supply' && (needsHealth || needsFuel)) {
            nextPlayer.health = Math.min(nextPlayer.maxHealth, nextPlayer.health + 40);
            nextPlayer.boostFuel = nextPlayer.maxFuel;
            nextPlayer.fuelOverheated = false;
            nextPlayer.dashCooldown = 0;
            st.respawnTimer = st.cooldownSec;
            stationEffects.push({ x: st.x, y: st.y, color: '#a78bfa' });
            break;
          }
        }
      }
    }

    // Fire Weapon
    if (shouldShoot && !nextPlayer.isDead && matchStatus === 'playing') {
      const activeConfig = WEAPONS[bot.weaponType];
      const cadenceMult = diff === 'cadet' ? 1.45 : diff === 'ace' ? 0.85 : 1.0;
      const minFloor = diff === 'cadet' ? 300 : diff === 'ace' ? 135 : 175;
      const botFireCadenceMs = Math.max(Math.round(activeConfig.fireRateMs * cadenceMult), minFloor);
      if (nowMs - bot.lastFiredAtMs >= botFireCadenceMs) {
        bot.lastFiredAtMs = nowMs;

        const muzzleOriginX = nextPlayer.x;
        const muzzleOriginY = nextPlayer.y - 5;
        const muzzle = getSafeMuzzlePoint(
          muzzleOriginX,
          muzzleOriginY,
          aimAngle,
          18,
          map,
        );

        const spreadHalf = activeConfig.spread / 2;
        for (let pelletIdx = 0; pelletIdx < activeConfig.pellets; pelletIdx++) {
          const angleOffset =
            activeConfig.pellets > 1
              ? -spreadHalf + (activeConfig.spread * pelletIdx) / (activeConfig.pellets - 1)
              : (Math.random() - 0.5) * activeConfig.spread;
          const bulletAngle = aimAngle + angleOffset;
          spawnedBullets.push({
            id: `bb_${bot.id}_${botBulletSeq++}_${pelletIdx}`,
            shooterId: bot.id,
            team: bot.team,
            weaponType: bot.weaponType,
            x: muzzle.x,
            y: muzzle.y,
            vx: Math.cos(bulletAngle) * activeConfig.speed,
            vy: Math.sin(bulletAngle) * activeConfig.speed,
            damage: activeConfig.damage,
            blastRadius: activeConfig.blastRadius,
            lifespan: activeConfig.blastRadius > 0 ? 80 : 50,
            maxLifespan: activeConfig.blastRadius > 0 ? 80 : 50,
          });
        }

        nextPlayer.vx -= Math.cos(aimAngle) * activeConfig.recoil * 0.7;
        nextPlayer.vy -= Math.sin(aimAngle) * activeConfig.recoil * 0.7;

        const distToLocal = Math.hypot(nextPlayer.x - localPlayer.x, nextPlayer.y - localPlayer.y);
        if (distToLocal < 760) {
          sounds.playWeaponSound(bot.weaponType);
        }

        if (activeConfig.maxAmmo !== Infinity) {
          bot.ammo = Math.max(0, bot.ammo - 1);
          if (bot.ammo <= 0) {
            bot.weaponType = 'pistol';
            bot.ammo = Infinity;
          }
        }
      }
    }

    // CTF Objective Checks
    if (isCTF && !nextPlayer.isDead && matchStatus === 'playing') {
      if (enemyFlag.status !== 'carried') {
        const dEnemy = Math.hypot(nextPlayer.x - enemyFlag.x, nextPlayer.y - enemyFlag.y);
        if (dEnemy < nextPlayer.radius + 24) {
          flagEvents.push({
            action: 'pickup',
            team: enemyTeam,
            carrierId: bot.id,
            carrierName: bot.player.avatar.callsign,
          });
        }
      }

      if (friendlyFlag.status === 'dropped') {
        const dFriendly = Math.hypot(nextPlayer.x - friendlyFlag.x, nextPlayer.y - friendlyFlag.y);
        if (dFriendly < nextPlayer.radius + 24) {
          flagEvents.push({
            action: 'return',
            team: friendlyTeam,
            carrierId: bot.id,
            carrierName: bot.player.avatar.callsign,
          });
        }
      }

      if (nextPlayer.carryingFlag) {
        const dBase = Math.hypot(
          nextPlayer.x - friendlyFlag.baseX,
          nextPlayer.y - friendlyFlag.baseY,
        );
        if (dBase < 66) {
          flagEvents.push({
            action: 'capture',
            team: friendlyTeam,
            carrierId: bot.id,
            carrierName: bot.player.avatar.callsign,
          });
        }
      }
    }
  }

  return { spawnedBullets, newlyDeadBots, flagEvents, stationEffects };
}
