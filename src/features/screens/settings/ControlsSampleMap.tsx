import { useEffect, useRef, useState } from 'react';
import { Bomb, Crosshair, Keyboard, MapPin, RefreshCw, Wind, ZoomIn } from 'lucide-react';
import { sounds } from '../../audio/soundEngine';
import { useAvatarStore } from '../../avatar/avatarStore';
import { renderAvatar } from '../../avatar/renderAvatar';
import { computeAutoCameraZoom, createCamera, updateCamera, type Camera } from '../../camera';
import { evaluateAimStick, evaluateMoveStick, getScaledStickMetrics } from '../../controls/touchStickMath';
import { renderFlags } from '../../ctf/renderFlags';
import type { Flag } from '../../ctf/types';
import { drawArenaPerimeterOverscan } from '../../game/arenaRenderer';
import { defaultMap } from '../../map/maps/defaultMap';
import {
  createBackdropCache,
  renderBackdropWorldProps,
  renderProceduralBackdrop,
  resolveMapTheme,
  type BackdropCache,
} from '../../map/renderBackdrop';
import { renderMap } from '../../map/renderMap';
import { raycastMapTerrain } from '../../map/terrainGeometry';
import { useSettingsStore } from '../../settings/settingsStore';

export type ControlSelection = 'all' | 'camera' | 'move' | 'aim' | 'actions' | 'bindings';

interface ControlsSampleMapProps {
  selectedControl: ControlSelection;
  onSelectControl: (control: ControlSelection) => void;
  framingSpot: 'center' | 'red_flag';
  onChangeFramingSpot: (spot: 'center' | 'red_flag') => void;
}

const WEAPON_TAG: Record<string, string> = {
  rifle: 'RFL',
  shotgun: 'SHG',
  sniper: 'SNP',
  rocket: 'RPG',
  pistol: 'PST',
};

const SAMPLE_FLAGS: Flag[] = [
  {
    team: 'blue',
    x: defaultMap.flagBlue.x,
    y: defaultMap.flagBlue.y,
    baseX: defaultMap.flagBlue.x,
    baseY: defaultMap.flagBlue.y,
    status: 'at_base',
    carrierId: null,
    returnTimer: 0,
  },
  {
    team: 'red',
    x: defaultMap.flagRed.x,
    y: defaultMap.flagRed.y,
    baseX: defaultMap.flagRed.x,
    baseY: defaultMap.flagRed.y,
    status: 'at_base',
    carrierId: null,
    returnTimer: 0,
  },
];

