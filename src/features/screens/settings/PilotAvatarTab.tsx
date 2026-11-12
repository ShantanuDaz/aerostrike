import { useEffect, useRef, useState } from 'react';
import { DEFAULT_AVATAR, useAvatarStore } from '../../avatar/avatarStore';
import { renderAvatar } from '../../avatar/renderAvatar';
import type { HeadgearType, JetpackStyle, VisorStyle } from '../../avatar/types';
import { sounds } from '../../audio/soundEngine';
import type { WeaponType } from '../../combat/types';
import { WEAPONS } from '../../combat/weaponsConfig';
import { useSettingsStore } from '../../settings/settingsStore';
import {
  Crosshair,
  Dices,
  Eye,
  Flame,
  Palette,
  RotateCcw,
  Shield,
  Sparkles,
} from 'lucide-react';

const HEADGEARS: { id: HeadgearType; label: string }[] = [
  { id: 'soldier_helmet', label: 'Tactical Helm' },
  { id: 'beret', label: 'Elite Beret' },
  { id: 'headband', label: 'War Band' },
  { id: 'gas_mask', label: 'Respirator' },
  { id: 'robo_visor', label: 'Robo Visor' },
  { id: 'horns', label: 'Apex Horns' },
  { id: 'none', label: 'Standard' },
];

const VISORS: { id: VisorStyle; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'cyborg', label: 'Cyborg Eye' },
  { id: 'sunglasses', label: 'Tactical Shades' },
  { id: 'goggles', label: 'Combat Goggles' },
  { id: 'neon', label: 'Laser Strip' },
];

const JETPACKS: { id: JetpackStyle; label: string }[] = [
  { id: 'dual_tank', label: 'Twin Cannons' },
  { id: 'falcon_wings', label: 'Falcon Wings' },
  { id: 'single_heavy', label: 'Heavy Reactor' },
];

const WEAPON_OPTIONS: WeaponType[] = ['rifle', 'shotgun', 'sniper', 'rocket', 'pistol'];

const SUIT_SWATCHES = [
  '#00f0ff',
  '#2563eb',
  '#ff0055',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#475569',
];

const GEAR_SWATCHES = [
  '#334155',
  '#0f172a',
  '#dc2626',
  '#0284c7',
  '#d97706',
  '#059669',
  '#7c3aed',
];

const SKIN_SWATCHES = ['#fde68a', '#fbcfe8', '#e2e8f0', '#fdba74', '#b45309', '#64748b'];

const RANDOM_NAMES = [
  'Viper', 'Ghost', 'Phantom', 'Titan', 'Rogue', 'Apex', 'Nova',
  'Specter', 'Falcon', 'Reaper', 'Shadow', 'Havoc', 'Striker', 'Blaze',
  'Zero', 'Cyber', 'Neon', 'Echo', 'Vortex', 'Krypton',
];

