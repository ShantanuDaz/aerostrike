import type { AvatarConfig } from '../avatar/types';
import type { Team } from '../ctf/types';
import type { GameMap } from '../map/types';
import {
  drawCombatBoot,
  drawHeadAndGear,
  drawJetpackModule,
  drawLimbSegment,
  getSoldierPalette,
} from '../avatar/renderAvatarParts';

export interface RagdollNode {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  radius: number;
}

export interface RagdollConstraint {
  a: number;
  b: number;
  length: number;
  stiffness: number;
}

export interface RagdollInstance {
  id: string;
  team: Team;
  avatar: AvatarConfig;
  facing: number;
  nodes: RagdollNode[];
  constraints: RagdollConstraint[];
  ttl: number;
  maxTtl: number;
}

// Node indices
const HEAD = 0;
const NECK = 1;
const PELVIS = 2;
const ELBOW_L = 3;
const HAND_L = 4;
const ELBOW_R = 5;
const HAND_R = 6;
const KNEE_L = 7;
const FOOT_L = 8;
const KNEE_R = 9;
const FOOT_R = 10;

const RAGDOLL_GRAVITY = 0.25;
const RAGDOLL_AIR_DRAG = 0.992;
const RAGDOLL_GROUND_FRICTION = 0.78;
const RAGDOLL_SOLVER_ITERS = 7;

export interface CreateRagdollParams {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  aimAngle: number;
  team: Team;
  avatar: AvatarConfig;
}

function makeNode(
  x: number,
  y: number,
  vx: number,
  vy: number,
  radius: number,
): RagdollNode {
  return { x, y, prevX: x, prevY: y, vx, vy, radius };
}

export function createRagdoll(params: CreateRagdollParams): RagdollInstance {
  const { id, x, y, vx, vy, aimAngle, team, avatar } = params;
  const facing = Math.cos(aimAngle) >= 0 ? 1 : -1;

  // Give ragdoll lively tumble velocity derived from impact + kick spin
  const baseVx = Math.max(-14, Math.min(14, vx));
  const baseVy = Math.max(-14, Math.min(14, vy - 2.2));
  const spinDir = Math.abs(baseVx) > 0.4 ? Math.sign(baseVx) : facing;

  const nodes: RagdollNode[] = [
    // 0: HEAD
    makeNode(x, y - 16, baseVx * 1.15 - spinDir * 1.8, baseVy - 1.5, 8),
    // 1: NECK / CHEST ROOT
    makeNode(x, y - 6, baseVx, baseVy, 5.5),
    // 2: PELVIS
    makeNode(x, y + 6, baseVx * 0.95 + spinDir * 0.8, baseVy + 0.4, 6),
    // 3: ELBOW L
    makeNode(x - 6, y - 2, baseVx - 1.4, baseVy - 0.8, 3.5),
    // 4: HAND L
    makeNode(x - 11, y + 4, baseVx - 2.4, baseVy - 1.8, 3.5),
    // 5: ELBOW R
    makeNode(x + 6, y - 2, baseVx + 1.4, baseVy - 0.6, 3.5),
    // 6: HAND R
    makeNode(x + 11, y + 4, baseVx + 2.4, baseVy - 1.5, 3.5),
    // 7: KNEE L
    makeNode(x - 4, y + 15, baseVx + spinDir * 1.5, baseVy + 0.8, 4),
    // 8: FOOT L
    makeNode(x - 5, y + 24, baseVx + spinDir * 2.8, baseVy + 1.4, 4.5),
    // 9: KNEE R
    makeNode(x + 4, y + 15, baseVx + spinDir * 1.1, baseVy + 0.5, 4),
    // 10: FOOT R
    makeNode(x + 5, y + 24, baseVx + spinDir * 2.2, baseVy + 1.0, 4.5),
  ];

  const dist = (a: number, b: number) =>
    Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y);

  const constraints: RagdollConstraint[] = [
    // Spine & Neck
    { a: HEAD, b: NECK, length: dist(HEAD, NECK), stiffness: 1.0 },
    { a: NECK, b: PELVIS, length: dist(NECK, PELVIS), stiffness: 1.0 },
    // Soft anti-fold brace keeping head/torso from collapsing completely inside each other
    { a: HEAD, b: PELVIS, length: dist(HEAD, PELVIS) * 0.95, stiffness: 0.35 },

    // Left Arm
    { a: NECK, b: ELBOW_L, length: 9, stiffness: 1.0 },
    { a: ELBOW_L, b: HAND_L, length: 8, stiffness: 1.0 },

    // Right Arm
    { a: NECK, b: ELBOW_R, length: 9, stiffness: 1.0 },
    { a: ELBOW_R, b: HAND_R, length: 8, stiffness: 1.0 },

    // Left Leg
    { a: PELVIS, b: KNEE_L, length: 10, stiffness: 1.0 },
    { a: KNEE_L, b: FOOT_L, length: 9.5, stiffness: 1.0 },

    // Right Leg
    { a: PELVIS, b: KNEE_R, length: 10, stiffness: 1.0 },
    { a: KNEE_R, b: FOOT_R, length: 9.5, stiffness: 1.0 },

    // Subtle shoulder-hip cross braces for stable torso volume
    { a: ELBOW_L, b: PELVIS, length: 14, stiffness: 0.08 },
    { a: ELBOW_R, b: PELVIS, length: 14, stiffness: 0.08 },
  ];

  return {
    id,
    team,
    avatar,
    facing,
    nodes,
    constraints,
    ttl: 4.5,
    maxTtl: 4.5,
  };
}

