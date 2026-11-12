import { sounds } from '../../audio/soundEngine';
import { type DefaultRadarMode, useSettingsStore } from '../../settings/settingsStore';
import { Sliders } from 'lucide-react';

export function DisplayHudTab() {
  const settings = useSettingsStore();

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div>
        <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" /> Visual FX & Tactical HUD
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Customize visual effects, camera shake, minimap radar sizing, and touch hints.
        </p>
      </div>

      {/* CRT Scanline Toggle */}
      <div className="flex items-center justify-between p-4 bg-slate-950/70 border border-slate-800 clip-chamfer">
        <div>
          <div className="text-sm font-bold text-white">CRT Scanline Filter</div>
          <div className="text-xs text-slate-400 mt-0.5">
            Overlay subtle cyberpunk scanlines across menus and battlefield canvas.
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            sounds.playUiClick();
            settings.updateSettings({ crtScanlines: !settings.crtScanlines });
          }}
          className={`px-4 py-2 text-xs font-mono font-black uppercase tracking-wider clip-chamfer border transition cursor-pointer ${
            settings.crtScanlines
              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
              : 'bg-slate-900 border-slate-700 text-slate-400'
          }`}
        >
          {settings.crtScanlines ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Camera Screen Shake Toggle */}
      <div className="flex items-center justify-between p-4 bg-slate-950/70 border border-slate-800 clip-chamfer">
        <div>
          <div className="text-sm font-bold text-white">Combat Screen Shake</div>
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
          className={`px-4 py-2 text-xs font-mono font-black uppercase tracking-wider clip-chamfer border transition cursor-pointer ${
            settings.screenShake
              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
              : 'bg-slate-900 border-slate-700 text-slate-400'
          }`}
        >
          {settings.screenShake ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Default Minimap Radar Mode */}
      <div className="p-4 bg-slate-950/70 border border-slate-800 clip-chamfer space-y-3">
        <div>
          <div className="text-sm font-bold text-white">Default Minimap Radar</div>
          <div className="text-xs text-slate-400 mt-0.5">
            Choose initial radar footprint when deploying into a match.
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: 'compact', label: 'Compact' },
              { id: 'expanded', label: 'Expanded' },
              { id: 'hidden', label: 'Minimized' },
            ] as { id: DefaultRadarMode; label: string }[]
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                sounds.playUiClick();
                settings.updateSettings({ defaultRadarMode: opt.id });
              }}
              className={`py-2 px-3 text-xs font-mono font-bold uppercase border clip-chamfer cursor-pointer transition ${
                settings.defaultRadarMode === opt.id
                  ? 'bg-cyan-500/25 border-cyan-400 text-white'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Touch Hints Toggle */}
      <div className="flex items-center justify-between p-4 bg-slate-950/70 border border-slate-800 clip-chamfer">
        <div>
          <div className="text-sm font-bold text-white">Mobile Touch Hints</div>
          <div className="text-xs text-slate-400 mt-0.5">
            Show idle Move/Aim thumb guides on touchscreen devices.
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            sounds.playUiClick();
            settings.updateSettings({ showTouchHints: !settings.showTouchHints });
          }}
          className={`px-4 py-2 text-xs font-mono font-black uppercase tracking-wider clip-chamfer border transition cursor-pointer ${
            settings.showTouchHints
              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
              : 'bg-slate-900 border-slate-700 text-slate-400'
          }`}
        >
          {settings.showTouchHints ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
}
