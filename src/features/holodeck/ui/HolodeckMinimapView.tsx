import { useEffect, useRef, useState } from 'react';
import { useHolodeckStore } from '../game/holodeckStore';
import { useSettingsStore } from '../../settings/settingsStore';
import { sounds } from '../../audio/soundEngine';
import { EyeOff, MapPin, Maximize2, Minimize2, ZoomIn, ZoomOut } from 'lucide-react';

type MinimapMode = 'compact' | 'expanded' | 'hidden';

function getViewportMetrics(): { compact: boolean; short: boolean; width: number; height: number } {
  if (typeof window === 'undefined') {
    return { compact: false, short: false, width: 1280, height: 720 };
  }
  return {
    compact: window.innerWidth < 768 || window.innerHeight < 520,
    short: window.innerHeight < 420,
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

export function HolodeckMinimapView() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<MinimapMode>(() => useSettingsStore.getState().defaultRadarMode || 'compact');
  const [vp, setVp] = useState(getViewportMetrics);
  const [zoomFactor, setZoomFactor] = useState(1.0);

  const localPlayer = useHolodeckStore((s) => s.localPlayer);
  const remotePlayers = useHolodeckStore((s) => s.remotePlayers);
  const spike = useHolodeckStore((s) => s.spike);

  useEffect(() => {
    const onResize = () => setVp(getViewportMetrics());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  const { compact: isCompactScreen, short: isShortScreen } = vp;

  const width =
    mode === 'expanded'
      ? isShortScreen
        ? 160
        : isCompactScreen
          ? 176
          : 236
      : isCompactScreen
        ? 118
        : 148;
  const height =
    mode === 'expanded'
      ? isShortScreen
        ? 88
        : isCompactScreen
          ? 96
          : 132
      : isCompactScreen
        ? 66
        : 82;

  // Render Minimap frame at 20 Hz
  useEffect(() => {
    if (mode === 'hidden') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId: number;
    let lastRender = 0;

    const render = (time: number) => {
      if (time - lastRender >= 48) {
        lastRender = time;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const targetW = Math.floor(width * dpr);
          const targetH = Math.floor(height * dpr);
          if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
          }

          ctx.save();
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

          // Clear background
          ctx.fillStyle = '#050811';
          ctx.fillRect(0, 0, width, height);

          // Center and scale: Holodeck map is 110m wide (X: -55..55) and 130m long (Z: -65..65)
          const cx = width / 2;
          const cy = height / 2;
          const scale = (Math.min(width / 120, height / 140)) * zoomFactor;

          // Draw Tactical Grid
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.08)';
          ctx.lineWidth = 1;
          const gridStep = 15 * scale;
          for (let gx = cx % gridStep; gx < width; gx += gridStep) {
            ctx.beginPath();
            ctx.moveTo(gx, 0);
            ctx.lineTo(gx, height);
            ctx.stroke();
          }
          for (let gy = cy % gridStep; gy < height; gy += gridStep) {
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(width, gy);
            ctx.stroke();
          }

          // Outer Map Boundary (110m x 130m)
          const halfW = 55 * scale;
          const halfH = 65 * scale;
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(cx - halfW, cy - halfH, halfW * 2, halfH * 2);

          // Key Map Dividers & Obstacles
          ctx.fillStyle = 'rgba(148, 163, 184, 0.2)';
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
          ctx.lineWidth = 1;

          // West divider walls (X: -18)
          const divWX = cx - 18 * scale;
          ctx.fillRect(divWX - 1, cy + 10 * scale, 2, 40 * scale);
          ctx.fillRect(divWX - 1, cy - 50 * scale, 2, 40 * scale);

          // East divider walls (X: +18)
          const divEX = cx + 18 * scale;
          ctx.fillRect(divEX - 1, cy + 10 * scale, 2, 40 * scale);
          ctx.fillRect(divEX - 1, cy - 50 * scale, 2, 40 * scale);

          // Mid courtyard cover
          ctx.fillRect(cx - 7 * scale, cy - 16 * scale, 14 * scale, 12 * scale);

          // Site A (East: X = +35, Z = -20)
          const siteAX = cx + 35 * scale;
          const siteAY = cy - 20 * scale;
          ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
          ctx.fillRect(siteAX - 10 * scale, siteAY - 10 * scale, 20 * scale, 20 * scale);
          ctx.strokeStyle = '#10b981';
          ctx.strokeRect(siteAX - 10 * scale, siteAY - 10 * scale, 20 * scale, 20 * scale);

          ctx.font = 'bold 8px ui-monospace, monospace';
          ctx.fillStyle = '#34d399';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('A', siteAX, siteAY);

          // Site B (West: X = -35, Z = -20)
          const siteBX = cx - 35 * scale;
          const siteBY = cy - 20 * scale;
          ctx.fillStyle = 'rgba(244, 63, 94, 0.2)';
          ctx.fillRect(siteBX - 10 * scale, siteBY - 10 * scale, 20 * scale, 20 * scale);
          ctx.strokeStyle = '#f43f5e';
          ctx.strokeRect(siteBX - 10 * scale, siteBY - 10 * scale, 20 * scale, 20 * scale);

          ctx.fillStyle = '#fb7185';
          ctx.fillText('B', siteBX, siteBY);

          // Spawn Zones
          // Defender Spawn (North: Z = -55)
          ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
          ctx.fillRect(cx - 20 * scale, cy - 64 * scale, 40 * scale, 16 * scale);

          // Attacker Spawn (South: Z = +55)
          ctx.fillStyle = 'rgba(244, 63, 94, 0.08)';
          ctx.fillRect(cx - 20 * scale, cy + 48 * scale, 40 * scale, 16 * scale);

          // Spike / Data Core Marker
          if (spike.state === 'planted' || spike.state === 'defusing') {
            const spX = cx + spike.position[0] * scale;
            const spY = cy + spike.position[2] * scale;
            const pulse = (time % 1000) / 1000;

            // Ping circle
            ctx.strokeStyle = `rgba(239, 68, 68, ${1 - pulse})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(spX, spY, 3 + pulse * 12, 0, Math.PI * 2);
            ctx.stroke();

            // Core dot
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(spX, spY, 3.5, 0, Math.PI * 2);
            ctx.fill();
          } else if (spike.state === 'idle') {
            const spX = cx + spike.position[0] * scale;
            const spY = cy + spike.position[2] * scale;
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(spX - 2.5, spY - 2.5, 5, 5);
          }

          // Remote Players / Bots
          const remotes = Object.values(remotePlayers);
          for (const rp of remotes) {
            if (!rp.isAlive) continue;
            const px = cx + rp.position[0] * scale;
            const py = cy + rp.position[2] * scale;

            const isTeammate = rp.team === localPlayer.team;
            ctx.fillStyle = isTeammate ? '#38bdf8' : '#f43f5e';
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fill();

            // Teammate border
            ctx.strokeStyle = isTeammate ? '#ffffff' : '#fda4af';
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }

          // Local Player Blip + Orientation Vision Cone
          if (localPlayer.isAlive) {
            const lpx = cx + localPlayer.position[0] * scale;
            const lpy = cy + localPlayer.position[2] * scale;

            // In Three.js: -Z is North, +X is East, yaw 0 faces -Z
            const yaw = localPlayer.yaw;
            const dirX = -Math.sin(yaw);
            const dirY = -Math.cos(yaw);

            // Vision cone / FOV indicator
            ctx.fillStyle = 'rgba(6, 182, 212, 0.22)';
            ctx.beginPath();
            ctx.moveTo(lpx, lpy);
            const fovHalf = Math.PI / 6; // 30 deg each side
            const leftAngle = Math.atan2(dirY, dirX) - fovHalf;
            const rightAngle = Math.atan2(dirY, dirX) + fovHalf;
            ctx.arc(lpx, lpy, 16 * zoomFactor, leftAngle, rightAngle);
            ctx.closePath();
            ctx.fill();

            // Directional pointer triangle
            ctx.fillStyle = '#22d3ee';
            ctx.beginPath();
            ctx.moveTo(lpx + dirX * 6, lpy + dirY * 6);
            ctx.lineTo(lpx - dirY * 3 - dirX * 3, lpy + dirX * 3 - dirY * 3);
            ctx.lineTo(lpx + dirY * 3 - dirX * 3, lpy - dirX * 3 - dirY * 3);
            ctx.closePath();
            ctx.fill();

            // Outer pulse ring
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          ctx.restore();
        }
      }
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [mode, width, height, zoomFactor, localPlayer, remotePlayers, spike]);

  const zoomControls = (
    <div
      data-no-joystick="true"
      className="flex items-center bg-slate-950/85 border border-cyan-500/40 clip-chamfer backdrop-blur-md shadow-xl overflow-hidden"
    >
      <button
        type="button"
        onClick={() => {
          sounds.playUiClick();
          setZoomFactor((z) => Math.max(0.7, z - 0.15));
        }}
        onTouchStart={(e) => e.stopPropagation()}
        className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800/80 transition cursor-pointer active:scale-95"
        title="Zoom Out"
        aria-label="Zoom Out"
      >
        <ZoomOut className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={() => {
          sounds.playUiClick();
          setZoomFactor(1.0);
        }}
        onTouchStart={(e) => e.stopPropagation()}
        className="h-7 px-2 flex items-center gap-1 text-[9px] font-mono font-black uppercase tracking-wider border-x border-slate-800 transition cursor-pointer text-cyan-300 bg-cyan-500/10"
        title="Reset Radar Zoom"
      >
        <span>{zoomFactor.toFixed(2).replace(/0$/, '')}x</span>
      </button>

      <button
        type="button"
        onClick={() => {
          sounds.playUiClick();
          setZoomFactor((z) => Math.min(1.6, z + 0.15));
        }}
        onTouchStart={(e) => e.stopPropagation()}
        className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800/80 transition cursor-pointer active:scale-95"
        title="Zoom In"
        aria-label="Zoom In"
      >
        <ZoomIn className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  if (mode === 'hidden') {
    return (
      <div
        data-no-joystick="true"
        className="flex flex-col items-end gap-1.5 mt-1"
      >
        <button
          type="button"
          onClick={() => {
            sounds.playUiClick();
            setMode('compact');
          }}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950/80 hover:bg-slate-900 border border-cyan-500/40 text-cyan-300 hover:text-white text-[9px] font-mono font-bold uppercase tracking-wider clip-chamfer shadow-xl cursor-pointer glow-cyan active:scale-95 transition"
          title="Show Tactical Radar"
        >
          <MapPin className="w-3 h-3 text-cyan-400" />
          <span>Radar</span>
        </button>
        {zoomControls}
      </div>
    );
  }

  return (
    <div
      data-no-joystick="true"
      className="flex flex-col items-end gap-1 mt-1 pointer-events-auto"
    >
      <div className="cyber-panel clip-chamfer overflow-hidden border border-cyan-500/40 shadow-2xl bg-slate-950/80 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2 px-2 py-0.5 bg-slate-950/90 border-b border-cyan-500/20">
          <span className="flex items-center gap-1 text-[8px] font-mono font-bold text-cyan-300 uppercase tracking-widest">
            <MapPin className="w-2.5 h-2.5 text-cyan-400" />
            <span>Radar</span>
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                sounds.playUiClick();
                setMode(mode === 'compact' ? 'expanded' : 'compact');
              }}
              className="p-0.5 text-slate-400 hover:text-white transition cursor-pointer"
              title={mode === 'compact' ? 'Expand Radar' : 'Compact Radar'}
            >
              {mode === 'expanded' ? (
                <Minimize2 className="w-2.5 h-2.5" />
              ) : (
                <Maximize2 className="w-2.5 h-2.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                sounds.playUiClick();
                setMode('hidden');
              }}
              className="p-0.5 text-slate-400 hover:text-rose-300 transition cursor-pointer"
              title="Hide Radar"
            >
              <EyeOff className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          style={{ width: `${width}px`, height: `${height}px` }}
          onClick={(e) => {
            e.stopPropagation();
            sounds.playUiClick();
            setMode(mode === 'compact' ? 'expanded' : 'compact');
          }}
          className="block cursor-pointer select-none"
          title="Tap to toggle radar scale"
        />
      </div>

      {zoomControls}
    </div>
  );
}
