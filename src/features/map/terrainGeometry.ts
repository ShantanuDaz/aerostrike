import type {
  GameMap,
  TerrainPoint,
  TerrainShape,
  TerrainSurfaceStyle,
} from './types';

export interface CompiledTerrainEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dx: number;
  dy: number;
  len: number;
  lenSq: number;
  /** Outward unit normal in screen coordinates (+x right, +y down) */
  nx: number;
  ny: number;
  isWalkable: boolean;
  isCeiling: boolean;
}

export interface CompiledTerrainShape {
  id?: string;
  kind: TerrainShape['kind'];
  type: 'ground' | 'wall';
  color?: string;
  trimColor?: string;
  style: TerrainSurfaceStyle;
  points: TerrainPoint[];
  edges: CompiledTerrainEdge[];
  /** Primary top contour for trim rendering */
  topArc: TerrainPoint[];
  /** Optional bottom contour for vaulted arches / suspended spans */
  bottomArc: TerrainPoint[] | null;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface TerrainRaycastHit {
  t: number;
  hitX: number;
  hitY: number;
  nx: number;
  ny: number;
  style: TerrainSurfaceStyle | 'rect';
}

export interface CapsuleTerrainResult {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isGrounded: boolean;
  groundNx: number;
  groundNy: number;
  hitCeiling: boolean;
}

const WALKABLE_NORMAL_MAX_Y = -0.60; // ~53 deg max slope angle
const CEILING_NORMAL_MIN_Y = 0.45;

interface CacheEntry {
  shapesRef: TerrainShape[] | undefined;
  count: number;
  compiled: CompiledTerrainShape[];
}

const mapShapeCache = new WeakMap<GameMap, CacheEntry>();

function signedPolygonArea(pts: TerrainPoint[]): number {
  let area2 = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    area2 += p1.x * p2.y - p2.x * p1.y;
  }
  return area2 * 0.5;
}

function dedupeSequentialPoints(pts: TerrainPoint[], eps = 0.25): TerrainPoint[] {
  if (pts.length === 0) return [];
  const out: TerrainPoint[] = [{ x: pts[0].x, y: pts[0].y }];
  for (let i = 1; i < pts.length; i++) {
    const prev = out[out.length - 1];
    const cur = pts[i];
    if (Math.hypot(cur.x - prev.x, cur.y - prev.y) > eps) {
      out.push({ x: cur.x, y: cur.y });
    }
  }
  if (out.length > 2) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.hypot(last.x - first.x, last.y - first.y) <= eps) {
      out.pop();
    }
  }
  return out;
}

/**
 * Samples a smooth Catmull-Rom curve passing through every control point.
 */
