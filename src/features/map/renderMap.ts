import type { ActiveRefillStation, GameMap } from './types';
import { getCompiledTerrainShapes, type CompiledTerrainShape } from './terrainGeometry';
import { getMapThemePalette, type ThemePalette } from './renderBackdrop';

let cachedStaticCanvas: HTMLCanvasElement | null = null;
let cachedStaticKey = '';

function drawTerrainShape(
  ctx: CanvasRenderingContext2D,
  shape: CompiledTerrainShape,
  palette: ThemePalette,
): void {
  const pts = shape.points;
  if (pts.length < 3) return;

  ctx.save();

  const baseColor =
    shape.color ??
    (shape.style === 'rock'
      ? palette.terrainRock
      : shape.style === 'deflector'
        ? '#1e293b'
        : palette.terrainRockAlt);

  // 1. Trace closed polygon & clip for interior texture
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.closePath();

  const spanH = Math.max(12, shape.maxY - shape.minY);
  const bodyGrad = ctx.createLinearGradient(0, shape.minY, 0, shape.maxY);
  bodyGrad.addColorStop(0, baseColor);
  bodyGrad.addColorStop(1, '#090d18');
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  ctx.save();
  ctx.clip();

  if (shape.style === 'rock' || shape.style === 'crystal' || shape.style === 'ice') {
    // Diagonal geologic strata / crystal facets (zero per-frame cost; cached once)
    ctx.strokeStyle =
      shape.style === 'ice' || shape.style === 'crystal'
        ? 'rgba(103, 232, 249, 0.085)'
        : 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = shape.style === 'rock' ? 7 : 4;
    const step = shape.style === 'rock' ? 38 : 28;
    ctx.beginPath();
    for (let sx = shape.minX - spanH; sx <= shape.maxX + spanH; sx += step) {
      ctx.moveTo(sx, shape.minY - 8);
      ctx.lineTo(sx + spanH * 0.55, shape.maxY + 8);
    }
    ctx.stroke();
  } else if (shape.style === 'deflector') {
    // Angled tactical armor stripes on sloped bunker deflectors
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.055)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let sx = shape.minX - spanH; sx <= shape.maxX + spanH; sx += 26) {
      ctx.moveTo(sx, shape.maxY + 8);
      ctx.lineTo(sx + spanH * 0.65, shape.minY - 8);
    }
    ctx.stroke();
  } else {
    // Brushed alloy seam lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let px = Math.ceil(shape.minX / 64) * 64; px < shape.maxX; px += 64) {
      ctx.moveTo(px, shape.minY);
      ctx.lineTo(px, shape.maxY);
    }
    ctx.stroke();
  }

  // Subtle top subsurface highlight band
  ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.fillRect(shape.minX, shape.minY, shape.maxX - shape.minX, Math.min(10, spanH * 0.25));
  ctx.restore();

  // 2. Perimeter contour stroke
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.26)';
  ctx.lineWidth = 1.25;
  ctx.stroke();

  // 3. Crisp glowing surface trim along walkable curves / sloped edges
  const trim = shape.trimColor ?? palette.terrainTrim;
  ctx.strokeStyle = trim;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (shape.topArc.length >= 2) {
    ctx.globalAlpha = 0.72;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(shape.topArc[0].x, shape.topArc[0].y + 1);
    for (let i = 1; i < shape.topArc.length; i++) {
      ctx.lineTo(shape.topArc[i].x, shape.topArc[i].y + 1);
    }
    ctx.stroke();

    if (shape.bottomArc && shape.bottomArc.length >= 2) {
      ctx.globalAlpha = 0.34;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(shape.bottomArc[0].x, shape.bottomArc[0].y - 1);
      for (let i = 1; i < shape.bottomArc.length; i++) {
        ctx.lineTo(shape.bottomArc[i].x, shape.bottomArc[i].y - 1);
      }
      ctx.stroke();
    }
  } else {
    ctx.globalAlpha = 0.68;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let i = 0; i < shape.edges.length; i++) {
      const e = shape.edges[i];
      if (!e.isWalkable) continue;
      ctx.moveTo(e.x1, e.y1 + 0.8);
      ctx.lineTo(e.x2, e.y2 + 0.8);
    }
    ctx.stroke();
  }

  ctx.restore();
}

