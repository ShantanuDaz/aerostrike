import { useEffect, useRef, useState } from 'react';
import { useAvatarStore, DEFAULT_AVATAR } from '../avatar/avatarStore';
import { renderAvatar } from '../avatar/renderAvatar';
import type { HeadgearType, JetpackStyle, VisorStyle } from '../avatar/types';
import {
  useSettingsStore,
  type DefaultRadarMode,
  type SettingsTab,
} from '../settings/settingsStore';
import { WEAPONS } from '../combat/weaponsConfig';
import type { WeaponType } from '../combat/types';
import { sounds } from '../audio/soundEngine';
import { music, MUSIC_TRACKS, type MusicTrackId } from '../audio/musicEngine';
import {
  ArrowLeft,
  Check,
  Crosshair,
  Dices,
  Eye,
  Flame,
  Gamepad2,
  Headphones,
  Keyboard,
  Monitor,
  Music,
  Palette,
  Play,
  RotateCcw,
  Shield,
  Sliders,
  Smartphone,
  Sparkles,
  Square,
  User,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';

interface SettingsScreenProps {
  initialTab?: SettingsTab;
  onBack: () => void;
}

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

const TABS: { id: SettingsTab; label: string; icon: typeof User }[] = [
  { id: 'avatar', label: 'Pilot & Suit', icon: User },
  { id: 'audio', label: 'Audio & SFX', icon: Headphones },
  { id: 'display', label: 'Display & HUD', icon: Monitor },
  { id: 'controls', label: 'Controls & Intel', icon: Gamepad2 },
];

export function SettingsScreen({ initialTab = 'avatar', onBack }: SettingsScreenProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [previewTeam, setPreviewTeam] = useState<'solo' | 'blue' | 'red'>('solo');
  const [previewingTrack, setPreviewingTrack] = useState<MusicTrackId | null>(null);

  useEffect(() => {
    return () => {
      music.setPreviewTrack(null);
    };
  }, []);

  const handleToggleTrackPreview = (trackId: MusicTrackId) => {
    sounds.playUiClick();
    if (previewingTrack === trackId) {
      setPreviewingTrack(null);
      music.setPreviewTrack(null);
    } else {
      if (!settings.musicEnabled) {
        settings.updateSettings({ musicEnabled: true });
      }
      if (settings.sfxMuted) {
        settings.updateSettings({ sfxMuted: false });
      }
      setPreviewingTrack(trackId);
      music.setPreviewTrack(trackId);
    }
  };

  const avatar = useAvatarStore((s) => s.avatar);
  const setAvatar = useAvatarStore((s) => s.setAvatar);

  const settings = useSettingsStore();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerAimRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  const avatarRef = useRef(avatar);
  const weaponRef = useRef(settings.defaultWeapon);
  const previewTeamRef = useRef(previewTeam);

  useEffect(() => {
    avatarRef.current = avatar;
  }, [avatar]);

  useEffect(() => {
    weaponRef.current = settings.defaultWeapon;
  }, [settings.defaultWeapon]);

  useEffect(() => {
    previewTeamRef.current = previewTeam;
  }, [previewTeam]);

  // Live Soldier Canvas Preview inside Avatar tab
  useEffect(() => {
    if (activeTab !== 'avatar') return;
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

      // Subtle holographic grid
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

      // Spotlight glow
      const glow = ctx.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, 110);
      glow.addColorStop(0, 'rgba(0, 240, 255, 0.22)');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // Pedestal ring
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
  }, [activeTab]);

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

  const handleResetAllSettings = () => {
    sounds.playUiClick();
    settings.resetSettings();
  };

  return (
    <div className="min-h-screen w-full cyber-grid-bg text-slate-100 flex flex-col relative overflow-y-auto select-none">
      {settings.crtScanlines && (
        <div className="fixed inset-0 scanline-overlay z-10 pointer-events-none" />
      )}

      {/* Top Header */}
      <header className="relative z-20 w-full max-w-6xl mx-auto px-4 pt-4 sm:pt-6 pb-3 flex items-center justify-between gap-3 border-b border-cyan-500/20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              sounds.playUiClick();
              onBack();
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-950/90 hover:bg-slate-900 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 hover:text-white text-xs font-mono font-bold uppercase tracking-wider clip-chamfer transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-400" />
            <span>Back to Hangar</span>
          </button>

          <div>
            <span className="text-[10px] font-mono text-cyan-400/80 uppercase tracking-widest block">
              // SYSTEM CONFIGURATION //
            </span>
            <h1 className="text-lg sm:text-xl font-black italic tracking-wider text-white uppercase">
              Settings & Armory
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold uppercase tracking-wider clip-chamfer">
            <Check className="w-3 h-3" /> Auto-Saved
          </span>
          <button
            onClick={handleResetAllSettings}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-950/80 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/50 text-slate-300 hover:text-rose-200 text-xs font-mono font-bold uppercase tracking-wider clip-chamfer transition cursor-pointer"
            title="Reset Audio, Display & Loadout Settings"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Defaults</span>
          </button>
        </div>
      </header>

      {/* Main Content Layout: Left Navigation Tabs + Right Settings Panel */}
      <main className="relative z-20 flex-1 w-full max-w-6xl mx-auto px-4 py-5 flex flex-col lg:flex-row gap-5">
        {/* Navigation Rail */}
        <nav className="w-full lg:w-60 shrink-0 grid grid-cols-2 sm:grid-cols-4 lg:flex lg:flex-col gap-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  sounds.playUiClick();
                  if (tab.id !== 'audio' && previewingTrack) {
                    setPreviewingTrack(null);
                    music.setPreviewTrack(null);
                  }
                  setActiveTab(tab.id);
                }}
                className={`flex items-center gap-2.5 px-4 py-3 text-left text-xs font-mono font-bold uppercase tracking-wider clip-chamfer border transition cursor-pointer ${
                  active
                    ? 'bg-cyan-500/20 border-cyan-400 text-white glow-cyan'
                    : 'bg-slate-950/75 border-slate-800 text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-cyan-300' : 'text-slate-500'}`} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Active Tab Content */}
        <section className="flex-1 cyber-panel clip-chamfer-lg p-4 sm:p-6 border border-cyan-500/30">
          {/* TAB 1: PILOT & SUIT (AVATAR EDITOR) */}
          {activeTab === 'avatar' && (
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
                      const active = settings.defaultWeapon === wId;
                      return (
                        <button
                          key={wId}
                          type="button"
                          onClick={() => {
                            sounds.playWeaponSound(wId);
                            settings.updateSettings({ defaultWeapon: wId });
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

                {/* Visor & Skin Tone */}
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
          )}

          {/* TAB 2: AUDIO & SFX */}
          {activeTab === 'audio' && (
            <div className="flex flex-col gap-6 max-w-2xl">
              <div>
                <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-cyan-400" /> Procedural Audio Synthesizer
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure master volume, mute state, and jetpack thruster acoustics.
                </p>
              </div>

              {/* Master Sound Mute Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-950/70 border border-slate-800 clip-chamfer">
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    {settings.sfxMuted ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                    )}
                    Master Sound Effects
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Enable or mute all weapon, explosion, UI, and CTF fanfare audio.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => settings.toggleMute()}
                  className={`px-4 py-2 text-xs font-mono font-black uppercase tracking-wider clip-chamfer border transition cursor-pointer ${
                    !settings.sfxMuted
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-rose-500/20 border-rose-400 text-rose-300'
                  }`}
                >
                  {settings.sfxMuted ? 'MUTED' : 'ENABLED'}
                </button>
              </div>

              {/* Master Volume Slider */}
              <div className="p-4 bg-slate-950/70 border border-slate-800 clip-chamfer space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">Master Volume</span>
                  <span className="text-sm font-mono font-black text-cyan-300">
                    {settings.sfxMuted ? '0% (Muted)' : `${settings.masterVolume}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={settings.masterVolume}
                  onChange={(e) =>
                    settings.updateSettings({
                      masterVolume: Number(e.target.value),
                      sfxMuted: Number(e.target.value) === 0 ? true : false,
                    })
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <div className="flex items-center gap-2 flex-wrap">
                  {[25, 50, 80, 100].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        settings.updateSettings({ masterVolume: preset, sfxMuted: false });
                        sounds.playUiClick();
                      }}
                      className={`px-2.5 py-1 text-[11px] font-mono font-bold border clip-chamfer cursor-pointer ${
                        settings.masterVolume === preset && !settings.sfxMuted
                          ? 'bg-cyan-500/25 border-cyan-400 text-white'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      {preset}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Background Music Section */}
              <div className="p-4 bg-slate-950/70 border border-cyan-500/30 clip-chamfer space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      <Music className="w-4 h-4 text-cyan-400" /> Adaptive Background Music
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Procedural synth soundtracks tailored for Hangar, War Room, and Combat.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playUiClick();
                      const next = !settings.musicEnabled;
                      settings.updateSettings({ musicEnabled: next });
                      if (!next) {
                        setPreviewingTrack(null);
                        music.setPreviewTrack(null);
                      }
                    }}
                    className={`px-4 py-2 text-xs font-mono font-black uppercase tracking-wider clip-chamfer border transition cursor-pointer shrink-0 ${
                      settings.musicEnabled
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                        : 'bg-slate-900 border-slate-700 text-slate-400'
                    }`}
                  >
                    {settings.musicEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Music Volume Slider */}
                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-slate-300">
                      Music Volume
                    </span>
                    <span className="text-xs font-mono font-black text-cyan-300">
                      {!settings.musicEnabled || settings.sfxMuted
                        ? 'Muted'
                        : `${settings.musicVolume}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={settings.musicVolume}
                    onChange={(e) =>
                      settings.updateSettings({
                        musicVolume: Number(e.target.value),
                        musicEnabled: Number(e.target.value) > 0,
                      })
                    }
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    {[25, 50, 75, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          settings.updateSettings({ musicVolume: preset, musicEnabled: true });
                          sounds.playUiClick();
                        }}
                        className={`px-2.5 py-1 text-[11px] font-mono font-bold border clip-chamfer cursor-pointer ${
                          settings.musicVolume === preset && settings.musicEnabled
                            ? 'bg-cyan-500/25 border-cyan-400 text-white'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        {preset}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Screen Soundtracks Audition Deck */}
                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  <div className="text-[11px] font-mono font-bold text-cyan-300 uppercase tracking-widest">
                    Screen Soundtrack Preview Deck
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(
                      [
                        ['landing', 'Landing / Hangar'],
                        ['connecting', 'Uplink Connecting'],
                        ['war_room', 'War Room Staging'],
                        ['combat', 'In-Game Skirmish'],
                        ['victory', 'Match Victory'],
                      ] as [MusicTrackId, string][]
                    ).map(([trackId, screenLabel]) => {
                      const meta = MUSIC_TRACKS[trackId];
                      const isPreviewing = previewingTrack === trackId;
                      return (
                        <button
                          key={trackId}
                          type="button"
                          onClick={() => handleToggleTrackPreview(trackId)}
                          className={`flex items-center justify-between gap-2 p-2.5 border clip-chamfer text-left transition cursor-pointer ${
                            isPreviewing
                              ? 'bg-cyan-500/20 border-cyan-400 text-white glow-cyan'
                              : 'bg-slate-900/80 border-slate-800 hover:border-cyan-500/40 text-slate-300'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">
                              {meta.title}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 truncate">
                              {screenLabel} • {meta.bpm} BPM
                            </div>
                          </div>
                          <span
                            className={`p-1.5 rounded border shrink-0 ${
                              isPreviewing
                                ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                                : 'bg-slate-950 text-cyan-400 border-slate-700'
                            }`}
                          >
                            {isPreviewing ? (
                              <Square className="w-3 h-3 fill-slate-950" />
                            ) : (
                              <Play className="w-3 h-3 fill-cyan-400" />
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Jetpack Thruster Audio Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-950/70 border border-slate-800 clip-chamfer">
                <div>
                  <div className="text-sm font-bold text-white">Jetpack Thruster Hum</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Play continuous low-frequency thrust hum while boosting in flight.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    settings.updateSettings({ jetpackAudio: !settings.jetpackAudio });
                    sounds.playUiClick();
                  }}
                  className={`px-4 py-2 text-xs font-mono font-black uppercase tracking-wider clip-chamfer border transition cursor-pointer ${
                    settings.jetpackAudio
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  {settings.jetpackAudio ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Sound Test Pad */}
              <div className="p-4 bg-slate-950/70 border border-cyan-500/25 clip-chamfer space-y-2.5">
                <div className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-widest">
                  Sound Calibration Pad
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => sounds.playRifle()}
                    className="py-2 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-400 text-xs font-mono font-bold text-slate-200 clip-chamfer cursor-pointer"
                  >
                    Rifle Shot
                  </button>
                  <button
                    type="button"
                    onClick={() => sounds.playShotgun()}
                    className="py-2 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-400 text-xs font-mono font-bold text-slate-200 clip-chamfer cursor-pointer"
                  >
                    Shotgun Blast
                  </button>
                  <button
                    type="button"
                    onClick={() => sounds.playExplosion()}
                    className="py-2 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-rose-400 text-xs font-mono font-bold text-slate-200 clip-chamfer cursor-pointer"
                  >
                    Explosion
                  </button>
                  <button
                    type="button"
                    onClick={() => sounds.playFlagCapture()}
                    className="py-2 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-emerald-400 text-xs font-mono font-bold text-slate-200 clip-chamfer cursor-pointer"
                  >
                    Flag Capture
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DISPLAY & HUD */}
          {activeTab === 'display' && (
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
          )}

          {/* TAB 4: CONTROLS & INTEL */}
          {activeTab === 'controls' && (
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
                      <strong className="text-white">Auto-Fullscreen:</strong> Runs the app fullscreen automatically on mobile devices.
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
                  <li>• Your own flag must be safely at base to score a capture (first to 3 captures wins).</li>
                  <li>• Touching your dropped friendly flag immediately returns it to base.</li>
                  <li>• Use Shotgun & Rocket recoil impulses mid-air to rocket-jump up vertical shafts!</li>
                </ul>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