function resolveRagdollObstacles(
  nodes: RagdollNode[],
  map: GameMap,
): boolean[] {
  const groundedFlags = new Array<boolean>(nodes.length).fill(false);

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const r = n.radius;

    // Obstacle collisions
    for (const obs of map.obstacles) {
      if (obs.type === 'hazard') continue;

      if (obs.type === 'platform') {
        // One-way platform landing
        const wasAbove = n.prevY + r <= obs.y + 5;
        const withinX = n.x + r > obs.x && n.x - r < obs.x + obs.width;
        if (wasAbove && withinX && n.y + r >= obs.y && n.y - n.prevY >= -0.5) {
          n.y = obs.y - r;
          groundedFlags[i] = true;
        }
        continue;
      }

      // Solid wall / ground push-out along minimum penetration axis
      const nearestX = Math.max(obs.x, Math.min(n.x, obs.x + obs.width));
      const nearestY = Math.max(obs.y, Math.min(n.y, obs.y + obs.height));
      const dx = n.x - nearestX;
      const dy = n.y - nearestY;
      const distSq = dx * dx + dy * dy;

      if (distSq < r * r) {
        if (distSq > 0.0001) {
          const d = Math.sqrt(distSq);
          const overlap = r - d;
          const nx = dx / d;
          const ny = dy / d;
          n.x += nx * overlap;
          n.y += ny * overlap;
          if (ny < -0.5) {
            groundedFlags[i] = true;
          }
        } else {
          // Node center inside rectangle: push out toward nearest edge
          const penLeft = n.x - obs.x;
          const penRight = obs.x + obs.width - n.x;
          const penTop = n.y - obs.y;
          const penBottom = obs.y + obs.height - n.y;
          const minPen = Math.min(penLeft, penRight, penTop, penBottom);

          if (minPen === penTop) {
            n.y = obs.y - r;
            groundedFlags[i] = true;
          } else if (minPen === penBottom) {
            n.y = obs.y + obs.height + r;
          } else if (minPen === penLeft) {
            n.x = obs.x - r;
          } else {
            n.x = obs.x + obs.width + r;
          }
        }
      }
    }

    // World boundary clamping
    if (n.x - r < 0) n.x = r;
    else if (n.x + r > map.width) n.x = map.width - r;

    if (n.y - r < 0) n.y = r;
    else if (n.y + r > map.height) {
      n.y = map.height - r;
      groundedFlags[i] = true;
    }
  }

  return groundedFlags;
}