function drawStaticMapLayer(
  ctx: CanvasRenderingContext2D,
  map: GameMap,
  skipBackground: boolean,
): void {
  const palette = getMapThemePalette(map);

  // 1. Deep Space Void Background (optional when GameCanvas draws parallax sky layer)
  if (!skipBackground) {
    ctx.fillStyle = map.backgroundColor || '#060913';
    ctx.fillRect(0, 0, map.width, map.height);
  }

  // 2. Subtle Tactical Grid & Sector Boundaries
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.025)';
  ctx.lineWidth = 1;
  const gridSize = 100;

  ctx.beginPath();
  for (let x = 0; x <= map.width; x += gridSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, map.height);
  }
  for (let y = 0; y <= map.height; y += gridSize) {
    ctx.moveTo(0, y);
    ctx.lineTo(map.width, y);
  }
  ctx.stroke();

  // Subtle world boundary perimeter line
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, map.width - 2, map.height - 2);
  ctx.restore();

  // 3. Team Base Zones (Clean Hologram Pads)
  const drawOutpostZone = (
    zone: { x: number; y: number; width: number; height: number },
    label: string,
    rgb: string,
    primaryColor: string,
  ) => {
    ctx.save();
    const grad = ctx.createLinearGradient(zone.x, zone.y + zone.height, zone.x, zone.y);
    grad.addColorStop(0, `rgba(${rgb}, 0.14)`);
    grad.addColorStop(1, `rgba(${rgb}, 0.02)`);
    ctx.fillStyle = grad;
    ctx.fillRect(zone.x, zone.y, zone.width, zone.height);

    ctx.strokeStyle = `rgba(${rgb}, 0.25)`;
    ctx.lineWidth = 1;
    ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);

    // Clean corner brackets
    const len = 14;
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(zone.x, zone.y + len);
    ctx.lineTo(zone.x, zone.y);
    ctx.lineTo(zone.x + len, zone.y);
    ctx.moveTo(zone.x + zone.width - len, zone.y);
    ctx.lineTo(zone.x + zone.width, zone.y);
    ctx.lineTo(zone.x + zone.width, zone.y + len);
    ctx.moveTo(zone.x, zone.y + zone.height - len);
    ctx.lineTo(zone.x, zone.y + zone.height);
    ctx.lineTo(zone.x + len, zone.y + zone.height);
    ctx.moveTo(zone.x + zone.width - len, zone.y + zone.height);
    ctx.lineTo(zone.x + zone.width, zone.y + zone.height);
    ctx.lineTo(zone.x + zone.width, zone.y + zone.height - len);
    ctx.stroke();

    ctx.fillStyle = `rgba(${rgb}, 0.72)`;
    ctx.font = 'bold 9px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(label, zone.x + 10, zone.y + 16);
    ctx.restore();
  };

  if (map.baseBlue) {
    drawOutpostZone(map.baseBlue, 'BLUE OUTPOST', '0, 240, 255', '#38bdf8');
  }

  if (map.baseRed) {
    drawOutpostZone(map.baseRed, 'RED OUTPOST', '255, 0, 85', '#fb7185');
  }

  // 4. Static Platforms & Walls
  for (const obstacle of map.obstacles) {
    if (obstacle.type === 'hazard') continue;

    ctx.save();
    ctx.fillStyle = obstacle.color ?? '#0f172a';
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

    // Subtle interior panel sheen
    ctx.fillStyle = 'rgba(255, 255, 255, 0.028)';
    ctx.fillRect(
      obstacle.x + 2,
      obstacle.y + 3,
      Math.max(0, obstacle.width - 4),
      Math.min(8, Math.max(0, obstacle.height - 4)),
    );

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

    // Crisp Glowing Top Rail
    ctx.fillStyle =
      obstacle.type === 'platform'
        ? 'rgba(56, 189, 248, 0.58)'
        : obstacle.type === 'ground'
          ? 'rgba(56, 189, 248, 0.34)'
          : 'rgba(148, 163, 184, 0.30)';
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, Math.min(2.5, obstacle.height));

    // Recessed bolts only on wider platforms
    if (obstacle.width >= 60 && obstacle.height >= 14) {
      ctx.fillStyle = 'rgba(100, 116, 139, 0.5)';
      ctx.beginPath();
      ctx.arc(obstacle.x + 7, obstacle.y + 8, 1.5, 0, Math.PI * 2);
      ctx.arc(obstacle.x + obstacle.width - 7, obstacle.y + 8, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 5. Sloped & Curved Terrain Shapes
  const terrainShapes = getCompiledTerrainShapes(map);
  for (let i = 0; i < terrainShapes.length; i++) {
    drawTerrainShape(ctx, terrainShapes[i], palette);
  }
}

/**
 * Renders the map background, tactical grid lines, sleek outpost zones, armored platforms,
 * and sloped/curved terrain hulls.
 * Static layers are cached in an offscreen canvas; animated hazards draw dynamically per frame.
 */
export function renderMap(
  ctx: CanvasRenderingContext2D,
  map: GameMap,
  timeSec: number = 0,
  skipBackground: boolean = false,
): void {
  if (typeof document !== 'undefined') {
    const shapeCount = map.terrainShapes ? map.terrainShapes.length : 0;
    const key = `${map.id}:${map.theme ?? ''}:${map.width}x${map.height}:${map.obstacles.length}:${shapeCount}:${skipBackground ? 1 : 0}`;
    if (!cachedStaticCanvas || cachedStaticKey !== key) {
      const offscreen = cachedStaticCanvas ?? document.createElement('canvas');
      offscreen.width = map.width;
      offscreen.height = map.height;
      const offCtx = offscreen.getContext('2d');
      if (offCtx) {
        offCtx.clearRect(0, 0, map.width, map.height);
        drawStaticMapLayer(offCtx, map, skipBackground);
        cachedStaticCanvas = offscreen;
        cachedStaticKey = key;
      } else {
        drawStaticMapLayer(ctx, map, skipBackground);
      }
    }

    if (cachedStaticCanvas && cachedStaticKey === key) {
      ctx.drawImage(cachedStaticCanvas, 0, 0);
    }
  } else {
    drawStaticMapLayer(ctx, map, skipBackground);
  }

  // Animated Thermal Hazards (drawn dynamically each frame for shimmer pulse)
  for (const obstacle of map.obstacles) {
    if (obstacle.type !== 'hazard') continue;

    ctx.save();
    ctx.fillStyle = 'rgba(153, 27, 27, 0.94)';
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

    ctx.fillStyle = 'rgba(239, 68, 68, 0.55)';
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, Math.min(7, obstacle.height * 0.35));

    const shimmer = 0.7 + Math.sin(timeSec * 5) * 0.3;
    ctx.fillStyle = `rgba(251, 146, 60, ${0.85 * shimmer})`;
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, 3);

    ctx.strokeStyle = 'rgba(248, 113, 113, 0.65)';
    ctx.lineWidth = 1;
    ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

    ctx.fillStyle = 'rgba(254, 240, 138, 0.85)';
    ctx.font = 'bold 9px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      'THERMAL HAZARD',
      obstacle.x + obstacle.width / 2,
      obstacle.y + Math.min(18, obstacle.height * 0.65),
    );
    ctx.restore();
  }

  // Animated Bounce / Jump Pads
  if (map.bouncePads && map.bouncePads.length > 0) {
    for (const pad of map.bouncePads) {
      const accent = pad.color ?? '#22d3ee';
      const pulse = 0.6 + Math.sin(timeSec * 6.5) * 0.4;
      const cx = pad.x + pad.width * 0.5;
      const vxTilt = typeof pad.launchVx === 'number' ? pad.launchVx * 0.085 : 0;

      ctx.save();
      // Pedestal housing
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.fillRect(pad.x, pad.y + 3, pad.width, Math.max(4, pad.height - 3));
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = 1;
      ctx.strokeRect(pad.x, pad.y + 3, pad.width, Math.max(4, pad.height - 3));

      // Glowing launch plate
      ctx.fillStyle = accent;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 10 * pulse;
      ctx.fillRect(pad.x + 2, pad.y, Math.max(4, pad.width - 4), 4);
      ctx.shadowBlur = 0;

      // Rising chevron field
      const arrowOffset = (timeSec * 22) % 14;
      for (let step = 0; step < 2; step++) {
        const yOff = ((arrowOffset + step * 7) % 14) + 5;
        const alpha = Math.max(0.12, 1 - yOff / 20);
        const shiftX = vxTilt * yOff * 2.2;
        ctx.strokeStyle = accent;
        ctx.globalAlpha = alpha * 0.85;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx + shiftX - 9, pad.y - yOff + 5);
        ctx.lineTo(cx + shiftX, pad.y - yOff);
        ctx.lineTo(cx + shiftX + 9, pad.y - yOff + 5);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

/**
 * Renders interactive Medkit, Jetpack Fuel, and Tactical Supply Refill Stations.
 */
export function renderRefillStations(
  ctx: CanvasRenderingContext2D,
  stations: ActiveRefillStation[],
  timeSec: number,
): void {
  if (!stations || stations.length === 0) return;

  for (let i = 0; i < stations.length; i++) {
    const st = stations[i];
    const isAvailable = st.respawnTimer <= 0;
    const bob = isAvailable ? Math.sin(timeSec * 3.2 + i * 1.1) * 3.5 : 0;

    const palette =
      st.stationType === 'medkit'
        ? { main: '#34d399', fill: 'rgba(16, 185, 129, 0.22)', label: 'MED' }
        : st.stationType === 'fuel'
          ? { main: '#38bdf8', fill: 'rgba(14, 165, 233, 0.22)', label: 'FUEL' }
          : { main: '#c084fc', fill: 'rgba(168, 85, 247, 0.22)', label: 'SUPPLY' };

    ctx.save();
    ctx.translate(st.x, st.y + bob);

    // Subtle ground beacon tick beneath floating pod
    ctx.fillStyle = isAvailable ? palette.main : 'rgba(100, 116, 139, 0.4)';
    ctx.globalAlpha = isAvailable ? 0.5 : 0.35;
    ctx.fillRect(-10, 18 - bob, 20, 2);
    ctx.globalAlpha = 1;

    if (!isAvailable) {
      const pct = Math.max(
        0,
        Math.min(1, 1 - st.respawnTimer / Math.max(1, st.cooldownSec)),
      );
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.55)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = palette.main;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, 13, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(203, 213, 225, 0.78)';
      ctx.font = 'bold 9px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.ceil(st.respawnTimer)}`, 0, 0.5);
      ctx.restore();
      continue;
    }

    // Active Holographic Pod
    ctx.fillStyle = palette.fill;
    ctx.strokeStyle = palette.main;
    ctx.lineWidth = 2;
    ctx.shadowColor = palette.main;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Distinct Iconography
    if (st.stationType === 'medkit') {
      ctx.fillStyle = '#ecfdf5';
      ctx.fillRect(-2.2, -6.5, 4.4, 13);
      ctx.fillRect(-6.5, -2.2, 13, 4.4);
    } else if (st.stationType === 'fuel') {
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.moveTo(1.5, -7.5);
      ctx.lineTo(-4.5, 0.5);
      ctx.lineTo(0, 0.5);
      ctx.lineTo(-1.5, 7.5);
      ctx.lineTo(4.5, -0.5);
      ctx.lineTo(0, -0.5);
      ctx.closePath();
      ctx.fill();
    } else {
      // Tactical omni-supply diamond + cross
      ctx.strokeStyle = '#f5f3ff';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(7, 0);
      ctx.lineTo(0, 7);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-1.5, -4, 3, 8);
      ctx.fillRect(-4, -1.5, 8, 3);
    }

    // Micro tag underneath
    ctx.fillStyle = palette.main;
    ctx.font = 'bold 8px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(palette.label, 0, 23);

    ctx.restore();
  }
}
