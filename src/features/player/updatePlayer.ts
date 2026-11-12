import type { Player, InputState } from './types';
import type { GameMap } from '../map/types';
import type { GameMode } from '../ctf/types';
import { sounds } from '../audio/soundEngine';
import { pickSpawnForMode } from './playerStore';
import {
  probeWalkableSurfaceBelow,
  resolveCapsuleVsTerrainShapes,
} from '../map/terrainGeometry';

// Reference physics tuned at 60 FPS and scaled cleanly by delta-time (dt * 60)
// so 60Hz, 90Hz, and 120Hz displays feel identical and responsive.
const GRAVITY = 0.21;
const THRUST = 0.46;
const MAX_RISE_SPEED = -5.25;
const MAX_FALL_SPEED = 7.2;

const GROUND_ACCEL = 0.42;
const AIR_ACCEL = 0.24;
const MAX_GROUND_SPEED = 2.75;
const MAX_AIR_SPEED = 3.6;

const GROUND_DRAG_X = 0.76;
const AIR_DRAG_X = 0.945;
const AIR_DRAG_Y = 0.96;

const BOOST_DRAIN = 0.42;
const BOOST_REGEN_AIR = 0.27;
const BOOST_REGEN_GROUND = 0.58;
const BOOST_RECOVER_THRESHOLD = 14;
const MAX_UPWARD_SPEED = -15;
const COYOTE_TIME_SEC = 0.11;
const GROUND_HOP_VY = -4.15;
const DASH_SPEED = 9.6;
const DASH_FUEL_COST = 18;
const DASH_COOLDOWN_SEC = 2.4;
const DASH_DURATION_SEC = 0.14;

export const PLAYER_HALF_WIDTH = 14;
export const PLAYER_HALF_HEIGHT = 25;

