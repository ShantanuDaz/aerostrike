import { useEffect, useRef } from 'react';
import type { GameMap } from '../../map/types';
import { getCompiledTerrainShapes } from '../../map/terrainGeometry';
import { getMapThemePalette } from '../../map/renderBackdrop';

interface MapSchematicPreviewProps {
  map: GameMap;
  isSelected: boolean;
  size?: 'mini' | 'card';
}

export function MapSchematicPreview({
  map,
  isSelected,
  size = 'card',
}: MapSchematicPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const palette = getMapThemePalette(map);
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, palette.previewBgTop);
    bgGrad.addColorStop(1, palette.previewBgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // If 3D Holodeck Map: Render tactical site schematic
    if (map.id.startsWith('holodeck-')) {
      const isBravo = map.id === 'holodeck-bravo';
      // Tactical cyan grid
      ctx.strokeStyle = isSelected ? 'rgba(6, 182, 212, 0.22)' : 'rgba(6, 182, 212, 0.1)';
      ctx.lineWidth = 1;
      for (let gx = 12; gx < w; gx += 16) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 12; gy < h; gy += 16) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      // Outer tactical boundary
      const pad = 8;
      ctx.strokeStyle = isSelected ? 'rgba(56, 189, 248, 0.8)' : 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);

      if (isBravo) {
        // Elevated Skybridge / Catwalk
        ctx.fillStyle = isSelected ? 'rgba(192, 132, 252, 0.35)' : 'rgba(192, 132, 252, 0.2)';
        ctx.fillRect(w * 0.44, pad + 8, w * 0.12, h - pad * 2 - 16);
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.6)';
        ctx.lineWidth = 1;
        ctx.strokeRect(w * 0.44, pad + 8, w * 0.12, h - pad * 2 - 16);

        // Site A (Emerald Dais - East)
        const siteAX = w * 0.76;
        const siteAY = h * 0.5;
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(siteAX, siteAY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = 'bold 9px ui-monospace, monospace';
        ctx.fillStyle = '#34d399';
        ctx.textAlign = 'center';
        ctx.fillText('[A]', siteAX, siteAY - 6);

        // Site B (Ruby Reactor - West)
        const siteBX = w * 0.24;
        const siteBY = h * 0.5;
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(siteBX, siteBY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#fb7185';
        ctx.fillText('[B]', siteBX, siteBY - 6);

        // Badge: 3D TACTICAL
        ctx.font = 'bold 8px ui-monospace, monospace';
        ctx.fillStyle = '#c084fc';
        ctx.textAlign = 'center';
        ctx.fillText('3D FPS • NEON NEXUS', w * 0.5, h - pad - 3);
        return;
      }

      // Holodeck Alpha layout
      // Mid courtyard cover blocks
      ctx.fillStyle = isSelected ? 'rgba(148, 163, 184, 0.4)' : 'rgba(148, 163, 184, 0.25)';
      ctx.fillRect(w * 0.45, h * 0.38, w * 0.1, h * 0.24);

      // Spawn Zones
      // Blue Defender Spawn (Left)
      ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.fillRect(pad + 2, pad + 2, w * 0.18, h - pad * 2 - 4);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(pad + 2, pad + 2, w * 0.18, h - pad * 2 - 4);

      // Red Attacker Spawn (Right)
      ctx.fillStyle = 'rgba(251, 113, 133, 0.18)';
      ctx.fillRect(w - pad - w * 0.18 - 2, pad + 2, w * 0.18, h - pad * 2 - 4);
      ctx.strokeStyle = 'rgba(251, 113, 133, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(w - pad - w * 0.18 - 2, pad + 2, w * 0.18, h - pad * 2 - 4);

      // Site A Marker (Top-ish Mid)
      const siteAX = w * 0.64;
      const siteAY = h * 0.34;
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(siteAX, siteAY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = 'bold 9px ui-monospace, monospace';
      ctx.fillStyle = '#34d399';
      ctx.textAlign = 'center';
      ctx.fillText('[A]', siteAX, siteAY - 6);

      // Site B Marker (Bottom-ish Mid)
      const siteBX = w * 0.36;
      const siteBY = h * 0.66;
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(siteBX, siteBY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      ctx.fillText('[B]', siteBX, siteBY + 12);

      // Badge: 3D TACTICAL
      ctx.font = 'bold 8px ui-monospace, monospace';
      ctx.fillStyle = '#22d3ee';
      ctx.textAlign = 'center';
      ctx.fillText('3D FPS • SPIKE DEFUSAL', w * 0.5, h - pad - 3);
      return;
    }

    ctx.strokeStyle = isSelected ? 'rgba(34, 211, 238, 0.1)' : 'rgba(148, 163, 184, 0.05)';
    ctx.lineWidth = 1;
    for (let gx = 16; gx < w; gx += 20) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    for (let gy = 16; gy < h; gy += 20) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    const padX = 6;
    const padY = 6;
    const scale = Math.min((w - padX * 2) / map.width, (h - padY * 2) / map.height);
    const offsetX = (w - map.width * scale) / 2;
    const offsetY = (h - map.height * scale) / 2;

    const tx = (x: number) => offsetX + x * scale;
    const ty = (y: number) => offsetY + y * scale;

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(offsetX, offsetY, map.width * scale, map.height * scale);

    ctx.fillStyle = 'rgba(59, 130, 246, 0.28)';
    ctx.fillRect(
      tx(map.baseBlue.x),
      ty(map.baseBlue.y),
      Math.max(4, map.baseBlue.width * scale),
      Math.max(4, map.baseBlue.height * scale),
    );
    ctx.fillStyle = 'rgba(244, 63, 94, 0.28)';
    ctx.fillRect(
      tx(map.baseRed.x),
      ty(map.baseRed.y),
      Math.max(4, map.baseRed.width * scale),
      Math.max(4, map.baseRed.height * scale),
    );

    for (const obs of map.obstacles) {
      if (obs.type === 'hazard') {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.8)';
      } else if (obs.type === 'ground') {
        ctx.fillStyle = '#334155';
      } else {
        ctx.fillStyle = isSelected ? '#475569' : '#334155';
      }
      ctx.fillRect(
        tx(obs.x),
        ty(obs.y),
        Math.max(2, obs.width * scale),
        Math.max(2, obs.height * scale),
      );
      if (obs.type === 'platform' || obs.type === 'wall') {
        ctx.fillStyle = isSelected ? 'rgba(34, 211, 238, 0.55)' : 'rgba(148, 163, 184, 0.35)';
        ctx.fillRect(tx(obs.x), ty(obs.y), Math.max(2, obs.width * scale), 1.2);
      }
    }

    // Slopes & curved hulls
    const shapes = getCompiledTerrainShapes(map);
    if (shapes.length > 0) {
      for (const shape of shapes) {
        const pts = shape.points;
        if (pts.length < 3) continue;
        ctx.fillStyle = shape.color ?? (isSelected ? '#475569' : '#334155');
        ctx.beginPath();
        ctx.moveTo(tx(pts[0].x), ty(pts[0].y));
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(tx(pts[i].x), ty(pts[i].y));
        }
        ctx.closePath();
        ctx.fill();

        if (shape.topArc.length >= 2) {
          ctx.strokeStyle = shape.trimColor ?? palette.terrainTrim;
          ctx.lineWidth = isSelected ? 1.4 : 1.0;
          ctx.beginPath();
          ctx.moveTo(tx(shape.topArc[0].x), ty(shape.topArc[0].y));
          for (let i = 1; i < shape.topArc.length; i++) {
            ctx.lineTo(tx(shape.topArc[i].x), ty(shape.topArc[i].y));
          }
          ctx.stroke();
        }
      }
    }

    for (const wp of map.weaponSpawns) {
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(tx(wp.x), ty(wp.y), 1.7, 0, Math.PI * 2);
      ctx.fill();
    }

    if (map.bouncePads) {
      ctx.fillStyle = '#22d3ee';
      for (const pad of map.bouncePads) {
        ctx.fillRect(
          tx(pad.x),
          ty(pad.y) - 0.8,
          Math.max(2.5, pad.width * scale),
          Math.max(1.5, pad.height * scale),
        );
      }
    }

    if (map.refillStations) {
      for (const st of map.refillStations) {
        ctx.fillStyle =
          st.stationType === 'medkit'
            ? '#34d399'
            : st.stationType === 'fuel'
              ? '#38bdf8'
              : '#c084fc';
        ctx.beginPath();
        ctx.arc(tx(st.x), ty(st.y), 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const drawFlagDot = (fx: number, fy: number, fill: string) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(tx(fx), ty(fy), 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    };
    drawFlagDot(map.flagBlue.x, map.flagBlue.y, '#38bdf8');
    drawFlagDot(map.flagRed.x, map.flagRed.y, '#fb7185');
  }, [map, isSelected]);

  if (size === 'mini') {
    return (
      <canvas
        ref={canvasRef}
        width={120}
        height={64}
        className="w-16 h-9 sm:w-20 sm:h-11 shrink-0 rounded border border-slate-700/90 bg-[#060b16] block"
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={220}
      height={100}
      className="w-24 h-12 shrink-0 short-wide:w-full short-wide:h-16 sm:w-full sm:tall:h-20 short:h-16 lg:tall:h-24 rounded-lg border border-slate-800/90 bg-[#060b16] block"
    />
  );
}