export function sampleCatmullRom(
  controlPoints: TerrainPoint[],
  totalSubdivisions: number = 18,
): TerrainPoint[] {
  if (controlPoints.length < 2) {
    return controlPoints.map((p) => ({ x: p.x, y: p.y }));
  }
  if (controlPoints.length === 2) {
    const steps = Math.max(1, Math.min(8, Math.round(totalSubdivisions / 2)));
    const a = controlPoints[0];
    const b = controlPoints[1];
    const out: TerrainPoint[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
    return out;
  }

  const n = controlPoints.length;
  const spans = n - 1;
  const perSpan = Math.max(2, Math.ceil(totalSubdivisions / spans));
  const out: TerrainPoint[] = [];

  for (let i = 0; i < spans; i++) {
    const p0 = controlPoints[Math.max(0, i - 1)];
    const p1 = controlPoints[i];
    const p2 = controlPoints[i + 1];
    const p3 = controlPoints[Math.min(n - 1, i + 2)];

    const stepEnd = i === spans - 1 ? perSpan : perSpan - 1;
    for (let s = 0; s <= stepEnd; s++) {
      const t = s / perSpan;
      const t2 = t * t;
      const t3 = t2 * t;
      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      out.push({ x, y });
    }
  }
  return out;
}

function compileSingleShape(
  shape: TerrainShape,
  mapHeight: number,
): CompiledTerrainShape | null {
  let rawPoints: TerrainPoint[];
  let topArc: TerrainPoint[];
  let bottomArc: TerrainPoint[] | null = null;

  if (shape.kind === 'polygon') {
    rawPoints = shape.points.map((p) => ({ x: p.x, y: p.y }));
    topArc = [];
  } else {
    if (shape.topPoints.length < 2) return null;
    const spanW = Math.abs(
      shape.topPoints[shape.topPoints.length - 1].x - shape.topPoints[0].x,
    );
    const autoSamples = Math.max(8, Math.min(42, Math.round(spanW / 32)));
    const samples = shape.samples ?? autoSamples;
    const sampledTop = sampleCatmullRom(shape.topPoints, samples);
    topArc = sampledTop;

    if (shape.bottomPoints && shape.bottomPoints.length >= 2) {
      const sampledBot = sampleCatmullRom(shape.bottomPoints, samples);
      bottomArc = sampledBot;
      rawPoints = [...sampledTop, ...[...sampledBot].reverse()];
    } else {
      const baselineY = shape.bottomY ?? mapHeight;
      const lastTop = sampledTop[sampledTop.length - 1];
      const firstTop = sampledTop[0];
      rawPoints = [
        ...sampledTop,
        { x: lastTop.x, y: baselineY },
        { x: firstTop.x, y: baselineY },
      ];
    }
  }

  const pts = dedupeSequentialPoints(rawPoints);
  if (pts.length < 3) return null;

  const area = signedPolygonArea(pts);
  if (Math.abs(area) < 1) return null;
  // Screen Y points down: clockwise polygons have positive shoelace area,
  // ensuring (ey / len, -ex / len) always points strictly outward.
  if (area < 0) {
    pts.reverse();
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const edges: CompiledTerrainEdge[] = [];

  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if (a.x < minX) minX = a.x;
    if (a.y < minY) minY = a.y;
    if (a.x > maxX) maxX = a.x;
    if (a.y > maxY) maxY = a.y;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    const len = Math.sqrt(lenSq);
    if (len < 1e-4) continue;
    const nx = dy / len;
    const ny = -dx / len;
    edges.push({
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      dx,
      dy,
      len,
      lenSq,
      nx,
      ny,
      isWalkable: ny <= WALKABLE_NORMAL_MAX_Y,
      isCeiling: ny >= CEILING_NORMAL_MIN_Y,
    });
  }

  if (edges.length < 3) return null;

  return {
    id: shape.id,
    kind: shape.kind,
    type: shape.type ?? 'ground',
    color: shape.color,
    trimColor: shape.trimColor,
    style: shape.style ?? (shape.type === 'wall' ? 'alloy' : 'rock'),
    points: pts,
    edges,
    topArc,
    bottomArc,
    minX,
    minY,
    maxX,
    maxY,
  };
}

export function getCompiledTerrainShapes(map: GameMap): CompiledTerrainShape[] {
  const shapes = map.terrainShapes;
  if (!shapes || shapes.length === 0) return [];

  const cached = mapShapeCache.get(map);
  if (cached && cached.shapesRef === shapes && cached.count === shapes.length) {
    return cached.compiled;
  }

  const compiled: CompiledTerrainShape[] = [];
  for (let i = 0; i < shapes.length; i++) {
    const item = compileSingleShape(shapes[i], map.height);
    if (item) compiled.push(item);
  }
  mapShapeCache.set(map, {
    shapesRef: shapes,
    count: shapes.length,
    compiled,
  });
  return compiled;
}

export function isPointInPolygon(
  px: number,
  py: number,
  shape: CompiledTerrainShape,
): boolean {
  if (px < shape.minX || px > shape.maxX || py < shape.minY || py > shape.maxY) {
    return false;
  }
  let inside = false;
  const pts = shape.points;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x;
    const yi = pts[i].y;
    const xj = pts[j].x;
    const yj = pts[j].y;

    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isPointInSolidTerrain(
  px: number,
  py: number,
  map: GameMap,
): boolean {
  for (let i = 0; i < map.obstacles.length; i++) {
    const obs = map.obstacles[i];
    if (obs.type !== 'wall' && obs.type !== 'ground') continue;
    if (
      px >= obs.x &&
      px <= obs.x + obs.width &&
      py >= obs.y &&
      py <= obs.y + obs.height
    ) {
      return true;
    }
  }
  const shapes = getCompiledTerrainShapes(map);
  for (let i = 0; i < shapes.length; i++) {
    if (isPointInPolygon(px, py, shapes[i])) {
      return true;
    }
  }
  return false;
}

function closestVerticalSpineToEdge(
  cx: number,
  topY: number,
  botY: number,
  edge: CompiledTerrainEdge,
): {
  distSq: number;
  sx: number;
  sy: number;
  ex: number;
  ey: number;
} {
  let bestDistSq = Infinity;
  let bestSx = cx;
  let bestSy = topY;
  let bestEx = edge.x1;
  let bestEy = edge.y1;

  const testPair = (sy: number, u: number) => {
    const ex = edge.x1 + edge.dx * u;
    const ey = edge.y1 + edge.dy * u;
    const ddx = cx - ex;
    const ddy = sy - ey;
    const dSq = ddx * ddx + ddy * ddy;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestSx = cx;
      bestSy = sy;
      bestEx = ex;
      bestEy = ey;
    }
  };

  // 1. Direct X crossing (minimum 0 if spine intersects edge)
  if (Math.abs(edge.dx) > 1e-8) {
    const uCross = (cx - edge.x1) / edge.dx;
    if (uCross >= 0 && uCross <= 1) {
      const yCross = edge.y1 + edge.dy * uCross;
      const sy = yCross < topY ? topY : yCross > botY ? botY : yCross;
      testPair(sy, uCross);
    }
  }

  // 2. Top & bottom spine endpoints projected onto edge
  const invLenSq = 1 / Math.max(1e-8, edge.lenSq);
  const uTop = Math.max(
    0,
    Math.min(1, ((cx - edge.x1) * edge.dx + (topY - edge.y1) * edge.dy) * invLenSq),
  );
  testPair(topY, uTop);

  const uBot = Math.max(
    0,
    Math.min(1, ((cx - edge.x1) * edge.dx + (botY - edge.y1) * edge.dy) * invLenSq),
  );
  testPair(botY, uBot);

  // 3. Edge endpoints projected onto vertical spine
  const sy1 = edge.y1 < topY ? topY : edge.y1 > botY ? botY : edge.y1;
  testPair(sy1, 0);

  const sy2 = edge.y2 < topY ? topY : edge.y2 > botY ? botY : edge.y2;
  testPair(sy2, 1);

  return {
    distSq: bestDistSq,
    sx: bestSx,
    sy: bestSy,
    ex: bestEx,
    ey: bestEy,
  };
}

/**
 * Resolves a humanoid capsule hitbox against compiled polygonal & curved terrain shapes.
 * Supports smooth uphill climbing, vaulted ceiling sliding, and half-pipe tangent gliding.
 */
export function resolveCapsuleVsTerrainShapes(
  inX: number,
  inY: number,
  inVx: number,
  inVy: number,
  halfW: number,
  halfH: number,
  map: GameMap,
): CapsuleTerrainResult {
  const shapes = getCompiledTerrainShapes(map);
  if (shapes.length === 0) {
    return {
      x: inX,
      y: inY,
      vx: inVx,
      vy: inVy,
      isGrounded: false,
      groundNx: 0,
      groundNy: -1,
      hitCeiling: false,
    };
  }

  let x = inX;
  let y = inY;
  let vx = inVx;
  let vy = inVy;
  let isGrounded = false;
  let groundNx = 0;
  let groundNy = -1;
  let hitCeiling = false;

  const radius = halfW;
  const spineHalf = Math.max(1, halfH - radius);
  const rSq = radius * radius;

  // Two relaxation passes keep concave valley / ramp junctions completely leak-free
  for (let pass = 0; pass < 2; pass++) {
    let anyPush = false;

    for (let sIdx = 0; sIdx < shapes.length; sIdx++) {
      const shape = shapes[sIdx];
      if (
        x + halfW <= shape.minX - 1 ||
        x - halfW >= shape.maxX + 1 ||
        y + halfH <= shape.minY - 1 ||
        y - halfH >= shape.maxY + 1
      ) {
        continue;
      }

      const topY = y - spineHalf;
      const botY = y + spineHalf;

      // Test containment for spine center/ends
      const insideMid = isPointInPolygon(x, y, shape);
      const insideTop = isPointInPolygon(x, topY, shape);
      const insideBot = isPointInPolygon(x, botY, shape);

      if (insideMid || insideTop || insideBot) {
        // Find shallowest escape edge for the spine center
        const probeY = insideBot && !insideTop ? botY : insideTop && !insideBot ? topY : y;
        let bestEdge: CompiledTerrainEdge | null = null;
        let bestDist = Infinity;

        for (let eIdx = 0; eIdx < shape.edges.length; eIdx++) {
          const edge = shape.edges[eIdx];
          const invLenSq = 1 / Math.max(1e-8, edge.lenSq);
          const u = Math.max(
            0,
            Math.min(1, ((x - edge.x1) * edge.dx + (probeY - edge.y1) * edge.dy) * invLenSq),
          );
          const ex = edge.x1 + edge.dx * u;
          const ey = edge.y1 + edge.dy * u;
          const d = Math.hypot(x - ex, probeY - ey);
          if (d < bestDist) {
            bestDist = d;
            bestEdge = edge;
          }
        }

        if (bestEdge) {
          const pushDist = bestDist + radius + 0.05;
          x += bestEdge.nx * pushDist;
          y += bestEdge.ny * pushDist;
          anyPush = true;

          const vn = vx * bestEdge.nx + vy * bestEdge.ny;
          if (vn < 0) {
            vx -= vn * bestEdge.nx;
            vy -= vn * bestEdge.ny;
          }
          if (bestEdge.isWalkable) {
            isGrounded = true;
            groundNx = bestEdge.nx;
            groundNy = bestEdge.ny;
          } else if (bestEdge.isCeiling) {
            hitCeiling = true;
          }
        }
        continue;
      }

      // Exterior capsule-vs-edge closest distance pushout
      let bestMinDistSq = rSq;
      let bestPushNx = 0;
      let bestPushNy = 0;
      let bestEdgeNormalY = 0;
      let bestEdgeNormalX = 0;

      for (let eIdx = 0; eIdx < shape.edges.length; eIdx++) {
        const edge = shape.edges[eIdx];
        // Edge bounding reject
        const eMinX = edge.x1 < edge.x2 ? edge.x1 : edge.x2;
        const eMaxX = edge.x1 > edge.x2 ? edge.x1 : edge.x2;
        const eMinY = edge.y1 < edge.y2 ? edge.y1 : edge.y2;
        const eMaxY = edge.y1 > edge.y2 ? edge.y1 : edge.y2;
        if (
          x + radius < eMinX - 1 ||
          x - radius > eMaxX + 1 ||
          botY + radius < eMinY - 1 ||
          topY - radius > eMaxY + 1
        ) {
          continue;
        }

        const c = closestVerticalSpineToEdge(x, topY, botY, edge);
        if (c.distSq < bestMinDistSq) {
          const dist = Math.sqrt(c.distSq);
          if (dist > 1e-5) {
            bestMinDistSq = c.distSq;
            bestPushNx = (c.sx - c.ex) / dist;
            bestPushNy = (c.sy - c.ey) / dist;
            bestEdgeNormalX = edge.nx;
            bestEdgeNormalY = edge.ny;
          } else {
            bestMinDistSq = 0;
            bestPushNx = edge.nx;
            bestPushNy = edge.ny;
            bestEdgeNormalX = edge.nx;
            bestEdgeNormalY = edge.ny;
          }
        }
      }

      if (bestMinDistSq < rSq) {
        const dist = Math.sqrt(bestMinDistSq);
        const overlap = radius - dist;
        if (overlap > 0.0001) {
          // Ensure normal points outward when touching boundary
          const dotOut = bestPushNx * bestEdgeNormalX + bestPushNy * bestEdgeNormalY;
          const nx = dotOut < -0.2 ? bestEdgeNormalX : bestPushNx;
          const ny = dotOut < -0.2 ? bestEdgeNormalY : bestPushNy;

          x += nx * overlap;
          y += ny * overlap;
          anyPush = true;

          const vn = vx * nx + vy * ny;
          if (vn < 0) {
            vx -= vn * nx;
            vy -= vn * ny;
          }
          if (ny <= WALKABLE_NORMAL_MAX_Y) {
            isGrounded = true;
            groundNx = nx;
            groundNy = ny;
          } else if (ny >= CEILING_NORMAL_MIN_Y) {
            hitCeiling = true;
          }
        }
      }
    }

    if (!anyPush) break;
  }

  return {
    x,
    y,
    vx,
    vy,
    isGrounded,
    groundNx,
    groundNy,
    hitCeiling,
  };
}

/**
 * Downhill ground-snap probe: keeps grounded runners glued smoothly along downward
 * slopes and curved bowls instead of bunny-hopping off facets.
 */
export function probeWalkableSurfaceBelow(
  x: number,
  feetY: number,
  maxDrop: number,
  map: GameMap,
): { snapY: number; nx: number; ny: number } | null {
  const shapes = getCompiledTerrainShapes(map);
  let bestT = 2;
  let bestNx = 0;
  let bestNy = -1;

  const y1 = feetY - 2;
  const y2 = feetY + maxDrop;

  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes[i];
    if (x < shape.minX - 2 || x > shape.maxX + 2 || y2 < shape.minY || y1 > shape.maxY) {
      continue;
    }
    for (let eIdx = 0; eIdx < shape.edges.length; eIdx++) {
      const edge = shape.edges[eIdx];
      if (!edge.isWalkable || Math.abs(edge.dx) < 1e-4) continue;
      const minEx = edge.x1 < edge.x2 ? edge.x1 : edge.x2;
      const maxEx = edge.x1 > edge.x2 ? edge.x1 : edge.x2;
      if (x < minEx || x > maxEx) continue;

      const u = (x - edge.x1) / edge.dx;
      const ey = edge.y1 + u * edge.dy;
      const t = (ey - y1) / (y2 - y1);
      if (t >= 0 && t <= 1 && t < bestT) {
        bestT = t;
        bestNx = edge.nx;
        bestNy = edge.ny;
      }
    }
  }

  // Also check solid obstacle tops in case stepping from a slope onto a flat ground floor
  for (let i = 0; i < map.obstacles.length; i++) {
    const obs = map.obstacles[i];
    if (obs.type !== 'ground' && obs.type !== 'wall') continue;
    if (x <= obs.x || x >= obs.x + obs.width) continue;
    if (obs.y >= y1 && obs.y <= y2) {
      const t = (obs.y - y1) / (y2 - y1);
      if (t < bestT) {
        bestT = t;
        bestNx = 0;
        bestNy = -1;
      }
    }
  }

  if (bestT > 1) return null;
  return {
    snapY: y1 + bestT * (y2 - y1),
    nx: bestNx,
    ny: bestNy,
  };
}