function isStandingOnPlatform(x: number, y: number, map: GameMap): boolean {
  const feetY = y + PLAYER_HALF_HEIGHT;
  for (let i = 0; i < map.obstacles.length; i++) {
    const obs = map.obstacles[i];
    if (obs.type !== 'platform') continue;
    if (
      x + PLAYER_HALF_WIDTH > obs.x + 0.01 &&
      x - PLAYER_HALF_WIDTH < obs.x + obs.width - 0.01 &&
      Math.abs(feetY - obs.y) <= 4
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Updates player physics, jetpack, timers, and humanoid obstacle collisions.
 */
export function updatePlayer(
  player: Player,
  input: InputState,
  map: GameMap,
  dt: number = 1 / 60,
  isLocalPlayer: boolean = true,
  respawnDelaySec: number = 4.5,
  mode: GameMode = 'ctf',
): Player {
  const safeDt = Math.max(0.001, Math.min(0.05, dt));
  const dtScale = safeDt * 60;

  // 1. Handle Dead / Respawn State
  if (player.isDead) {
    if (isLocalPlayer) {
      sounds.setJetpackBoosting(false);
    }
    const nextRespawnTimer = player.respawnTimer - safeDt;
    if (nextRespawnTimer <= 0) {
      const spawn = pickSpawnForMode(map, player.team, mode, player.id);
      return {
        ...player,
        x: spawn.x,
        y: spawn.y,
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
    }
    return {
      ...player,
      respawnTimer: nextRespawnTimer,
    };
  }

  const { x, y, maxFuel } = player;
  let { vx, vy, boostFuel, invulnerableTimer, health, respawnTimer, carryingFlag } = player;
  let fuelOverheated = Boolean(player.fuelOverheated);
  let isDead: boolean = player.isDead;
  const wasGrounded = Boolean(player.isGrounded);
  let dropThroughTimer = Math.max(0, (player.dropThroughTimer ?? 0) - safeDt);
  let coyoteTimer = wasGrounded
    ? COYOTE_TIME_SEC
    : Math.max(0, (player.coyoteTimer ?? 0) - safeDt);
  let dashCooldown = Math.max(0, (player.dashCooldown ?? 0) - safeDt);
  let dashActiveTimer = Math.max(0, (player.dashActiveTimer ?? 0) - safeDt);
  let bounceCooldownTimer = Math.max(0, (player.bounceCooldownTimer ?? 0) - safeDt);
  const wasBoostInput = Boolean(player.wasBoostInput);

  // Invulnerability timer decay
  if (invulnerableTimer > 0) {
    invulnerableTimer = Math.max(0, invulnerableTimer - safeDt);
  }

  // Platform drop-through intent (only inject downward impulse when perched on a one-way platform)
  const wantsDropThrough = (input.moveY ?? 0) > 0.5;
  if (wantsDropThrough) {
    dropThroughTimer = 0.24;
    if (wasGrounded && vy === 0 && isStandingOnPlatform(x, y, map)) {
      vy = 1.4;
    }
  }

  // Thruster Air-Dash (burst impulse with cooldown & fuel cost)
  if (input.dash && dashCooldown <= 0 && !fuelOverheated && boostFuel >= DASH_FUEL_COST) {
    const dashDir =
      Math.abs(input.moveX) > 0.15
        ? Math.sign(input.moveX)
        : Math.cos(input.aimAngle) >= 0
          ? 1
          : -1;
    vx = dashDir * DASH_SPEED;
    vy = Math.min(vy * 0.25, 0.4);
    boostFuel = Math.max(0, boostFuel - DASH_FUEL_COST);
    if (boostFuel <= 0) {
      boostFuel = 0;
      fuelOverheated = true;
    }
    dashCooldown = DASH_COOLDOWN_SEC;
    dashActiveTimer = DASH_DURATION_SEC;
    if (isLocalPlayer) {
      sounds.playDash();
    }
  }

  const prevVx = vx;
  const prevVy = vy;

  // 2. Horizontal Movement (Soft directional speed cap preserves knockback/recoil/dash)
  const accelX = wasGrounded ? GROUND_ACCEL : AIR_ACCEL;
  const maxInputSpeed = wasGrounded ? MAX_GROUND_SPEED : MAX_AIR_SPEED;
  const hasHorizInput = Math.abs(input.moveX) > 0.01;

  if (dashActiveTimer > 0) {
    // Preserve full thruster dash impulse during burst window
  } else if (hasHorizInput) {
    const dirSign = Math.sign(input.moveX);
    const targetSpeed = Math.abs(input.moveX) * maxInputSpeed;
    if (vx * dirSign < targetSpeed) {
      vx += input.moveX * accelX * dtScale;
      if (vx * dirSign > targetSpeed) {
        vx = dirSign * targetSpeed;
      }
    } else if (Math.abs(vx) > targetSpeed) {
      // Gently bleed excess knockback/recoil down toward input speed
      const activeDrag = wasGrounded ? GROUND_DRAG_X : AIR_DRAG_X;
      vx *= Math.pow(activeDrag, dtScale);
    }
  } else {
    const dragX = wasGrounded ? GROUND_DRAG_X : AIR_DRAG_X;
    vx *= Math.pow(dragX, dtScale);
    if (Math.abs(vx) < 0.03) {
      vx = 0;
    }
  }

  // 3. Jetpack Thrust + Crisp Ground/Coyote Takeoff Hop
  if (boostFuel <= 0) {
    boostFuel = 0;
    fuelOverheated = true;
  }

  if (!wasBoostInput && input.boosting && (wasGrounded || coyoteTimer > 0) && vy > -2.5) {
    vy = Math.min(vy, GROUND_HOP_VY);
    coyoteTimer = 0;
  }

  const isBoosting = input.boosting && !fuelOverheated && boostFuel > 0;
  if (isBoosting) {
    if (vy > MAX_RISE_SPEED) {
      vy -= THRUST * dtScale;
    }
    // Flag carrier has 15% higher fuel consumption
    const drainMultiplier = player.carryingFlag ? 1.15 : 1.0;
    boostFuel = Math.max(0, boostFuel - BOOST_DRAIN * drainMultiplier * dtScale);
    if (boostFuel <= 0) {
      boostFuel = 0;
      fuelOverheated = true;
    }
  } else {
    const regenRate = wasGrounded ? BOOST_REGEN_GROUND : BOOST_REGEN_AIR;
    boostFuel = Math.min(maxFuel, boostFuel + regenRate * dtScale);
    if (fuelOverheated && boostFuel >= BOOST_RECOVER_THRESHOLD) {
      fuelOverheated = false;
    }
  }

  // Trigger continuous audio for local player
  if (isLocalPlayer) {
    sounds.setJetpackBoosting(isBoosting);
  }

  // 4. Kinematics: Gravity, Drag & Terminal Clamps (Refresh-rate independent across 60/90/120Hz)
  vy += GRAVITY * dtScale;
  vy *= Math.pow(AIR_DRAG_Y, dtScale);
  if (isBoosting && prevVy >= MAX_RISE_SPEED && vy < MAX_RISE_SPEED) {
    vy = MAX_RISE_SPEED;
  } else if (vy > MAX_FALL_SPEED) {
    vy = MAX_FALL_SPEED;
  } else if (vy < MAX_UPWARD_SPEED) {
    vy = MAX_UPWARD_SPEED;
  }

  // 5. Tentative Next Position (Midpoint velocity integration)
  const totalDx = ((prevVx + vx) * 0.5) * dtScale;
  const totalDy = ((prevVy + vy) * 0.5) * dtScale;
  const hasTerrainShapes = Boolean(map.terrainShapes && map.terrainShapes.length > 0);
  const substeps = hasTerrainShapes
    ? Math.max(1, Math.min(4, Math.ceil(Math.hypot(totalDx, totalDy) / 7)))
    : 1;
  const stepDx = totalDx / substeps;
  const stepDy = totalDy / substeps;

  let curX = x;
  let curY = y;
  let nextX = x;
  let nextY = y;
  const halfW = PLAYER_HALF_WIDTH;
  const halfH = PLAYER_HALF_HEIGHT;
  let isGrounded = false;
  let groundNy = -1;

  for (let step = 0; step < substeps; step++) {
    nextX = curX + stepDx;
    nextY = curY + stepDy;

    // 6. Separated Axis Obstacle Collisions (X pass then Y pass prevents corner snagging)
    // 6a. Horizontal pass against solid walls/ground using swept edge tests + penetration fallback
    for (const obs of map.obstacles) {
      if (obs.type !== 'wall' && obs.type !== 'ground') continue;

      if (curY + halfH <= obs.y + 0.01 || curY - halfH >= obs.y + obs.height - 0.01) {
        continue;
      }

      const sweptRight = nextX > curX && curX + halfW <= obs.x + 4 && nextX + halfW > obs.x;
      const sweptLeft =
        nextX < curX && curX - halfW >= obs.x + obs.width - 4 && nextX - halfW < obs.x + obs.width;

      if (sweptRight) {
        const clamped = obs.x - halfW;
        if (nextX > clamped) {
          nextX = clamped;
        }
        if (vx > 0) vx = 0;
      } else if (sweptLeft) {
        const clamped = obs.x + obs.width + halfW;
        if (nextX < clamped) {
          nextX = clamped;
        }
        if (vx < 0) vx = 0;
      } else if (nextX + halfW > obs.x && nextX - halfW < obs.x + obs.width) {
        const pushLeft = nextX + halfW - obs.x;
        const pushRight = obs.x + obs.width - (nextX - halfW);
        const horizPen = Math.min(pushLeft, pushRight);
        const vertPen = Math.min(curY + halfH - obs.y, obs.y + obs.height - (curY - halfH));
        if (horizPen <= vertPen) {
          if (pushLeft <= pushRight) {
            nextX = obs.x - halfW;
            if (vx > 0) vx = 0;
          } else {
            nextX = obs.x + obs.width + halfW;
            if (vx < 0) vx = 0;
          }
        }
      }
    }

    if (nextX - halfW < 0) {
      nextX = halfW;
      vx = 0;
    } else if (nextX + halfW > map.width) {
      nextX = map.width - halfW;
      vx = 0;
    }

    // 6b. Vertical pass against solid walls/ground + one-way platforms
    for (const obs of map.obstacles) {
      if (obs.type === 'hazard') continue;

      if (nextX + halfW <= obs.x + 0.01 || nextX - halfW >= obs.x + obs.width - 0.01) {
        continue;
      }

      if (obs.type === 'wall' || obs.type === 'ground') {
        if (vy >= 0 && curY + halfH <= obs.y + 6 && nextY + halfH >= obs.y) {
          nextY = obs.y - halfH;
          vy = 0;
          isGrounded = true;
          groundNy = -1;
        } else if (
          vy <= 0 &&
          curY - halfH >= obs.y + obs.height - 6 &&
          nextY - halfH <= obs.y + obs.height
        ) {
          nextY = obs.y + obs.height + halfH;
          vy = 0;
        } else if (nextY + halfH > obs.y && nextY - halfH < obs.y + obs.height) {
          const pushUp = nextY + halfH - obs.y;
          const pushDown = obs.y + obs.height - (nextY - halfH);
          if (pushUp <= pushDown) {
            nextY = obs.y - halfH;
            if (vy > 0) vy = 0;
            isGrounded = true;
            groundNy = -1;
          } else {
            nextY = obs.y + obs.height + halfH;
            if (vy < 0) vy = 0;
          }
        }
      } else {
        // Platform (One-way jump-through unless holding down / drop-through active)
        if (dropThroughTimer <= 0 && !wantsDropThrough && vy >= 0 && curY + halfH <= obs.y + 6 && nextY + halfH >= obs.y) {
          nextY = obs.y - halfH;
          vy = 0;
          isGrounded = true;
          groundNy = -1;
        }
      }
    }

    // 6b-bis. Sloped & curved terrain resolution (capsule pushout + half-pipe tangent glide)
    if (hasTerrainShapes) {
      const terrainRes = resolveCapsuleVsTerrainShapes(
        nextX,
        nextY,
        vx,
        vy,
        halfW,
        halfH,
        map,
      );
      nextX = terrainRes.x;
      nextY = terrainRes.y;
      vx = terrainRes.vx;
      vy = terrainRes.vy;
      if (terrainRes.isGrounded) {
        isGrounded = true;
        groundNy = terrainRes.groundNy;
      }
      if (nextX - halfW < 0) {
        nextX = halfW;
        if (vx < 0) vx = 0;
      } else if (nextX + halfW > map.width) {
        nextX = map.width - halfW;
        if (vx > 0) vx = 0;
      }
    }

    curX = nextX;
    curY = nextY;
  }

  // Smooth downhill slope snapping so runners don't hop across convex hills/ramps
  if (
    hasTerrainShapes &&
    wasGrounded &&
    !isGrounded &&
    !isBoosting &&
    !wantsDropThrough &&
    bounceCooldownTimer <= 0 &&
    vy >= -0.4 &&
    Math.abs(nextX - x) > 0.05
  ) {
    const snap = probeWalkableSurfaceBelow(nextX, nextY + halfH, 10, map);
    if (snap) {
      nextY = snap.snapY - halfH;
      isGrounded = true;
      groundNy = snap.ny;
      const vn = vx * snap.nx + vy * snap.ny;
      if (vn < 0) {
        vx -= vn * snap.nx;
        vy -= vn * snap.ny;
      }
    }
  }

  // Keep standing pilots steady on angled ramps when idle
  if (
    hasTerrainShapes &&
    wasGrounded &&
    isGrounded &&
    groundNy > -0.995 &&
    !isBoosting &&
    !hasHorizInput &&
    dashActiveTimer <= 0 &&
    bounceCooldownTimer <= 0 &&
    Math.hypot(vx, vy) < 0.85
  ) {
    vx = 0;
    vy = 0;
    if (Math.hypot(nextX - x, nextY - y) < 0.45) {
      nextX = x;
      nextY = y;
    }
  }

  // 6c. Hazard triggers using resolved hitbox
  for (const obs of map.obstacles) {
    if (obs.type !== 'hazard') continue;
    if (
      nextX + halfW > obs.x &&
      nextX - halfW < obs.x + obs.width &&
      nextY + halfH > obs.y &&
      nextY - halfH < obs.y + obs.height
    ) {
      health = 0;
      isDead = true;
      respawnTimer = respawnDelaySec;
      carryingFlag = false;
      if (isLocalPlayer) {
        sounds.setJetpackBoosting(false);
      }
      break;
    }
  }

  // 6d. Bounce / Jump Pads
  if (!isDead && bounceCooldownTimer <= 0 && map.bouncePads && map.bouncePads.length > 0) {
    for (const pad of map.bouncePads) {
      if (
        nextX + halfW > pad.x &&
        nextX - halfW < pad.x + pad.width &&
        nextY + halfH > pad.y &&
        nextY - halfH < pad.y + pad.height
      ) {
        vy = pad.launchVy;
        if (typeof pad.launchVx === 'number' && pad.launchVx !== 0) {
          vx = pad.launchVx;
        }
        isGrounded = false;
        dropThroughTimer = 0;
        bounceCooldownTimer = 0.18;
        if (isLocalPlayer) {
          sounds.playBouncePad();
        }
        break;
      }
    }
  }

  // 7. Vertical World Map Boundary Clamping
  if (nextY - halfH < 0) {
    nextY = halfH;
    vy = 0;
  } else if (nextY + halfH > map.height) {
    nextY = map.height - halfH;
    vy = 0;
    isGrounded = true;
  }

  return {
    ...player,
    x: nextX,
    y: nextY,
    vx,
    vy,
    health,
    isDead,
    respawnTimer,
    carryingFlag,
    boostFuel,
    invulnerableTimer,
    aimAngle: input.aimAngle,
    isGrounded,
    fuelOverheated,
    dropThroughTimer,
    coyoteTimer,
    wasBoostInput: Boolean(input.boosting),
    dashCooldown,
    dashActiveTimer,
    bounceCooldownTimer,
  };
}
