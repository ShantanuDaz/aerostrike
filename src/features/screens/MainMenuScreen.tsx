import { useEffect, useState } from 'react';
import {
  Box,
  Gamepad2,
  LogIn,
  Music,
  Play,
  QrCode,
  Rocket,
  Settings,
  Volume2,
  VolumeX,
  WifiOff,
} from 'lucide-react';
import { useAvatarStore } from '../avatar/avatarStore';
import { useSettingsStore, type SettingsTab } from '../settings/settingsStore';
import { WEAPONS } from '../combat/weaponsConfig';
import { networkManager } from '../network/peerRoom';
import { useMapStore } from '../map/mapStore';
import { useCTFStore } from '../ctf/ctfStore';
import { sounds } from '../audio/soundEngine';
import { PwaInstallButton, PwaOfflinePill, usePwaStore } from '../pwa';
import { OrbitalHangarCanvas } from './mainMenu/OrbitalHangarCanvas';
import { JoinSquadModal } from './mainMenu/JoinSquadModal';
import { HostMatchModal, type HostLaunchConfig } from './mainMenu/HostMatchModal';
import {
  SoloSkirmishModal,
  type SoloLaunchConfig,
} from './mainMenu/SoloSkirmishModal';

interface MainMenuScreenProps {
  invitedRoomCode?: string | null;
  initialOpenSolo?: boolean;
  onSoloModalOpened?: () => void;
  onOpenSettings: (tab?: SettingsTab) => void;
  onEnterWarRoom: (roomCode: string, isHost?: boolean) => void;
  onStartSoloPractice: (config?: SoloLaunchConfig) => void;
  onJoinInvitedRoom?: (roomCode: string) => void;
}

