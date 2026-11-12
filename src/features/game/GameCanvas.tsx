import { useEffect, useRef, useCallback } from 'react';
import type { GameMap } from '../map/types';
import {
  usePlayerStore,
  type RagdollInstance,
} from '../player';
import {
  CAMERA_ZOOM_STEP,
  clampCameraZoom,
  computeAutoCameraZoom,
  createCamera,
  screenToWorld,
  updateCamera,
  type Camera,
} from '../camera';
import {
  useCombatStore,
  useMatchStatsStore,
  type ActiveWeaponPickup,
  type WeaponType,
} from '../combat';
import { clearOptimisticClaims } from '../combat/optimisticClaims';
import { useCTFStore } from '../ctf';
import { useNetworkStore } from '../network/networkStore';
import { networkManager } from '../network/peerRoom';
import { useAvatarStore } from '../avatar/avatarStore';
import { MinimapView } from '../ui/MinimapView';
import { VirtualControls } from '../controls/VirtualControls';
import { useIsTouchHUD } from '../controls/useIsTouchHUD';
import { hapticShot } from '../controls/haptics';
import { sounds } from '../audio/soundEngine';
import { useSettingsStore } from '../settings/settingsStore';
import { useChatStore } from '../comms/chatStore';
import { buildActiveStations, engineWorld } from './engineWorld';
import { createArenaRenderScratch, renderArenaFrame } from './arenaRenderer';
import { createArenaSimState, stepArenaFrame } from './arenaSimulation';
import type { AttackerAttribution } from './combatHitProcessor';

interface GameCanvasProps {
  map: GameMap;
}

const WEAPON_KEYS: Record<string, WeaponType> = {
  Digit1: 'rifle',
  Digit2: 'shotgun',
  Digit3: 'sniper',
  Digit4: 'rocket',
  Digit5: 'pistol',
};

function getInitialZoom(w: number, h: number): number {
  const settings = useSettingsStore.getState();
  return settings.cameraZoomMode === 'custom'
    ? settings.cameraZoom
    : computeAutoCameraZoom(w, h);
}

function adjustZoomByDelta(delta: number, viewW: number, viewH: number): void {
  const settings = useSettingsStore.getState();
  const baseZoom =
    settings.cameraZoomMode === 'custom'
      ? settings.cameraZoom
      : computeAutoCameraZoom(viewW, viewH);
  settings.updateSettings({
    cameraZoomMode: 'custom',
    cameraZoom: clampCameraZoom(baseZoom + delta),
  });
}