/**
 * Resolves a simple circle (used by ragdoll nodes and remote network extrapolation)
 * against all compiled terrain shapes.
 */
export function resolveCircleVsTerrainShapes(
  inX: number,
  inY: number,
  radius: number,
  map: GameMap,
): { x: number; y: number; grounded: boolean; nx: number; ny: number } {
  const shapes = getCompiledTerrainShapes(map);
  if (shapes.length === 0) {
    return { x: inX, y: inY, grounded: false, nx: 0, ny: -1 };
  }

  let x = inX;
  let y = inY;
  let grounded = false;
  let outNx = 0;
  let outNy = -1;
  const rSq = radius * radius;

  for (let sIdx = 0; sIdx < shapes.length; sIdx++) {
    const shape = shapes[sIdx];
    if (
      x + radius <= shape.minX ||
      x - radius >= shape.maxX ||
      y + radius <= shape.minY ||
      y - radius >= shape.maxY
    ) {
      continue;
    }

    const inside = isPointInPolygon(x, y, shape);
    let bestEdge: CompiledTerrainEdge | null = null;
    let bestEx = x;
    let bestEy = y;
    let bestDistSq = inside ? Infinity : rSq;

    for (let eIdx = 0; eIdx < shape.edges.length; eIdx++) {
      const edge = shape.edges[eIdx];
      const invLenSq = 1 / Math.max(1e-8, edge.lenSq);
      const u = Math.max(
        0,
        Math.min(1, ((x - edge.x1) * edge.dx + (y - edge.y1) * edge.dy) * invLenSq),
      );
      const ex = edge.x1 + edge.dx * u;
      const ey = edge.y1 + edge.dy * u;
      const dSq = (x - ex) * (x - ex) + (y - ey) * (y - ey);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestEdge = edge;
        bestEx = ex;
        bestEy = ey;
      }
    }

    if (bestEdge) {
      const dist = Math.sqrt(bestDistSq);
      if (inside) {
        const push = dist + radius;
        x += bestEdge.nx * push;
        y += bestEdge.ny * push;
        outNx = bestEdge.nx;
        outNy = bestEdge.ny;
        if (bestEdge.isWalkable) grounded = true;
      } else if (dist < radius) {
        const overlap = radius - dist;
        const nx = dist > 1e-5 ? (x - bestEx) / dist : bestEdge.nx;
        const ny = dist > 1e-5 ? (y - bestEy) / dist : bestEdge.ny;
        x += nx * overlap;
        y += ny * overlap;
        outNx = nx;
        outNy = ny;
        if (ny <= -0.5) grounded = true;
      }
    }
  }

  return { x, y, grounded, nx: outNx, ny: outNy };
}