export function PilotAvatarTab() {
  const [previewTeam, setPreviewTeam] = useState<'solo' | 'blue' | 'red'>('solo');
  const avatar = useAvatarStore((s) => s.avatar);
  const setAvatar = useAvatarStore((s) => s.setAvatar);
  const defaultWeapon = useSettingsStore((s) => s.defaultWeapon);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerAimRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  const avatarRef = useRef(avatar);
  const weaponRef = useRef(defaultWeapon);
  const previewTeamRef = useRef(previewTeam);

  useEffect(() => {
    avatarRef.current = avatar;
  }, [avatar]);

  useEffect(() => {
    weaponRef.current = defaultWeapon;
  }, [defaultWeapon]);

  useEffect(() => {
    previewTeamRef.current = previewTeam;
  }, [previewTeam]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let timeSec = 0;
    let last = performance.now();

    const render = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      timeSec += dt;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = '#070b16';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.06)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < w; gx += 26) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 0; gy < h; gy += 26) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      const glow = ctx.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, 108);
      glow.addColorStop(0, 'rgba(0, 240, 255, 0.22)');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2 + 64, 56, 12, 0, 0, Math.PI * 2);
      ctx.stroke();

      const ptr = pointerAimRef.current;
      const aimAngle = ptr.active
        ? Math.atan2(ptr.y - h / 2, ptr.x - w / 2)
        : Math.sin(timeSec * 0.9) * 0.4;

      ctx.save();
      ctx.translate(w / 2, h / 2 + Math.sin(timeSec * 2.5) * 4);
      renderAvatar(ctx, avatarRef.current, {
        aimAngle,
        radius: 34,
        isBoosting: true,
        team: previewTeamRef.current === 'solo' ? undefined : previewTeamRef.current,
        showHUD: false,
        vy: Math.cos(timeSec * 2.5) * 0.7,
        timeSec,
        weaponType: weaponRef.current,
      });
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleRandomCallsign = () => {
    sounds.playUiClick();
    const base = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
    const num = Math.floor(10 + Math.random() * 90);
    setAvatar({ callsign: `${base}_${num}` });
  };

  const handleResetPilot = () => {
    sounds.playUiClick();
    setAvatar({ ...DEFAULT_AVATAR, callsign: avatar.callsign });
  };

  const activeHeadgearLabel =
    HEADGEARS.find((h) => h.id === avatar.headgear)?.label ?? 'Standard';
  const activeWeaponShort = WEAPONS[defaultWeapon].name.split(' ').pop();

  return (
    <div className="flex-1 min-h-0 h-full flex flex-row gap-2 sm:gap-4 overflow-hidden">
      {/* Pinned Left Preview Column (always visible on mobile portrait, landscape & desktop) */}
      <div className="w-[138px] xs:w-[158px] sm:w-[225px] lg:w-[270px] shrink-0 h-full flex flex-col justify-between gap-1.5 sm:gap-2.5 bg-slate-950/75 p-2 sm:p-3 border border-cyan-500/25 clip-chamfer overflow-hidden">
        {/* Top Team Switcher + Quick Reset */}
        <div className="shrink-0 flex items-center justify-between gap-1">
          <div className="flex items-center gap-0.5 sm:gap-1 min-w-0">
            {(['solo', 'blue', 'red'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  setPreviewTeam(t);
                }}
                className={`px-1.5 sm:px-2 py-0.5 rounded text-[8.5px] sm:text-[9px] font-mono font-bold uppercase cursor-pointer border ${
                  previewTeam === t
                    ? t === 'red'
                      ? 'bg-rose-600/30 border-rose-400 text-rose-200'
                      : 'bg-cyan-600/30 border-cyan-400 text-cyan-200'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleResetPilot}
            className="shrink-0 p-1 sm:px-2 sm:py-0.5 bg-slate-900 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-400/50 text-slate-400 hover:text-rose-200 rounded text-[9px] font-mono font-bold uppercase cursor-pointer flex items-center gap-1"
            title="Reset Suit Appearance"
          >
            <RotateCcw className="w-3 h-3 shrink-0" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>

        {/* Live Hangar Rig Canvas */}
        <div className="relative flex-1 min-h-[110px] w-full flex items-center justify-center overflow-hidden rounded-lg border border-cyan-500/25 bg-[#070b16]">
          <canvas
            ref={canvasRef}
            width={240}
            height={220}
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              pointerAimRef.current = {
                x: ((e.clientX - r.left) / r.width) * e.currentTarget.width,
                y: ((e.clientY - r.top) / r.height) * e.currentTarget.height,
                active: true,
              };
            }}
            onPointerLeave={() => {
              pointerAimRef.current.active = false;
            }}
            className="w-full h-full object-contain cursor-crosshair touch-none"
          />

          <div className="pointer-events-none absolute top-1.5 left-1.5 hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-950/75 border border-cyan-500/25 text-[8.5px] font-mono font-bold uppercase text-cyan-300">
            <Sparkles className="w-2.5 h-2.5" /> Live Rig
          </div>

          <div className="pointer-events-none absolute bottom-1 inset-x-1 flex items-center justify-center">
            <span className="px-1.5 py-0.5 rounded bg-slate-950/80 border border-slate-800 text-[8px] sm:text-[9px] font-mono text-slate-300 truncate max-w-full">
              {activeHeadgearLabel} • {activeWeaponShort}
            </span>
          </div>
        </div>

        {/* Callsign Editor */}
        <div className="shrink-0">
          <label className="hidden tall:block text-[9px] font-mono font-bold text-cyan-300 uppercase tracking-widest mb-1">
            Callsign
          </label>
          <div className="flex items-center gap-1">
            <input
              type="text"
              maxLength={16}
              value={avatar.callsign}
              onChange={(e) => setAvatar({ callsign: e.target.value })}
              className="flex-1 min-w-0 bg-slate-900 border border-slate-700 focus:border-cyan-400 px-2 py-1 sm:py-1.5 text-[11px] sm:text-xs font-mono font-bold text-white outline-none clip-chamfer"
              placeholder="Callsign..."
              aria-label="Combat Callsign"
            />
            <button
              type="button"
              onClick={handleRandomCallsign}
              className="shrink-0 p-1.5 sm:px-2 sm:py-1.5 bg-slate-800 hover:bg-slate-700 border border-cyan-500/30 text-amber-400 clip-chamfer cursor-pointer"
              title="Randomize Callsign"
              aria-label="Randomize Callsign"
            >
              <Dices className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Right Customization Column */}
      <div className="flex-1 min-w-0 h-full overflow-y-auto cyber-scroll pr-1 flex flex-col gap-3.5 sm:gap-4 pb-2">
        {/* Tactical Headgear & Gear Accent (First for instant customization) */}
        <div className="bg-slate-950/55 border border-slate-800/90 p-2.5 sm:p-3.5 clip-chamfer space-y-2.5">
          <label className="text-[10px] sm:text-[11px] font-mono font-bold text-cyan-300 uppercase tracking-widest flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> Tactical Headgear
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {HEADGEARS.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  setAvatar({ headgear: h.id });
                }}
                className={`px-1.5 sm:px-2.5 py-1.5 sm:py-2 text-[10.5px] sm:text-xs font-medium border transition text-center cursor-pointer clip-chamfer leading-tight ${
                  avatar.headgear === h.id
                    ? 'bg-cyan-500/25 border-cyan-400 text-white font-bold'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap pt-1 border-t border-slate-800/70">
            <span className="text-[9.5px] font-mono text-slate-400 uppercase mr-0.5">
              Gear Tint:
            </span>
            {GEAR_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  setAvatar({ headgearColor: c });
                }}
                style={{ backgroundColor: c }}
                className={`w-5 h-5 rounded-full border transition cursor-pointer ${
                  avatar.headgearColor === c
                    ? 'border-white scale-115 shadow-sm'
                    : 'border-slate-700 opacity-80 hover:opacity-100'
                }`}
                aria-label={`Gear tint ${c}`}
              />
            ))}
          </div>
        </div>

        {/* Suit Colorway + Custom Picker */}
        <div className="bg-slate-950/55 border border-slate-800/90 p-2.5 sm:p-3.5 clip-chamfer space-y-2">
          <label className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> Suit Armor Colorway
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {SUIT_SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  setAvatar({ bodyColor: color });
                }}
                style={{ backgroundColor: color }}
                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 transition-transform cursor-pointer ${
                  avatar.bodyColor.toLowerCase() === color.toLowerCase()
                    ? 'border-white scale-115 shadow-lg shadow-cyan-500/40'
                    : 'border-transparent opacity-80 hover:opacity-100 hover:scale-105'
                }`}
                aria-label={`Suit color ${color}`}
              />
            ))}
            <label
              className="flex items-center gap-1.5 px-2 py-1 bg-slate-900 border border-slate-700 hover:border-cyan-400 rounded-full text-[10px] font-mono text-slate-300 cursor-pointer"
              title="Custom Armor Color"
            >
              <input
                type="color"
                value={avatar.bodyColor}
                onChange={(e) => setAvatar({ bodyColor: e.target.value })}
                className="w-4 h-4 bg-transparent border-0 cursor-pointer p-0"
              />
              <span>Custom</span>
            </label>
          </div>
        </div>

        {/* Visor & Jetpack */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-slate-950/55 border border-slate-800/90 p-2.5 sm:p-3.5 clip-chamfer space-y-2">
            <label className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> Optics &amp; Visor
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {VISORS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    setAvatar({ visorStyle: v.id });
                  }}
                  className={`px-2 py-1.5 text-[10.5px] sm:text-xs font-medium border transition text-left cursor-pointer clip-chamfer ${
                    avatar.visorStyle === v.id
                      ? 'bg-cyan-500/25 border-cyan-400 text-white font-bold'
                      : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-950/55 border border-slate-800/90 p-2.5 sm:p-3.5 clip-chamfer space-y-2">
            <label className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" /> Jetpack Thrusters
            </label>
            <div className="flex flex-col gap-1.5">
              {JETPACKS.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    setAvatar({ jetpackStyle: j.id });
                  }}
                  className={`px-2.5 py-1.5 text-[10.5px] sm:text-xs font-medium border transition text-left cursor-pointer clip-chamfer ${
                    avatar.jetpackStyle === j.id
                      ? 'bg-amber-500/20 border-amber-400 text-white font-bold'
                      : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {j.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Starting Weapon Preview + Faceplate Tone */}
        <div className="bg-slate-950/55 border border-slate-800/90 p-2.5 sm:p-3.5 clip-chamfer space-y-2.5">
          <label className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> Default Starting Weapon
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
            {WEAPON_OPTIONS.map((wId) => {
              const active = defaultWeapon === wId;
              return (
                <button
                  key={wId}
                  type="button"
                  onClick={() => {
                    sounds.playWeaponSound(wId);
                    updateSettings({ defaultWeapon: wId });
                  }}
                  className={`px-1.5 py-1.5 text-[10px] sm:text-[11px] font-mono font-bold uppercase border clip-chamfer cursor-pointer transition ${
                    active
                      ? 'bg-cyan-500/25 border-cyan-400 text-white'
                      : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {WEAPONS[wId].name.split(' ').pop()}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-800/80">
            <span className="text-[9.5px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              Faceplate Tone:
            </span>
            {SKIN_SWATCHES.map((tone) => (
              <button
                key={tone}
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  setAvatar({ skinTone: tone });
                }}
                style={{ backgroundColor: tone }}
                className={`w-5 h-5 rounded-full border transition cursor-pointer ${
                  avatar.skinTone === tone
                    ? 'border-white scale-115'
                    : 'border-slate-700 opacity-80 hover:opacity-100'
                }`}
                aria-label={`Faceplate tone ${tone}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