export function MainMenuScreen({
  invitedRoomCode,
  initialOpenSolo = false,
  onSoloModalOpened,
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

  const matchRules = useCTFStore((s) => s.matchRules);
  const setMatchRules = useCTFStore((s) => s.setMatchRules);
  const selectMap = useMapStore((s) => s.selectMap);
  const selectedMap = useMapStore((s) => s.selectedMap);
  const isHolodeck = matchRules.mode === 'holodeck' || selectedMap.id.startsWith('holodeck-');

  const isOnline = usePwaStore((s) => s.isOnline);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showHostModal, setShowHostModal] = useState(false);
  const [showSoloModal, setShowSoloModal] = useState(() => Boolean(initialOpenSolo));
  const [offlineWarning, setOfflineWarning] = useState<string | null>(null);

  useEffect(() => {
    if (initialOpenSolo) {
      onSoloModalOpened?.();
    }
  }, [initialOpenSolo, onSoloModalOpened]);

  const isCoarsePointer =
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(pointer: coarse)').matches);

  const ensureEnlistedWithCallsign = () => {
    const clean = avatar.callsign.trim() || `Pilot_${Math.floor(100 + Math.random() * 900)}`;
    confirmEnlistment({ ...avatar, callsign: clean });
  };

  const updateRoomUrl = (code: string) => {
    try {
      const newUrl = `${window.location.origin}${window.location.pathname}?room=${code}`;
      window.history.replaceState(window.history.state, '', newUrl);
    } catch {
      // ignore restricted History API environments on mobile WebViews
    }
  };

  const handleCreateRoom = () => {
    sounds.playUiClick();
    if (!isOnline) {
      setOfflineWarning('Offline — Solo Skirmish works offline. Reconnect to host P2P matches.');
      return;
    }
    setOfflineWarning(null);
    ensureEnlistedWithCallsign();
    setShowHostModal(true);
  };

  const handleConfirmHostRoom = (config: HostLaunchConfig) => {
    ensureEnlistedWithCallsign();
    const newCode = 'ROOM-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    networkManager.connect(newCode, true);
    // Must apply map & rules AFTER connect(), since connect() clears stale room state & resets rules
    useMapStore.getState().selectMap(config.mapId);
    useCTFStore.getState().setMatchRules(config.matchRules);
    updateRoomUrl(newCode);
    setShowHostModal(false);
    onEnterWarRoom(newCode, true);
  };

  const handleJoinRoomCode = (roomCode: string) => {
    ensureEnlistedWithCallsign();
    const cleanCode = roomCode.trim().toUpperCase();
    networkManager.connect(cleanCode, false);
    updateRoomUrl(cleanCode);
    setShowJoinModal(false);
    onEnterWarRoom(cleanCode, false);
  };

  const handleSoloOpen = () => {
    sounds.playUiClick();
    ensureEnlistedWithCallsign();
    setShowSoloModal(true);
  };

  const handleSoloDeploy = (config: SoloLaunchConfig) => {
    ensureEnlistedWithCallsign();
    setShowSoloModal(false);
    onStartSoloPractice(config);
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
    <div className="relative w-full min-h-[100dvh] overflow-x-hidden bg-[#060913] text-slate-100 select-none">
      {/* Layer 0/1: Interactive Full-Bleed Orbital Hangar Canvas */}
      <OrbitalHangarCanvas avatar={avatar} defaultWeapon={defaultWeapon} />

      {/* CRT Scanline Overlay */}
      {crtScanlines && (
        <div className="fixed inset-0 scanline-overlay z-10 pointer-events-none" />
      )}

      {/* Layer 2: Floating Game UI Safe Zone (Scrolls cleanly on tiny screens) */}
      <div className="relative z-20 w-full min-h-[100dvh] safe-insets flex flex-col justify-between pointer-events-none">
        <div className="w-full flex-1 flex flex-col justify-between p-3 short:p-2.5 sm:tall:p-4 lg:tall:p-6">
          {/* TOP BAR: Game Crest + Utility Controls */}
          <header className="w-full flex items-start justify-between gap-2 sm:gap-3 pointer-events-auto">
            {/* Left: Game Crest */}
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="px-1.5 sm:px-2 py-0.5 bg-cyan-400 text-slate-950 font-black text-[9px] sm:text-xs italic tracking-wider -skew-x-12 shrink-0">
                  <span className="inline-block skew-x-12">OMEGA</span>
                </span>
                <h1 className="text-base xs:text-lg sm:text-2xl lg:text-3xl font-black italic tracking-tight text-white drop-shadow-[0_0_18px_rgba(0,240,255,0.45)] truncate">
                  AERO<span className="text-cyan-400">STRIKE</span>
                </h1>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1 text-[9px] sm:text-[10px] font-mono text-cyan-300/80 uppercase tracking-widest flex-wrap">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span className="truncate">
                  {isHolodeck ? 'PROJECT HOLODECK // 3D TACTICAL FPS' : 'ORBITAL HANGAR // 2D P2P CTF'}
                </span>
                <PwaOfflinePill />
              </div>
            </div>

            {/* Center Pill: Dimension Mode Switcher (2D OMEGA vs 3D HOLODECK) */}
            <div className="flex items-center bg-slate-950/90 border border-slate-700/80 p-0.5 sm:p-1 rounded-lg font-mono text-[10px] sm:text-xs shadow-2xl pointer-events-auto">
              <button
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  setMatchRules({ ...matchRules, mode: 'ctf' });
                  selectMap('ctf-canyon-arena');
                }}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded font-black uppercase transition-all flex items-center gap-1 sm:gap-1.5 cursor-pointer ${
                  !isHolodeck
                    ? 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_#06b6d4]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Rocket className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>2D Omega</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  setMatchRules({ ...matchRules, mode: 'holodeck' });
                  selectMap('holodeck-alpha');
                }}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded font-black uppercase transition-all flex items-center gap-1 sm:gap-1.5 cursor-pointer ${
                  isHolodeck
                    ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-[0_0_10px_#f43f5e]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Box className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-300" />
                <span>3D Holodeck</span>
                <span className="text-[8px] sm:text-[9px] bg-rose-950/90 text-rose-300 px-1 py-0.2 rounded border border-rose-500/50">FPS</span>
              </button>
            </div>

            {/* Right: Install PWA, Music, Audio Mute & Full Settings Screen Button */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <PwaInstallButton compact />
              <button
                onClick={() => {
                  updateSettings({ musicEnabled: !musicEnabled });
                  sounds.playUiClick();
                }}
                className={`p-2 sm:tall:p-2.5 bg-slate-950/80 hover:bg-slate-900 border transition cursor-pointer clip-chamfer ${
                  musicEnabled
                    ? 'border-cyan-500/40 text-cyan-300 hover:border-cyan-400'
                    : 'border-slate-700/80 text-slate-500 hover:text-slate-300'
                }`}
                title={musicEnabled ? 'Mute Background Music' : 'Enable Background Music'}
                aria-label={musicEnabled ? 'Mute Background Music' : 'Enable Background Music'}
              >
                <Music className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  toggleMute();
                }}
                className="p-2 sm:tall:p-2.5 bg-slate-950/80 hover:bg-slate-900 border border-slate-700/80 hover:border-cyan-400/50 text-slate-200 transition cursor-pointer clip-chamfer"
                title={isMuted ? 'Unmute SFX' : 'Mute SFX'}
                aria-label={isMuted ? 'Unmute SFX' : 'Mute SFX'}
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
                aria-label="Settings"
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 xs:px-3 sm:tall:px-3.5 py-2 sm:tall:py-2.5 bg-slate-950/85 hover:bg-slate-900 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 hover:text-white text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer clip-chamfer glow-cyan"
              >
                <Settings className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="hidden xs:inline">Settings</span>
              </button>
            </div>
          </header>

          {/* BOTTOM / STAGE AREA: Minimal Pilot Tag (Left) + Deploy Stack (Right) */}
          <div className="w-full flex flex-col short-wide:flex-row sm:flex-row short-wide:items-end sm:items-end justify-between gap-2.5 sm:gap-4 mt-auto pt-4 sm:pt-0">
            {/* Left Stage Identity Badge */}
            <div className="flex flex-col items-start gap-1.5 pointer-events-none">
              <div className="flex items-center gap-2.5 bg-slate-950/75 backdrop-blur-md border border-cyan-500/30 px-3 py-1.5 short:py-1 sm:tall:px-3.5 sm:tall:py-2 clip-chamfer">
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

              <span className="inline-block text-[9px] sm:text-[10px] font-mono text-slate-500 tracking-wider">
                {isCoarsePointer
                  ? 'DRAG BAY TO AIM • TAP TO TEST-FIRE'
                  : 'MOVE CURSOR TO AIM • CLICK BAY TO TEST-FIRE'}
              </span>
            </div>

            {/* Right Action Cluster: Secondary Modes + Primary DEPLOY CTA */}
            <div className="w-full short-wide:w-[270px] sm:tall:w-[270px] md:tall:w-[310px] lg:tall:w-[340px] flex flex-col gap-1.5 sm:tall:gap-2 lg:tall:gap-2.5 pointer-events-auto">
              {/* Direct Invite Banner (when opened via ?room= link before enlistment) */}
              {invitedRoomCode && (
                <button
                  onClick={handleInvitedJoin}
                  className="w-full py-2.5 short:py-2 lg:tall:py-3 px-3.5 lg:tall:px-4 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-xs uppercase tracking-widest clip-chamfer shadow-xl cursor-pointer flex items-center justify-between transition"
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

              {/* Offline P2P Notice */}
              {!isOnline && offlineWarning && (
                <div className="px-3 py-1.5 bg-amber-950/85 border border-amber-400/60 text-amber-200 text-[10px] font-mono clip-chamfer flex items-center gap-2">
                  <WifiOff className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span>{offlineWarning}</span>
                </div>
              )}

              {/* Secondary Row: Join Squad & Solo Practice */}
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                <button
                  onClick={() => {
                    sounds.playUiClick();
                    if (!isOnline) {
                      setOfflineWarning('Offline — Solo Skirmish works offline. Reconnect to join P2P rooms.');
                      return;
                    }
                    setOfflineWarning(null);
                    setShowJoinModal(true);
                  }}
                  className="py-2 short:py-1.5 lg:tall:py-3 px-2.5 lg:tall:px-3 bg-slate-950/85 hover:bg-slate-900 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 hover:text-white font-mono font-bold text-[11px] lg:text-xs uppercase tracking-wider clip-chamfer transition cursor-pointer flex items-center justify-center gap-1.5 lg:gap-2"
                >
                  <QrCode className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-cyan-400 shrink-0" />
                  <span>Join / QR</span>
                </button>

                <button
                  onClick={handleSoloOpen}
                  className="py-2 short:py-1.5 lg:tall:py-3 px-2.5 lg:tall:px-3 bg-slate-950/85 hover:bg-emerald-950/60 border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 hover:text-white font-mono font-bold text-[11px] lg:text-xs uppercase tracking-wider clip-chamfer transition cursor-pointer flex items-center justify-center gap-1.5 lg:gap-2"
                  title="Configure and deploy into offline AI capture-the-flag skirmish"
                >
                  <Gamepad2 className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-emerald-400 shrink-0" />
                  <span>Solo Skirmish</span>
                </button>
              </div>

              {/* Primary Hero DEPLOY Button */}
              <button
                onClick={handleCreateRoom}
                className={`w-full py-2.5 short:py-2 lg:tall:py-4 px-3 xs:px-4 lg:tall:px-6 font-black text-xs sm:text-sm lg:tall:text-base uppercase tracking-[0.12em] xs:tracking-[0.15em] lg:tall:tracking-[0.2em] clip-chamfer-lg shadow-2xl transition-all cursor-pointer flex items-center justify-center gap-2 lg:gap-2.5 group whitespace-nowrap ${
                  isHolodeck
                    ? 'bg-gradient-to-r from-rose-500 via-amber-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 text-white shadow-rose-950/80 glow-rose'
                    : 'bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 glow-cyan shadow-cyan-950/80'
                }`}
              >
                {isHolodeck ? (
                  <>
                    <Box className="w-4 h-4 lg:tall:w-5 lg:tall:h-5 shrink-0 group-hover:rotate-12 transition-transform text-white" />
                    <span>Host 3D Match // War Room</span>
                    <Play className="w-3.5 h-3.5 lg:tall:w-4 lg:tall:h-4 shrink-0 fill-white" />
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4 lg:tall:w-5 lg:tall:h-5 shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    <span>Deploy // Host Match</span>
                    <Play className="w-3.5 h-3.5 lg:tall:w-4 lg:tall:h-4 shrink-0 fill-slate-950" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* JOIN SQUAD MODAL (Code Input + Camera QR Scanner) */}
      <JoinSquadModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onJoinRoomCode={handleJoinRoomCode}
      />

      {/* HOST MATCH CONFIG MODAL */}
      {showHostModal && (
        <HostMatchModal
          isOpen
          is3DMode={isHolodeck}
          onClose={() => setShowHostModal(false)}
          onConfirmHost={handleConfirmHostRoom}
        />
      )}

      {/* SOLO SKIRMISH CONFIG MODAL */}
      {showSoloModal && (
        <SoloSkirmishModal
          isOpen
          is3DMode={isHolodeck}
          onClose={() => setShowSoloModal(false)}
          onDeploy={handleSoloDeploy}
        />
      )}
    </div>
  );
}
