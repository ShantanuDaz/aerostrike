import { sounds } from "../../audio/soundEngine";
import {
  computeAutoCameraZoom,
  MAX_CAMERA_ZOOM,
  MIN_CAMERA_ZOOM,
} from "../../camera/cameraMath";
import {
  type DefaultRadarMode,
  type HudScale,
  useSettingsStore,
} from "../../settings/settingsStore";
import { Eye, Sliders, ZoomIn } from "lucide-react";

export function DisplayHudTab() {
  const settings = useSettingsStore();
  const autoPreviewZoom =
    typeof window !== "undefined"
      ? computeAutoCameraZoom(window.innerWidth, window.innerHeight)
      : 1;
  const activeZoomDisplay =
    settings.cameraZoomMode === "auto" ? autoPreviewZoom : settings.cameraZoom;

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div>
        <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" /> Visual FX, Camera &amp;
          Tactical HUD
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Tune battlefield zoom framing, HUD scale, team shape clarity, visual
          FX, and radar sizing.
        </p>
      </div>

      {/* Camera Tactical Zoom */}
      <div className="p-3.5 sm:p-4 bg-slate-950/70 border border-cyan-500/30 clip-chamfer space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <ZoomIn className="w-4 h-4 text-cyan-400 shrink-0" />
              Combat Camera Zoom
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Zoom out to spot threats farther across narrow screens, or switch
              to Auto for adaptive viewport framing.
            </div>
          </div>
          <span className="shrink-0 px-2.5 py-1 bg-slate-900 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-black clip-chamfer">
            {settings.cameraZoomMode === "auto" ? "AUTO " : ""}
            {activeZoomDisplay.toFixed(2)}x
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => {
              sounds.playUiClick();
              settings.updateSettings({ cameraZoomMode: "auto" });
            }}
            className={`py-2 px-3 text-[11px] sm:text-xs font-mono font-black uppercase border clip-chamfer cursor-pointer transition ${
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
            className={`py-2 px-3 text-[11px] sm:text-xs font-mono font-black uppercase border clip-chamfer cursor-pointer transition ${
              settings.cameraZoomMode === "custom"
                ? "bg-cyan-500/25 border-cyan-400 text-white"
                : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
            }`}
          >
            Custom ({settings.cameraZoom.toFixed(2)}x)
          </button>
        </div>

        <div className="space-y-2 pt-1">
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
          />
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { z: 0.65, label: "0.65x Wide" },
              { z: 0.85, label: "0.85x Tactical" },
              { z: 1.0, label: "1.00x Std" },
              { z: 1.2, label: "1.20x Close" },
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
                className={`px-2.5 py-1 text-[10px] sm:text-[11px] font-mono font-bold border clip-chamfer cursor-pointer ${
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
      </div>

      {/* HUD Scale */}
      <div className="p-3.5 sm:p-4 bg-slate-950/70 border border-slate-800 clip-chamfer space-y-3">
        <div>
          <div className="text-sm font-bold text-white">HUD Interface Scale</div>
          <div className="text-xs text-slate-400 mt-0.5">
            Adjust top scoreboard &amp; weapon dock proportions for small phones
            or large displays.
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
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
              className={`py-2 px-2 sm:px-3 text-[10px] xs:text-[11px] sm:text-xs font-mono font-bold uppercase border clip-chamfer cursor-pointer transition ${
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

      {/* High Contrast Team Shapes */}
      <div className="flex items-center justify-between gap-3 p-3.5 sm:p-4 bg-slate-950/70 border border-slate-800 clip-chamfer">
        <div className="min-w-0">
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <Eye className="w-4 h-4 text-cyan-400 shrink-0" />
            High-Contrast Team Shapes
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            Add ◆ Blue Diamond &amp; ▲ Red Triangle badges beside nameplates,
            radar blips, and scoreboard rows.
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            sounds.playUiClick();
            settings.updateSettings({
              highContrastTeamMarkers: !settings.highContrastTeamMarkers,
            });
          }}
          className={`shrink-0 px-3.5 sm:px-4 py-2 text-xs font-mono font-black uppercase tracking-wider clip-chamfer border transition cursor-pointer ${
            settings.highContrastTeamMarkers
              ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
              : "bg-slate-900 border-slate-700 text-slate-400"
          }`}
        >
          {settings.highContrastTeamMarkers ? "ON" : "OFF"}
        </button>
      </div>

      {/* CRT Scanline Toggle */}
      <div className="flex items-center justify-between gap-3 p-3.5 sm:p-4 bg-slate-950/70 border border-slate-800 clip-chamfer">
        <div className="min-w-0">
          <div className="text-sm font-bold text-white">
            CRT Scanline Filter
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            Overlay subtle cyberpunk scanlines across menus and battlefield
            canvas.
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            sounds.playUiClick();
            settings.updateSettings({ crtScanlines: !settings.crtScanlines });
          }}
          className={`shrink-0 px-3.5 sm:px-4 py-2 text-xs font-mono font-black uppercase tracking-wider clip-chamfer border transition cursor-pointer ${
            settings.crtScanlines
              ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
              : "bg-slate-900 border-slate-700 text-slate-400"
          }`}
        >
          {settings.crtScanlines ? "ON" : "OFF"}
        </button>
      </div>

      {/* Camera Screen Shake Toggle */}
      <div className="flex items-center justify-between gap-3 p-3.5 sm:p-4 bg-slate-950/70 border border-slate-800 clip-chamfer">
        <div className="min-w-0">
          <div className="text-sm font-bold text-white">
            Combat Screen Shake
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            Apply camera recoil shake on heavy weapons fire and impact hits.
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            sounds.playUiClick();
            settings.updateSettings({ screenShake: !settings.screenShake });
          }}
          className={`shrink-0 px-3.5 sm:px-4 py-2 text-xs font-mono font-black uppercase tracking-wider clip-chamfer border transition cursor-pointer ${
            settings.screenShake
              ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
              : "bg-slate-900 border-slate-700 text-slate-400"
          }`}
        >
          {settings.screenShake ? "ON" : "OFF"}
        </button>
      </div>

      {/* Default Minimap Radar Mode */}
      <div className="p-3.5 sm:p-4 bg-slate-950/70 border border-slate-800 clip-chamfer space-y-3">
        <div>
          <div className="text-sm font-bold text-white">
            Default Minimap Radar
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            Choose initial radar footprint when deploying into a match.
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
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
              className={`py-2 px-1 xs:px-2 sm:px-3 text-[10px] xs:text-[11px] sm:text-xs font-mono font-bold uppercase border clip-chamfer cursor-pointer transition ${
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

      {/* Touch Hints Toggle */}
      <div className="flex items-center justify-between gap-3 p-3.5 sm:p-4 bg-slate-950/70 border border-slate-800 clip-chamfer">
        <div className="min-w-0">
          <div className="text-sm font-bold text-white">Mobile Touch Hints</div>
          <div className="text-xs text-slate-400 mt-0.5">
            Show idle Move/Aim thumb guides on touchscreen devices.
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            sounds.playUiClick();
            settings.updateSettings({
              showTouchHints: !settings.showTouchHints,
            });
          }}
          className={`shrink-0 px-3.5 sm:px-4 py-2 text-xs font-mono font-black uppercase tracking-wider clip-chamfer border transition cursor-pointer ${
            settings.showTouchHints
              ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
              : "bg-slate-900 border-slate-700 text-slate-400"
          }`}
        >
          {settings.showTouchHints ? "ON" : "OFF"}
        </button>
      </div>
    </div>
  );
}
