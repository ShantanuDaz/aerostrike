import { Suspense, lazy, useEffect, useState } from 'react';
import { MainMenuScreen } from './features/screens/MainMenuScreen';
import type { ScreenState } from './features/screens/types';
import { useMapStore } from './features/map/mapStore';
import { networkManager } from './features/network/peerRoom';
import { useNetworkStore } from './features/network/networkStore';
import { buildActiveStations, engineWorld } from './features/game/engineWorld';
import { useAvatarStore } from './features/avatar/avatarStore';
import { usePlayerStore } from './features/player/playerStore';
import { useCTFStore } from './features/ctf/ctfStore';
import { useCombatStore } from './features/combat/combatStore';
import { useMatchStatsStore } from './features/combat/statsStore';
import { useSettingsStore, type SettingsTab } from './features/settings/settingsStore';
import { sounds } from './features/audio/soundEngine';
import { music } from './features/audio/musicEngine';
import { isMobileDevice, requestMobileFullscreen } from './features/controls/mobileFullscreen';
import type { Team } from './features/ctf/types';

const SettingsScreen = lazy(() =>
  import('./features/screens/SettingsScreen').then((m) => ({ default: m.SettingsScreen })),
);
const ConnectingScreen = lazy(() =>
  import('./features/screens/ConnectingScreen').then((m) => ({ default: m.ConnectingScreen })),
);
const WarRoomScreen = lazy(() =>
  import('./features/screens/WarRoomScreen').then((m) => ({ default: m.WarRoomScreen })),
);
const GameCanvas = lazy(() =>
  import('./features/game/GameCanvas').then((m) => ({ default: m.GameCanvas })),
);
const HUD = lazy(() =>
  import('./features/ui/HUD').then((m) => ({ default: m.HUD })),
);
const GameOverModal = lazy(() =>
  import('./features/ui/GameOverModal').then((m) => ({ default: m.GameOverModal })),
);

function ScreenLoadingFallback({ label }: { label: string }) {
  return (
    <div className="fixed inset-0 bg-[#060913] text-cyan-300 flex flex-col items-center justify-center gap-3 font-mono select-none">
      <div className="w-10 h-10 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
      <span className="text-xs uppercase tracking-[0.2em] font-bold text-cyan-300/90">
        {label}
      </span>
    </div>
  );
}

function getInitialRoomParam(): string | null {
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  return roomParam ? roomParam.trim().toUpperCase() : null;
}

