import { useEffect, useRef, useState } from "react";
import { sounds } from "../../audio/soundEngine";
import { useAvatarStore } from "../../avatar/avatarStore";
import { renderAvatar } from "../../avatar/renderAvatar";
import {
  computeAutoCameraZoom,
  createCamera,
  MAX_CAMERA_ZOOM,
  MIN_CAMERA_ZOOM,
  updateCamera,
  type Camera,
} from "../../camera";
import { drawArenaPerimeterOverscan } from "../../game/arenaRenderer";
import { defaultMap } from "../../map/maps/defaultMap";
import {
  createBackdropCache,
  renderBackdropWorldProps,
  renderProceduralBackdrop,
  resolveMapTheme,
  type BackdropCache,
} from "../../map/renderBackdrop";
import { renderMap } from "../../map/renderMap";
import {
  type DefaultRadarMode,
  type HudScale,
  useSettingsStore,
} from "../../settings/settingsStore";
import {
  applySwUpdate,
  checkForSwUpdate,
  PwaInstallButton,
  requestPersistentStorage,
  usePwaStore,
} from "../../pwa";
import {
  Check,
  Eye,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Smartphone,
  Zap,
  ZoomIn,
} from "lucide-react";

type DisplayFocus = "all" | "zoom" | "hud" | "radar" | "fx";

const DISPLAY_CHIPS: { id: DisplayFocus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "zoom", label: "Zoom" },
  { id: "hud", label: "HUD Size" },
  { id: "radar", label: "Radar" },
  { id: "fx", label: "FX & App" },
];

