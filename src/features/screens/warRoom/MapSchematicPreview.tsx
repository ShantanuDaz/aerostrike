import { useEffect, useRef } from 'react';
import type { GameMap } from '../../map/types';

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

    ctx.fillStyle = '#060b16';
    ctx.fillRect(0, 0, w, h);

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
      className="w-24 h-12 shrink-0 sm:w-full sm:h-20 lg:h-24 rounded-lg border border-slate-800/90 bg-[#060b16] block"
    />
  );
}
