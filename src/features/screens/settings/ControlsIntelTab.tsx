import { Keyboard, Smartphone, Zap } from 'lucide-react';

export function ControlsIntelTab() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400" /> Controls & Combat Field Manual
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Universal desktop & touch input bindings plus Capture The Flag tactical rules.
        </p>
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
              ['1 – 5 Keys', 'Select Rifle / Shotgun / Sniper / RPG / Pistol'],
              ['Q Key', 'Quick Cycle Weapon'],
              ['Tab (Hold)', 'Tactical Scoreboard (CAP / K / D)'],
            ].map(([key, desc]) => (
              <div
                key={key}
                className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-900 last:border-0"
              >
                <span className="font-mono font-bold text-cyan-200 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  {key}
                </span>
                <span className="text-slate-300 text-right">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Touch Controls */}
        <div className="bg-slate-950/75 border border-slate-800 p-4 clip-chamfer space-y-3">
          <div className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
            <Smartphone className="w-4 h-4" /> Mobile Touch Controls
          </div>
          <ul className="space-y-2 text-xs text-slate-300 list-disc list-inside">
            <li>
              <strong className="text-white">Left Screen Half:</strong> Floating move stick; drag up to jetpack boost, down to drop through platforms.
            </li>
            <li>
              <strong className="text-white">Right Screen Half:</strong> Floating aim & auto-fire stick.
            </li>
            <li>
              <strong className="text-white">DASH & BOOST Buttons:</strong> Dedicated thumb triggers for burst air-dash and vertical climb.
            </li>
            <li>
              <strong className="text-white">Weapon Swap Pill:</strong> Cycles weapons and shows ammo on the bottom-right thumb cluster.
            </li>
            <li>
              <strong className="text-white">Combat Auto-Fullscreen:</strong> Engages fullscreen automatically during combat deployment on mobile devices while respecting manual exits.
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
          <li>• Use Shotgun & Rocket recoil impulses mid-air to rocket-jump up vertical shafts!</li>
        </ul>
      </div>
    </div>
  );
}