export function GameCanvas({ map }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenShakeRef = useRef(0);
  const crosshairSpreadRef = useRef(0);
  const pointerPosRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });
  const ragdollsRef = useRef<RagdollInstance[]>([]);
  const prevDeadMapRef = useRef<Map<string, boolean>>(new Map());
  const prevLocalDeadRef = useRef(false);
  const lastLocalAttackerRef = useRef<AttackerAttribution | null>(null);
  const needsCameraSnapRef = useRef(true);
  const simStateRef = useRef(createArenaSimState());

  const isTouchHUD = useIsTouchHUD();
  const isTouchHUDRef = useRef(isTouchHUD);
  useEffect(() => {
    isTouchHUDRef.current = isTouchHUD;
  }, [isTouchHUD]);

  const initialWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const initialHeight = typeof window !== 'undefined' ? window.innerHeight : 720;
  const viewportRef = useRef({
    width: initialWidth,
    height: initialHeight,
    dpr: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1,
  });
  const cameraRef = useRef<Camera>(
    createCamera(initialWidth, initialHeight, getInitialZoom(initialWidth, initialHeight)),
  );
  const matchGeneration = useCTFStore((s) => s.matchGeneration);

  // Direct HiDPI canvas sizing on resize (zero React re-renders)
  useEffect(() => {
    const syncCanvasSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      viewportRef.current = { width, height, dpr };

      const canvas = canvasRef.current;
      if (canvas) {
        const targetW = Math.floor(width * dpr);
        const targetH = Math.floor(height * dpr);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
      }

      cameraRef.current = {
        ...cameraRef.current,
        viewportWidth: width,
        viewportHeight: height,
      };
    };

    syncCanvasSize();
    window.addEventListener('resize', syncCanvasSize);
    window.addEventListener('orientationchange', syncCanvasSize);
    return () => {
      window.removeEventListener('resize', syncCanvasSize);
      window.removeEventListener('orientationchange', syncCanvasSize);
    };
  }, []);

  // Initialize / reset match world pickups, stations, spawn, loadout, and snap camera
  useEffect(() => {
    clearOptimisticClaims();
    const initialPickups: ActiveWeaponPickup[] = (map.weaponSpawns || []).map((ws) => ({
      id: ws.id,
      x: ws.x,
      y: ws.y,
      weaponType: ws.weaponType,
      respawnTimer: 0,
    }));
    engineWorld.resetWorldForMatch(initialPickups, false, buildActiveStations(map));

    const netState = useNetworkStore.getState();
    const isMultiplayer = Boolean(netState.roomCode);
    const ctf = useCTFStore.getState();
    if (!isMultiplayer && (ctf.stateSeq === 0 || ctf.flags.blue.baseX !== map.flagBlue.x)) {
      if (ctf.stateSeq === 0) {
        ctf.initMatch(map);
      }
    } else if (
      isMultiplayer &&
      ctf.flags.blue.baseX !== map.flagBlue.x &&
      netState.isHost
    ) {
      ctf.initMatch(map);
    }

    const myPlayerId = useAvatarStore.getState().playerId;
    usePlayerStore.getState().spawnAtTeamBase(map, myPlayerId);
    const spawnedLocal = usePlayerStore.getState().player;

    const stats = useMatchStatsStore.getState();
    stats.setLocalDeathSummary(null);
    stats.setTacticalMenuOpen(false);
    stats.registerParticipant(myPlayerId, spawnedLocal.avatar.callsign, spawnedLocal.team);
    if (!isMultiplayer) {
      engineWorld.spawnSoloBots(map, spawnedLocal.team, engineWorld.soloConfig);
      for (const bot of engineWorld.soloBots) {
        stats.registerParticipant(bot.id, bot.player.avatar.callsign, bot.team);
      }
    } else {
      engineWorld.clearSoloBots();
      for (const member of Object.values(netState.roster)) {
        stats.registerParticipant(member.playerId, member.callsign, member.team);
      }
    }

    ragdollsRef.current = [];
    prevDeadMapRef.current.clear();
    prevLocalDeadRef.current = false;
    lastLocalAttackerRef.current = null;
    screenShakeRef.current = 0;
    crosshairSpreadRef.current = 0;
    needsCameraSnapRef.current = true;
    simStateRef.current = createArenaSimState();

    const w = window.innerWidth;
    const h = window.innerHeight;
    cameraRef.current = updateCamera(
      createCamera(w, h, getInitialZoom(w, h)),
      spawnedLocal.x,
      spawnedLocal.y,
      map.width,
      map.height,
      1.0,
    );
  }, [map, matchGeneration]);

  // Sync avatar edits without clobbering live velocity/position
  const avatar = useAvatarStore((s) => s.avatar);
  useEffect(() => {
    const live = engineWorld.localPlayer ?? usePlayerStore.getState().player;
    usePlayerStore.getState().setPlayer({ ...live, avatar });
  }, [avatar]);

  // Weapon Fire Handler
  const handleFire = useCallback(() => {
    if (useCTFStore.getState().matchStatus !== 'playing') return;
    const isMultiplayer = Boolean(useNetworkStore.getState().roomCode);
    if (!isMultiplayer && useMatchStatsStore.getState().tacticalMenuOpen) return;

    const player = engineWorld.localPlayer ?? usePlayerStore.getState().player;
    if (player.isDead) return;

    const muzzleOriginX = player.x;
    const muzzleOriginY = player.y - 5;

    const fireResult = useCombatStore.getState().fireWeapon({
      shooterId: player.id,
      team: player.team,
      originX: muzzleOriginX,
      originY: muzzleOriginY,
      aimAngle: player.aimAngle,
      map,
    });

    if (fireResult) {
      hapticShot(fireResult.firedWeapon);
      crosshairSpreadRef.current = Math.min(
        12,
        crosshairSpreadRef.current + Math.max(3, fireResult.recoil * 1.4),
      );
      if (useSettingsStore.getState().screenShake) {
        screenShakeRef.current = Math.min(7, fireResult.recoil * 0.85);
      }

      const recoilImpulse = fireResult.recoil;
      player.vx -= Math.cos(player.aimAngle) * recoilImpulse;
      player.vy -= Math.sin(player.aimAngle) * recoilImpulse;

      networkManager.broadcastShoot({
        shooterId: player.id,
        team: player.team,
        weaponType: fireResult.firedWeapon,
        originX: muzzleOriginX,
        originY: muzzleOriginY,
        aimAngle: player.aimAngle,
        spreadOffsets: fireResult.spreadOffsets,
        speedScale: fireResult.speedScale,
      });
    }
  }, [map]);

  const handleSwitchWeapon = useCallback(() => {
    if (useCTFStore.getState().matchStatus !== 'playing') return;
    useCombatStore.getState().cycleWeapon();
  }, []);

  const handleThrowGrenade = useCallback(() => {
    if (useCTFStore.getState().matchStatus !== 'playing') return;
    const isMultiplayer = Boolean(useNetworkStore.getState().roomCode);
    if (!isMultiplayer && useMatchStatsStore.getState().tacticalMenuOpen) return;

    const player = engineWorld.localPlayer ?? usePlayerStore.getState().player;
    if (player.isDead) return;

    const throwOriginX = player.x;
    const throwOriginY = player.y - 5;

    const throwResult = useCombatStore.getState().throwGrenade({
      shooterId: player.id,
      team: player.team,
      originX: throwOriginX,
      originY: throwOriginY,
      aimAngle: player.aimAngle,
      map,
    });

    if (throwResult) {
      hapticShot('grenade');
      crosshairSpreadRef.current = Math.min(12, crosshairSpreadRef.current + 3);
      player.vx -= Math.cos(player.aimAngle) * throwResult.recoil;
      player.vy -= Math.sin(player.aimAngle) * throwResult.recoil;

      networkManager.broadcastShoot({
        shooterId: player.id,
        team: player.team,
        weaponType: 'grenade',
        originX: throwOriginX,
        originY: throwOriginY,
        aimAngle: player.aimAngle,
        spreadOffsets: throwResult.spreadOffsets,
        speedScale: throwResult.speedScale,
      });
    }
  }, [map]);

  // Main 60/120 FPS Zero-React-Commit Engine & Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = performance.now();
    let isMouseDown = false;
    const keys: Record<string, boolean> = {};
    const renderScratch = createArenaRenderScratch(useAvatarStore.getState().avatar);

    const syncKeyboardInput = () => {
      if (useCTFStore.getState().matchStatus !== 'playing') return;
      const isMultiplayer = Boolean(useNetworkStore.getState().roomCode);
      if (!isMultiplayer && useMatchStatsStore.getState().tacticalMenuOpen) return;

      let moveX = 0;
      if (keys['KeyA'] || keys['ArrowLeft']) moveX -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) moveX += 1;
      const moveY = keys['KeyS'] || keys['ArrowDown'] ? 1 : 0;
      const boosting = Boolean(keys['KeyW'] || keys['ArrowUp'] || keys['Space']);
      const dash = Boolean(keys['ShiftLeft'] || keys['ShiftRight'] || keys['KeyE']);
      usePlayerStore.getState().setInput({ moveX, moveY, boosting, dash });
    };

    const clearAllInputs = () => {
      for (const code in keys) {
        keys[code] = false;
      }
      isMouseDown = false;
      usePlayerStore
        .getState()
        .setInput({ moveX: 0, moveY: 0, boosting: false, shooting: false, dash: false });
      sounds.setJetpackBoosting(false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearAllInputs();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if ((e.code === 'Enter' || e.code === 'KeyT') && !e.repeat) {
        const chatState = useChatStore.getState();
        if (!chatState.isHudChatOpen) {
          e.preventDefault();
          clearAllInputs();
          chatState.setHudChatOpen(true);
          return;
        }
      }

      if (e.code === 'Escape' && !e.repeat) {
        const chatState = useChatStore.getState();
        if (chatState.isHudChatOpen) {
          chatState.setHudChatOpen(false);
          return;
        }
        const stats = useMatchStatsStore.getState();
        const nextOpen = !stats.tacticalMenuOpen;
        if (nextOpen) {
          clearAllInputs();
        }
        stats.setTacticalMenuOpen(nextOpen);
        return;
      }

      const { width: viewW, height: viewH } = viewportRef.current;
      if (e.code === 'Equal' || e.code === 'NumpadAdd') {
        adjustZoomByDelta(CAMERA_ZOOM_STEP, viewW, viewH);
        return;
      }
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
        adjustZoomByDelta(-CAMERA_ZOOM_STEP, viewW, viewH);
        return;
      }
      if ((e.code === 'Digit0' || e.code === 'Numpad0') && !e.repeat) {
        useSettingsStore.getState().updateSettings({ cameraZoomMode: 'auto' });
        return;
      }

      if (useCTFStore.getState().matchStatus !== 'playing') return;
      const isMultiplayer = Boolean(useNetworkStore.getState().roomCode);
      if (!isMultiplayer && useMatchStatsStore.getState().tacticalMenuOpen) return;

      keys[e.code] = true;
      if (WEAPON_KEYS[e.code]) {
        useCombatStore.getState().setEquippedWeapon(WEAPON_KEYS[e.code]);
      }
      if (e.code === 'KeyQ' && !e.repeat) {
        handleSwitchWeapon();
      }
      if (e.code === 'KeyG' && !e.repeat) {
        handleThrowGrenade();
      }
      syncKeyboardInput();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
      syncKeyboardInput();
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      pointerPosRef.current = { x: screenX, y: screenY, active: true };

      if (useCTFStore.getState().matchStatus !== 'playing') return;
      const isMultiplayer = Boolean(useNetworkStore.getState().roomCode);
      if (!isMultiplayer && useMatchStatsStore.getState().tacticalMenuOpen) return;

      const player = engineWorld.localPlayer ?? usePlayerStore.getState().player;
      const { worldX, worldY } = screenToWorld(screenX, screenY, cameraRef.current);

      const aimAngle = Math.atan2(worldY - (player.y - 5), worldX - player.x);
      usePlayerStore.getState().setInput({ aimAngle });
    };

    const handleMouseLeave = () => {
      pointerPosRef.current = { ...pointerPosRef.current, active: false };
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (useChatStore.getState().isInputFocused) return;
      const isMultiplayer = Boolean(useNetworkStore.getState().roomCode);
      if (!isMultiplayer && useMatchStatsStore.getState().tacticalMenuOpen) return;
      if (useCTFStore.getState().matchStatus !== 'playing') return;
      if (e.button === 0) {
        isMouseDown = true;
        handleFire();
      } else if (e.button === 2) {
        handleThrowGrenade();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleHudGrenadeThrow = () => {
      handleThrowGrenade();
    };

    const handleMouseUp = () => {
      isMouseDown = false;
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      const { width: viewW, height: viewH } = viewportRef.current;
      const step = e.deltaY < 0 ? 0.08 : -0.08;
      adjustZoomByDelta(step, viewW, viewH);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', clearAllInputs);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('contextmenu', handleContextMenu);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('aerostrike:throw-grenade', handleHudGrenadeThrow);

    const loop = (timestamp: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (timestamp - lastTime) / 1000));
      lastTime = timestamp;
      const timeSec = timestamp / 1000;
      const { width: viewW, height: viewH, dpr } = viewportRef.current;

      const simResult = stepArenaFrame({
        map,
        dt,
        timestamp,
        viewW,
        viewH,
        dpr,
        isMouseDown,
        clearAllInputs,
        handleFire,
        simState: simStateRef.current,
        renderScratch,
        cameraRef,
        needsCameraSnapRef,
        screenShakeRef,
        ragdollsRef,
        prevDeadMapRef,
        prevLocalDeadRef,
        lastLocalAttackerRef,
      });

      renderArenaFrame({
        ctx,
        map,
        viewW,
        viewH,
        dpr,
        dt,
        timeSec,
        currentCamera: simResult.currentCamera,
        localPlayer: simResult.localPlayer,
        myPlayerId: simResult.myPlayerId,
        isBoostingNow: simResult.isBoostingNow,
        isMultiplayer: simResult.isMultiplayer,
        ragdolls: ragdollsRef.current,
        scratch: renderScratch,
        screenShakeRef,
        crosshairSpreadRef,
        pointerPosRef,
        isTouchHUD: isTouchHUDRef.current,
      });

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', clearAllInputs);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      canvas.removeEventListener('wheel', handleWheel);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('aerostrike:throw-grenade', handleHudGrenadeThrow);
      sounds.setJetpackBoosting(false);
    };
  }, [map, handleFire, handleSwitchWeapon, handleThrowGrenade]);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden touch-none select-none">
      <canvas
        ref={canvasRef}
        className={`block w-full h-full bg-[#060913] touch-none ${
          isTouchHUD ? '' : 'cursor-none'
        }`}
      />
      <MinimapView map={map} />
      <VirtualControls
        onSwitchWeapon={handleSwitchWeapon}
        onThrowGrenade={handleThrowGrenade}
      />
    </div>
  );
}