function segmentSegmentHitT(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): number | null {
  const rx = bx - ax;
  const ry = by - ay;
  const sx = dx - cx;
  const sy = dy - cy;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-8) return null;

  const qpx = cx - ax;
  const qpy = cy - ay;
  const t = (qpx * sy - qpy * sx) / denom;
  const u = (qpx * ry - qpy * rx) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return t;
  }
  return null;
}

function segmentRectHitWithNormal(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): { t: number; nx: number; ny: number } | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  let enterNx = 0;
  let enterNy = 0;

  if (Math.abs(dx) < 1e-8) {
    if (x1 < rx || x1 > rx + rw) return null;
  } else {
    let rEnter = (rx - x1) / dx;
    let rExit = (rx + rw - x1) / dx;
    let nx = -1;
    if (dx < 0) {
      const tmp = rEnter;
      rEnter = rExit;
      rExit = tmp;
      nx = 1;
    }
    if (rEnter > t0) {
      t0 = rEnter;
      enterNx = nx;
      enterNy = 0;
    }
    if (rExit < t1) t1 = rExit;
    if (t0 > t1) return null;
  }

  if (Math.abs(dy) < 1e-8) {
    if (y1 < ry || y1 > ry + rh) return null;
  } else {
    let rEnter = (ry - y1) / dy;
    let rExit = (ry + rh - y1) / dy;
    let ny = -1;
    if (dy < 0) {
      const tmp = rEnter;
      rEnter = rExit;
      rExit = tmp;
      ny = 1;
    }
    if (rEnter > t0) {
      t0 = rEnter;
      enterNx = 0;
      enterNy = ny;
    }
    if (rExit < t1) t1 = rExit;
    if (t0 > t1) return null;
  }

  if (t0 <= t1) {
    return { t: t0, nx: enterNx, ny: enterNy };
  }
  return null;
}