export function updateRagdolls(
  ragdolls: RagdollInstance[],
  map: GameMap,
  dt: number,
): RagdollInstance[] {
  const safeDt = Math.max(0.001, Math.min(0.05, dt));
  const dtScale = safeDt * 60;
  const drag = Math.pow(RAGDOLL_AIR_DRAG, dtScale);

  const active: RagdollInstance[] = [];

  for (const rag of ragdolls) {
    rag.ttl -= safeDt;
    if (rag.ttl <= 0) continue;

    // 1. PBD Prediction Step
    for (const n of rag.nodes) {
      n.prevX = n.x;
      n.prevY = n.y;
      n.vy += RAGDOLL_GRAVITY * dtScale;
      n.x += n.vx * dtScale;
      n.y += n.vy * dtScale;
    }

    // 2. Iterative Distance Constraints & Terrain Collisions
    let lastGrounded: boolean[] = [];
    for (let iter = 0; iter < RAGDOLL_SOLVER_ITERS; iter++) {
      for (const c of rag.constraints) {
        const na = rag.nodes[c.a];
        const nb = rag.nodes[c.b];
        const dx = nb.x - na.x;
        const dy = nb.y - na.y;
        const d = Math.hypot(dx, dy) || 0.0001;
        const diff = ((d - c.length) / d) * 0.5 * c.stiffness;
        na.x += dx * diff;
        na.y += dy * diff;
        nb.x -= dx * diff;
        nb.y -= dy * diff;
      }

      lastGrounded = resolveRagdollObstacles(rag.nodes, map);
    }

    // 3. Derive frame-rate-independent velocities with ground friction
    for (let i = 0; i < rag.nodes.length; i++) {
      const n = rag.nodes[i];
      let nextVx = ((n.x - n.prevX) / dtScale) * drag;
      let nextVy = ((n.y - n.prevY) / dtScale) * drag;

      if (lastGrounded[i]) {
        nextVx *= Math.pow(RAGDOLL_GROUND_FRICTION, dtScale);
        if (Math.abs(nextVy) < 0.3) nextVy = 0;
        if (Math.abs(nextVx) < 0.05) nextVx = 0;
      }

      n.vx = Math.max(-18, Math.min(18, nextVx));
      n.vy = Math.max(-18, Math.min(18, nextVy));
    }

    active.push(rag);
  }

  return active;
}

