import { useEffect, useRef, useState } from 'react';
import { useNetworkStore } from '../network/networkStore';
import { networkManager } from '../network/peerRoom';
import { usePlayerStore } from '../player/playerStore';
import { useMapStore } from '../map/mapStore';
import type { GameMap } from '../map/types';
import { useAvatarStore, DEFAULT_AVATAR } from '../avatar/avatarStore';
import { renderAvatar } from '../avatar/renderAvatar';
import { useSettingsStore } from '../settings/settingsStore';
import { WEAPONS } from '../combat/weaponsConfig';
import { sounds } from '../audio/soundEngine';
import { useCTFStore } from '../ctf/ctfStore';
import type {
  MatchRulesConfig,
  MatchTimeLimitPreset,
  RespawnDelayPreset,
  TargetCapturesPreset,
  Team,
} from '../ctf/types';
import type { RosterMember } from '../network/types';
import { RoomQRCodeModal } from '../ui/RoomQRCodeModal';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Flag,
  Lock,
  Map as MapIcon,
  Music,
  Play,
  QrCode,
  RefreshCw,
  Rocket,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  TimerReset,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from 'lucide-react';

interface WarRoomScreenProps {
  onStartMatch: () => void;
  onLeaveRoom: () => void;
}

interface StageStar {
  x: number;
  y: number;
  r: number;
  speed: number;
  alpha: number;
}

interface StageSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
}

interface StageTracer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