/**
 * Unified segment raycast against solid rectangular obstacles AND all sloped/curved terrain shapes.
 */
export function raycastMapTerrain(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  map: GameMap,
): TerrainRaycastHit | null {
  let bestHit: TerrainRaycastHit | null = null;
  const segMinX = x1 < x2 ? x1 : x2;
  const segMaxX = x1 > x2 ? x1 : x2;
  const segMinY = y1 < y2 ? y1 : y2;
  const segMaxY = y1 > y2 ? y1 : y2;

  for (let i = 0; i < map.obstacles.length; i++) {
    const obs = map.obstacles[i];
    if (obs.type !== 'wall' && obs.type !== 'ground') continue;
    if (
      segMaxX < obs.x ||
      segMinX > obs.x + obs.width ||
      segMaxY < obs.y ||
      segMinY > obs.y + obs.height
    ) {
      continue;
    }
    const hit = segmentRectHitWithNormal(
      x1,
      y1,
      x2,
      y2,
      obs.x,
      obs.y,
      obs.width,
      obs.height,
    );
    if (hit && (!bestHit || hit.t < bestHit.t)) {
      bestHit = {
        t: hit.t,
        hitX: x1 + (x2 - x1) * hit.t,
        hitY: y1 + (y2 - y1) * hit.t,
        nx: hit.nx,
        ny: hit.ny,
        style: 'rect',
      };
    }
  }

  const shapes = getCompiledTerrainShapes(map);
  for (let sIdx = 0; sIdx < shapes.length; sIdx++) {
    const shape = shapes[sIdx];
    if (
      segMaxX < shape.minX ||
      segMinX > shape.maxX ||
      segMaxY < shape.minY ||
      segMinY > shape.maxY
    ) {
      continue;
    }

    if (isPointInPolygon(x1, y1, shape)) {
      return {
        t: 0,
        hitX: x1,
        hitY: y1,
        nx: 0,
        ny: -1,
        style: shape.style,
      };
    }

    for (let eIdx = 0; eIdx < shape.edges.length; eIdx++) {
      const edge = shape.edges[eIdx];
      const t = segmentSegmentHitT(
        x1,
        y1,
        x2,
        y2,
        edge.x1,
        edge.y1,
        edge.x2,
        edge.y2,
      );
      if (t !== null && (!bestHit || t < bestHit.t)) {
        bestHit = {
          t,
          hitX: x1 + (x2 - x1) * t,
          hitY: y1 + (y2 - y1) * t,
          nx: edge.nx,
          ny: edge.ny,
          style: shape.style,
        };
      }
    }
  }

  return bestHit;
}

export function hasSolidLineOfSight(
  map: GameMap,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): boolean {
  return raycastMapTerrain(x1, y1, x2, y2, map) === null;
}