export function ControlsSampleMap({
  selectedControl,
  onSelectControl,
  framingSpot,
  onChangeFramingSpot,
}: ControlsSampleMapProps) {
  const settings = useSettingsStore();
  const avatar = useAvatarStore((s) => s.avatar);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [boxSize, setBoxSize] = useState<{ w: number; h: number }>({ w: 420, h: 250 });

  // Live preview simulation state
  const pilotStateRef = useRef<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    aimAngle: number;
    isBoosting: boolean;
    isFiring: boolean;
    moveDx: number;
    moveDy: number;
    aimDx: number;
    aimDy: number;
    moveActive: boolean;
    aimActive: boolean;
    cam: Camera;
  }>({
    x: 450,
    y: 448,
    vx: 0,
    vy: 0,
    aimAngle: -0.25,
    isBoosting: false,
    isFiring: false,
    moveDx: 0,
    moveDy: 0,
    aimDx: 0,
    aimDy: 0,
    moveActive: false,
    aimActive: false,
    cam: createCamera(420, 250, 0.7),
  });

  const [moveKnobOffset, setMoveKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [aimKnobOffset, setAimKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [moveStickActive, setMoveStickActive] = useState(false);
  const [aimStickActive, setAimStickActive] = useState(false);
  const [aimFiringPreview, setAimFiringPreview] = useState(false);

  const avatarRef = useRef(avatar);
  const settingsRef = useRef(settings);
  const framingSpotRef = useRef(framingSpot);
  const boxSizeRef = useRef(boxSize);

  useEffect(() => {
    avatarRef.current = avatar;
  }, [avatar]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    boxSizeRef.current = boxSize;
  }, [boxSize]);

  useEffect(() => {
    framingSpotRef.current = framingSpot;
    pilotStateRef.current.x = framingSpot === 'red_flag' ? 790 : 450;
    pilotStateRef.current.y = framingSpot === 'red_flag' ? 470 : 448;
  }, [framingSpot]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 40 && rect.height > 40) {
        setBoxSize({ w: Math.round(rect.width), h: Math.round(rect.height) });
      }
    };
    updateSize();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let backdropCache: BackdropCache | null = null;
    let animId = 0;
    let timeSec = 0;
    let lastNow = performance.now();

    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
      lastNow = now;
      timeSec += dt;

      const { w: cssW, h: cssH } = boxSizeRef.current;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const targetW = Math.max(120, Math.round(cssW * dpr));
      const targetH = Math.max(90, Math.round(cssH * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      const st = pilotStateRef.current;
      const s = settingsRef.current;

      // Subtle motion from live preview Move stick drag or gentle idle hover
      if (st.moveActive) {
        st.x = Math.max(40, Math.min(defaultMap.width - 40, st.x + st.moveDx * 220 * dt));
        st.y = Math.max(80, Math.min(defaultMap.height - 56, st.y + st.moveDy * 180 * dt));
      } else {
        const homeX = framingSpotRef.current === 'red_flag' ? 790 : 450;
        const homeY = framingSpotRef.current === 'red_flag' ? 470 : 448;
        st.x += (homeX - st.x) * Math.min(1, dt * 6);
        st.y += (homeY - st.y) * Math.min(1, dt * 6);
      }

      const rawZoom =
        s.cameraZoomMode === 'auto'
          ? computeAutoCameraZoom(
              typeof window !== 'undefined' ? window.innerWidth : 667,
              typeof window !== 'undefined' ? window.innerHeight : 375,
            )
          : s.cameraZoom;

      // Scale world zoom proportionally to preview canvas width vs typical phone viewport (667px)
      const viewportRatio = Math.max(0.45, Math.min(1.0, cssW / 667));
      const effectiveZoom = rawZoom * viewportRatio;
      st.cam = updateCamera(
        {
          ...st.cam,
          viewportWidth: cssW,
          viewportHeight: cssH,
          zoom: effectiveZoom,
        },
        st.x,
        st.y,
        defaultMap.width,
        defaultMap.height,
        0.2,
      );

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      const themeId = resolveMapTheme(defaultMap);
      const backdropKey = `${defaultMap.id}:${themeId}:${cssW}x${cssH}`;
      if (!backdropCache || backdropCache.key !== backdropKey) {
        backdropCache = createBackdropCache(defaultMap, cssW, cssH);
      }
      renderProceduralBackdrop(
        ctx,
        backdropCache,
        defaultMap,
        st.cam,
        cssW,
        cssH,
        timeSec,
      );

      ctx.save();
      ctx.scale(st.cam.zoom, st.cam.zoom);
      ctx.translate(-st.cam.x, -st.cam.y);

      renderBackdropWorldProps(ctx, defaultMap, timeSec);
      renderMap(ctx, defaultMap, timeSec, false);
      renderFlags(ctx, SAMPLE_FLAGS, timeSec);

      const renderAim = st.aimActive ? st.aimAngle : -0.22 + Math.sin(timeSec * 0.9) * 0.12;
      const pilotY = st.y + (st.moveActive ? 0 : Math.sin(timeSec * 2.4) * 3.5);

      if (s.touchAimLine) {
        const laserLen = 420;
        const targetX = st.x + Math.cos(renderAim) * laserLen;
        const targetY = pilotY + Math.sin(renderAim) * laserLen;
        const hit = raycastMapTerrain(
          st.x,
          pilotY,
          targetX,
          targetY,
          defaultMap,
        );
        const endX = hit ? hit.hitX : targetX;
        const endY = hit ? hit.hitY : targetY;

        ctx.save();
        ctx.strokeStyle = st.isFiring ? 'rgba(251, 146, 60, 0.72)' : 'rgba(56, 189, 248, 0.42)';
        ctx.lineWidth = st.isFiring ? 2 : 1.3;
        ctx.setLineDash([7, 6]);
        ctx.beginPath();
        ctx.moveTo(st.x + Math.cos(renderAim) * 20, pilotY + Math.sin(renderAim) * 20);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(st.x, pilotY);
      renderAvatar(ctx, avatarRef.current, {
        aimAngle: renderAim,
        radius: 17,
        isBoosting: st.isBoosting || !st.moveActive,
        team: framingSpotRef.current === 'red_flag' ? 'blue' : undefined,
        showHUD: false,
        vy: st.moveActive ? st.moveDy * 2 : Math.cos(timeSec * 2.4) * 0.4,
        timeSec,
        weaponType: s.defaultWeapon,
      });
      ctx.restore();

      // Muzzle spark when user drags Aim stick into fire zone
      if (st.isFiring) {
        const mx = st.x + Math.cos(renderAim) * 26;
        const my = pilotY + Math.sin(renderAim) * 26;
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(mx, my, 4.5 + Math.sin(timeSec * 40) * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Show real edge overscan & AEROSTRIKE side branding
      drawArenaPerimeterOverscan(ctx, defaultMap, st.cam, cssW, cssH);

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Proportional scale factor for controls inside the preview frame
  const stickMetrics = getScaledStickMetrics(settings.touchControlScale, settings.touchStickDeadzone);
  const previewRatio = Math.max(0.56, Math.min(0.86, boxSize.w / 620));
  const movePadPx = Math.round(stickMetrics.movePadSize * previewRatio);
  const aimPadPx = Math.round(stickMetrics.aimPadSize * previewRatio);
  const moveKnobPx = Math.round(stickMetrics.moveKnobSize * previewRatio);
  const aimKnobPx = Math.round(stickMetrics.aimKnobSize * previewRatio);
  const moveMaxPx = stickMetrics.moveMaxDist * previewRatio;
  const aimMaxPx = stickMetrics.aimMaxDist * previewRatio;
  const ringPx = Math.round(stickMetrics.aimPerimeterRingSize * previewRatio);
  const deadzoneRingPx = Math.max(
    14,
    Math.round(Math.max(10, stickMetrics.aimDeadzoneDist * 2.2) * previewRatio),
  );
  const btnW = Math.round(52 * stickMetrics.scale * previewRatio);
  const btnH = Math.round(44 * stickMetrics.scale * previewRatio);
  const btnFontPx = Math.max(8, Math.round(10 * Math.min(1, stickMetrics.scale) * previewRatio + 1.5));

  const isLeftHanded = settings.touchLayout === 'left_handed';
  const idleOpacity = settings.touchControlOpacity;
  const activeZoom =
    settings.cameraZoomMode === 'auto'
      ? computeAutoCameraZoom(
          typeof window !== 'undefined' ? window.innerWidth : 667,
          typeof window !== 'undefined' ? window.innerHeight : 375,
        )
      : settings.cameraZoom;

  const updateMovePointer = (clientX: number, clientY: number, el: HTMLDivElement) => {
    const r = el.getBoundingClientRect();
    const dx = clientX - (r.left + r.width / 2);
    const dy = clientY - (r.top + r.height / 2);
    const res = evaluateMoveStick(dx, dy, moveMaxPx);
    setMoveKnobOffset({ x: res.offsetX, y: res.offsetY });
    pilotStateRef.current.moveActive = true;
    pilotStateRef.current.moveDx = res.offsetX / Math.max(1, moveMaxPx);
    pilotStateRef.current.moveDy = res.offsetY / Math.max(1, moveMaxPx);
    pilotStateRef.current.isBoosting = res.boosting;
  };

  const resetMovePointer = () => {
    setMoveStickActive(false);
    setMoveKnobOffset({ x: 0, y: 0 });
    pilotStateRef.current.moveActive = false;
    pilotStateRef.current.moveDx = 0;
    pilotStateRef.current.moveDy = 0;
    pilotStateRef.current.isBoosting = false;
  };

  const updateAimPointer = (clientX: number, clientY: number, el: HTMLDivElement) => {
    const r = el.getBoundingClientRect();
    const dx = clientX - (r.left + r.width / 2);
    const dy = clientY - (r.top + r.height / 2);
    const res = evaluateAimStick(dx, dy, {
      maxDist: aimMaxPx,
      deadzoneDist: stickMetrics.aimDeadzoneDist * previewRatio,
      firePerimeterDist: stickMetrics.aimFirePerimeterDist * previewRatio,
      aimMode: settings.touchAimMode,
    });
    setAimKnobOffset({ x: res.offsetX, y: res.offsetY });
    setAimFiringPreview(res.isFiring);
    pilotStateRef.current.aimActive = true;
    pilotStateRef.current.isFiring = res.isFiring;
    if (res.hasAim) {
      pilotStateRef.current.aimAngle = res.angle;
    }
  };

  const resetAimPointer = () => {
    setAimStickActive(false);
    setAimKnobOffset({ x: 0, y: 0 });
    setAimFiringPreview(false);
    pilotStateRef.current.aimActive = false;
    pilotStateRef.current.isFiring = false;
  };

  const actionBottomPx = Math.round(10 + aimPadPx + 6 * stickMetrics.scale * previewRatio);

  const selectionRingClass = (id: ControlSelection) =>
    selectedControl === id
      ? 'ring-2 ring-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.55)]'
      : 'hover:ring-1 hover:ring-cyan-400/50';

  return (
    <div className="flex flex-col gap-1.5 h-full min-h-0">
      {/* Sample Map Interactive Frame (ONLY Controls + Arena) */}
      <div
        ref={containerRef}
        onClick={() => {
          sounds.playUiClick();
          onSelectControl('camera');
        }}
        className={`relative flex-1 min-h-[168px] w-full rounded-lg overflow-hidden border bg-[#060913] select-none cursor-pointer transition ${
          selectedControl === 'camera'
            ? 'border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.28)]'
            : 'border-cyan-500/35'
        }`}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Subtle Top Control Helpers: Keys Pill, Framing Spot, Zoom Pill */}
        <div
          className="absolute top-1.5 inset-x-1.5 flex items-center justify-between gap-1 pointer-events-none"
        >
          <div className="flex items-center gap-1 pointer-events-auto">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                sounds.playUiClick();
                onSelectControl(selectedControl === 'bindings' ? 'all' : 'bindings');
              }}
              className={`flex items-center gap-1 px-2 py-1 text-[9px] font-mono font-bold uppercase clip-chamfer border cursor-pointer backdrop-blur-sm transition ${
                selectedControl === 'bindings'
                  ? 'bg-cyan-500/30 border-cyan-300 text-white'
                  : 'bg-slate-950/80 border-slate-700/80 text-slate-300 hover:border-cyan-400/60'
              }`}
            >
              <Keyboard className="w-3 h-3 text-cyan-400" />
              <span>Keys &amp; Guide</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                sounds.playUiClick();
                onChangeFramingSpot(framingSpot === 'center' ? 'red_flag' : 'center');
              }}
              className="flex items-center gap-1 px-2 py-1 bg-slate-950/80 hover:bg-slate-900 border border-slate-700/80 hover:border-rose-400/60 text-[9px] font-mono font-bold uppercase text-slate-300 clip-chamfer cursor-pointer backdrop-blur-sm"
              title="Toggle camera preview between Center Arena and Red Flag Edge Overscan"
            >
              <MapPin className={`w-3 h-3 ${framingSpot === 'red_flag' ? 'text-rose-400' : 'text-cyan-400'}`} />
              <span className="hidden xs:inline">
                {framingSpot === 'red_flag' ? 'Red Flag Edge' : 'Center Map'}
              </span>
              <span className="xs:hidden">{framingSpot === 'red_flag' ? 'Edge' : 'Center'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              sounds.playUiClick();
              onSelectControl('camera');
            }}
            className={`pointer-events-auto flex items-center gap-1 px-2 py-1 text-[9px] font-mono font-black uppercase clip-chamfer border cursor-pointer backdrop-blur-sm transition ${
              selectedControl === 'camera'
                ? 'bg-cyan-500/30 border-cyan-300 text-white'
                : 'bg-slate-950/80 border-cyan-500/35 text-cyan-200 hover:border-cyan-400'
            }`}
          >
            <ZoomIn className="w-3 h-3 text-cyan-400" />
            <span>
              {settings.cameraZoomMode === 'auto' ? 'AUTO ' : ''}
              {activeZoom.toFixed(2)}x
            </span>
          </button>
        </div>

        {/* MOVE STICK (Interactive & Clickable) */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            sounds.playUiClick();
            onSelectControl('move');
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            onSelectControl('move');
            setMoveStickActive(true);
            updateMovePointer(e.clientX, e.clientY, e.currentTarget);
          }}
          onPointerMove={(e) => {
            if (!moveStickActive) return;
            updateMovePointer(e.clientX, e.clientY, e.currentTarget);
          }}
          onPointerUp={resetMovePointer}
          onPointerCancel={resetMovePointer}
          style={{
            width: `${movePadPx}px`,
            height: `${movePadPx}px`,
            bottom: '10px',
            left: isLeftHanded ? 'auto' : '10px',
            right: isLeftHanded ? '10px' : 'auto',
            opacity: moveStickActive || selectedControl === 'move' ? Math.max(0.85, idleOpacity) : idleOpacity,
          }}
          className={`absolute rounded-full border-2 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing backdrop-blur-[2px] transition-[opacity,box-shadow] ${
            moveStickActive
              ? 'border-cyan-400 bg-cyan-950/35 shadow-[0_0_20px_rgba(34,211,238,0.35)]'
              : 'border-cyan-400/50 bg-slate-950/35'
          } ${selectionRingClass('move')}`}
        >
          <div className="absolute inset-2 rounded-full border border-dashed border-cyan-400/20 pointer-events-none" />
          {settings.showTouchHints && (
            <>
              <span className="pointer-events-none absolute top-1 text-[7px] font-mono font-black tracking-wider text-cyan-300/80 uppercase">
                Boost
              </span>
              <span className="pointer-events-none absolute bottom-1 text-[7px] font-mono font-bold tracking-wider text-slate-400/80 uppercase">
                Drop
              </span>
            </>
          )}

          {selectedControl === 'move' && (
            <span className="pointer-events-none -top-4 left-1/2 -translate-x-1/2 absolute px-1.5 py-0.5 rounded bg-cyan-500 text-slate-950 text-[7.5px] font-mono font-black uppercase tracking-wider whitespace-nowrap">
              Move Stick
            </span>
          )}

          <div
            style={{
              width: `${moveKnobPx}px`,
              height: `${moveKnobPx}px`,
              transform: `translate(${moveKnobOffset.x}px, ${moveKnobOffset.y}px)`,
            }}
            className="pointer-events-none rounded-full border-2 border-cyan-200 bg-gradient-to-br from-cyan-400 to-sky-600 shadow-md flex items-center justify-center"
          >
            <div className="w-2 h-2 rounded-full bg-white/90" />
          </div>
        </div>

        {/* ACTION BUTTONS CLUSTER (Weapon, Dash, Optional Jet) */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            sounds.playUiClick();
            onSelectControl('actions');
          }}
          style={{
            bottom: `${actionBottomPx}px`,
            left: isLeftHanded ? '10px' : 'auto',
            right: isLeftHanded ? 'auto' : '10px',
            opacity: selectedControl === 'actions' ? Math.max(0.85, idleOpacity) : idleOpacity,
          }}
          className={`absolute flex items-end gap-1.5 p-0.5 rounded transition cursor-pointer ${selectionRingClass('actions')}`}
        >
          {selectedControl === 'actions' && (
            <span className="pointer-events-none -top-4 right-0 absolute px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[7.5px] font-mono font-black uppercase tracking-wider whitespace-nowrap">
              Action Buttons
            </span>
          )}

          {/* Weapon Switch Badge */}
          <div
            style={{ width: `${btnW}px`, height: `${btnH}px` }}
            className="clip-chamfer border border-cyan-400/50 bg-slate-950/85 flex flex-col items-center justify-center gap-0.5 backdrop-blur-sm"
          >
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span
                style={{ fontSize: `${btnFontPx}px` }}
                className="font-mono font-black text-white leading-none"
              >
                {WEAPON_TAG[settings.defaultWeapon] ?? 'RFL'}
              </span>
              <RefreshCw className="w-2.5 h-2.5 text-cyan-400" />
            </div>
            <span className="text-[7px] font-mono font-bold text-slate-300 leading-none">
              SWP
            </span>
          </div>

          {/* Frag Grenade + Dash */}
          <div className="flex items-end gap-1.5">
            {settings.showTouchGrenadeButton && (
              <div
                style={{ width: `${btnW}px`, height: `${btnH}px` }}
                className="clip-chamfer border border-lime-400/75 bg-lime-950/75 flex flex-col items-center justify-center backdrop-blur-sm"
              >
                <div className="flex items-center gap-0.5 leading-none">
                  <Bomb className="w-3 h-3 text-lime-300" />
                  <span className="text-[9px] font-mono font-black text-white">2</span>
                </div>
                <span className="text-[7px] font-mono font-black text-lime-100 uppercase leading-none mt-0.5">
                  Frag
                </span>
              </div>
            )}
            <div
              style={{ width: `${btnW}px`, height: `${btnH}px` }}
              className="clip-chamfer border border-cyan-400/65 bg-slate-950/85 flex flex-col items-center justify-center gap-0.5 backdrop-blur-sm"
            >
              <Wind className="w-3.5 h-3.5 text-cyan-300" />
              <span className="text-[7px] font-mono font-black text-cyan-100 uppercase leading-none">
                Dash
              </span>
            </div>
          </div>
        </div>

        {/* AIM & SHOOT STICK (Interactive & Clickable) */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            sounds.playUiClick();
            onSelectControl('aim');
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            onSelectControl('aim');
            setAimStickActive(true);
            updateAimPointer(e.clientX, e.clientY, e.currentTarget);
          }}
          onPointerMove={(e) => {
            if (!aimStickActive) return;
            updateAimPointer(e.clientX, e.clientY, e.currentTarget);
          }}
          onPointerUp={resetAimPointer}
          onPointerCancel={resetAimPointer}
          style={{
            width: `${aimPadPx}px`,
            height: `${aimPadPx}px`,
            bottom: '10px',
            left: isLeftHanded ? '10px' : 'auto',
            right: isLeftHanded ? 'auto' : '10px',
            opacity: aimStickActive || selectedControl === 'aim' ? Math.max(0.85, idleOpacity) : idleOpacity,
          }}
          className={`absolute rounded-full border-2 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing backdrop-blur-[2px] transition-[opacity,box-shadow] ${
            aimFiringPreview
              ? 'border-amber-400 bg-amber-950/40 shadow-[0_0_24px_rgba(245,158,11,0.45)]'
              : aimStickActive
                ? 'border-amber-400/75 bg-slate-950/45'
                : 'border-amber-400/50 bg-slate-950/35'
          } ${selectionRingClass('aim')}`}
        >
          {settings.touchAimMode === 'precision' ? (
            <div
              style={{ width: `${ringPx}px`, height: `${ringPx}px` }}
              className={`pointer-events-none absolute rounded-full border border-dashed ${
                aimFiringPreview ? 'border-amber-300/85' : 'border-amber-400/35'
              }`}
            />
          ) : (
            <div
              style={{ width: `${deadzoneRingPx}px`, height: `${deadzoneRingPx}px` }}
              className="pointer-events-none absolute rounded-full border border-dashed border-amber-300/55"
            />
          )}

          {settings.showTouchHints && (
            <span className="pointer-events-none absolute bottom-1 text-[6.5px] font-mono font-black tracking-wider text-amber-300/80 uppercase">
              {settings.touchAimMode === 'instant' ? 'Drag = Shoot' : 'Edge = Shoot'}
            </span>
          )}

          {selectedControl === 'aim' && (
            <span className="pointer-events-none -top-4 left-1/2 -translate-x-1/2 absolute px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[7.5px] font-mono font-black uppercase tracking-wider whitespace-nowrap">
              Aim &amp; Fire
            </span>
          )}

          <div
            style={{
              width: `${aimKnobPx}px`,
              height: `${aimKnobPx}px`,
              transform: `translate(${aimKnobOffset.x}px, ${aimKnobOffset.y}px)`,
            }}
            className="pointer-events-none rounded-full border-2 border-amber-200 bg-gradient-to-br from-amber-400 to-rose-600 shadow-md flex items-center justify-center"
          >
            <Crosshair className="w-3.5 h-3.5 text-slate-950" />
          </div>
        </div>
      </div>

      {/* Bottom Interactive Prompt Strip */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-2 py-1 bg-slate-950/80 border border-slate-800 rounded text-[9.5px] font-mono text-slate-300">
        <span className="truncate">
          Tap or drag any control on the sample map to test &amp; edit it
        </span>
        {selectedControl !== 'all' && (
          <button
            type="button"
            onClick={() => {
              sounds.playUiClick();
              onSelectControl('all');
            }}
            className="shrink-0 text-cyan-300 hover:text-white font-bold uppercase cursor-pointer"
          >
            Show All
          </button>
        )}
      </div>
    </div>
  );
}
