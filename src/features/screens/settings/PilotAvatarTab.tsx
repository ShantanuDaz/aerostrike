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
      for (let gx = 0; gx < w; gx += 28) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 0; gy < h; gy += 28) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      const glow = ctx.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, 110);
      glow.addColorStop(0, 'rgba(0, 240, 255, 0.22)');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2 + 64, 58, 12, 0, 0, Math.PI * 2);
      ctx.stroke();

      const ptr = pointerAimRef.current;
      const aimAngle = ptr.active
        ? Math.atan2(ptr.y - h / 2, ptr.x - w / 2)
        : Math.sin(timeSec * 0.9) * 0.4;

      ctx.save();
      ctx.translate(w / 2, h / 2 + Math.sin(timeSec * 2.5) * 4);
      renderAvatar(ctx, avatarRef.current, {
        aimAngle,
        radius: 32,
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

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      {/* Left Preview Column */}
      <div className="xl:col-span-5 flex flex-col items-center gap-4 bg-slate-950/65 p-4 border border-cyan-500/20 clip-chamfer">
        <div className="w-full flex items-center justify-between text-[10px] font-mono uppercase tracking-wider">
          <span className="text-cyan-400 font-bold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Live Hangar Rig
          </span>
          <div className="flex items-center gap-1">
            {(['solo', 'blue', 'red'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  setPreviewTeam(t);
                }}
                className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase cursor-pointer border ${
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
        </div>

        <canvas
          ref={canvasRef}
          width={260}
          height={230}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            pointerAimRef.current = {
              x: ((e.clientX - r.left) / r.width) * e.currentTarget.width,
              y: ((e.clientY - r.top) / r.height) * e.currentTarget.height,
              active: true,
            };
          }}
          onMouseLeave={() => {
            pointerAimRef.current.active = false;
          }}
          className="w-full max-w-[260px] rounded-xl border border-cyan-500/25 cursor-crosshair shadow-inner"
        />

        {/* Callsign Editor */}
        <div className="w-full">
          <label className="text-[10px] font-mono font-bold text-cyan-300 uppercase tracking-widest block mb-1.5">
            Combat Callsign
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              maxLength={16}
              value={avatar.callsign}
              onChange={(e) => setAvatar({ callsign: e.target.value })}
              className="flex-1 bg-slate-900 border border-slate-700 focus:border-cyan-400 px-3 py-2 text-sm font-mono font-bold text-white outline-none clip-chamfer"
              placeholder="Callsign..."
            />
            <button
              type="button"
              onClick={handleRandomCallsign}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-cyan-500/30 text-amber-400 clip-chamfer cursor-pointer"
              title="Randomize Callsign"
            >
              <Dices className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Starting Weapon Preview */}
        <div className="w-full">
          <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5 text-cyan-400" /> Default Starting Weapon
          </label>
          <div className="grid grid-cols-3 gap-1.5">
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
                  className={`px-2 py-1.5 text-[11px] font-mono font-bold uppercase border clip-chamfer cursor-pointer transition ${
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
        </div>

        <button
          type="button"
          onClick={handleResetPilot}
          className="text-[11px] font-mono text-slate-400 hover:text-rose-300 flex items-center gap-1.5 cursor-pointer pt-1"
        >
          <RotateCcw className="w-3 h-3" /> Reset Suit Appearance
        </button>
      </div>

      {/* Right Customization Controls */}
      <div className="xl:col-span-7 flex flex-col gap-5">
        {/* Suit Colorway + Custom Picker */}
        <div>
          <label className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-widest block mb-2 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-cyan-400" /> Suit Armor Colorway
          </label>
          <div className="flex items-center gap-2.5 flex-wrap">
            {SUIT_SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  setAvatar({ bodyColor: color });
                }}
                style={{ backgroundColor: color }}
                className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                  avatar.bodyColor.toLowerCase() === color.toLowerCase()
                    ? 'border-white scale-120 shadow-lg shadow-cyan-500/40'
                    : 'border-transparent opacity-80 hover:opacity-100 hover:scale-105'
                }`}
              />
            ))}
            <label
              className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-slate-700 hover:border-cyan-400 rounded-full text-[10px] font-mono text-slate-300 cursor-pointer"
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

        {/* Headgear & Gear Accent */}
        <div>
          <label className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-widest block mb-2 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-cyan-400" /> Tactical Headgear
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2.5">
            {HEADGEARS.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  setAvatar({ headgear: h.id });
                }}
                className={`px-2.5 py-2 text-xs font-medium border transition text-center cursor-pointer clip-chamfer ${
                  avatar.headgear === h.id
                    ? 'bg-cyan-500/25 border-cyan-400 text-white font-bold'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-slate-400 uppercase mr-1">
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
                    ? 'border-white scale-120'
                    : 'border-slate-700 opacity-80 hover:opacity-100'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Visor & Jetpack */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-widest block mb-2 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-cyan-400" /> Optics & Visor
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
                  className={`px-2.5 py-2 text-xs font-medium border transition text-left cursor-pointer clip-chamfer ${
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

          <div>
            <label className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-widest block mb-2 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" /> Jetpack Thrusters
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
                  className={`px-3 py-2 text-xs font-medium border transition text-left cursor-pointer clip-chamfer ${
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

        {/* Faceplate / Skin Tone */}
        <div className="flex items-center gap-2.5 flex-wrap pt-1 border-t border-slate-800/80">
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
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
                  ? 'border-white scale-120'
                  : 'border-slate-700 opacity-80 hover:opacity-100'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
