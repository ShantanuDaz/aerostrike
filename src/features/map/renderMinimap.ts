import type { ActiveRefillStation, GameMap } from './types';
import type { GameMode } from '../ctf/types';
import { getCompiledTerrainShapes } from './terrainGeometry';
import { getMapThemePalette } from './renderBackdrop';
import { getWorldViewportSize, type Camera } from '../camera';

export interface MinimapPlayerBlip {
  x: number;
  y: number;
  team: 'blue' | 'red';
  isLocal?: boolean;
  hasFlag?: boolean;
}

export interface MinimapFlagMarker {
  x: number;
  y: number;
  team: 'blue' | 'red';
}

/**
 * Draws a real-time minimap radar HUD onto a dedicated canvas or canvas overlay.
 */
export function renderMinimap(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  map: GameMap,
  camera: Camera,
  players: MinimapPlayerBlip[],
  flags: MinimapFlagMarker[],
  stations?: ActiveRefillStation[],
  highContrast: boolean = false,
  mode: GameMode = 'ctf',
): void {
  // Clear minimap
  ctx.clearRect(0, 0, width, height);

  // Background panel
  ctx.fillStyle = 'rgba(10, 15, 29, 0.85)';
  ctx.fillRect(0, 0, width, height);

  const scaleX = width / map.width;
  const scaleY = height / map.height;

  // 1. Draw Map Platforms
  ctx.fillStyle = 'rgba(100, 116, 139, 0.6)';
  for (const obs of map.obstacles) {
    if (obs.type === 'hazard') {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
    } else {
      ctx.fillStyle = 'rgba(100, 116, 139, 0.6)';
    }
    ctx.fillRect(
      obs.x * scaleX,
      obs.y * scaleY,
      Math.max(1, obs.width * scaleX),
      Math.max(1, obs.height * scaleY),
    );
  }

  // 1b. Draw Sloped & Curved Terrain Polygons
  const shapes = getCompiledTerrainShapes(map);
  if (shapes.length > 0) {
    const palette = getMapThemePalette(map);
    ctx.fillStyle = 'rgba(100, 116, 139, 0.65)';
    ctx.strokeStyle = palette.terrainTrim;
    ctx.lineWidth = 0.75;
    for (let i = 0; i < shapes.length; i++) {
      const pts = shapes[i].points;
      if (pts.length < 3) continue;
      ctx.beginPath();
      ctx.moveTo(pts[0].x * scaleX, pts[0].y * scaleY);
      for (let j = 1; j < pts.length; j++) {
        ctx.lineTo(pts[j].x * scaleX, pts[j].y * scaleY);
      }
      ctx.closePath();
      ctx.fill();
      if (shapes[i].topArc.length >= 2) {
        ctx.save();
        ctx.globalAlpha = 0.65;
        ctx.beginPath();
        ctx.moveTo(shapes[i].topArc[0].x * scaleX, shapes[i].topArc[0].y * scaleY);
        for (let j = 1; j < shapes[i].topArc.length; j++) {
          ctx.lineTo(shapes[i].topArc[j].x * scaleX, shapes[i].topArc[j].y * scaleY);
        }
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // 2. Draw Base Highlights (CTF / TDM only)
  if (mode !== 'ffa') {
    if (map.baseBlue) {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
      ctx.fillRect(
        map.baseBlue.x * scaleX,
        map.baseBlue.y * scaleY,
        map.baseBlue.width * scaleX,
        map.baseBlue.height * scaleY,
      );
    }
    if (map.baseRed) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.fillRect(
        map.baseRed.x * scaleX,
        map.baseRed.y * scaleY,
        map.baseRed.width * scaleX,
        map.baseRed.height * scaleY,
      );
    }
  }

  // 3. Draw Flags & Arena Utilities (Bounce Pads / Refill Stations)
  if (map.bouncePads) {
    ctx.fillStyle = 'rgba(34, 211, 238, 0.85)';
    for (const pad of map.bouncePads) {
      ctx.fillRect(
        pad.x * scaleX,
        pad.y * scaleY - 1,
        Math.max(2, pad.width * scaleX),
        Math.max(1.5, pad.height * scaleY),
      );
    }
  }

  const stationMarkers = stations ?? map.refillStations;
  if (stationMarkers) {
    for (const st of stationMarkers) {
      if (
        'respawnTimer' in st &&
        typeof st.respawnTimer === 'number' &&
        st.respawnTimer > 0
      ) {
        continue;
      }
      ctx.fillStyle =
        st.stationType === 'medkit'
          ? '#34d399'
          : st.stationType === 'fuel'
            ? '#38bdf8'
            : '#c084fc';
      ctx.beginPath();
      ctx.arc(st.x * scaleX, st.y * scaleY, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (mode === 'ctf') {
    for (const flag of flags) {
      ctx.save();
      ctx.fillStyle = flag.team === 'blue' ? '#38bdf8' : '#f87171';
      ctx.beginPath();
      ctx.arc(flag.x * scaleX, flag.y * scaleY, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }

  // 4. Draw Camera Frustum (Zoom-aware Viewport Box, clipped neatly to arena bounds)
  const { worldViewWidth, worldViewHeight } = getWorldViewportSize(camera);
  const frustumLeft = Math.max(0, camera.x * scaleX);
  const frustumTop = Math.max(0, camera.y * scaleY);
  const frustumRight = Math.min(width, (camera.x + worldViewWidth) * scaleX);
  const frustumBottom = Math.min(height, (camera.y + worldViewHeight) * scaleY);
  if (frustumRight > frustumLeft && frustumBottom > frustumTop) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      frustumLeft,
      frustumTop,
      frustumRight - frustumLeft,
      frustumBottom - frustumTop,
    );
    ctx.restore();
  }

  // 5. Draw Player Blips
  for (const p of players) {
    ctx.save();
    const px = p.x * scaleX;
    const py = p.y * scaleY;

    if (p.isLocal) {
      // Local player: glowing lime ring + dot
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#86efac';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (mode === 'ffa') {
      // All other pilots in Free For All are hostile targets
      ctx.fillStyle = highContrast ? '#fb7185' : '#f43f5e';
      ctx.beginPath();
      if (highContrast) {
        ctx.moveTo(px, py - 3.4);
        ctx.lineTo(px + 3.2, py + 2.8);
        ctx.lineTo(px - 3.2, py + 2.8);
        ctx.closePath();
      } else {
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      }
      ctx.fill();
    } else if (highContrast) {
      ctx.fillStyle = p.team === 'blue' ? '#38bdf8' : '#fb7185';
      ctx.beginPath();
      if (p.team === 'blue') {
        ctx.moveTo(px, py - 3.2);
        ctx.lineTo(px + 3.2, py);
        ctx.lineTo(px, py + 3.2);
        ctx.lineTo(px - 3.2, py);
      } else {
        ctx.moveTo(px, py - 3.4);
        ctx.lineTo(px + 3.2, py + 2.8);
        ctx.lineTo(px - 3.2, py + 2.8);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = p.team === 'blue' ? '#3b82f6' : '#ef4444';
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Flag carrier marker: pulsing outer ring (CTF only)
    if (mode === 'ctf' && p.hasFlag) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Outer border
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.8)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, width, height);
}
