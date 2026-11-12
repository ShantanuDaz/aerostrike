import { useEffect, useState } from "react";
import { useNetworkStore } from "../network/networkStore";
import { networkManager } from "../network/peerRoom";
import { usePlayerStore } from "../player/playerStore";
import { useMapStore } from "../map/mapStore";
import { useAvatarStore, DEFAULT_AVATAR } from "../avatar/avatarStore";
import { useSettingsStore } from "../settings/settingsStore";
import { sounds } from "../audio/soundEngine";
import { useCTFStore } from "../ctf/ctfStore";
import type { MatchRulesConfig, Team } from "../ctf/types";
import { RoomQRCodeModal } from "../ui/RoomQRCodeModal";
import { isNativeShareSupported, shareRoomInvite } from "../pwa";
import { VoiceMicButton, WarRoomCommsPanel } from "../comms/CommsPanel";
import { DropBayStageCanvas } from "./warRoom/DropBayStageCanvas";
import { MapSchematicPreview } from "./warRoom/MapSchematicPreview";
import {
  JoinRejectedModal,
  MatchRulesModal,
  SquadRosterModal,
  TheaterSelectModal,
} from "./warRoom/WarRoomModals";
import { WarRoomArmoryModal } from "./warRoom/WarRoomArmoryModal";
import {
  deriveWarRoomSquad,
  formatClockPreset,
  getCleanMapTitle,
} from "./warRoom/warRoomUtils";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  Flag,
  Lock,
  Map as MapIcon,
  Music,
  Play,
  QrCode,
  RefreshCw,
  Rocket,
  Share2,
  SlidersHorizontal,
  Users,
  Volume2,
  VolumeX,
  WifiOff,
  Wrench,
} from "lucide-react";

interface WarRoomScreenProps {
  onStartMatch: () => void;
  onLeaveRoom: () => void;
}