export const App = () => {
  const isEnlisted = useAvatarStore((s) => s.isEnlisted);
  const selectedMap = useMapStore((s) => s.selectedMap);
  const initMatch = useCTFStore((s) => s.initMatch);
  const matchStatus = useCTFStore((s) => s.matchStatus);
  const crtScanlines = useSettingsStore((s) => s.crtScanlines);

  const [invitedRoom, setInvitedRoom] = useState<string | null>(getInitialRoomParam);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('avatar');

  // Land directly on the Orbital Hangar Stage (or auto-connect if returning via ?room= invite)
  const [screen, setScreen] = useState<ScreenState>(() => {
    const roomParam = getInitialRoomParam();
    if (roomParam && isEnlisted) {
      return 'connecting';
    }
    return 'main_menu';
  });

  // Mobile-only: keep the whole application in fullscreen from launch and across interactions
  useEffect(() => {
    if (!isMobileDevice()) return;

    requestMobileFullscreen();

    const ensureFullscreen = () => {
      requestMobileFullscreen();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestMobileFullscreen();
      }
    };

    window.addEventListener('touchend', ensureFullscreen, { capture: true, passive: true });
    window.addEventListener('click', ensureFullscreen, { capture: true, passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('touchend', ensureFullscreen, { capture: true });
      window.removeEventListener('click', ensureFullscreen, { capture: true });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Adaptive procedural background music per screen & match state
  useEffect(() => {
    if (screen === 'connecting') {
      music.setTrack('connecting');
    } else if (screen === 'war_room') {
      music.setTrack('war_room');
    } else if (screen === 'in_game') {
      music.setTrack(matchStatus === 'game_over' ? 'victory' : 'combat');
    } else {
      music.setTrack('landing');
    }
  }, [screen, matchStatus]);

  // Auto-connect to invited room once enlisted (only if not already initialized for that room)
  useEffect(() => {
    if (invitedRoom && isEnlisted) {
      const currentRoom = useNetworkStore.getState().roomCode;
      if (currentRoom !== invitedRoom) {
        networkManager.connect(invitedRoom, false);
      }
    }
  }, [invitedRoom, isEnlisted]);

  // Listen for Host match control signals over PeerJS WebRTC
  useEffect(() => {
    networkManager.setOnStartMatch((mapId: string) => {
      const mapStore = useMapStore.getState();
      const targetMap = mapStore.availableMaps[mapId] ?? mapStore.selectedMap;
      mapStore.selectMap(mapId);
      useMatchStatsStore.getState().resetStats();
      useCombatStore.getState().initLoadout(useSettingsStore.getState().defaultWeapon);
      usePlayerStore.getState().spawnAtTeamBase(targetMap, useAvatarStore.getState().playerId);
      useCTFStore.getState().prepareClientArena(targetMap);
      setScreen('in_game');
    });

    networkManager.setOnReturnToStaging(() => {
      sounds.setJetpackBoosting(false);
      useMatchStatsStore.getState().resetStats();
      setScreen('war_room');
    });

    networkManager.setOnRejoinMatch((mapId: string, team?: Team) => {
      if (team) {
        usePlayerStore.getState().setTeam(team);
      }
      const mapStore = useMapStore.getState();
      const targetMap = mapStore.availableMaps[mapId] ?? mapStore.selectedMap;
      mapStore.selectMap(mapId);
      const stats = useMatchStatsStore.getState();
      stats.resetStats();
      useCombatStore.getState().initLoadout(useSettingsStore.getState().defaultWeapon);
      const myId = useAvatarStore.getState().playerId;
      usePlayerStore.getState().spawnAtTeamBase(targetMap, myId);
      const localP = usePlayerStore.getState().player;
      stats.registerParticipant(myId, localP.avatar.callsign, localP.team);
      for (const m of Object.values(useNetworkStore.getState().roster)) {
        stats.registerParticipant(m.playerId, m.callsign, m.team);
      }
      useCTFStore.getState().prepareClientArena(targetMap);
      setScreen('in_game');
    });

    networkManager.setOnRematch((mapId: string) => {
      const mapStore = useMapStore.getState();
      const targetMap = mapStore.availableMaps[mapId] ?? mapStore.selectedMap;
      mapStore.selectMap(mapId);
      engineWorld.resetWorldForMatch(
        (targetMap.weaponSpawns || []).map((ws) => ({
          id: ws.id,
          x: ws.x,
          y: ws.y,
          weaponType: ws.weaponType,
          respawnTimer: 0,
        })),
        true,
        buildActiveStations(targetMap),
      );
      const stats = useMatchStatsStore.getState();
      stats.resetStats();
      useCombatStore.getState().initLoadout(useSettingsStore.getState().defaultWeapon);
      const myId = useAvatarStore.getState().playerId;
      usePlayerStore.getState().spawnAtTeamBase(targetMap, myId);
      const localP = usePlayerStore.getState().player;
      stats.registerParticipant(myId, localP.avatar.callsign, localP.team);
      for (const m of Object.values(useNetworkStore.getState().roster)) {
        stats.registerParticipant(m.playerId, m.callsign, m.team);
      }
      useCTFStore.getState().prepareClientArena(targetMap);
    });
  }, []);

  // Screen Navigation Callbacks
  const handleOpenSettings = (tab: SettingsTab = 'avatar') => {
    setSettingsTab(tab);
    setScreen('settings');
  };

  const handleEnterWarRoom = (roomCode: string, isHost: boolean = false) => {
    setInvitedRoom(roomCode);
    if (isHost) {
      setScreen('war_room');
    } else {
      setScreen('connecting');
    }
  };

  const handleJoinInvitedRoom = (roomCode: string) => {
    setInvitedRoom(roomCode);
    const currentRoom = useNetworkStore.getState().roomCode;
    if (currentRoom !== roomCode) {
      networkManager.connect(roomCode, false);
    }
    setScreen('connecting');
  };

  const handleStartSoloPractice = () => {
    const currentMap = useMapStore.getState().selectedMap;
    useMatchStatsStore.getState().resetStats();
    useCombatStore.getState().initLoadout(useSettingsStore.getState().defaultWeapon);
    usePlayerStore.getState().spawnAtTeamBase(currentMap, useAvatarStore.getState().playerId);
    initMatch(currentMap);
    setScreen('in_game');
  };

  const handleStartMatch = () => {
    const currentMap = useMapStore.getState().selectedMap;
    useMatchStatsStore.getState().resetStats();
    useCombatStore.getState().initLoadout(useSettingsStore.getState().defaultWeapon);
    usePlayerStore.getState().spawnAtTeamBase(currentMap, useAvatarStore.getState().playerId);
    networkManager.setInActiveBattle(true);
    initMatch(currentMap);
    setScreen('in_game');
  };

  const handleExitActiveBattle = () => {
    sounds.setJetpackBoosting(false);
    engineWorld.clearSoloBots();
    useMatchStatsStore.getState().resetStats();
    const localPlayer = usePlayerStore.getState().player;

    const isNetworkMatch = Boolean(invitedRoom || useNetworkStore.getState().roomCode);
    if (isNetworkMatch) {
      if (useNetworkStore.getState().isHost) {
        networkManager.broadcastReturnToStaging();
      } else {
        if (localPlayer.carryingFlag) {
          const enemyTeam = localPlayer.team === 'blue' ? 'red' : 'blue';
          useCTFStore.getState().dropFlag(enemyTeam, localPlayer.x, localPlayer.y);
          networkManager.broadcastFlagEvent({
            action: 'drop',
            team: enemyTeam,
            x: localPlayer.x,
            y: localPlayer.y,
          });
        }
        networkManager.notifyLeaveBattle();
      }
      setScreen('war_room');
    } else {
      setScreen('main_menu');
    }
  };

  const handleLeaveWarRoom = () => {
    sounds.setJetpackBoosting(false);
    engineWorld.clearSoloBots();
    useMatchStatsStore.getState().resetStats();
    networkManager.disconnect();
    setInvitedRoom(null);
    try {
      const cleanUrl = `${window.location.origin}${window.location.pathname}`;
      window.history.replaceState(null, '', cleanUrl);
    } catch {
      // ignore restricted History API environments
    }
    setScreen('main_menu');
  };

  // --- SCREEN 1: ORBITAL HANGAR STAGE (MAIN MENU) ---
  if (screen === 'main_menu') {
    return (
      <MainMenuScreen
        invitedRoomCode={invitedRoom}
        onOpenSettings={handleOpenSettings}
        onEnterWarRoom={handleEnterWarRoom}
        onStartSoloPractice={handleStartSoloPractice}
        onJoinInvitedRoom={handleJoinInvitedRoom}
      />
    );
  }

  // --- SCREEN 2: SETTINGS & ARMORY ---
  if (screen === 'settings') {
    return (
      <Suspense fallback={<ScreenLoadingFallback label="Loading Armory..." />}>
        <SettingsScreen
          initialTab={settingsTab}
          onBack={() => setScreen('main_menu')}
        />
      </Suspense>
    );
  }

  // --- SCREEN 3: CONNECTING / SECURE UPLINK LOADING SCREEN ---
  if (screen === 'connecting') {
    return (
      <Suspense fallback={<ScreenLoadingFallback label="Initializing Uplink..." />}>
        <ConnectingScreen
          roomCode={invitedRoom || useNetworkStore.getState().roomCode || 'UNKNOWN'}
          onConnected={() => setScreen('war_room')}
          onCancel={handleLeaveWarRoom}
        />
      </Suspense>
    );
  }

  // --- SCREEN 4: WAR ROOM (PREPARING / STAGING PAGE) ---
  if (screen === 'war_room') {
    return (
      <Suspense fallback={<ScreenLoadingFallback label="Entering War Room..." />}>
        <WarRoomScreen
          onStartMatch={handleStartMatch}
          onLeaveRoom={handleLeaveWarRoom}
        />
      </Suspense>
    );
  }

  // --- SCREEN 5: IN-GAME (LIVE CTF MATCH) ---
  return (
    <Suspense fallback={<ScreenLoadingFallback label="Deploying Combat Arena..." />}>
      <div className="fixed inset-0 overflow-hidden touch-none select-none bg-[#060913]">
        {/* Scanline CRT overlay */}
        {crtScanlines && (
          <div className="absolute inset-0 scanline-overlay pointer-events-none z-10" />
        )}

        {/* Top Floating HUD */}
        <HUD onExitToWarRoom={handleExitActiveBattle} onAbortRoom={handleLeaveWarRoom} />

        {/* Full-bleed 60 FPS Game Canvas */}
        <GameCanvas map={selectedMap} />

        {/* Match Victory / Defeat Modal */}
        <GameOverModal onLeaveMatch={handleExitActiveBattle} />
      </div>
    </Suspense>
  );
};

export default App;
