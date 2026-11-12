import { useEffect, useRef, useState } from 'react';
import type { GameMap } from '../map/types';
import { renderMinimap } from '../map/renderMinimap';
import {
  CAMERA_ZOOM_STEP,
  clampCameraZoom,
  computeAutoCameraZoom,
  createCamera,
} from '../camera';
import { engineWorld } from '../game/engineWorld';
import { useCTFStore } from '../ctf/ctfStore';
import { usePlayerStore } from '../player/playerStore';
import { useSettingsStore } from '../settings/settingsStore';
import { sounds } from '../audio/soundEngine';
import { EyeOff, MapPin, Maximize2, Minimize2, ZoomIn, ZoomOut } from 'lucide-react';

interface MinimapViewProps {
  map: GameMap;
}

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

export function MinimapView({ map }: MinimapViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<MinimapMode>(
    () => useSettingsStore.getState().defaultRadarMode,
  );
  const [vp, setVp] = useState(getViewportMetrics);

  const cameraZoomMode = useSettingsStore((s) => s.cameraZoomMode);
  const cameraZoom = useSettingsStore((s) => s.cameraZoom);
  const highContrast = useSettingsStore((s) => s.highContrastTeamMarkers);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

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
  const effectiveZoom =
    cameraZoomMode === 'custom'
      ? cameraZoom
      : computeAutoCameraZoom(vp.width, vp.height);

  const adjustZoom = (delta: number) => {
    sounds.playUiClick();
    updateSettings({
      cameraZoomMode: 'custom',
      cameraZoom: clampCameraZoom(effectiveZoom + delta),
    });
  };

  const handleToggleAutoZoom = () => {
    sounds.playUiClick();
    if (cameraZoomMode === 'custom') {
      updateSettings({ cameraZoomMode: 'auto' });
    } else {
      // Quick one-tap toggle when already in Auto: zoom out wider or reset to 1.0x
      const nextQuick = effectiveZoom > 0.78 ? 0.65 : 1.0;
      updateSettings({
        cameraZoomMode: 'custom',
        cameraZoom: nextQuick,
      });
    }
  };

  const width =
    mode === 'expanded'
      ? isShortScreen
        ? 168
        : isCompactScreen
          ? 192
          : 236
      : isCompactScreen
        ? 112
        : 148;
  const height =
    mode === 'expanded'
      ? isShortScreen
        ? 92
        : isCompactScreen
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
          createCamera(window.innerWidth, window.innerHeight, effectiveZoom),
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
          engineWorld.stations,
          highContrast,
        );
      }
    }

    engineWorld.setMinimapTarget(canvas, width, height, hidden);
    return () => {
      engineWorld.setMinimapTarget(null, width, height, true);
    };
  }, [width, height, mode, map, effectiveZoom, highContrast]);

  const zoomControls = (
    <div
      data-no-joystick="true"
      className="flex items-center bg-slate-950/85 border border-cyan-500/40 clip-chamfer backdrop-blur-md shadow-xl overflow-hidden"
    >
      <button
        type="button"
        onClick={() => adjustZoom(-CAMERA_ZOOM_STEP)}
        onTouchStart={(e) => e.stopPropagation()}
        className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800/80 transition cursor-pointer active:scale-95"
        title="Zoom Out (Wider Arena View)"
        aria-label="Zoom Out"
      >
        <ZoomOut className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={handleToggleAutoZoom}
        onTouchStart={(e) => e.stopPropagation()}
        className={`h-7 px-2 flex items-center gap-1 text-[9px] font-mono font-black uppercase tracking-wider border-x border-slate-800 transition cursor-pointer ${
          cameraZoomMode === 'auto'
            ? 'text-cyan-300 bg-cyan-500/10'
            : 'text-amber-200 hover:text-white bg-amber-500/10'
        }`}
        title={
          cameraZoomMode === 'auto'
            ? 'Auto Responsive Zoom (Tap for Quick Preset)'
            : 'Custom Zoom (Tap to Restore Auto)'
        }
      >
        <span>{cameraZoomMode === 'auto' ? 'A' : ''}</span>
        <span>{effectiveZoom.toFixed(2).replace(/0$/, '')}x</span>
      </button>

      <button
        type="button"
        onClick={() => adjustZoom(CAMERA_ZOOM_STEP)}
        onTouchStart={(e) => e.stopPropagation()}
        className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800/80 transition cursor-pointer active:scale-95"
        title="Zoom In (Closer View)"
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
        style={{
          marginTop: 'env(safe-area-inset-top, 0px)',
          marginRight: 'env(safe-area-inset-right, 0px)',
        }}
        className="fixed top-12 sm:top-14 right-2 sm:right-3 z-20 pointer-events-auto flex flex-col items-end gap-1.5"
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
        {zoomControls}
      </div>
    );
  }

  return (
    <div
      data-no-joystick="true"
      style={{
        marginTop: 'env(safe-area-inset-top, 0px)',
        marginRight: 'env(safe-area-inset-right, 0px)',
      }}
      className="fixed top-12 sm:top-14 right-2 sm:right-3 z-20 pointer-events-auto flex flex-col items-end gap-1"
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

      {zoomControls}
    </div>
  );
}