export function renderRagdoll(
  ctx: CanvasRenderingContext2D,
  ragdoll: RagdollInstance,
  timeSec: number,
): void {
  const n = ragdoll.nodes;
  const palette = getSoldierPalette(ragdoll.avatar, ragdoll.team);
  const fadeAlpha = ragdoll.ttl < 0.85 ? Math.max(0, ragdoll.ttl / 0.85) : 1;

  ctx.save();
  ctx.globalAlpha = fadeAlpha;

  // Torso orientation angle from pelvis -> neck
  const spineAngle =
    Math.atan2(n[PELVIS].y - n[NECK].y, n[PELVIS].x - n[NECK].x) - Math.PI / 2;
  const torsoMidX = (n[NECK].x + n[PELVIS].x) * 0.5;
  const torsoMidY = (n[NECK].y + n[PELVIS].y) * 0.5;

  // Dynamic facing from neck -> head tilt or stored facing
  const headAngle =
    Math.atan2(n[NECK].y - n[HEAD].y, n[NECK].x - n[HEAD].x) - Math.PI / 2;

  // 1. Jetpack attached to torso spine (flickering out, no active boost)
  ctx.save();
  ctx.translate(
    torsoMidX - ragdoll.facing * 5 * Math.cos(spineAngle),
    torsoMidY - ragdoll.facing * 5 * Math.sin(spineAngle),
  );
  ctx.rotate(spineAngle);
  ctx.scale(ragdoll.facing, 1);
  drawJetpackModule(ctx, ragdoll.avatar, false, timeSec);
  ctx.restore();

  // 2. Back Leg (L)
  drawLimbSegment(
    ctx,
    n[PELVIS].x,
    n[PELVIS].y,
    n[KNEE_L].x,
    n[KNEE_L].y,
    4.6,
    palette.secondary,
    palette.outline,
  );
  drawLimbSegment(
    ctx,
    n[KNEE_L].x,
    n[KNEE_L].y,
    n[FOOT_L].x,
    n[FOOT_L].y,
    4.0,
    palette.joint,
    palette.outline,
    palette.secondary,
  );
  const bootAngleL = Math.atan2(
    n[FOOT_L].y - n[KNEE_L].y,
    n[FOOT_L].x - n[KNEE_L].x,
  ) - Math.PI / 2;
  drawCombatBoot(
    ctx,
    n[FOOT_L].x,
    n[FOOT_L].y,
    bootAngleL,
    ragdoll.facing,
    palette.secondary,
    palette.trim,
  );

  // 3. Back Arm (L)
  drawLimbSegment(
    ctx,
    n[NECK].x,
    n[NECK].y,
    n[ELBOW_L].x,
    n[ELBOW_L].y,
    3.6,
    palette.secondary,
    palette.outline,
  );
  drawLimbSegment(
    ctx,
    n[ELBOW_L].x,
    n[ELBOW_L].y,
    n[HAND_L].x,
    n[HAND_L].y,
    3.2,
    palette.joint,
    palette.outline,
    palette.secondary,
  );

  // 4. Armored Torso Chassis aligned to spine
  ctx.save();
  ctx.translate(torsoMidX, torsoMidY);
  ctx.rotate(spineAngle);

  ctx.fillStyle = palette.primary;
  ctx.strokeStyle = palette.outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-6.5, -7.5, 13, 15, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
  ctx.beginPath();
  ctx.roundRect(-4.5, -4.5, 9, 9, 2);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-6.5, 4.2, 13, 2.5);
  ctx.restore();

  // 5. Front Leg (R)
  drawLimbSegment(
    ctx,
    n[PELVIS].x,
    n[PELVIS].y,
    n[KNEE_R].x,
    n[KNEE_R].y,
    4.8,
    palette.primary,
    palette.outline,
  );
  drawLimbSegment(
    ctx,
    n[KNEE_R].x,
    n[KNEE_R].y,
    n[FOOT_R].x,
    n[FOOT_R].y,
    4.2,
    palette.joint,
    palette.outline,
    palette.trim,
  );
  const bootAngleR = Math.atan2(
    n[FOOT_R].y - n[KNEE_R].y,
    n[FOOT_R].x - n[KNEE_R].x,
  ) - Math.PI / 2;
  drawCombatBoot(
    ctx,
    n[FOOT_R].x,
    n[FOOT_R].y,
    bootAngleR,
    ragdoll.facing,
    palette.primary,
    palette.trim,
  );

  // 6. Head + Gear
  ctx.save();
  ctx.translate(n[HEAD].x, n[HEAD].y);
  ctx.rotate(headAngle);
  drawHeadAndGear(ctx, ragdoll.avatar, ragdoll.facing, palette, timeSec);
  ctx.restore();

  // 7. Front Arm (R)
  drawLimbSegment(
    ctx,
    n[NECK].x,
    n[NECK].y,
    n[ELBOW_R].x,
    n[ELBOW_R].y,
    3.8,
    palette.primary,
    palette.outline,
  );
  drawLimbSegment(
    ctx,
    n[ELBOW_R].x,
    n[ELBOW_R].y,
    n[HAND_R].x,
    n[HAND_R].y,
    3.4,
    palette.joint,
    palette.outline,
    palette.trim,
  );

  ctx.restore();
}
