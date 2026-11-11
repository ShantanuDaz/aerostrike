import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useAvatarStore } from '../avatar/avatarStore';
import { renderAvatar } from '../avatar/renderAvatar';
import { useSettingsStore, type SettingsTab } from '../settings/settingsStore';
import { WEAPONS } from '../combat/weaponsConfig';
import { networkManager } from '../network/peerRoom';
import { sounds } from '../audio/soundEngine';

const QRScannerModal = lazy(() =>
  import('../ui/QRScannerModal').then((m) => ({ default: m.QRScannerModal })),
);
import {
  Gamepad2,
  LogIn,
  Music,
  Play,
  QrCode,
  Rocket,
  Scan,
  Settings,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';

interface MainMenuScreenProps {
  invitedRoomCode?: string | null;
  onOpenSettings: (tab?: SettingsTab) => void;
  onEnterWarRoom: (roomCode: string, isHost?: boolean) => void;
  onStartSoloPractice: () => void;
  onJoinInvitedRoom?: (roomCode: string) => void;
}

interface HangarTracer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface HangarSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
}

interface StarDot {
  x: number;
  y: number;
  r: number;
  speed: number;
  alpha: number;
}

export function MainMenuScreen({
  invitedRoomCode,
  onOpenSettings,
  onEnterWarRoom,
  onStartSoloPractice,
  onJoinInvitedRoom,
}: MainMenuScreenProps) {
  const avatar = useAvatarStore((s) => s.avatar);
  const confirmEnlistment = useAvatarStore((s) => s.confirmEnlistment);

  const isMuted = useSettingsStore((s) => s.sfxMuted);
  const musicEnabled = useSettingsStore((s) => s.musicEnabled);
  const crtScanlines = useSettingsStore((s) => s.crtScanlines);
  const defaultWeapon = useSettingsStore((s) => s.defaultWeapon);
  const toggleMute = useSettingsStore((s) => s.toggleMute);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });
  const tracersRef = useRef<HangarTracer[]>([]);
  const sparksRef = useRef<HangarSpark[]>([]);
  const soldierPosRef = useRef<{ x: number; y: number; aimAngle: number }>({
    x: 240,
    y: 260,
    aimAngle: -0.1,
  });

  const avatarRef = useRef(avatar);
  const weaponRef = useRef(defaultWeapon);
  useEffect(() => {
    avatarRef.current = avatar;
  }, [avatar]);
  useEffect(() => {
    weaponRef.current = defaultWeapon;
  }, [defaultWeapon]);

  useEffect(() => {
    if (!showJoinModal || showQRScanner) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowJoinModal(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showJoinModal, showQRScanner]);

  // 60 FPS Live Orbital Hangar Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const stars: StarDot[] = Array.from({ length: 58 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 1.4,
      speed: 0.004 + Math.random() * 0.014,
      alpha: 0.2 + Math.random() * 0.55,
    }));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    let animId = 0;
    let lastTime = performance.now();
    let timeSec = 0;
    let smoothAim = -0.08;

    const renderFrame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      timeSec += dt;

      const w = window.innerWidth;
      const h = window.innerHeight;
      const isPortrait = w < 640;
      const isShortLandscape = !isPortrait && h < 520;

      // 1. Deep Space Orbital Backdrop
      ctx.fillStyle = '#060913';
      ctx.fillRect(0, 0, w, h);

      // Subtle atmospheric horizon glow
      const bgGlow = ctx.createRadialGradient(
        isPortrait ? w * 0.5 : w * 0.34,
        isPortrait ? h * 0.37 : h * 0.47,
        20,
        isPortrait ? w * 0.5 : w * 0.34,
        isPortrait ? h * 0.37 : h * 0.47,
        Math.max(w, h) * 0.65,
      );
      bgGlow.addColorStop(0, 'rgba(0, 240, 255, 0.12)');
      bgGlow.addColorStop(0.5, 'rgba(14, 30, 64, 0.16)');
      bgGlow.addColorStop(1, 'rgba(6, 9, 19, 0)');
      ctx.fillStyle = bgGlow;
      ctx.fillRect(0, 0, w, h);

      // Drifting orbital stars
      for (const s of stars) {
        s.x = (s.x + s.speed * dt) % 1;
        const twinkle = 0.7 + Math.sin(timeSec * 2.2 + s.y * 20) * 0.3;
        ctx.fillStyle = `rgba(186, 230, 253, ${s.alpha * twinkle})`;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h * 0.78, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Faint tactical coordinate grid
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.035)';
      ctx.lineWidth = 1;
      const gridStep = 56;
      for (let gx = 0; gx < w; gx += gridStep) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 0; gy < h; gy += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }
      ctx.restore();

      // 2. Hangar Architecture Silhouette (Upper Trusses & Floor Deck)
      const deckY = isPortrait ? h * 0.56 : h * 0.72;
      ctx.save();
      ctx.fillStyle = 'rgba(9, 15, 30, 0.78)';
      ctx.fillRect(0, deckY, w, h - deckY);

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, deckY);
      ctx.lineTo(w, deckY);
      ctx.stroke();

      // Perspective deck lines
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.06)';
      for (let i = -6; i <= 6; i++) {
        ctx.beginPath();
        ctx.moveTo(w * 0.4 + i * 75, deckY);
        ctx.lineTo(w * 0.4 + i * 190, h);
        ctx.stroke();
      }

      // Upper hangar framing struts
      ctx.fillStyle = 'rgba(11, 18, 35, 0.85)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w * 0.16, 0);
      ctx.lineTo(0, h * 0.22);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(w, 0);
      ctx.lineTo(w * 0.84, 0);
      ctx.lineTo(w, h * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 3. Drop-Bay Pedestal & Volumetric Spotlight
      const stageX = isPortrait ? w * 0.5 : w * 0.32;
      const stageY = isPortrait ? h * 0.38 : isShortLandscape ? h * 0.45 : h * 0.47;
      const soldierRadius = isShortLandscape
        ? Math.max(24, Math.min(34, h * 0.086))
        : isPortrait
          ? Math.max(28, Math.min(40, w * 0.095))
          : Math.max(38, Math.min(52, Math.min(w, h) * 0.068));
      const padY = stageY + soldierRadius * 2.15;

      // Spotlight cone from ceiling
      ctx.save();
      const cone = ctx.createLinearGradient(stageX, 0, stageX, padY);
      cone.addColorStop(0, 'rgba(0, 240, 255, 0.02)');
      cone.addColorStop(0.6, 'rgba(0, 240, 255, 0.09)');
      cone.addColorStop(1, 'rgba(0, 240, 255, 0.18)');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(stageX - 48, 0);
      ctx.lineTo(stageX + 48, 0);
      ctx.lineTo(stageX + 145, padY + 8);
      ctx.lineTo(stageX - 145, padY + 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Pedestal platform
      ctx.save();
      const padW = isPortrait ? 108 : isShortLandscape ? 105 : 148;
      const padH = isPortrait || isShortLandscape ? 18 : 28;
      ctx.fillStyle = '#0b1326';
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(stageX, padY, padW, padH, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Inner pulsing holographic ring
      const ringPulse = 0.65 + Math.sin(timeSec * 3.2) * 0.35;
      ctx.strokeStyle = `rgba(56, 189, 248, ${ringPulse * 0.7})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([12, 8]);
      ctx.lineDashOffset = -timeSec * 22;
      ctx.beginPath();
      ctx.ellipse(stageX, padY, padW * 0.72, padH * 0.68, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Ambient pad thruster sparks
      if (Math.random() < 0.28) {
        sparksRef.current.push({
          x: stageX + (Math.random() - 0.5) * 44,
          y: stageY + soldierRadius * 0.9,
          vx: (Math.random() - 0.5) * 28,
          vy: -25 - Math.random() * 45,
          life: 0.7 + Math.random() * 0.6,
          size: 1.5 + Math.random() * 2,
          color: Math.random() > 0.3 ? '#38bdf8' : '#f59e0b',
        });
      }

      // 4. Aim Angle Tracking
      const ptr = pointerRef.current;
      let targetAim = Math.sin(timeSec * 0.8) * 0.32 - 0.08;
      if (ptr.active) {
        targetAim = Math.atan2(ptr.y - stageY, ptr.x - stageX);
      }
      // Shortest angular interpolation
      let delta = targetAim - smoothAim;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      smoothAim += delta * Math.min(1, dt * 10);

      const hoverOffsetY = Math.sin(timeSec * 2.4) * 5;
      soldierPosRef.current = {
        x: stageX,
        y: stageY + hoverOffsetY,
        aimAngle: smoothAim,
      };

      // 5. Render Hero Exo-Soldier
      ctx.save();
      ctx.translate(stageX, stageY + hoverOffsetY);
      renderAvatar(ctx, avatarRef.current, {
        aimAngle: smoothAim,
        radius: soldierRadius,
        isBoosting: true,
        showHUD: false,
        vx: 0,
        vy: Math.cos(timeSec * 2.4) * 0.6,
        isGrounded: false,
        timeSec,
        weaponType: weaponRef.current,
      });
      ctx.restore();

      // 6. Update & Draw Sparks + Hangar Test Tracers
      for (let i = sparksRef.current.length - 1; i >= 0; i--) {
        const sp = sparksRef.current[i];
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.life -= dt;
        if (sp.life <= 0) {
          sparksRef.current.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0, Math.min(1, sp.life));
        ctx.fillStyle = sp.color;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (let i = tracersRef.current.length - 1; i >= 0; i--) {
        const tr = tracersRef.current[i];
        const prevX = tr.x;
        const prevY = tr.y;
        tr.x += tr.vx * dt;
        tr.y += tr.vy * dt;
        tr.life -= dt;
        if (tr.life <= 0 || tr.x < -50 || tr.x > w + 50 || tr.y < -50 || tr.y > h + 50) {
          tracersRef.current.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = tr.color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(tr.x, tr.y);
        ctx.stroke();
      }

      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Track cursor aim & allow clicking background hangar canvas to dry-fire a tracer!
  const handleStageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    pointerRef.current = { x: e.clientX, y: e.clientY, active: true };
  };

  const handleStageCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = soldierPosRef.current;
    const angle = Math.atan2(e.clientY - pos.y, e.clientX - pos.x);
    const wCfg = WEAPONS[defaultWeapon];
    sounds.playWeaponSound(defaultWeapon);

    const count = wCfg.pellets;
    for (let i = 0; i < count; i++) {
      const spread = count > 1 ? (i - (count - 1) / 2) * 0.08 : 0;
      const a = angle + spread;
      const spd = 950;
      tracersRef.current.push({
        x: pos.x + Math.cos(a) * 34,
        y: pos.y + Math.sin(a) * 34,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: 0.75,
        color: wCfg.color,
      });
    }
    for (let i = 0; i < 6; i++) {
      const a = angle + (Math.random() - 0.5) * 0.7;
      sparksRef.current.push({
        x: pos.x + Math.cos(angle) * 36,
        y: pos.y + Math.sin(angle) * 36,
        vx: Math.cos(a) * (120 + Math.random() * 140),
        vy: Math.sin(a) * (120 + Math.random() * 140),
        life: 0.35,
        size: 2.2,
        color: '#fde047',
      });
    }
  };

  const ensureEnlistedWithCallsign = () => {
    const clean = avatar.callsign.trim() || `Pilot_${Math.floor(100 + Math.random() * 900)}`;
    confirmEnlistment({ ...avatar, callsign: clean });
  };

  const updateRoomUrl = (code: string) => {
    try {
      const newUrl = `${window.location.origin}${window.location.pathname}?room=${code}`;
      window.history.replaceState(null, '', newUrl);
    } catch {
      // ignore restricted History API environments on mobile WebViews
    }
  };

  const handleCreateRoom = () => {
    sounds.playUiClick();
    ensureEnlistedWithCallsign();
    const newCode = 'ROOM-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    networkManager.connect(newCode, true);
    updateRoomUrl(newCode);
    onEnterWarRoom(newCode, true);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    sounds.playUiClick();
    ensureEnlistedWithCallsign();
    const cleanCode = joinCode.trim().toUpperCase();
    networkManager.connect(cleanCode, false);
    updateRoomUrl(cleanCode);
    setShowJoinModal(false);
    onEnterWarRoom(cleanCode, false);
  };

  const handleScanSuccess = (scannedCode: string) => {
    ensureEnlistedWithCallsign();
    setJoinCode(scannedCode);
    networkManager.connect(scannedCode, false);
    updateRoomUrl(scannedCode);
    setShowJoinModal(false);
    onEnterWarRoom(scannedCode, false);
  };

  const handleSoloLaunch = () => {
    sounds.playUiClick();
    ensureEnlistedWithCallsign();
    onStartSoloPractice();
  };

  const handleInvitedJoin = () => {
    if (!invitedRoomCode) return;
    sounds.playUiClick();
    ensureEnlistedWithCallsign();
    if (onJoinInvitedRoom) {
      onJoinInvitedRoom(invitedRoomCode);
    } else {
      networkManager.connect(invitedRoomCode, false);
      onEnterWarRoom(invitedRoomCode, false);
    }
  };

  return (
    <div
      onMouseMove={handleStageMouseMove}
      className="relative w-full min-h-[100dvh] overflow-x-hidden bg-[#060913] text-slate-100 select-none"
    >
      {/* Layer 0/1: Interactive Full-Bleed Orbital Hangar Canvas */}
      <canvas
        ref={canvasRef}
        onClick={handleStageCanvasClick}
        className="fixed inset-0 w-full h-full block cursor-crosshair z-0"
        title="Move cursor to aim • Click hangar bay to test-fire weapon"
      />

      {/* CRT Scanline Overlay */}
      {crtScanlines && (
        <div className="fixed inset-0 scanline-overlay z-10 pointer-events-none" />
      )}

      {/* Layer 2: Floating Game UI Safe Zone (Scrolls cleanly on tiny screens) */}
      <div className="relative z-20 w-full min-h-[100dvh] flex flex-col justify-between p-3 sm:p-4 lg:p-6 pointer-events-none">
        {/* TOP BAR: Game Crest + Utility Controls */}
        <header className="w-full flex items-start justify-between gap-2 sm:gap-3 pointer-events-auto">
          {/* Left: Game Crest */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="px-1.5 sm:px-2 py-0.5 bg-cyan-400 text-slate-950 font-black text-[9px] sm:text-xs italic tracking-wider -skew-x-12 shrink-0">
                <span className="inline-block skew-x-12">OMEGA</span>
              </span>
              <h1 className="text-lg sm:text-2xl lg:text-3xl font-black italic tracking-tight text-white drop-shadow-[0_0_18px_rgba(0,240,255,0.45)] truncate">
                AERO<span className="text-cyan-400">STRIKE</span>
              </h1>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1 text-[9px] sm:text-[10px] font-mono text-cyan-300/80 uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="truncate">ORBITAL HANGAR // 2D P2P CTF</span>
            </div>
          </div>

          {/* Right: Music, Audio Mute & Full Settings Screen Button */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => {
                updateSettings({ musicEnabled: !musicEnabled });
                sounds.playUiClick();
              }}
              className={`p-2 sm:p-2.5 bg-slate-950/80 hover:bg-slate-900 border transition cursor-pointer clip-chamfer ${
                musicEnabled && !isMuted
                  ? 'border-cyan-500/40 text-cyan-300 hover:border-cyan-400'
                  : 'border-slate-700/80 text-slate-500 hover:text-slate-300'
              }`}
              title={musicEnabled ? 'Mute Background Music' : 'Enable Background Music'}
            >
              <Music className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                toggleMute();
              }}
              className="p-2 sm:p-2.5 bg-slate-950/80 hover:bg-slate-900 border border-slate-700/80 hover:border-cyan-400/50 text-slate-200 transition cursor-pointer clip-chamfer"
              title={isMuted ? 'Unmute All Audio' : 'Mute All Audio'}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
            </button>

            <button
              onClick={() => {
                sounds.playUiClick();
                onOpenSettings('avatar');
              }}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 sm:py-2.5 bg-slate-950/85 hover:bg-slate-900 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 hover:text-white text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer clip-chamfer glow-cyan"
            >
              <Settings className="w-4 h-4 text-cyan-400" />
              <span>Settings</span>
            </button>
          </div>
        </header>

        {/* BOTTOM / STAGE AREA: Minimal Pilot Tag (Left) + Deploy Stack (Right) */}
        <div className="w-full flex flex-col sm:flex-row sm:items-end justify-between gap-2.5 sm:gap-4 mt-auto pt-16 sm:pt-0">
          {/* Left Stage Identity Badge */}
          <div className="flex flex-col items-start gap-1.5 pointer-events-none">
            <div className="flex items-center gap-2.5 bg-slate-950/75 backdrop-blur-md border border-cyan-500/30 px-3 py-1.5 sm:px-3.5 sm:py-2 clip-chamfer">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/70"
                style={{ backgroundColor: avatar.bodyColor }}
              />
              <div className="flex flex-col">
                <span className="text-[9px] font-mono text-cyan-400/80 uppercase tracking-widest leading-none">
                  Active Pilot // {WEAPONS[defaultWeapon].name}
                </span>
                <span className="text-xs sm:text-sm lg:text-base font-black text-white font-mono leading-tight tracking-wide">
                  {avatar.callsign}
                </span>
              </div>
            </div>

            <span className="hidden lg:inline-block text-[10px] font-mono text-slate-500 tracking-wider">
              MOVE CURSOR TO AIM • CLICK BAY TO TEST-FIRE
            </span>
          </div>

          {/* Right Action Cluster: Secondary Modes + Primary DEPLOY CTA */}
          <div className="w-full sm:w-[270px] md:w-[310px] lg:w-[340px] flex flex-col gap-1.5 sm:gap-2 lg:gap-2.5 pointer-events-auto">
            {/* Direct Invite Banner (when opened via ?room= link before enlistment) */}
            {invitedRoomCode && (
              <button
                onClick={handleInvitedJoin}
                className="w-full py-2.5 lg:py-3 px-3.5 lg:px-4 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-xs uppercase tracking-widest clip-chamfer shadow-xl cursor-pointer flex items-center justify-between transition"
              >
                <span className="flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  Join Invited Squad
                </span>
                <span className="font-mono bg-slate-950/20 px-2 py-0.5 rounded">
                  {invitedRoomCode}
                </span>
              </button>
            )}

            {/* Secondary Row: Join Squad & Solo Practice */}
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
              <button
                onClick={() => {
                  sounds.playUiClick();
                  setShowJoinModal(true);
                }}
                className="py-2 lg:py-3 px-2.5 lg:px-3 bg-slate-950/85 hover:bg-slate-900 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 hover:text-white font-mono font-bold text-[11px] lg:text-xs uppercase tracking-wider clip-chamfer transition cursor-pointer flex items-center justify-center gap-1.5 lg:gap-2"
              >
                <QrCode className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-cyan-400" />
                <span>Join / QR</span>
              </button>

              <button
                onClick={handleSoloLaunch}
                className="py-2 lg:py-3 px-2.5 lg:px-3 bg-slate-950/85 hover:bg-emerald-950/60 border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 hover:text-white font-mono font-bold text-[11px] lg:text-xs uppercase tracking-wider clip-chamfer transition cursor-pointer flex items-center justify-center gap-1.5 lg:gap-2"
                title="Deploy into offline 2v2 AI capture-the-flag skirmish"
              >
                <Gamepad2 className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-emerald-400" />
                <span>Solo 2v2 AI</span>
              </button>
            </div>

            {/* Primary Hero DEPLOY Button */}
            <button
              onClick={handleCreateRoom}
              className="w-full py-2.5 lg:py-4 px-4 lg:px-6 bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-xs sm:text-sm lg:text-base uppercase tracking-[0.15em] lg:tracking-[0.2em] clip-chamfer-lg shadow-2xl shadow-cyan-950/80 transition-all cursor-pointer flex items-center justify-center gap-2 lg:gap-2.5 glow-cyan group whitespace-nowrap"
            >
              <Rocket className="w-4 h-4 lg:w-5 lg:h-5 shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              <span>Deploy // Host Match</span>
              <Play className="w-3.5 h-3.5 lg:w-4 lg:h-4 shrink-0 fill-slate-950" />
            </button>
          </div>
        </div>
      </div>

      {/* JOIN SQUAD MODAL (Code Input + Camera QR Scanner) */}
      {showJoinModal && (
        <div
          onClick={() => setShowJoinModal(false)}
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="cyber-panel clip-chamfer-lg w-full max-w-sm max-h-[92dvh] overflow-y-auto p-5 sm:p-6 border border-cyan-500/40 glow-cyan flex flex-col gap-3.5"
          >
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <div className="flex items-center gap-2">
                <LogIn className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-black text-white uppercase tracking-widest font-mono">
                  Join Squad Room
                </h2>
              </div>
              <button
                onClick={() => setShowJoinModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                sounds.playUiClick();
                setShowQRScanner(true);
              }}
              className="w-full py-3 bg-gradient-to-r from-cyan-900/70 to-blue-900/70 hover:from-cyan-800/80 hover:to-blue-800/80 border border-cyan-400/50 text-cyan-200 hover:text-white font-mono font-bold text-xs uppercase tracking-wider clip-chamfer transition cursor-pointer flex items-center justify-center gap-2 glow-cyan"
            >
              <Scan className="w-4 h-4 text-cyan-400" />
              <span>Scan Room QR Code</span>
            </button>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-slate-800" />
              <span className="text-[10px] font-mono text-slate-500 uppercase">OR ENTER CODE</span>
              <div className="flex-1 h-px bg-slate-800" />
            </div>

            <form onSubmit={handleJoinRoom} className="flex flex-col gap-3">
              <input
                type="text"
                autoFocus
                placeholder="ROOM-XXXXX"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                className="w-full bg-slate-950/90 border border-slate-700 focus:border-cyan-400 px-4 py-3 text-sm font-mono font-bold text-cyan-200 uppercase text-center tracking-widest outline-none clip-chamfer"
              />
              <button
                type="submit"
                disabled={!joinCode.trim()}
                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 text-white font-black text-xs uppercase tracking-widest clip-chamfer transition cursor-pointer flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>Connect to Squad</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Optical QR Scanner Modal (Lazy-loaded only when opened) */}
      {showQRScanner && (
        <Suspense fallback={null}>
          <QRScannerModal
            isOpen={showQRScanner}
            onClose={() => setShowQRScanner(false)}
            onScanSuccess={handleScanSuccess}
          />
        </Suspense>
      )}
    </div>
  );
}
