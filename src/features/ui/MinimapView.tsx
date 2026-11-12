import { useEffect, useRef, useState } from 'react';
import type { GameMap } from '../map/types';
import { renderMinimap } from '../map/renderMinimap';
import { createCamera } from '../camera';
import { engineWorld } from '../game/engineWorld';
import { useCTFStore } from '../ctf/ctfStore';
import { usePlayerStore } from '../player/playerStore';
import { MapPin, Maximize2, Minimize2, EyeOff } from 'lucide-react';
import { useSettingsStore } from '../settings/settingsStore';

interface MinimapViewProps {
  map: GameMap;
}

type MinimapMode = 'compact' | 'expanded' | 'hidden';

function getIsCompactScreen(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768 || window.innerHeight < 520;
}

export function MinimapView({ map }: MinimapViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<MinimapMode>(
    () => useSettingsStore.getState().defaultRadarMode,
  );
  const [isCompactScreen, setIsCompactScreen] = useState(getIsCompactScreen);

  useEffect(() => {
    const onResize = () => setIsCompactScreen(getIsCompactScreen());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  const width =
    mode === 'expanded'
      ? isCompactScreen
        ? 192
        : 236
      : isCompactScreen
        ? 112
        : 148;
  const height =
    mode === 'expanded'
      ? isCompactScreen
        ? 106
        : 132
      : isCompactScreen
        ? 62
        : 82;

  useEffect(() => {
    const hidden = mode === 'hidden';
    const canvas = hidden ? null : canvasRef.current;

    if (canvas) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.floor(width * dpr);
      const targetH = Math.floor(height * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        const local = engineWorld.localPlayer ?? usePlayerStore.getState().player;
        const flags = useCTFStore.getState().flags;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        renderMinimap(
          ctx,
          width,
          height,
          map,
          createCamera(window.innerWidth, window.innerHeight),
          [
            {
              x: local.x,
              y: local.y,
              team: local.team,
              isLocal: true,
              hasFlag: local.carryingFlag,
            },
            ...Array.from(engineWorld.remotePlayers.values())
              .filter((rp) => !rp.isDead)
              .map((rp) => ({
                x: rp.renderX,
                y: rp.renderY,
                team: rp.team,
                isLocal: false,
                hasFlag: rp.carryingFlag,
              })),
          ],
          [
            { x: flags.blue.x, y: flags.blue.y, team: 'blue' },
            { x: flags.red.x, y: flags.red.y, team: 'red' },
          ],
        );
      }
    }

    engineWorld.setMinimapTarget(canvas, width, height, hidden);
    return () => {
      engineWorld.setMinimapTarget(null, width, height, true);
    };
  }, [width, height, mode, map]);

  if (mode === 'hidden') {
    return (
      <div
        data-no-joystick="true"
        className="fixed top-10 sm:top-12 right-2 sm:right-3 z-20 pointer-events-auto"
      >
        <button
          type="button"
          onClick={() => setMode('compact')}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950/80 hover:bg-slate-900 border border-cyan-500/40 text-cyan-300 hover:text-white text-[9px] font-mono font-bold uppercase tracking-wider clip-chamfer shadow-xl cursor-pointer glow-cyan active:scale-95 transition"
          title="Show Tactical Radar"
        >
          <MapPin className="w-3 h-3 text-cyan-400" />
          <span>Radar</span>
        </button>
      </div>
    );
  }

  return (
    <div
      data-no-joystick="true"
      className="fixed top-10 sm:top-12 right-2 sm:right-3 z-20 pointer-events-auto flex flex-col items-end"
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
              onClick={() => setMode(mode === 'compact' ? 'expanded' : 'compact')}
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
              onClick={() => setMode('hidden')}
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
          onClick={() => setMode(mode === 'compact' ? 'expanded' : 'compact')}
          className="block cursor-pointer"
          title="Tap to resize radar"
        />
      </div>
    </div>
  );
}