export function WarRoomScreen({
  onStartMatch,
  onLeaveRoom,
}: WarRoomScreenProps) {
  const roomCode = useNetworkStore((s) => s.roomCode);
  const selfPeerId = useNetworkStore((s) => s.selfPeerId);
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
  const [localReadyFallback, setLocalReadyFallback] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showArmoryModal, setShowArmoryModal] = useState(false);
  const [confirmUnreadyLaunch, setConfirmUnreadyLaunch] = useState(false);

  const isCoarsePointer =
    typeof window !== "undefined" &&
    Boolean(window.matchMedia?.("(pointer: coarse)").matches);

  // Close overlays with Escape
  useEffect(() => {
    if (!showMapModal && !showRosterModal && !showRulesModal) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowMapModal(false);
        setShowRosterModal(false);
        setShowRulesModal(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [showMapModal, showRosterModal, showRulesModal]);

  const {
    localIsReady: isReady,
    blueMembers,
    redMembers,
    totalPlayers,
    readyCount,
  } = deriveWarRoomSquad({
    roster,
    peers,
    localPlayerId,
    selfPeerId,
    localAvatar,
    localTeam,
    localReadyFallback,
    isHost,
    gamePhase,
    defaultAvatar: DEFAULT_AVATAR,
  });

  const handleCopyLink = () => {
    sounds.playUiClick();
    const link = `${window.location.origin}${window.location.pathname}?room=${roomCode || ""}`;
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

  const handleNativeShare = () => {
    sounds.playUiClick();
    if (!roomCode) return;
    void shareRoomInvite(roomCode).then((result) => {
      if (result === "copied") {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    });
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
    setLocalReadyFallback(next);
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

  const showUnreadyConfirm =
    confirmUnreadyLaunch && totalPlayers > 1 && readyCount < totalPlayers;

  const handleLaunchMission = () => {
    const unreadyCount = Math.max(0, totalPlayers - readyCount);
    if (totalPlayers > 1 && unreadyCount > 0 && !confirmUnreadyLaunch) {
      sounds.playUiClick();
      setConfirmUnreadyLaunch(true);
      return;
    }
    setConfirmUnreadyLaunch(false);
    sounds.playUiClick();
    usePlayerStore.getState().spawnAtTeamBase(selectedMap, localPlayerId);
    networkManager.broadcastStartMatch(selectedMap.id);
    onStartMatch();
  };

  return (
    <div className="relative w-full min-h-[100dvh] overflow-x-hidden bg-[#060913] text-slate-100 select-none">
      {/* Layer 0: Unobstructed Dual-Bay Hangar Canvas */}
      <DropBayStageCanvas
        blueMembers={blueMembers}
        redMembers={redMembers}
        localPlayerId={localPlayerId}
        defaultWeapon={defaultWeapon}
        localTeam={localTeam}
      />

      {/* CRT Scanline Overlay */}
      {crtScanlines && (
        <div className="fixed inset-0 scanline-overlay z-10 pointer-events-none" />
      )}

      {/* Layer 2: Minimal Game Perimeter HUD */}
      <div className="relative z-20 w-full min-h-[100dvh] safe-insets flex flex-col justify-between pointer-events-none">
        <div className="w-full flex-1 flex flex-col justify-between gap-2 short:gap-1 p-2.5 short:p-2 sm:tall:p-4 lg:tall:p-5">
          {/* TOP STRIP */}
          <div className="w-full flex flex-col gap-1.5 sm:tall:gap-2 pointer-events-auto">
            <header className="w-full flex items-center justify-between gap-1.5 sm:gap-2">
              {/* Left: Leave + War Room Tag */}
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    onLeaveRoom();
                  }}
                  className="flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 bg-slate-950/85 hover:bg-rose-950/70 text-slate-200 hover:text-rose-200 border border-slate-700/80 hover:border-rose-500/60 transition cursor-pointer text-xs font-mono font-bold clip-chamfer shrink-0"
                  title="Leave War Room"
                  aria-label="Leave War Room"
                >
                  <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" />
                  <span className="hidden sm:inline">Leave</span>
                </button>

                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <span className="hidden xs:inline-block px-1.5 sm:px-2 py-0.5 bg-cyan-400 text-slate-950 font-black text-[9px] sm:text-xs italic tracking-wider -skew-x-12 shrink-0">
                    <span className="inline-block skew-x-12">WAR ROOM</span>
                  </span>
                  <span className="text-xs xs:text-sm sm:text-lg font-black text-white font-mono tracking-wider sm:tracking-widest truncate">
                    {roomCode}
                  </span>
                  <span
                    className={`hidden sm:inline-block text-[9px] font-mono font-bold px-1.5 py-0.5 uppercase tracking-wider shrink-0 ${
                      isHost
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/45"
                        : "bg-slate-950/85 text-slate-300 border border-slate-700"
                    }`}
                  >
                    {isHost ? "HOST" : "CADET"}
                  </span>
                </div>
              </div>

              {/* Right: Armory + Copy + QR + Music + Mute */}
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    setShowArmoryModal(true);
                  }}
                  className="flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-2 bg-slate-950/85 hover:bg-slate-900 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 hover:text-white text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer clip-chamfer"
                  title="Customize Pilot, Weapon, Zoom & Controls"
                  aria-label="Armory & Settings"
                >
                  <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">Armory</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-2 bg-slate-950/85 hover:bg-slate-900 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 hover:text-white text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer clip-chamfer"
                  title="Copy Invite Link"
                  aria-label="Copy Invite Link"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                  <span className="hidden md:inline">
                    {copied ? "Copied!" : "Copy Link"}
                  </span>
                </button>

                {isNativeShareSupported() && (
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-2 bg-slate-950/85 hover:bg-slate-900 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 hover:text-white text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer clip-chamfer"
                    title="Share Invite via System Sheet"
                    aria-label="Share Invite"
                  >
                    <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="hidden lg:inline">Share</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    setShowQRModal(true);
                  }}
                  className="flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-2 bg-slate-950/85 hover:bg-slate-900 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 hover:text-white text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer clip-chamfer glow-cyan"
                  title="Show Squad Uplink QR Code"
                  aria-label="Show Squad Uplink QR Code"
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
                    musicEnabled
                      ? "border-cyan-500/40 text-cyan-300 hover:border-cyan-400"
                      : "border-slate-700/80 text-slate-500 hover:text-slate-300"
                  }`}
                  title={
                    musicEnabled
                      ? "Mute Background Music"
                      : "Enable Background Music"
                  }
                  aria-label={
                    musicEnabled
                      ? "Mute Background Music"
                      : "Enable Background Music"
                  }
                >
                  <Music className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => toggleMute()}
                  className="p-1.5 sm:p-2 bg-slate-950/85 hover:bg-slate-900 border border-slate-700/80 hover:border-cyan-400/50 text-slate-200 transition cursor-pointer clip-chamfer"
                  title={isMuted ? "Unmute SFX" : "Mute SFX"}
                  aria-label={isMuted ? "Unmute SFX" : "Mute SFX"}
                >
                  {isMuted ? (
                    <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                  )}
                </button>

                <VoiceMicButton />
              </div>
            </header>

            {/* Faction Switcher + Rules & Roster Triggers */}
            <div className="w-full flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
              <div className="flex items-center gap-1 sm:gap-2 bg-slate-950/75 backdrop-blur-md border border-slate-800/90 p-0.5 sm:p-1 clip-chamfer">
                <button
                  type="button"
                  onClick={() => handleSelectTeam("blue")}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 xs:px-2.5 sm:px-3.5 py-1 text-[10px] sm:text-xs font-mono font-black uppercase tracking-wider transition clip-chamfer ${
                    localTeam === "blue"
                      ? "bg-cyan-500/25 border border-cyan-400 text-cyan-200 glow-cyan cursor-default"
                      : "bg-slate-900/70 hover:bg-blue-950/60 border border-transparent text-slate-400 hover:text-cyan-200 cursor-pointer"
                  }`}
                >
                  <Flag className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span>Blue</span>
                  <span className="px-1 xs:px-1.5 py-0.5 bg-blue-950 text-cyan-300 text-[9px]">
                    {blueMembers.length}
                  </span>
                </button>

                <span className="text-[9px] font-mono font-bold text-slate-600 px-0.5">
                  VS
                </span>

                <button
                  type="button"
                  onClick={() => handleSelectTeam("red")}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 xs:px-2.5 sm:px-3.5 py-1 text-[10px] sm:text-xs font-mono font-black uppercase tracking-wider transition clip-chamfer ${
                    localTeam === "red"
                      ? "bg-rose-500/25 border border-rose-400 text-rose-200 glow-red cursor-default"
                      : "bg-slate-900/70 hover:bg-rose-950/60 border border-transparent text-slate-400 hover:text-rose-200 cursor-pointer"
                  }`}
                >
                  <Flag className="w-3 h-3 text-rose-400 shrink-0" />
                  <span>Red</span>
                  <span className="px-1 xs:px-1.5 py-0.5 bg-rose-950 text-rose-300 text-[9px]">
                    {redMembers.length}
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    setShowRulesModal(true);
                  }}
                  className="flex items-center gap-1 sm:gap-1.5 px-2 xs:px-2.5 sm:px-3 py-1.5 bg-slate-950/80 hover:bg-slate-900 border border-slate-700/80 hover:border-amber-400/60 text-slate-200 hover:text-white text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider clip-chamfer transition cursor-pointer"
                  title={
                    isHost ? "Configure Match Rules" : "View Active Match Rules"
                  }
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>FT{matchRules.targetCaptures}</span>
                  <span className="hidden md:inline text-slate-400">
                    • {formatClockPreset(matchRules.timeLimitSec)} •{" "}
                    {matchRules.respawnDelaySec}s
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    setShowRosterModal(true);
                  }}
                  className="flex items-center gap-1 sm:gap-1.5 px-2 xs:px-2.5 sm:px-3 py-1.5 bg-slate-950/80 hover:bg-slate-900 border border-slate-700/80 hover:border-cyan-400/50 text-slate-200 hover:text-white text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider clip-chamfer transition cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Squad {totalPlayers}</span>
                  <span className="hidden sm:inline text-emerald-400">
                    ({readyCount}/{totalPlayers} Ready)
                  </span>
                </button>
              </div>
            </div>

            {!isHost && hostSignalLost && !isJoinRejected && (
              <div className="w-full bg-amber-950/90 border border-amber-400/70 text-amber-100 px-3 py-1.5 sm:py-2 clip-chamfer backdrop-blur-md shadow-lg flex flex-wrap items-center justify-between gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="flex items-center gap-2 min-w-0">
                  <WifiOff className="w-4 h-4 text-amber-300 shrink-0 animate-pulse" />
                  <div className="text-[10px] sm:text-xs font-mono leading-snug">
                    <span className="font-black uppercase tracking-wider text-amber-200">
                      Host Signal Lost • Reconnecting
                      {hostReconnectAttempts > 0
                        ? ` (#${hostReconnectAttempts})`
                        : "..."}
                    </span>
                    <span className="hidden sm:inline text-amber-200/80 ml-2">
                      {hostDisconnectReason ||
                        "Host uplink dropped or offline."}
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

          {/* CENTER STAGE SPACER */}
          <div className="flex-1 min-h-[48px] short:min-h-[24px] sm:tall:min-h-[100px] pointer-events-none" />

          {/* SQUAD COMMS (TEXT, QUICK EMOJIS & VOICE STATUS) */}
          <div className="w-full flex justify-start">
            <WarRoomCommsPanel />
          </div>

          {/* BOTTOM DOCK */}
          <footer className="w-full flex flex-col short-wide:flex-row sm:flex-row short-wide:items-end sm:items-end justify-between gap-2 sm:gap-3 pointer-events-auto">
            <button
              type="button"
              onClick={() => {
                sounds.playUiClick();
                setShowMapModal(true);
              }}
              className="w-full short-wide:w-auto sm:w-auto short-wide:min-w-0 short-wide:flex-1 sm:tall:min-w-[235px] lg:tall:min-w-[300px] lg:tall:flex-none bg-slate-950/85 hover:bg-slate-900/95 backdrop-blur-md border border-cyan-500/40 hover:border-cyan-400 p-2 short:p-1.5 lg:tall:p-2.5 clip-chamfer flex items-center justify-between gap-2.5 sm:gap-3 transition cursor-pointer text-left glow-cyan group"
            >
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <MapSchematicPreview map={selectedMap} isSelected size="mini" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-cyan-400 uppercase tracking-widest">
                    <MapIcon className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      {isHost ? "Theater • Tap to Change" : "Active Theater"}
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm font-black text-white truncate">
                    {getCleanMapTitle(selectedMap)}
                  </div>
                  <div className="text-[9px] font-mono text-slate-400 truncate">
                    {selectedMap.width}×{selectedMap.height} •{" "}
                    {selectedMap.weaponSpawns.length} Crates
                    {(selectedMap.bouncePads?.length ?? 0) > 0
                      ? ` • ${selectedMap.bouncePads!.length} Pads`
                      : ""}
                    {(selectedMap.refillStations?.length ?? 0) > 0
                      ? ` • ${selectedMap.refillStations!.length} Stations`
                      : ""}
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

            <div className="w-full short-wide:w-auto sm:w-auto short-wide:shrink-0 sm:tall:min-w-[240px] lg:tall:min-w-[330px] flex flex-row lg:tall:flex-col items-stretch gap-2">
              <span className="hidden sm:block text-[9px] lg:tall:text-[10px] font-mono text-slate-500 tracking-wider text-right">
                {isCoarsePointer
                  ? "DRAG BAY TO AIM • TAP TO TEST-FIRE"
                  : "MOVE CURSOR TO AIM • CLICK BAY TO TEST-FIRE"}
              </span>

              <button
                type="button"
                onClick={handleToggleReady}
                className={`shrink-0 lg:tall:w-full px-2.5 xs:px-3 py-2 short:py-1.5 bg-slate-950/85 backdrop-blur-md border transition cursor-pointer flex items-center justify-between gap-1.5 xs:gap-2 text-[10px] sm:text-xs font-mono font-black uppercase tracking-wider clip-chamfer ${
                  isReady
                    ? "border-emerald-400/60 text-emerald-300 hover:bg-emerald-950/40"
                    : "border-amber-400/60 text-amber-300 hover:bg-amber-950/40"
                }`}
                title="Toggle Ready status"
              >
                <span className="flex items-center gap-1.5">
                  {isReady && (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>{isReady ? "Ready" : "Standby"}</span>
                </span>
                <span className="hidden lg:tall:inline text-[10px] text-slate-400 font-normal">
                  {readyCount}/{totalPlayers} Squad Ready
                </span>
              </button>

              {isHost ? (
                showUnreadyConfirm ? (
                  <div className="flex-1 lg:tall:w-full flex items-stretch gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        sounds.playUiClick();
                        setConfirmUnreadyLaunch(false);
                      }}
                      className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px] sm:text-xs font-bold uppercase clip-chamfer cursor-pointer"
                    >
                      Wait
                    </button>
                    <button
                      type="button"
                      onClick={handleLaunchMission}
                      className="flex-1 py-2.5 short:py-1.5 px-3 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-[11px] sm:text-xs uppercase tracking-wider clip-chamfer-lg shadow-xl cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <Rocket className="w-4 h-4 shrink-0" />
                      <span>
                        Launch ({totalPlayers - readyCount} Standby)?
                      </span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleLaunchMission}
                    className="flex-1 lg:tall:w-full py-2.5 short:py-1.5 lg:tall:py-3.5 px-2.5 xs:px-3.5 sm:px-4 lg:tall:px-6 bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-xs sm:text-sm lg:tall:text-base uppercase tracking-[0.08em] xs:tracking-[0.12em] sm:tracking-[0.15em] clip-chamfer-lg shadow-2xl shadow-cyan-950/80 transition-all cursor-pointer flex items-center justify-center gap-1.5 xs:gap-2 glow-cyan group whitespace-nowrap"
                  >
                    <Rocket className="w-4 h-4 lg:tall:w-5 lg:tall:h-5 shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    <span>Launch Mission</span>
                    {totalPlayers > 1 && readyCount < totalPlayers && (
                      <span className="px-1.5 py-0.5 bg-amber-950/75 text-amber-200 border border-amber-400/50 text-[9px] font-mono rounded">
                        {totalPlayers - readyCount} Wait
                      </span>
                    )}
                    <Play className="w-3.5 h-3.5 lg:tall:w-4 lg:tall:h-4 shrink-0 fill-slate-950" />
                  </button>
                )
              ) : hostSignalLost ? (
                <div className="flex-1 lg:tall:w-full py-2.5 short:py-1.5 lg:tall:py-3 px-4 bg-amber-950/75 border border-amber-400/60 text-amber-200 font-mono font-bold text-[10px] sm:text-xs uppercase tracking-widest clip-chamfer-lg flex items-center justify-center gap-2">
                  <WifiOff className="w-3.5 h-3.5 text-amber-300 shrink-0 animate-pulse" />
                  <span className="truncate">
                    Host Signal Lost • Reconnecting...
                  </span>
                </div>
              ) : gamePhase === "in_game" ? (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    onStartMatch();
                  }}
                  className="flex-1 lg:tall:w-full py-2.5 short:py-1.5 lg:tall:py-3.5 px-2.5 xs:px-3.5 sm:px-4 lg:tall:px-6 bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-xs sm:text-sm lg:tall:text-base uppercase tracking-[0.08em] xs:tracking-[0.12em] sm:tracking-[0.15em] clip-chamfer-lg shadow-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 xs:gap-2 glow-cyan whitespace-nowrap"
                >
                  <Play className="w-4 h-4 shrink-0 fill-slate-950" />
                  <span>Rejoin Battle</span>
                </button>
              ) : (
                <div className="flex-1 lg:tall:w-full py-2.5 short:py-1.5 lg:tall:py-3 px-4 bg-cyan-950/60 border border-cyan-500/45 text-cyan-200 font-mono font-bold text-[10px] sm:text-xs uppercase tracking-widest clip-chamfer-lg flex items-center justify-center gap-2 glow-cyan">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
                  <span className="truncate">Awaiting Host...</span>
                </div>
              )}
            </div>
          </footer>
        </div>
      </div>

      <TheaterSelectModal
        isOpen={showMapModal}
        isHost={isHost}
        selectedMap={selectedMap}
        availableMaps={availableMaps}
        onSelectMap={handleSelectMap}
        onClose={() => setShowMapModal(false)}
      />

      <SquadRosterModal
        isOpen={showRosterModal}
        totalPlayers={totalPlayers}
        readyCount={readyCount}
        blueMembers={blueMembers}
        redMembers={redMembers}
        localPlayerId={localPlayerId}
        localTeam={localTeam}
        localIsReady={isReady}
        onToggleReady={handleToggleReady}
        onSelectTeam={handleSelectTeam}
        onClose={() => setShowRosterModal(false)}
      />

      <MatchRulesModal
        isOpen={showRulesModal}
        isHost={isHost}
        matchRules={matchRules}
        onUpdateRules={handleUpdateRules}
        onClose={() => setShowRulesModal(false)}
      />

      <RoomQRCodeModal
        isOpen={showQRModal}
        roomCode={roomCode || ""}
        onClose={() => setShowQRModal(false)}
      />

      <JoinRejectedModal
        isOpen={isJoinRejected}
        rejectionReason={rejectionReason}
        onLeaveRoom={onLeaveRoom}
      />

      {showArmoryModal && (
        <WarRoomArmoryModal
          isOpen
          onClose={() => setShowArmoryModal(false)}
        />
      )}
    </div>
  );
}
