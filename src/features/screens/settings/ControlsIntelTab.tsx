import { Keyboard, Smartphone, Vibrate, Zap } from 'lucide-react';
import { sounds } from '../../audio/soundEngine';
import {
  type TouchAimMode,
  type TouchLayout,
  useSettingsStore,
} from '../../settings/settingsStore';

export function ControlsIntelTab() {
  const settings = useSettingsStore();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400" /> Controls &amp; Combat Field Manual
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Tune mobile touch ergonomics and review desktop bindings plus Capture The Flag tactical rules.
        </p>
      </div>

      {/* Interactive Mobile & Touch Tuning */}
      <div className="bg-slate-950/75 border border-cyan-500/30 p-3.5 sm:p-4 clip-chamfer space-y-4">
        <div className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
          <Smartphone className="w-4 h-4" /> Mobile &amp; Touch Ergonomics
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Aim Fire Mode */}
          <div className="space-y-1.5">
            <div className="text-xs font-bold text-white">Right Stick Aim Style</div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Precision Mode aims cleanly without firing until you push past the outer ring or release.
            </p>
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {(
                [
                  { id: 'instant', label: 'Instant Fire' },
                  { id: 'precision', label: 'Precision Aim' },
                ] as { id: TouchAimMode; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    settings.updateSettings({ touchAimMode: opt.id });
                  }}
                  className={`py-2 px-2 text-[11px] font-mono font-bold uppercase border clip-chamfer cursor-pointer transition ${
                    settings.touchAimMode === opt.id
                      ? 'bg-cyan-500/25 border-cyan-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Stick Handedness */}
          <div className="space-y-1.5">
            <div className="text-xs font-bold text-white">Thumb Cluster Handedness</div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Swap virtual move &amp; aim screen halves plus action buttons to match left-handed grip.
            </p>
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {(
                [
                  { id: 'right_handed', label: 'Right-Handed' },
                  { id: 'left_handed', label: 'Left-Handed' },
                ] as { id: TouchLayout; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    settings.updateSettings({ touchLayout: opt.id });
                  }}
                  className={`py-2 px-2 text-[11px] font-mono font-bold uppercase border clip-chamfer cursor-pointer transition ${
                    settings.touchLayout === opt.id
                      ? 'bg-cyan-500/25 border-cyan-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => {
              sounds.playUiClick();
              settings.updateSettings({ touchAimLine: !settings.touchAimLine });
            }}
            className={`flex items-center justify-between gap-2 px-3 py-2 border clip-chamfer text-left cursor-pointer transition ${
              settings.touchAimLine
                ? 'bg-cyan-500/15 border-cyan-400/70 text-cyan-200'
                : 'bg-slate-900/80 border-slate-800 text-slate-400'
            }`}
          >
            <span className="text-[11px] font-mono font-bold uppercase">Aim Laser Line</span>
            <span className="text-[10px] font-mono font-black">
              {settings.touchAimLine ? 'ON' : 'OFF'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              sounds.playUiClick();
              settings.updateSettings({
                showTouchBoostButton: !settings.showTouchBoostButton,
              });
            }}
            className={`flex items-center justify-between gap-2 px-3 py-2 border clip-chamfer text-left cursor-pointer transition ${
              settings.showTouchBoostButton
                ? 'bg-cyan-500/15 border-cyan-400/70 text-cyan-200'
                : 'bg-slate-900/80 border-slate-800 text-slate-400'
            }`}
          >
            <span className="text-[11px] font-mono font-bold uppercase">Boost Button</span>
            <span className="text-[10px] font-mono font-black">
              {settings.showTouchBoostButton ? 'ON' : 'OFF'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              sounds.playUiClick();
              settings.updateSettings({ hapticsEnabled: !settings.hapticsEnabled });
            }}
            className={`flex items-center justify-between gap-2 px-3 py-2 border clip-chamfer text-left cursor-pointer transition ${
              settings.hapticsEnabled
                ? 'bg-emerald-500/15 border-emerald-400/70 text-emerald-200'
                : 'bg-slate-900/80 border-slate-800 text-slate-400'
            }`}
          >
            <span className="text-[11px] font-mono font-bold uppercase flex items-center gap-1.5">
              <Vibrate className="w-3.5 h-3.5 shrink-0" />
              Haptics
            </span>
            <span className="text-[10px] font-mono font-black">
              {settings.hapticsEnabled ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Desktop Keybindings */}
        <div className="bg-slate-950/75 border border-slate-800 p-4 clip-chamfer space-y-3">
          <div className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
            <Keyboard className="w-4 h-4" /> Desktop Controls
          </div>
          <div className="space-y-2 text-xs">
            {[
              ['A / D or ← / →', 'Strafe Left / Right'],
              ['W / Space / ↑', 'Fire Jetpack & Jump Hop'],
              ['S / ↓', 'Drop Through Platforms'],
              ['Shift / E', 'Thruster Air-Dash Burst'],
              ['Mouse Move', '360° Aim Crosshair'],
              ['Left Click (Hold)', 'Fire Equipped Weapon'],
              ['Wheel / + / - / 0', 'Camera Zoom Out / In / Auto'],
              ['1 – 5 / Q Keys', 'Select Weapon / Quick Cycle'],
              ['Tab / Esc', 'Scoreboard / Tactical Pause Menu'],
            ].map(([key, desc]) => (
              <div
                key={key}
                className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-900 last:border-0"
              >
                <span className="shrink-0 whitespace-nowrap text-[10px] sm:text-xs font-mono font-bold text-cyan-200 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  {key}
                </span>
                <span className="text-slate-300 text-right text-[11px] sm:text-xs">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Touch Controls */}
        <div className="bg-slate-950/75 border border-slate-800 p-4 clip-chamfer space-y-3">
          <div className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
            <Smartphone className="w-4 h-4" /> Mobile Touch Guide
          </div>
          <ul className="space-y-2 text-xs text-slate-300 list-disc list-inside">
            <li>
              <strong className="text-white">Move Stick:</strong> Drag horizontally to strafe, pull up to boost, push down to drop through ledges.
            </li>
            <li>
              <strong className="text-white">Aim Stick:</strong> Aims 360° with an optional laser sightline; choose Instant Fire or Precision Aim above.
            </li>
            <li>
              <strong className="text-white">Radar Zoom Pill (− / Auto / +):</strong> Zooms the camera out immediately for wide situational awareness on small screens.
            </li>
            <li>
              <strong className="text-white">Weapon Pill &amp; Rack Drawer:</strong> Tap the badge to quick-cycle or expand <code className="text-cyan-300">Rack</code> to pick any of the 5 weapons directly.
            </li>
            <li>
              <strong className="text-white">Combat Menu &amp; Auto-Fullscreen:</strong> Tap <code className="text-cyan-300">Menu</code> in the top-right to adjust zoom, layout, audio, or fullscreen mid-match.
            </li>
          </ul>
        </div>
      </div>

      {/* CTF Rules & Recoil Tip */}
      <div className="bg-slate-950/75 border border-cyan-500/25 p-4 clip-chamfer space-y-2">
        <div className="text-xs font-mono font-bold text-amber-300 uppercase tracking-widest">
          Tactical Engagement Rules
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
          <li>• Touch the enemy flag to pick it up and carry it back to your base pedestal.</li>
          <li>• Your own flag must be safely at base to score a capture (first to rule limit wins).</li>
          <li>• Touching your dropped friendly flag immediately returns it to base.</li>
          <li>• Use Shotgun &amp; Rocket recoil impulses mid-air to rocket-jump up vertical shafts!</li>
        </ul>
      </div>
    </div>
  );
}