export function DisplayHudTab() {
  const settings = useSettingsStore();
  const avatar = useAvatarStore((s) => s.avatar);
  const pwa = usePwaStore();

  const [focus, setFocus] = useState<DisplayFocus>("all");
  const [shakeEnergy, setShakeEnergy] = useState(0);

  const previewBoxRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [boxSize, setBoxSize] = useState({ w: 400, h: 240 });

  const settingsRef = useRef(settings);
  const avatarRef = useRef(avatar);
  const boxSizeRef = useRef(boxSize);
  const shakeRef = useRef(0);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    avatarRef.current = avatar;
  }, [avatar]);

  useEffect(() => {
    boxSizeRef.current = boxSize;
  }, [boxSize]);

  useEffect(() => {
    shakeRef.current = shakeEnergy;
  }, [shakeEnergy]);

  useEffect(() => {
    if (shakeEnergy <= 0) return;
    const id = window.setTimeout(() => setShakeEnergy(0), 320);
    return () => window.clearTimeout(id);
  }, [shakeEnergy]);

  useEffect(() => {
    const el = previewBoxRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 40 && r.height > 40) {
        setBoxSize({ w: Math.round(r.width), h: Math.round(r.height) });
      }
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let backdropCache: BackdropCache | null = null;
    let animId = 0;
    let timeSec = 0;
    let lastNow = performance.now();
    let cam: Camera = createCamera(400, 240, 0.7);

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

      const s = settingsRef.current;
      const rawZoom =
        s.cameraZoomMode === "auto"
          ? computeAutoCameraZoom(
              typeof window !== "undefined" ? window.innerWidth : 667,
              typeof window !== "undefined" ? window.innerHeight : 375,
            )
          : s.cameraZoom;
      const viewportRatio = Math.max(0.45, Math.min(1.0, cssW / 667));
      cam = updateCamera(
        {
          ...cam,
          viewportWidth: cssW,
          viewportHeight: cssH,
          zoom: rawZoom * viewportRatio,
        },
        450,
        410,
        defaultMap.width,
        defaultMap.height,
        0.2,
      );

      if (shakeRef.current > 0) {
        shakeRef.current = Math.max(0, shakeRef.current - dt * 28);
      }
      const ox =
        s.screenShake && shakeRef.current > 0
          ? (Math.sin(timeSec * 58) * shakeRef.current)
          : 0;
      const oy =
        s.screenShake && shakeRef.current > 0
          ? (Math.cos(timeSec * 49) * shakeRef.current)
          : 0;

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
        cam,
        cssW,
        cssH,
        timeSec,
      );

      ctx.save();
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-cam.x + ox, -cam.y + oy);

      renderBackdropWorldProps(ctx, defaultMap, timeSec);
      renderMap(ctx, defaultMap, timeSec, false);

      // Friendly Blue & Rival Red pilots demonstrating markers & zoom
      const blueY = 445 + Math.sin(timeSec * 2.1) * 4;
      ctx.save();
      ctx.translate(385, blueY);
      renderAvatar(ctx, avatarRef.current, {
        aimAngle: -0.15,
        radius: 17,
        isBoosting: true,
        team: "blue",
        showHUD: false,
        vy: 0,
        timeSec,
        weaponType: s.defaultWeapon,
      });
      ctx.restore();

      const redY = 445 + Math.cos(timeSec * 2.1) * 4;
      ctx.save();
      ctx.translate(545, redY);
      renderAvatar(
        ctx,
        {
          ...avatarRef.current,
          bodyColor: "#ff0055",
          headgear: "soldier_helmet",
          visorStyle: "neon",
          callsign: "Rival",
        },
        {
          aimAngle: Math.PI + 0.15,
          radius: 17,
          isBoosting: false,
          team: "red",
          showHUD: false,
          vy: 0,
          timeSec,
          weaponType: "rocket",
        },
      );
      ctx.restore();

      // Team Marker Badges
      ctx.font = "bold 11px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#38bdf8";
      ctx.fillText(
        s.highContrastTeamMarkers ? `◆ ${avatarRef.current.callsign || "YOU"}` : avatarRef.current.callsign || "YOU",
        385,
        blueY - 30,
      );
      ctx.fillStyle = "#fb7185";
      ctx.fillText(
        s.highContrastTeamMarkers ? "▲ RIVAL" : "RIVAL",
        545,
        redY - 30,
      );

      ctx.restore();

      drawArenaPerimeterOverscan(ctx, defaultMap, cam, cssW, cssH);

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, []);

  const autoPreviewZoom =
    typeof window !== "undefined"
      ? computeAutoCameraZoom(window.innerWidth, window.innerHeight)
      : 1;
  const activeZoomDisplay =
    settings.cameraZoomMode === "auto" ? autoPreviewZoom : settings.cameraZoom;

  const hudBadgeClass =
    settings.hudScale === "compact"
      ? "scale-90 text-[8.5px]"
      : settings.hudScale === "large"
        ? "scale-105 text-[10.5px]"
        : "scale-100 text-[9.5px]";

  const showZoom = focus === "all" || focus === "zoom";
  const showHud = focus === "all" || focus === "hud";
  const showRadar = focus === "all" || focus === "radar";
  const showFx = focus === "all" || focus === "fx";

  return (
    <div className="flex-1 min-h-0 h-full flex flex-col min-[520px]:flex-row gap-2.5 sm:gap-4 overflow-hidden">
      {/* Pinned Left Live HUD Preview */}
      <div className="h-[185px] xs:h-[205px] min-[520px]:h-full min-[520px]:flex-1 min-w-0 shrink-0 min-[520px]:shrink flex flex-col gap-1.5">
        <div
          ref={previewBoxRef}
          onClick={() => {
            sounds.playUiClick();
            setFocus("zoom");
          }}
          className="relative flex-1 min-h-[150px] w-full rounded-lg overflow-hidden border border-cyan-500/35 bg-[#060913] cursor-pointer select-none"
        >
          <canvas ref={canvasRef} className="w-full h-full block" />

          {/* Simulated CRT Scanline Overlay inside Preview */}
          {settings.crtScanlines && (
            <div className="pointer-events-none absolute inset-0 scanline-overlay opacity-80" />
          )}

          {/* Top-Left Vitals & Center Scoreboard Mockup (HUD Scale Preview) */}
          <div className="absolute top-1.5 inset-x-1.5 flex items-start justify-between gap-1.5 pointer-events-none">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                sounds.playUiClick();
                setFocus("hud");
              }}
              className={`pointer-events-auto origin-top-left px-2 py-1 bg-slate-950/85 border clip-chamfer font-mono transition cursor-pointer ${hudBadgeClass} ${
                focus === "hud" ? "border-cyan-300 ring-1 ring-cyan-400" : "border-cyan-500/35"
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-slate-200">
                <span className="text-sky-300">
                  {settings.highContrastTeamMarkers ? "◆ BLUE 2" : "BLUE 2"}
                </span>
                <span className="text-slate-400">3:40</span>
                <span className="text-rose-300">
                  {settings.highContrastTeamMarkers ? "▲ RED 1" : "RED 1"}
                </span>
              </div>
            </button>

            {/* Right Radar Mockup (Default Radar Mode Preview) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                sounds.playUiClick();
                setFocus("radar");
              }}
              className={`pointer-events-auto bg-slate-950/85 border clip-chamfer font-mono transition cursor-pointer ${
                focus === "radar" ? "border-cyan-300 ring-1 ring-cyan-400" : "border-slate-700"
              } ${
                settings.defaultRadarMode === "expanded"
                  ? "w-28 h-16 p-1.5"
                  : settings.defaultRadarMode === "compact"
                    ? "w-20 h-12 p-1"
                    : "px-2 py-1"
              }`}
            >
              {settings.defaultRadarMode === "hidden" ? (
                <span className="text-[8.5px] font-bold text-slate-300 uppercase">
                  Radar Hidden
                </span>
              ) : (
                <div className="w-full h-full flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[7.5px] text-cyan-300 font-bold uppercase">
                    <span>Radar</span>
                    <span>{settings.defaultRadarMode === "expanded" ? "EXP" : "CMP"}</span>
                  </div>
                  <div className="flex-1 mt-0.5 rounded-sm bg-slate-900/90 border border-slate-800 relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-rose-400" />
                  </div>
                </div>
              )}
            </button>
          </div>

          {/* Bottom-Left Quick Actions inside Preview */}
          <div className="absolute bottom-1.5 inset-x-1.5 flex items-center justify-between gap-1.5 pointer-events-none">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                sounds.playUiClick();
                settings.updateSettings({
                  highContrastTeamMarkers: !settings.highContrastTeamMarkers,
                });
              }}
              className="pointer-events-auto px-2 py-1 bg-slate-950/85 hover:bg-slate-900 border border-slate-700 hover:border-cyan-400/60 clip-chamfer text-[8.5px] font-mono font-bold text-slate-200 cursor-pointer"
            >
              Markers: {settings.highContrastTeamMarkers ? "◆/▲ ON" : "Standard"}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                sounds.playExplosion();
                setShakeEnergy(settings.screenShake ? 9 : 0);
                setFocus("fx");
              }}
              className="pointer-events-auto flex items-center gap-1 px-2 py-1 bg-slate-950/85 hover:bg-slate-900 border border-amber-500/40 clip-chamfer text-[8.5px] font-mono font-bold text-amber-300 cursor-pointer"
            >
              <Zap className="w-2.5 h-2.5" />
              Test Shake
            </button>
          </div>
        </div>

        <div className="shrink-0 flex items-center justify-between px-2 py-1 bg-slate-950/80 border border-slate-800 rounded text-[9.5px] font-mono text-slate-400">
          <span className="truncate">Tap HUD, Radar, or Field to jump to its setting</span>
          <span className="text-cyan-300 font-bold shrink-0">{activeZoomDisplay.toFixed(2)}x</span>
        </div>
      </div>

      {/* Scrollable Right Settings Panel */}
      <div className="flex-1 min-[520px]:flex-none min-[520px]:w-[265px] sm:w-[300px] lg:w-[355px] min-h-0 h-full flex flex-col overflow-hidden bg-slate-950/55 border border-slate-800 clip-chamfer">
        {/* Focus Chip Bar */}
        <div className="shrink-0 p-2 sm:p-2.5 border-b border-slate-800 bg-slate-950/90 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-cyan-300 flex items-center gap-1.5">
              <Monitor className="w-3.5 h-3.5 text-cyan-400" /> Display &amp; HUD
            </span>
            <span className="text-[9.5px] font-mono text-slate-400 uppercase">
              {settings.hudScale} • {settings.defaultRadarMode}
            </span>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto cyber-scroll pb-0.5">
            {DISPLAY_CHIPS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  setFocus(c.id);
                }}
                className={`shrink-0 px-2 py-1 text-[9.5px] font-mono font-bold uppercase clip-chamfer border cursor-pointer transition ${
                  focus === c.id
                    ? "bg-cyan-500/25 border-cyan-400 text-white"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto cyber-scroll p-2.5 sm:p-3 flex flex-col gap-3">
          {/* Camera Tactical Zoom */}
          {showZoom && (
            <div className="p-3 bg-slate-950/80 border border-cyan-500/30 clip-chamfer space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ZoomIn className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  Combat Camera Zoom
                </div>
                <span className="px-2 py-0.5 bg-slate-900 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono font-black clip-chamfer">
                  {settings.cameraZoomMode === "auto" ? "AUTO " : ""}
                  {activeZoomDisplay.toFixed(2)}x
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    settings.updateSettings({ cameraZoomMode: "auto" });
                  }}
                  className={`py-1.5 px-2 text-[10px] font-mono font-black uppercase border clip-chamfer cursor-pointer transition ${
                    settings.cameraZoomMode === "auto"
                      ? "bg-cyan-500/25 border-cyan-400 text-white"
                      : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
                  }`}
                >
                  Auto ({autoPreviewZoom.toFixed(2)}x)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    settings.updateSettings({ cameraZoomMode: "custom" });
                  }}
                  className={`py-1.5 px-2 text-[10px] font-mono font-black uppercase border clip-chamfer cursor-pointer transition ${
                    settings.cameraZoomMode === "custom"
                      ? "bg-cyan-500/25 border-cyan-400 text-white"
                      : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
                  }`}
                >
                  Custom ({settings.cameraZoom.toFixed(2)}x)
                </button>
              </div>

              <input
                type="range"
                min={MIN_CAMERA_ZOOM}
                max={MAX_CAMERA_ZOOM}
                step={0.05}
                value={
                  settings.cameraZoomMode === "auto"
                    ? autoPreviewZoom
                    : settings.cameraZoom
                }
                onChange={(e) =>
                  settings.updateSettings({
                    cameraZoomMode: "custom",
                    cameraZoom: Number(e.target.value),
                  })
                }
                className="w-full accent-cyan-400 cursor-pointer"
                aria-label="Combat Camera Zoom"
              />

              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { z: 0.55, label: "0.55x Wide" },
                  { z: 0.75, label: "0.75x Mob" },
                  { z: 0.9, label: "0.90x Tac" },
                  { z: 1.15, label: "1.15x Close" },
                ].map((preset) => (
                  <button
                    key={preset.z}
                    type="button"
                    onClick={() => {
                      sounds.playUiClick();
                      settings.updateSettings({
                        cameraZoomMode: "custom",
                        cameraZoom: preset.z,
                      });
                    }}
                    className={`px-2 py-1 text-[9.5px] font-mono font-bold border clip-chamfer cursor-pointer ${
                      settings.cameraZoomMode === "custom" &&
                      Math.abs(settings.cameraZoom - preset.z) < 0.02
                        ? "bg-cyan-500/25 border-cyan-400 text-white"
                        : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* HUD Scale */}
          {showHud && (
            <div className="p-3 bg-slate-950/80 border border-slate-800 clip-chamfer space-y-2.5">
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" /> HUD Interface Scale
                </div>
                <div className="text-[10.5px] text-slate-400 mt-0.5">
                  Adjust top scoreboard &amp; weapon dock proportions.
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: "compact", label: "Compact" },
                    { id: "standard", label: "Standard" },
                    { id: "large", label: "Large" },
                  ] as { id: HudScale; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      sounds.playUiClick();
                      settings.updateSettings({ hudScale: opt.id });
                    }}
                    className={`py-1.5 px-2 text-[10px] font-mono font-bold uppercase border clip-chamfer cursor-pointer transition ${
                      settings.hudScale === opt.id
                        ? "bg-cyan-500/25 border-cyan-400 text-white"
                        : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Default Minimap Radar Mode */}
          {showRadar && (
            <div className="p-3 bg-slate-950/80 border border-slate-800 clip-chamfer space-y-2.5">
              <div>
                <div className="text-xs font-bold text-white">Default Minimap Radar</div>
                <div className="text-[10.5px] text-slate-400 mt-0.5">
                  Initial radar footprint when deploying into a match.
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: "compact", label: "Compact" },
                    { id: "expanded", label: "Expanded" },
                    { id: "hidden", label: "Minimized" },
                  ] as { id: DefaultRadarMode; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      sounds.playUiClick();
                      settings.updateSettings({ defaultRadarMode: opt.id });
                    }}
                    className={`py-1.5 px-1.5 text-[10px] font-mono font-bold uppercase border clip-chamfer cursor-pointer transition ${
                      settings.defaultRadarMode === opt.id
                        ? "bg-cyan-500/25 border-cyan-400 text-white"
                        : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Visual FX Toggles + PWA */}
          {showFx && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  settings.updateSettings({
                    highContrastTeamMarkers: !settings.highContrastTeamMarkers,
                  });
                }}
                className="w-full flex items-center justify-between gap-2 p-2.5 bg-slate-950/80 border border-slate-800 clip-chamfer text-left cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    High-Contrast Team Shapes
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Show ◆ Blue &amp; ▲ Red badges on HUD &amp; radar.
                  </div>
                </div>
                <span
                  className={`shrink-0 px-2.5 py-1 text-[10px] font-mono font-black uppercase clip-chamfer border ${
                    settings.highContrastTeamMarkers
                      ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                      : "bg-slate-900 border-slate-700 text-slate-400"
                  }`}
                >
                  {settings.highContrastTeamMarkers ? "ON" : "OFF"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  settings.updateSettings({ crtScanlines: !settings.crtScanlines });
                }}
                className="w-full flex items-center justify-between gap-2 p-2.5 bg-slate-950/80 border border-slate-800 clip-chamfer text-left cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white">CRT Scanline Filter</div>
                  <div className="text-[10px] text-slate-400">
                    Cyberpunk horizontal scanline overlay.
                  </div>
                </div>
                <span
                  className={`shrink-0 px-2.5 py-1 text-[10px] font-mono font-black uppercase clip-chamfer border ${
                    settings.crtScanlines
                      ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                      : "bg-slate-900 border-slate-700 text-slate-400"
                  }`}
                >
                  {settings.crtScanlines ? "ON" : "OFF"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  settings.updateSettings({ screenShake: !settings.screenShake });
                }}
                className="w-full flex items-center justify-between gap-2 p-2.5 bg-slate-950/80 border border-slate-800 clip-chamfer text-left cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white">Combat Screen Shake</div>
                  <div className="text-[10px] text-slate-400">
                    Recoil &amp; blast camera kick.
                  </div>
                </div>
                <span
                  className={`shrink-0 px-2.5 py-1 text-[10px] font-mono font-black uppercase clip-chamfer border ${
                    settings.screenShake
                      ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                      : "bg-slate-900 border-slate-700 text-slate-400"
                  }`}
                >
                  {settings.screenShake ? "ON" : "OFF"}
                </span>
              </button>

              {/* Native App & Offline PWA Status */}
              <div className="p-3 bg-slate-950/80 border border-cyan-500/25 clip-chamfer space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    Native App &amp; Offline
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[9.5px] font-mono font-black uppercase border clip-chamfer ${
                      pwa.isInstalled
                        ? "bg-emerald-950/70 border-emerald-400/60 text-emerald-300"
                        : "bg-slate-900 border-slate-700 text-slate-300"
                    }`}
                  >
                    {pwa.isInstalled ? `Native (${pwa.displayMode})` : "Browser"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                  <div className="p-2 bg-slate-900/75 border border-slate-800 clip-chamfer flex items-center justify-between gap-1">
                    <span className="text-slate-400">Cache</span>
                    <span className={pwa.swRegistered ? "text-emerald-300 font-bold" : "text-slate-400"}>
                      {pwa.swRegistered
                        ? pwa.offlineAssetCount !== null
                          ? `${pwa.offlineAssetCount} files`
                          : "Ready"
                        : "Standby"}
                    </span>
                  </div>

                  <div className="p-2 bg-slate-900/75 border border-slate-800 clip-chamfer flex items-center justify-between gap-1">
                    <span className="text-slate-400">Lock</span>
                    {pwa.storagePersisted ? (
                      <span className="text-emerald-300 font-bold flex items-center gap-0.5">
                        <ShieldCheck className="w-3 h-3" /> Safe
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playUiClick();
                          void requestPersistentStorage();
                        }}
                        className="text-cyan-300 hover:text-white underline cursor-pointer font-bold"
                      >
                        Protect
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <PwaInstallButton />

                  {pwa.swUpdateReady ? (
                    <button
                      type="button"
                      onClick={() => {
                        sounds.playUiClick();
                        applySwUpdate();
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-cyan-400 to-sky-400 text-slate-950 font-mono font-black text-[10px] uppercase clip-chamfer cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Apply Update</span>
                    </button>
                  ) : pwa.swRegistered ? (
                    <button
                      type="button"
                      disabled={pwa.swChecking}
                      onClick={() => {
                        sounds.playUiClick();
                        void checkForSwUpdate();
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 text-slate-200 text-[10px] font-mono font-bold uppercase clip-chamfer cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 text-cyan-400 ${pwa.swChecking ? "animate-spin" : ""}`} />
                      <span>{pwa.swChecking ? "Checking..." : "Check Updates"}</span>
                    </button>
                  ) : null}

                  {pwa.isInstalled && (
                    <span className="inline-flex items-center gap-1 text-[9.5px] font-mono text-emerald-300/90 ml-auto">
                      <Check className="w-3 h-3" /> Installed
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