function getCleanMapTitle(map: GameMap): string {
  return map.name.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function getMapModeTag(map: GameMap): string {
  if (map.id === 'ctf-canyon-arena') return 'LARGE CTF';
  if (map.id === 'sky-citadel') return 'AERIAL CTF';
  if (map.id === 'cryo-facility') return 'INDOOR CTF';
  if (map.id === 'training-ground') return 'SKIRMISH';
  if (map.id === 'bunker') return 'CQB';
  return map.width >= 2000 ? 'LARGE' : 'COMPACT';
}

function formatClockPreset(sec: number): string {
  if (sec <= 0) return '∞';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function MapSchematicPreview({
  map,
  isSelected,
  size = 'card',
}: {
  map: GameMap;
  isSelected: boolean;
  size?: 'mini' | 'card';
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#060b16';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = isSelected ? 'rgba(34, 211, 238, 0.1)' : 'rgba(148, 163, 184, 0.05)';
    ctx.lineWidth = 1;
    for (let gx = 16; gx < w; gx += 20) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    for (let gy = 16; gy < h; gy += 20) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    const padX = 6;
    const padY = 6;
    const scale = Math.min((w - padX * 2) / map.width, (h - padY * 2) / map.height);
    const offsetX = (w - map.width * scale) / 2;
    const offsetY = (h - map.height * scale) / 2;

    const tx = (x: number) => offsetX + x * scale;
    const ty = (y: number) => offsetY + y * scale;

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(offsetX, offsetY, map.width * scale, map.height * scale);

    ctx.fillStyle = 'rgba(59, 130, 246, 0.28)';
    ctx.fillRect(
      tx(map.baseBlue.x),
      ty(map.baseBlue.y),
      Math.max(4, map.baseBlue.width * scale),
      Math.max(4, map.baseBlue.height * scale),
    );
    ctx.fillStyle = 'rgba(244, 63, 94, 0.28)';
    ctx.fillRect(
      tx(map.baseRed.x),
      ty(map.baseRed.y),
      Math.max(4, map.baseRed.width * scale),
      Math.max(4, map.baseRed.height * scale),
    );

    for (const obs of map.obstacles) {
      if (obs.type === 'hazard') {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.8)';
      } else if (obs.type === 'ground') {
        ctx.fillStyle = '#334155';
      } else {
        ctx.fillStyle = isSelected ? '#475569' : '#334155';
      }
      ctx.fillRect(
        tx(obs.x),
        ty(obs.y),
        Math.max(2, obs.width * scale),
        Math.max(2, obs.height * scale),
      );
      if (obs.type === 'platform' || obs.type === 'wall') {
        ctx.fillStyle = isSelected ? 'rgba(34, 211, 238, 0.55)' : 'rgba(148, 163, 184, 0.35)';
        ctx.fillRect(tx(obs.x), ty(obs.y), Math.max(2, obs.width * scale), 1.2);
      }
    }

    for (const wp of map.weaponSpawns) {
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(tx(wp.x), ty(wp.y), 1.7, 0, Math.PI * 2);
      ctx.fill();
    }

    if (map.bouncePads) {
      ctx.fillStyle = '#22d3ee';
      for (const pad of map.bouncePads) {
        ctx.fillRect(
          tx(pad.x),
          ty(pad.y) - 0.8,
          Math.max(2.5, pad.width * scale),
          Math.max(1.5, pad.height * scale),
        );
      }
    }

    if (map.refillStations) {
      for (const st of map.refillStations) {
        ctx.fillStyle =
          st.stationType === 'medkit'
            ? '#34d399'
            : st.stationType === 'fuel'
              ? '#38bdf8'
              : '#c084fc';
        ctx.beginPath();
        ctx.arc(tx(st.x), ty(st.y), 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const drawFlagDot = (fx: number, fy: number, fill: string) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(tx(fx), ty(fy), 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    };
    drawFlagDot(map.flagBlue.x, map.flagBlue.y, '#38bdf8');
    drawFlagDot(map.flagRed.x, map.flagRed.y, '#fb7185');
  }, [map, isSelected]);

  if (size === 'mini') {
    return (
      <canvas
        ref={canvasRef}
        width={120}
        height={64}
        className="w-16 h-9 sm:w-20 sm:h-11 shrink-0 rounded border border-slate-700/90 bg-[#060b16] block"
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={220}
      height={100}
      className="w-24 h-12 shrink-0 sm:w-full sm:h-20 lg:h-24 rounded-lg border border-slate-800/90 bg-[#060b16] block"
    />
  );
}

export function WarRoomScreen({ onStartMatch, onLeaveRoom }: WarRoomScreenProps) {
  const roomCode = useNetworkStore((s) => s.roomCode);
  const isHost = useNetworkStore((s) => s.isHost);
  const gamePhase = useNetworkStore((s) => s.gamePhase);
  const peers = useNetworkStore((s) => s.peers);
  const roster = useNetworkStore((s) => s.roster);
  const isJoinRejected = useNetworkStore((s) => s.isJoinRejected);
  const rejectionReason = useNetworkStore((s) => s.rejectionReason);
  const hostSignalLost = useNetworkStore((s) => s.hostSignalLost);
  const hostDisconnectReason = useNetworkStore((s) => s.hostDisconnectReason);
  const hostReconnectAttempts = useNetworkStore((s) => s.hostReconnectAttempts);

  const localPlayer = usePlayerStore((s) => s.player);
  const setTeam = usePlayerStore((s) => s.setTeam);
  const localPlayerId = useAvatarStore((s) => s.playerId);
  const localAvatar = useAvatarStore((s) => s.avatar);
  const localTeam = localPlayer.team;

  const selectedMap = useMapStore((s) => s.selectedMap);
  const selectMap = useMapStore((s) => s.selectMap);
  const availableMaps = useMapStore((s) => s.availableMaps);
  const matchRules = useCTFStore((s) => s.matchRules);
  const setMatchRules = useCTFStore((s) => s.setMatchRules);

  const isMuted = useSettingsStore((s) => s.sfxMuted);
  const musicEnabled = useSettingsStore((s) => s.musicEnabled);
  const crtScanlines = useSettingsStore((s) => s.crtScanlines);
  const defaultWeapon = useSettingsStore((s) => s.defaultWeapon);
  const toggleMute = useSettingsStore((s) => s.toggleMute);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const [copied, setCopied] = useState(false);
  const [isReady, setIsReady] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);

  // Close overlays with Escape
  useEffect(() => {
    if (!showMapModal && !showRosterModal && !showRulesModal) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowMapModal(false);
        setShowRosterModal(false);
        setShowRulesModal(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showMapModal, showRosterModal, showRulesModal]);

  // Derive unified roster of all squad members (Host + Cadets + Local Player)
  const allMembersMap: Record<string, RosterMember> = {};

  Object.values(roster).forEach((m) => {
    allMembersMap[m.playerId] = { ...m };
  });

  Object.values(peers).forEach((p) => {
    const alreadyMapped = Object.values(allMembersMap).some(
      (m) => m.peerId === p.peerId || m.callsign === p.callsign,
    );
    if (!alreadyMapped) {
      allMembersMap[p.peerId] = {
        playerId: p.peerId,
        peerId: p.peerId,
        callsign: p.callsign,
        team: p.team,
        avatar: {
          ...DEFAULT_AVATAR,
          callsign: p.callsign,
          bodyColor: p.team === 'blue' ? '#3b82f6' : '#ef4444',
        },
        isReady: p.isReady ?? true,
        isHost: Boolean(p.isHost),
        isOnline: true,
      };
    }
  });

  allMembersMap[localPlayerId] = {
    playerId: localPlayerId,
    peerId: useNetworkStore.getState().selfPeerId || 'local',
    callsign: localAvatar.callsign,
    team: localTeam,
    avatar: localAvatar,
    isReady,
    isHost,
    isOnline: true,
  };

  const memberList = Object.values(allMembersMap).filter(
    (m) => m.isOnline || m.playerId === localPlayerId || gamePhase === 'in_game',
  );
  const blueMembers = memberList.filter((m) => m.team === 'blue');
  const redMembers = memberList.filter((m) => m.team === 'red');
  const totalPlayers = memberList.length;
  const readyCount = memberList.filter((m) => m.isReady).length;

  // Refs synced cleanly for the 60 FPS Drop-Bay Stage Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });
  const sparksRef = useRef<StageSpark[]>([]);
  const tracersRef = useRef<StageTracer[]>([]);
  const localBayPosRef = useRef<{ x: number; y: number; team: Team }>({
    x: 240,
    y: 220,
    team: localTeam,
  });

  const stageStateRef = useRef({
    blueMembers,
    redMembers,
    localPlayerId,
    defaultWeapon,
    localTeam,
  });

  useEffect(() => {
    stageStateRef.current = {
      blueMembers,
      redMembers,
      localPlayerId,
      defaultWeapon,
      localTeam,
    };
  }, [blueMembers, redMembers, localPlayerId, defaultWeapon, localTeam]);

  // 60 FPS Dual-Faction Drop-Bay Stage (Unobstructed Centerpiece on All Devices)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const stars: StageStar[] = Array.from({ length: 64 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 1.4,
      speed: 0.004 + Math.random() * 0.012,
      alpha: 0.18 + Math.random() * 0.55,
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
    let smoothLocalAim = 0;

    const drawPedestal = (
      cx: number,
      cy: number,
      padW: number,
      padH: number,
      primaryRgb: string,
      ringColor: string,
    ) => {
      ctx.save();
      const cone = ctx.createLinearGradient(cx, 0, cx, cy);
      cone.addColorStop(0, `rgba(${primaryRgb}, 0.01)`);
      cone.addColorStop(0.6, `rgba(${primaryRgb}, 0.07)`);
      cone.addColorStop(1, `rgba(${primaryRgb}, 0.16)`);
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(cx - padW * 0.34, 0);
      ctx.lineTo(cx + padW * 0.34, 0);
      ctx.lineTo(cx + padW * 1.05, cy + 6);
      ctx.lineTo(cx - padW * 1.05, cy + 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = '#091122';
      ctx.strokeStyle = `rgba(${primaryRgb}, 0.55)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, padW, padH, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const pulse = 0.65 + Math.sin(timeSec * 3.1) * 0.35;
      ctx.strokeStyle = ringColor;
      ctx.globalAlpha = 0.65 * pulse;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([10, 7]);
      ctx.lineDashOffset = -timeSec * 20;
      ctx.beginPath();
      ctx.ellipse(cx, cy, padW * 0.72, padH * 0.66, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    };

    const drawPilotTag = (
      px: number,
      py: number,
      radius: number,
      member: RosterMember,
      isLocal: boolean,
      teamColor: string,
    ) => {
      const label = (member.callsign || 'PILOT').slice(0, 12);
      const prefix = member.isHost ? '★ ' : '';
      const suffix = isLocal ? ' [YOU]' : '';
      const fullText = `${prefix}${label}${suffix}`;

      ctx.save();
      ctx.font = 'bold 10px ui-monospace, SFMono-Regular, Menlo, monospace';
      const textWidth = ctx.measureText(fullText).width;
      const boxW = textWidth + 20;
      const boxH = 18;
      const tagY = py - radius * 2.0 - 12;

      ctx.fillStyle = 'rgba(6, 9, 19, 0.88)';
      ctx.strokeStyle = isLocal ? teamColor : 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(px - boxW / 2, tagY, boxW, boxH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = member.isReady ? '#34d399' : '#f59e0b';
      ctx.beginPath();
      ctx.arc(px - boxW / 2 + 7, tagY + boxH / 2, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isLocal ? '#ffffff' : '#cbd5e1';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(fullText, px - boxW / 2 + 13, tagY + boxH / 2 + 0.5);
      ctx.restore();
    };

    const renderFrame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      timeSec += dt;

      const w = window.innerWidth;
      const h = window.innerHeight;
      const isPortrait = w < 640;
      const isShortLandscape = !isPortrait && h < 520;

      const {
        blueMembers: blues,
        redMembers: reds,
        localPlayerId: myId,
        defaultWeapon: myWeapon,
        localTeam: myTeam,
      } = stageStateRef.current;

      // 1. Deep Space Orbital Backdrop
      ctx.fillStyle = '#060913';
      ctx.fillRect(0, 0, w, h);

      const blueBayX = isPortrait ? w * 0.28 : w * 0.33;
      const redBayX = isPortrait ? w * 0.72 : w * 0.67;
      const bayCenterY = isShortLandscape
        ? h * 0.49
        : isPortrait
          ? h * 0.44
          : h * 0.46;

      // Dual atmospheric faction horizon glows
      const blueGlow = ctx.createRadialGradient(
        blueBayX,
        bayCenterY,
        15,
        blueBayX,
        bayCenterY,
        Math.max(w, h) * 0.44,
      );
      blueGlow.addColorStop(0, 'rgba(0, 240, 255, 0.14)');
      blueGlow.addColorStop(0.6, 'rgba(14, 30, 64, 0.12)');
      blueGlow.addColorStop(1, 'rgba(6, 9, 19, 0)');
      ctx.fillStyle = blueGlow;
      ctx.fillRect(0, 0, w, h);

      const redGlow = ctx.createRadialGradient(
        redBayX,
        bayCenterY,
        15,
        redBayX,
        bayCenterY,
        Math.max(w, h) * 0.44,
      );
      redGlow.addColorStop(0, 'rgba(255, 0, 85, 0.12)');
      redGlow.addColorStop(0.6, 'rgba(48, 12, 30, 0.10)');
      redGlow.addColorStop(1, 'rgba(6, 9, 19, 0)');
      ctx.fillStyle = redGlow;
      ctx.fillRect(0, 0, w, h);

      // Drifting orbital stars
      for (const s of stars) {
        s.x = (s.x + s.speed * dt) % 1;
        const twinkle = 0.7 + Math.sin(timeSec * 2.2 + s.y * 20) * 0.3;
        ctx.fillStyle = `rgba(186, 230, 253, ${s.alpha * twinkle})`;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h * 0.76, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Subtle tactical grid
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.032)';
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

      // 2. Hangar Floor Deck & Framing
      const soldierRadius = isShortLandscape
        ? Math.max(20, Math.min(28, h * 0.068))
        : isPortrait
          ? Math.max(22, Math.min(30, w * 0.072))
          : Math.max(30, Math.min(44, Math.min(w, h) * 0.056));
      const padY = bayCenterY + soldierRadius * 2.15;
      const deckY = Math.max(padY - 4, bayCenterY + soldierRadius * 1.9);

      ctx.save();
      ctx.fillStyle = 'rgba(9, 15, 30, 0.8)';
      ctx.fillRect(0, deckY, w, h - deckY);

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.16)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, deckY);
      ctx.lineTo(w, deckY);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.055)';
      for (let i = -7; i <= 7; i++) {
        ctx.beginPath();
        ctx.moveTo(w * 0.5 + i * 75, deckY);
        ctx.lineTo(w * 0.5 + i * 195, h);
        ctx.stroke();
      }
      ctx.restore();

      // 3. Central Holographic Standoff Reticle
      const centerX = w * 0.5;
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centerX, Math.max(82, bayCenterY - soldierRadius * 2.3));
      ctx.lineTo(centerX, padY + 14);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(centerX, bayCenterY, isShortLandscape ? 16 : 22, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = '900 italic 11px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = 'rgba(226, 232, 240, 0.52)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('VS', centerX, bayCenterY + 0.5);
      ctx.restore();

      // 4. Dual Drop-Bay Pedestals
      const padW = isPortrait
        ? Math.min(82, w * 0.21)
        : isShortLandscape
          ? Math.min(100, w * 0.14)
          : Math.min(136, Math.max(96, w * 0.11));
      const padH = isShortLandscape || isPortrait ? 15 : 22;
      drawPedestal(blueBayX, padY, padW, padH, '0, 240, 255', '#38bdf8');
      drawPedestal(redBayX, padY, padW, padH, '255, 0, 85', '#fb7185');

      // Ambient sparks on both pads
      if (Math.random() < 0.22) {
        sparksRef.current.push({
          x: blueBayX + (Math.random() - 0.5) * padW * 0.9,
          y: padY - 4,
          vx: (Math.random() - 0.5) * 20,
          vy: -22 - Math.random() * 35,
          life: 0.65 + Math.random() * 0.5,
          size: 1.4 + Math.random() * 1.6,
          color: '#38bdf8',
        });
      }
      if (Math.random() < 0.22) {
        sparksRef.current.push({
          x: redBayX + (Math.random() - 0.5) * padW * 0.9,
          y: padY - 4,
          vx: (Math.random() - 0.5) * 20,
          vy: -22 - Math.random() * 35,
          life: 0.65 + Math.random() * 0.5,
          size: 1.4 + Math.random() * 1.6,
          color: '#fb7185',
        });
      }

      // 5. Render Faction Soldiers Directly in the Open Drop Bays
      const renderFactionBay = (
        members: RosterMember[],
        bayCenterX: number,
        team: Team,
        defaultAim: number,
        teamTagColor: string,
      ) => {
        if (members.length === 0) {
          ctx.save();
          ctx.font = 'bold 9px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.fillStyle = team === 'blue' ? 'rgba(56, 189, 248, 0.48)' : 'rgba(251, 113, 133, 0.48)';
          ctx.textAlign = 'center';
          ctx.fillText('[ BAY STANDBY ]', bayCenterX, bayCenterY + 4);
          ctx.restore();
          return;
        }

        const maxSpan = isPortrait ? padW * 1.35 : padW * 1.65;
        const step = members.length > 1 ? Math.min(58, maxSpan / (members.length - 1)) : 0;
        const startX = bayCenterX - ((members.length - 1) * step) / 2;

        members.forEach((member, idx) => {
          const isLocal = member.playerId === myId;
          const px = startX + idx * step;
          const bobPhase = idx * 1.3;
          const hoverY = Math.sin(timeSec * 2.4 + bobPhase) * (member.isReady ? 4 : 2);
          const py = bayCenterY + hoverY + (members.length > 1 && idx % 2 === 1 ? 5 : 0);
          const slotRadius = members.length > 2 ? soldierRadius * 0.86 : soldierRadius;

          let aimAngle = defaultAim + Math.sin(timeSec * 0.75 + bobPhase) * 0.22;
          if (isLocal) {
            localBayPosRef.current = { x: px, y: py, team };
            const ptr = pointerRef.current;
            const desiredAim = ptr.active
              ? Math.atan2(ptr.y - py, ptr.x - px)
              : defaultAim + Math.sin(timeSec * 0.8) * 0.28;
            let delta = desiredAim - smoothLocalAim;
            while (delta > Math.PI) delta -= Math.PI * 2;
            while (delta < -Math.PI) delta += Math.PI * 2;
            smoothLocalAim += delta * Math.min(1, dt * 10);
            aimAngle = smoothLocalAim;
          }

          ctx.save();
          ctx.translate(px, py);
          renderAvatar(ctx, member.avatar || DEFAULT_AVATAR, {
            aimAngle,
            radius: slotRadius,
            isBoosting: member.isReady,
            team,
            showHUD: false,
            vx: 0,
            vy: Math.cos(timeSec * 2.4 + bobPhase) * 0.5,
            isGrounded: false,
            timeSec,
            weaponType: isLocal ? myWeapon : 'rifle',
          });
          ctx.restore();

          drawPilotTag(px, py, slotRadius, member, isLocal, teamTagColor);
        });
      };

      if (myTeam === 'blue') {
        renderFactionBay(reds, redBayX, 'red', Math.PI, '#fb7185');
        renderFactionBay(blues, blueBayX, 'blue', 0, '#38bdf8');
      } else {
        renderFactionBay(blues, blueBayX, 'blue', 0, '#38bdf8');
        renderFactionBay(reds, redBayX, 'red', Math.PI, '#fb7185');
      }

      // 6. Sparks & Test-Fire Tracers
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

  const handleStageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    pointerRef.current = { x: e.clientX, y: e.clientY, active: true };
  };

  const handleStageCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = localBayPosRef.current;
    const angle = Math.atan2(e.clientY - pos.y, e.clientX - pos.x);
    const wCfg = WEAPONS[defaultWeapon];
    sounds.playWeaponSound(defaultWeapon);

    const tracerColor = pos.team === 'blue' ? '#38bdf8' : '#fb7185';
    const count = wCfg.pellets;
    for (let i = 0; i < count; i++) {
      const spread = count > 1 ? (i - (count - 1) / 2) * 0.08 : 0;
      const a = angle + spread;
      const spd = 950;
      tracersRef.current.push({
        x: pos.x + Math.cos(a) * 28,
        y: pos.y + Math.sin(a) * 28,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: 0.75,
        color: wCfg.color || tracerColor,
      });
    }
    for (let i = 0; i < 6; i++) {
      const a = angle + (Math.random() - 0.5) * 0.7;
      sparksRef.current.push({
        x: pos.x + Math.cos(angle) * 30,
        y: pos.y + Math.sin(angle) * 30,
        vx: Math.cos(a) * (120 + Math.random() * 140),
        vy: Math.sin(a) * (120 + Math.random() * 140),
        life: 0.35,
        size: 2.2,
        color: '#fde047',
      });
    }
  };

  const handleCopyLink = () => {
    sounds.playUiClick();
    const link = `${window.location.origin}${window.location.pathname}?room=${roomCode || ''}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(link)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {
          // ignore clipboard permission rejections
        });
    }
  };

  const handleSelectTeam = (newTeam: Team) => {
    if (localTeam === newTeam) return;
    sounds.playUiClick();
    setTeam(newTeam);
    networkManager.broadcastTeamChange(newTeam);
  };

  const handleToggleReady = () => {
    sounds.playUiClick();
    const next = !isReady;
    setIsReady(next);
    networkManager.broadcastReadyChange(next);
  };

  const handleSelectMap = (mapId: string) => {
    if (!isHost) return;
    sounds.playUiClick();
    selectMap(mapId);
    networkManager.broadcastMapChange(mapId);
    setShowMapModal(false);
  };

  const handleUpdateRules = (partial: Partial<MatchRulesConfig>) => {
    if (!isHost) return;
    sounds.playUiClick();
    const next: MatchRulesConfig = { ...matchRules, ...partial };
    setMatchRules(next);
    networkManager.broadcastRulesChange(next);
  };

  const handleLaunchMission = () => {
    sounds.playUiClick();
    usePlayerStore.getState().spawnAtTeamBase(selectedMap, localPlayerId);
    networkManager.broadcastStartMatch(selectedMap.id);
    onStartMatch();
  };

  const renderRosterRow = (m: RosterMember, faction: Team) => {
    const isLocal = m.playerId === localPlayerId;
    const safeCallsign = m.callsign || 'Pilot';
    return (
      <div
        key={m.playerId}
        className={`flex items-center justify-between gap-2 px-3 py-2 border clip-chamfer ${
          faction === 'blue'
            ? isLocal
              ? 'bg-blue-950/75 border-cyan-400/60 glow-cyan'
              : 'bg-slate-950/80 border-slate-800'
            : isLocal
              ? 'bg-rose-950/75 border-rose-400/60 glow-red'
              : 'bg-slate-950/80 border-slate-800'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/60"
            style={{
              backgroundColor:
                m.avatar?.bodyColor || (faction === 'blue' ? '#2563eb' : '#dc2626'),
            }}
          />
          {isLocal ? (
            <button
              type="button"
              onClick={handleToggleReady}
              className={`px-2 py-0.5 text-[9px] font-mono font-black uppercase border transition cursor-pointer shrink-0 flex items-center gap-1 ${
                isReady
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                  : 'bg-amber-500/20 border-amber-400 text-amber-300'
              }`}
            >
              {isReady && <Check className="w-2.5 h-2.5" />}
              {isReady ? 'READY' : 'WAIT'}
            </button>
          ) : m.isHost ? (
            <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
              ★ HOST
            </span>
          ) : m.isReady ? (
            <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shrink-0">
              READY
            </span>
          ) : (
            <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
              WAIT
            </span>
          )}
          <span className="text-xs font-bold text-white truncate flex items-center gap-1">
            {safeCallsign}
            {isLocal && (
              <Sparkles
                className={`w-3 h-3 shrink-0 ${
                  faction === 'blue' ? 'text-cyan-300' : 'text-rose-300'
                }`}
              />
            )}
          </span>
        </div>

        <span
          className={`text-[9px] font-mono font-bold shrink-0 ${
            faction === 'blue' ? 'text-cyan-400/80' : 'text-rose-400/80'
          }`}
        >
          {m.isHost ? 'HOST' : isLocal ? 'YOU' : 'CADET'}
        </span>
      </div>
    );
  };

  return (
    <div
      onMouseMove={handleStageMouseMove}
      className="relative w-full min-h-[100dvh] overflow-x-hidden bg-[#060913] text-slate-100 select-none"
    >
      {/* Layer 0: Unobstructed Dual-Bay Hangar Canvas */}
      <canvas
        ref={canvasRef}
        onClick={handleStageCanvasClick}
        className="fixed inset-0 w-full h-full block cursor-crosshair z-0"
        title="Move cursor to aim • Click drop bay to test-fire weapon"
      />

      {/* CRT Scanline Overlay */}
      {crtScanlines && (
        <div className="fixed inset-0 scanline-overlay z-10 pointer-events-none" />
      )}

      {/* Layer 2: Minimal Game Perimeter HUD (Never covers live drop-bay pilots) */}
      <div className="relative z-20 w-full min-h-[100dvh] flex flex-col justify-between gap-2 p-2.5 sm:p-4 lg:p-5 pointer-events-none">
        {/* TOP STRIP: Bar 1 (Room & Utilities) + Bar 2 (Quick Team Switcher Pills) */}
        <div className="w-full flex flex-col gap-2 pointer-events-auto">
          <header className="w-full flex items-center justify-between gap-2">
            {/* Left: Leave + War Room Tag */}
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  onLeaveRoom();
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 bg-slate-950/85 hover:bg-rose-950/70 text-slate-200 hover:text-rose-200 border border-slate-700/80 hover:border-rose-500/60 transition cursor-pointer text-xs font-mono font-bold clip-chamfer shrink-0"
                title="Leave War Room"
              >
                <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" />
                <span className="hidden sm:inline">Leave</span>
              </button>

              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <span className="px-1.5 sm:px-2 py-0.5 bg-cyan-400 text-slate-950 font-black text-[9px] sm:text-xs italic tracking-wider -skew-x-12 shrink-0">
                  <span className="inline-block skew-x-12">WAR ROOM</span>
                </span>
                <span className="text-sm sm:text-lg font-black text-white font-mono tracking-wider sm:tracking-widest truncate">
                  {roomCode}
                </span>
                <span
                  className={`hidden sm:inline-block text-[9px] font-mono font-bold px-1.5 py-0.5 uppercase tracking-wider shrink-0 ${
                    isHost
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/45'
                      : 'bg-slate-950/85 text-slate-300 border border-slate-700'
                  }`}
                >
                  {isHost ? 'HOST' : 'CADET'}
                </span>
              </div>
            </div>

            {/* Right: Copy + QR + Music + Mute */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 bg-slate-950/85 hover:bg-slate-900 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 hover:text-white text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer clip-chamfer"
                title="Copy Invite Link"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-cyan-400" />
                )}
                <span className="hidden md:inline">{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  setShowQRModal(true);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 bg-slate-950/85 hover:bg-slate-900 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 hover:text-white text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer clip-chamfer glow-cyan"
                title="Show Squad Uplink QR Code"
              >
                <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden md:inline">Room QR</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  updateSettings({ musicEnabled: !musicEnabled });
                  sounds.playUiClick();
                }}
                className={`p-1.5 sm:p-2 bg-slate-950/85 hover:bg-slate-900 border transition cursor-pointer clip-chamfer ${
                  musicEnabled && !isMuted
                    ? 'border-cyan-500/40 text-cyan-300 hover:border-cyan-400'
                    : 'border-slate-700/80 text-slate-500 hover:text-slate-300'
                }`}
                title={musicEnabled ? 'Mute Background Music' : 'Enable Background Music'}
              >
                <Music className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              <button
                type="button"
                onClick={() => toggleMute()}
                className="p-1.5 sm:p-2 bg-slate-950/85 hover:bg-slate-900 border border-slate-700/80 hover:border-cyan-400/50 text-slate-200 transition cursor-pointer clip-chamfer"
                title={isMuted ? 'Unmute All Audio' : 'Mute All Audio'}
              >
                {isMuted ? (
                  <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                )}
              </button>
            </div>
          </header>

          {/* Compact Single-Line Faction Switcher + Roster Drawer Trigger */}
          <div className="w-full flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-950/75 backdrop-blur-md border border-slate-800/90 p-1 clip-chamfer">
              <button
                type="button"
                onClick={() => handleSelectTeam('blue')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1 text-[10px] sm:text-xs font-mono font-black uppercase tracking-wider transition clip-chamfer ${
                  localTeam === 'blue'
                    ? 'bg-cyan-500/25 border border-cyan-400 text-cyan-200 glow-cyan cursor-default'
                    : 'bg-slate-900/70 hover:bg-blue-950/60 border border-transparent text-slate-400 hover:text-cyan-200 cursor-pointer'
                }`}
              >
                <Flag className="w-3 h-3 text-cyan-400" />
                <span>Blue</span>
                <span className="px-1.5 py-0.5 bg-blue-950 text-cyan-300 text-[9px]">
                  {blueMembers.length}
                </span>
              </button>

              <span className="text-[9px] font-mono font-bold text-slate-600 px-0.5">VS</span>

              <button
                type="button"
                onClick={() => handleSelectTeam('red')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1 text-[10px] sm:text-xs font-mono font-black uppercase tracking-wider transition clip-chamfer ${
                  localTeam === 'red'
                    ? 'bg-rose-500/25 border border-rose-400 text-rose-200 glow-red cursor-default'
                    : 'bg-slate-900/70 hover:bg-rose-950/60 border border-transparent text-slate-400 hover:text-rose-200 cursor-pointer'
                }`}
              >
                <Flag className="w-3 h-3 text-rose-400" />
                <span>Red</span>
                <span className="px-1.5 py-0.5 bg-rose-950 text-rose-300 text-[9px]">
                  {redMembers.length}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  setShowRulesModal(true);
                }}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-950/80 hover:bg-slate-900 border border-slate-700/80 hover:border-amber-400/60 text-slate-200 hover:text-white text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider clip-chamfer transition cursor-pointer"
                title={isHost ? 'Configure Match Rules' : 'View Active Match Rules'}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>FT{matchRules.targetCaptures}</span>
                <span className="hidden md:inline text-slate-400">
                  • {formatClockPreset(matchRules.timeLimitSec)} • {matchRules.respawnDelaySec}s
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  setShowRosterModal(true);
                }}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-950/80 hover:bg-slate-900 border border-slate-700/80 hover:border-cyan-400/50 text-slate-200 hover:text-white text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider clip-chamfer transition cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  Squad {totalPlayers}
                </span>
                <span className="hidden sm:inline text-emerald-400">
                  ({readyCount}/{totalPlayers} Ready)
                </span>
              </button>
            </div>
          </div>

          {!isHost && hostSignalLost && !isJoinRejected && (
            <div className="w-full bg-amber-950/90 border border-amber-400/70 text-amber-100 px-3 py-2 clip-chamfer backdrop-blur-md shadow-lg flex flex-wrap items-center justify-between gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="flex items-center gap-2 min-w-0">
                <WifiOff className="w-4 h-4 text-amber-300 shrink-0 animate-pulse" />
                <div className="text-[10px] sm:text-xs font-mono leading-snug">
                  <span className="font-black uppercase tracking-wider text-amber-200">
                    Host Signal Lost • Reconnecting
                    {hostReconnectAttempts > 0 ? ` (#${hostReconnectAttempts})` : '...'}
                  </span>
                  <span className="hidden sm:inline text-amber-200/80 ml-2">
                    {hostDisconnectReason || 'Host uplink dropped or offline.'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    networkManager.retryHostConnection();
                  }}
                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-400/30 border border-amber-400/60 text-amber-100 text-[10px] font-mono font-black uppercase clip-chamfer transition cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    onLeaveRoom();
                  }}
                  className="px-2.5 py-1 bg-rose-600/85 hover:bg-rose-500 border border-rose-400/70 text-white text-[10px] font-mono font-black uppercase clip-chamfer transition cursor-pointer"
                >
                  Return to Hangar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CENTER STAGE SPACER (Guarantees completely unobstructed live soldiers!) */}
        <div className="flex-1 min-h-[120px] sm:min-h-[140px] pointer-events-none" />

        {/* BOTTOM DOCK: Compact Selected Map Tile (Left) + Ready & Deploy CTA (Right) */}
        <footer className="w-full flex flex-col sm:flex-row sm:items-end justify-between gap-2 sm:gap-3 pointer-events-auto">
          {/* Left: Active Theater Tile (Opens Theater Selector Modal) */}
          <button
            type="button"
            onClick={() => {
              sounds.playUiClick();
              setShowMapModal(true);
            }}
            className="w-full sm:w-auto sm:min-w-[235px] lg:min-w-[300px] bg-slate-950/85 hover:bg-slate-900/95 backdrop-blur-md border border-cyan-500/40 hover:border-cyan-400 p-2 lg:p-2.5 clip-chamfer flex items-center justify-between gap-3 transition cursor-pointer text-left glow-cyan group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <MapSchematicPreview map={selectedMap} isSelected size="mini" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-cyan-400 uppercase tracking-widest">
                  <MapIcon className="w-3 h-3 shrink-0" />
                  <span>{isHost ? 'Theater • Tap to Change' : 'Active Theater'}</span>
                </div>
                <div className="text-xs sm:text-sm font-black text-white truncate">
                  {getCleanMapTitle(selectedMap)}
                </div>
                <div className="text-[9px] font-mono text-slate-400 truncate">
                  {selectedMap.width}×{selectedMap.height} • {selectedMap.weaponSpawns.length} Crates
                  {(selectedMap.bouncePads?.length ?? 0) > 0
                    ? ` • ${selectedMap.bouncePads!.length} Pads`
                    : ''}
                  {(selectedMap.refillStations?.length ?? 0) > 0
                    ? ` • ${selectedMap.refillStations!.length} Stations`
                    : ''}
                </div>
              </div>
            </div>

            {isHost ? (
              <span className="shrink-0 inline-flex items-center gap-0.5 px-2 py-1 bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 group-hover:text-white text-[9px] font-mono font-black uppercase clip-chamfer">
                Change
                <ChevronRight className="w-3 h-3" />
              </span>
            ) : (
              <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 bg-slate-900 border border-slate-700 text-slate-400 text-[9px] font-mono font-bold uppercase">
                <Lock className="w-2.5 h-2.5" />
                Host
              </span>
            )}
          </button>

          {/* Right: Ready Toggle + Primary Launch Mission CTA */}
          <div className="w-full sm:w-auto sm:min-w-[270px] lg:min-w-[330px] flex flex-row lg:flex-col items-stretch gap-2">
            <span className="hidden lg:block text-[10px] font-mono text-slate-500 tracking-wider text-right">
              MOVE CURSOR TO AIM • CLICK BAY TO TEST-FIRE
            </span>

            <button
              type="button"
              onClick={handleToggleReady}
              className={`shrink-0 lg:w-full px-3 py-2 bg-slate-950/85 backdrop-blur-md border transition cursor-pointer flex items-center justify-between gap-2 text-[10px] sm:text-xs font-mono font-black uppercase tracking-wider clip-chamfer ${
                isReady
                  ? 'border-emerald-400/60 text-emerald-300 hover:bg-emerald-950/40'
                  : 'border-amber-400/60 text-amber-300 hover:bg-amber-950/40'
              }`}
              title="Toggle Ready status"
            >
              <span className="flex items-center gap-1.5">
                {isReady && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{isReady ? 'Ready' : 'Standby'}</span>
              </span>
              <span className="hidden lg:inline text-[10px] text-slate-400 font-normal">
                {readyCount}/{totalPlayers} Squad Ready
              </span>
            </button>

            {isHost ? (
              <button
                type="button"
                onClick={handleLaunchMission}
                className="flex-1 lg:w-full py-2.5 lg:py-3.5 px-4 lg:px-6 bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-xs sm:text-sm lg:text-base uppercase tracking-[0.12em] sm:tracking-[0.15em] clip-chamfer-lg shadow-2xl shadow-cyan-950/80 transition-all cursor-pointer flex items-center justify-center gap-2 glow-cyan group whitespace-nowrap"
              >
                <Rocket className="w-4 h-4 lg:w-5 lg:h-5 shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                <span>Launch Mission</span>
                <Play className="w-3.5 h-3.5 lg:w-4 lg:h-4 shrink-0 fill-slate-950" />
              </button>
            ) : hostSignalLost ? (
              <div className="flex-1 lg:w-full py-2.5 lg:py-3 px-4 bg-amber-950/75 border border-amber-400/60 text-amber-200 font-mono font-bold text-[10px] sm:text-xs uppercase tracking-widest clip-chamfer-lg flex items-center justify-center gap-2">
                <WifiOff className="w-3.5 h-3.5 text-amber-300 shrink-0 animate-pulse" />
                <span className="truncate">Host Signal Lost • Reconnecting...</span>
              </div>
            ) : gamePhase === 'in_game' ? (
              <button
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  onStartMatch();
                }}
                className="flex-1 lg:w-full py-2.5 lg:py-3.5 px-4 lg:px-6 bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-xs sm:text-sm lg:text-base uppercase tracking-[0.12em] sm:tracking-[0.15em] clip-chamfer-lg shadow-2xl transition-all cursor-pointer flex items-center justify-center gap-2 glow-cyan whitespace-nowrap"
              >
                <Play className="w-4 h-4 shrink-0 fill-slate-950" />
                <span>Rejoin Battle</span>
              </button>
            ) : (
              <div className="flex-1 lg:w-full py-2.5 lg:py-3 px-4 bg-cyan-950/60 border border-cyan-500/45 text-cyan-200 font-mono font-bold text-[10px] sm:text-xs uppercase tracking-widest clip-chamfer-lg flex items-center justify-center gap-2 glow-cyan">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
                <span className="truncate">Awaiting Host...</span>
              </div>
            )}
          </div>
        </footer>
      </div>

      {/* THEATER SELECTION MODAL (Clean & Scrollable on All Devices) */}
      {showMapModal && (
        <div
          onClick={() => setShowMapModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-150 select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="cyber-panel clip-chamfer-lg shadow-2xl w-full max-w-2xl max-h-[90dvh] flex flex-col overflow-hidden border border-cyan-500/50 glow-cyan animate-in zoom-in-95 duration-150"
          >
            {/* Pinned Header */}
            <div className="shrink-0 flex items-center justify-between px-4 sm:px-5 py-3 border-b border-cyan-500/20 bg-slate-950/90">
              <div className="flex items-center gap-2">
                <MapIcon className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-white tracking-wider uppercase font-mono">
                    Select Combat Theater
                  </h3>
                  <span className="text-[9px] font-mono text-slate-400 uppercase block">
                    {isHost ? 'Host chooses arena for squad deployment' : 'Active arena controlled by room host'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  setShowMapModal(false);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 hover:border-rose-500/60 hover:bg-rose-950/60 text-slate-300 hover:text-white text-[10px] font-mono font-bold uppercase clip-chamfer cursor-pointer"
              >
                <X className="w-3.5 h-3.5 text-rose-400" />
                <span>Close</span>
              </button>
            </div>

            {/* Scrollable Map Grid */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-5 bg-slate-950/60">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {Object.values(availableMaps).map((m) => {
                  const isSelected = selectedMap.id === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={!isHost}
                      onClick={() => handleSelectMap(m.id)}
                      className={`text-left p-2.5 border transition-all flex sm:flex-col items-center sm:items-stretch gap-3 sm:gap-2.5 clip-chamfer ${
                        isSelected
                          ? 'bg-cyan-950/45 border-cyan-400 glow-cyan'
                          : isHost
                            ? 'bg-slate-950/75 border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900/80 cursor-pointer'
                            : 'bg-slate-950/50 border-slate-800/70 opacity-70 cursor-default'
                      }`}
                    >
                      <MapSchematicPreview map={m} isSelected={isSelected} size="card" />

                      <div className="flex-1 sm:flex-none flex items-center justify-between gap-2 min-w-0">
                        <div className="min-w-0">
                          <div className="text-xs font-black text-white truncate">
                            {getCleanMapTitle(m)}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">
                            {m.width}×{m.height} • {m.weaponSpawns.length} Crates
                            {(m.bouncePads?.length ?? 0) > 0 ? ` • ${m.bouncePads!.length} Pads` : ''}
                          </div>
                        </div>

                        <span
                          className={`shrink-0 px-2 py-0.5 text-[9px] font-mono font-black uppercase ${
                            isSelected
                              ? 'bg-cyan-400 text-slate-950'
                              : 'bg-slate-900 text-slate-400 border border-slate-700/80'
                          }`}
                        >
                          {isSelected ? 'ACTIVE' : getMapModeTag(m)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SQUAD ROSTER MODAL (On-Demand Full Pilot List & Faction Details) */}
      {showRosterModal && (
        <div
          onClick={() => setShowRosterModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-150 select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="cyber-panel clip-chamfer-lg shadow-2xl w-full max-w-xl max-h-[90dvh] flex flex-col overflow-hidden border border-cyan-500/50 glow-cyan animate-in zoom-in-95 duration-150"
          >
            <div className="shrink-0 flex items-center justify-between px-4 sm:px-5 py-3 border-b border-cyan-500/20 bg-slate-950/90">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-white tracking-wider uppercase font-mono">
                    Squad Roster ({totalPlayers})
                  </h3>
                  <span className="text-[9px] font-mono text-emerald-400 uppercase block">
                    {readyCount}/{totalPlayers} Pilots Ready for Drop
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  setShowRosterModal(false);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 hover:border-rose-500/60 hover:bg-rose-950/60 text-slate-300 hover:text-white text-[10px] font-mono font-bold uppercase clip-chamfer cursor-pointer"
              >
                <X className="w-3.5 h-3.5 text-rose-400" />
                <span>Close</span>
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-5 bg-slate-950/60">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Blue Squad Column */}
                <div className="bg-slate-950/75 border border-cyan-500/35 p-3 clip-chamfer flex flex-col gap-2">
                  <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
                    <span className="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Flag className="w-3.5 h-3.5 text-cyan-400" />
                      Blue Squad
                    </span>
                    <span className="text-[10px] font-mono text-cyan-300 font-bold">
                      {blueMembers.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {blueMembers.map((m) => renderRosterRow(m, 'blue'))}
                    {blueMembers.length === 0 && (
                      <div className="text-[10px] font-mono text-slate-500 text-center py-4">
                        [ NO BLUE PILOTS ]
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectTeam('blue')}
                    disabled={localTeam === 'blue'}
                    className={`mt-auto w-full py-2 text-[10px] font-black uppercase tracking-widest clip-chamfer transition ${
                      localTeam === 'blue'
                        ? 'bg-cyan-500/15 border border-cyan-400/50 text-cyan-300 cursor-default'
                        : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
                    }`}
                  >
                    {localTeam === 'blue' ? 'Your Active Squad' : 'Switch to Blue'}
                  </button>
                </div>

                {/* Red Squad Column */}
                <div className="bg-slate-950/75 border border-rose-500/35 p-3 clip-chamfer flex flex-col gap-2">
                  <div className="flex items-center justify-between border-b border-rose-500/20 pb-2">
                    <span className="text-xs font-black text-red-shimmer uppercase tracking-wider flex items-center gap-1.5">
                      <Flag className="w-3.5 h-3.5 text-rose-400" />
                      Red Squad
                    </span>
                    <span className="text-[10px] font-mono text-rose-300 font-bold">
                      {redMembers.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {redMembers.map((m) => renderRosterRow(m, 'red'))}
                    {redMembers.length === 0 && (
                      <div className="text-[10px] font-mono text-slate-500 text-center py-4">
                        [ NO RED PILOTS ]
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectTeam('red')}
                    disabled={localTeam === 'red'}
                    className={`mt-auto w-full py-2 text-[10px] font-black uppercase tracking-widest clip-chamfer transition ${
                      localTeam === 'red'
                        ? 'bg-rose-500/15 border border-rose-400/50 text-rose-300 cursor-default'
                        : 'bg-rose-600 hover:bg-rose-500 text-white cursor-pointer'
                    }`}
                  >
                    {localTeam === 'red' ? 'Your Active Squad' : 'Switch to Red'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MATCH RULES CONFIGURATION MODAL */}
      {showRulesModal && (
        <div
          onClick={() => setShowRulesModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-150 select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="cyber-panel clip-chamfer-lg shadow-2xl w-full max-w-lg max-h-[90dvh] flex flex-col overflow-hidden border border-amber-500/45 glow-amber animate-in zoom-in-95 duration-150"
          >
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-4 sm:px-5 py-3 border-b border-amber-500/20 bg-slate-950/90">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-white tracking-wider uppercase font-mono">
                    Match Rules &amp; Engagement
                  </h3>
                  <span className="text-[9px] font-mono text-slate-400 uppercase block">
                    {isHost
                      ? 'Changes broadcast live to all connected cadets'
                      : 'Rules locked & synchronized by squad host'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  setShowRulesModal(false);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 hover:border-rose-500/60 hover:bg-rose-950/60 text-slate-300 hover:text-white text-[10px] font-mono font-bold uppercase clip-chamfer cursor-pointer"
              >
                <X className="w-3.5 h-3.5 text-rose-400" />
                <span>Close</span>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 bg-slate-950/65 space-y-5">
              {/* 1. Capture Limit */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-300">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    Capture Limit (First To)
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {matchRules.targetCaptures} {matchRules.targetCaptures === 1 ? 'Capture' : 'Captures'}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {([1, 3, 5, 7] as TargetCapturesPreset[]).map((cap) => {
                    const active = matchRules.targetCaptures === cap;
                    return (
                      <button
                        key={cap}
                        type="button"
                        disabled={!isHost}
                        onClick={() => handleUpdateRules({ targetCaptures: cap })}
                        className={`py-2 px-2 border text-xs font-mono font-black uppercase clip-chamfer transition ${
                          active
                            ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 glow-cyan'
                            : isHost
                              ? 'bg-slate-900/80 border-slate-700/80 text-slate-400 hover:border-cyan-400/50 hover:text-white cursor-pointer'
                              : 'bg-slate-900/50 border-slate-800 text-slate-500 cursor-default'
                        }`}
                      >
                        FT{cap}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Match Clock + Sudden-Death Overtime */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-300">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    Match Clock
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {matchRules.timeLimitSec === 0
                      ? 'No Time Limit'
                      : `${formatClockPreset(matchRules.timeLimitSec)} + Sudden-Death OT`}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {([0, 180, 300, 480] as MatchTimeLimitPreset[]).map((sec) => {
                    const active = matchRules.timeLimitSec === sec;
                    return (
                      <button
                        key={sec}
                        type="button"
                        disabled={!isHost}
                        onClick={() => handleUpdateRules({ timeLimitSec: sec })}
                        className={`py-2 px-2 border text-xs font-mono font-black uppercase clip-chamfer transition ${
                          active
                            ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 glow-cyan'
                            : isHost
                              ? 'bg-slate-900/80 border-slate-700/80 text-slate-400 hover:border-cyan-400/50 hover:text-white cursor-pointer'
                              : 'bg-slate-900/50 border-slate-800 text-slate-500 cursor-default'
                        }`}
                      >
                        {sec === 0 ? 'Untimed' : formatClockPreset(sec)}
                      </button>
                    );
                  })}
                </div>
                {matchRules.timeLimitSec > 0 && (
                  <p className="text-[10px] font-mono text-amber-300/85 mt-1.5">
                    If tied when the clock hits 0:00, Sudden-Death Overtime begins — next capture wins!
                  </p>
                )}
              </div>

              {/* 3. Redeploy / Respawn Delay */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-300">
                    <TimerReset className="w-3.5 h-3.5 text-emerald-400" />
                    Redeploy Delay
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {matchRules.respawnDelaySec}s Cooldown
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { sec: 2.5, label: '2.5s Fast' },
                      { sec: 4.5, label: '4.5s Std' },
                      { sec: 6.5, label: '6.5s Tac' },
                    ] as { sec: RespawnDelayPreset; label: string }[]
                  ).map(({ sec, label }) => {
                    const active = matchRules.respawnDelaySec === sec;
                    return (
                      <button
                        key={sec}
                        type="button"
                        disabled={!isHost}
                        onClick={() => handleUpdateRules({ respawnDelaySec: sec })}
                        className={`py-2 px-2 border text-xs font-mono font-black uppercase clip-chamfer transition ${
                          active
                            ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                            : isHost
                              ? 'bg-slate-900/80 border-slate-700/80 text-slate-400 hover:border-emerald-400/50 hover:text-white cursor-pointer'
                              : 'bg-slate-900/50 border-slate-800 text-slate-500 cursor-default'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {!isHost && (
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/90 border border-slate-700 text-[10px] font-mono text-slate-300 clip-chamfer">
                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Only the squad Host can adjust match rules.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Enlarged QR Code Modal */}
      <RoomQRCodeModal
        isOpen={showQRModal}
        roomCode={roomCode || ''}
        onClose={() => setShowQRModal(false)}
      />

      {/* Host Security Enforcement / Rejection Modal */}
      {isJoinRejected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in select-none">
          <div className="cyber-panel-red clip-chamfer-lg p-6 sm:p-8 max-w-md w-full max-h-[90dvh] overflow-y-auto text-center flex flex-col items-center gap-5 shadow-2xl border border-rose-500/50 glow-red animate-in zoom-in-95 duration-150">
            <div className="w-16 h-16 bg-rose-950/80 border border-rose-500/60 flex items-center justify-center text-rose-400 glow-red clip-chamfer shrink-0">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold text-rose-400 uppercase tracking-widest block">
                // HOST SECURITY ENFORCEMENT //
              </span>
              <h2 className="text-xl font-black text-white uppercase tracking-tight mt-1">
                Deployment Restricted
              </h2>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                {rejectionReason ||
                  'Match is currently in progress. Only enlisted squad members from the initial deployment can rejoin this battle.'}
              </p>
            </div>
            <div className="w-full pt-2">
              <button
                type="button"
                onClick={onLeaveRoom}
                className="w-full py-3 bg-gradient-to-r from-rose-700 to-red-600 hover:from-rose-600 hover:to-red-500 text-white font-mono text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-lg shadow-rose-950 clip-chamfer"
              >
                Return to Hangar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
