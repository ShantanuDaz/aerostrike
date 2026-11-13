import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useHolodeckStore } from './game/holodeckStore';
import {
  getHolodeckMapData,
  buildHolodeckMapGroup,
} from './map/mapRegistry';
import type { HolodeckMapData } from './map/holodeckAlpha';
import { useMapStore } from '../map/mapStore';
import { useCTFStore } from '../ctf/ctfStore';
import { isPointInsideZone } from './map/mapColliders';
import {
  createInitialKCCState,
  stepCharacterController,
  type KCCInput,
  type KCCState,
} from './physics/characterController';
import { ViewmodelRig } from './weapons/viewmodelRig';
import {
  createInitialGunplayState,
  canFireWeapon,
  executeShot,
  startReload,
  finishReloadIfReady,
  updateGunplayBloom,
  calculateCurrentSpread,
  rayIntersectsAABB,
  type GunplayState,
} from './weapons/gunplayController';
import {
  buildPlayerHitboxes,
  raycastPlayerHitboxes,
} from './avatars/hitboxZones';
import { ProceduralAvatarRig } from './avatars/proceduralAvatarMesh';
import {
  stepSpike,
  buildPlantedSpikeMesh,
} from './game/spikeController';
import { evaluateRoundOutcome } from './game/roundRules';
import {
  createInitialBots3D,
  stepBot3D,
  type Bot3DState,
} from './game/botAI3D';
import { TacticalCrosshair } from './ui/TacticalCrosshair';
import { SpikeProgressRing } from './ui/SpikeProgressRing';
import { ScopeView } from './ui/ScopeView';
import { HolodeckGameOverModal } from './ui/HolodeckGameOverModal';
import { MobileTouchOverlay } from './ui/MobileTouchOverlay';
import { encodeHolodeckPacket } from './net/holodeckProtocol';
import { networkManager } from '../network/peerRoom';
import {
  HOLODECK_WEAPONS,
  type HolodeckPlayerState,
  type HolodeckWeaponId,
  type PlantSite,
} from './core/types';
import { sounds } from '../audio/soundEngine';

function createBotPlayerState(b: Bot3DState): HolodeckPlayerState {
  return {
    id: b.id,
    callsign: b.name,
    team: b.team,
    isLocal: false,
    isHost: false,
    isAlive: b.isAlive,
    health: b.health,
    armor: b.armor,
    credits: 0,
    position: b.position,
    velocity: b.velocity,
    yaw: b.yaw,
    pitch: b.pitch,
    isCrouching: Boolean(b.isCrouching),
    isGrounded: true,
    isSprinting: false,
    activeWeaponId: b.activeWeaponId,
    ammo: {
      vandal: { clip: 25, reserve: 75 },
      operator: { clip: 5, reserve: 15 },
      classic: { clip: 12, reserve: 36 },
      knife: { clip: 1, reserve: 1 },
    },
    kills: 0,
    deaths: 0,
    plants: 0,
    defuses: 0,
  };
}

interface Tactical3DCanvasProps {
  onExitToWarRoom?: () => void;
}

export function Tactical3DCanvas({ onExitToWarRoom }: Tactical3DCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const localPlayer = useHolodeckStore((s) => s.localPlayer);
  const spike = useHolodeckStore((s) => s.spike);
  const updateLocalPlayer = useHolodeckStore((s) => s.updateLocalPlayer);
  const advanceRound = useHolodeckStore((s) => s.advanceRound);
  const pushKillFeed = useHolodeckStore((s) => s.pushKillFeed);
  const selectedMap = useMapStore((s) => s.selectedMap);
  const matchRules = useCTFStore((s) => s.matchRules);

  // Crosshair & UI State
  const [spreadRadius, setSpreadRadius] = useState(0);
  const [isScoped, setIsScoped] = useState(false);
  const [spikeAction, setSpikeAction] = useState<{ action: 'planting' | 'defusing'; progress: number; total: number } | null>(null);
  const [stagingCountdown, setStagingCountdown] = useState(5);
  const [isCrouchedTouch, setIsCrouchedTouch] = useState(false);
  const [activeWeapon, setActiveWeapon] = useState<HolodeckWeaponId>(localPlayer.activeWeaponId);
  const [lastFiredAt, setLastFiredAt] = useState<number>(0);

  const touchState = useRef({
    moveForward: 0,
    moveRight: 0,
    jump: false,
    crouch: false,
    fire: false,
    interact: false,
  });

  const touchLookDelta = useRef({
    yaw: 0,
    pitch: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // --- 1. THREE.JS ENGINE SETUP ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080e1e);
    scene.fog = new THREE.FogExp2(0x080e1e, 0.010);

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      250,
    );

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Atmospheric Lighting & Sunlight Shadow Frustum
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x1e293b, 0.65);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.15);
    sunLight.position.set(45, 80, 35);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 220;
    sunLight.shadow.camera.left = -70;
    sunLight.shadow.camera.right = 70;
    sunLight.shadow.camera.top = 70;
    sunLight.shadow.camera.bottom = -70;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.radius = 2.0;
    scene.add(sunLight);

    // --- 2. MAP GENERATION & COLLIDERS ---
    const mapData: HolodeckMapData = getHolodeckMapData(selectedMap.id);
    const mapGroup = buildHolodeckMapGroup(selectedMap.id, mapData);
    scene.add(mapGroup);

    // Spawn Containment Barriers for Round Staging (Search & Destroy only)
    const isSND = matchRules.mode === 'holodeck';
    let stagingTimerSec = isSND ? 3.0 : 0.0;
    const barrierMatBlue = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    const barrierMatRed = new THREE.MeshBasicMaterial({
      color: 0xff1e56,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });

    const blueBarrier = new THREE.Mesh(new THREE.BoxGeometry(60, 10, 0.4), barrierMatBlue);
    blueBarrier.position.set(0, 5, -34);
    blueBarrier.visible = isSND;
    scene.add(blueBarrier);

    const redBarrier = new THREE.Mesh(new THREE.BoxGeometry(60, 10, 0.4), barrierMatRed);
    redBarrier.position.set(0, 5, 34);
    redBarrier.visible = isSND;
    scene.add(redBarrier);

    if (!isSND) {
      setStagingCountdown(0);
    }

    let plantedSpikeMesh: THREE.Group | null = null;

    // --- 3. VIEWMODEL RIG ---
    const viewmodel = new ViewmodelRig(localPlayer.team);
    viewmodel.setWeapon(localPlayer.activeWeaponId);
    camera.add(viewmodel.group);
    scene.add(camera);

    // --- 4. AVATAR RIGS FOR BOTS & NETWORK PEERS ---
    const avatarRigs = new Map<string, ProceduralAvatarRig>();
    const lastBotPositions = new Map<string, [number, number, number]>();

    const isSoloSkirmish = useHolodeckStore.getState().isSoloSkirmish;

    // Initialize 3D Tactical Bots & Respawn Tracker (STRICTLY ONLY in Solo Skirmish! Never in hosted or War Room matches)
    let bots: Bot3DState[] = isSoloSkirmish ? createInitialBots3D(selectedMap.id, localPlayer.team) : [];
    const botRespawnTimers = new Map<string, number>();
    let playerRespawnTimerSec = 0;
    let matchTimerSec = 300;
    for (const b of bots) {
      const rig = new ProceduralAvatarRig(b.team);
      rig.setWeapon(b.activeWeaponId);
      rig.updatePose(b.position, b.yaw, 0, false, 0, 0.016);
      scene.add(rig.root);
      avatarRigs.set(b.id, rig);
      lastBotPositions.set(b.id, [b.position[0], b.position[1], b.position[2]]);
      if (isSoloSkirmish) {
        useHolodeckStore.getState().setRemotePlayer(b.id, createBotPlayerState(b));
      }
    }

    // --- 4.5. VFX SYSTEM (TRACERS & IMPACT SPARKS) ---
    interface Tracer {
      mesh: THREE.Mesh;
      material: THREE.MeshBasicMaterial;
      life: number;
      maxLife: number;
    }

    interface Spark {
      mesh: THREE.Mesh;
      vel: THREE.Vector3;
      life: number;
      maxLife: number;
    }

    const tracers: Tracer[] = [];
    const sparks: Spark[] = [];

    const spawnTracer = (start: THREE.Vector3, end: THREE.Vector3, color = 0x00f0ff) => {
      const dist = start.distanceTo(end);
      if (dist < 0.2) return;

      const geom = new THREE.CylinderGeometry(0.012, 0.012, dist, 6);
      geom.rotateX(Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
      });
      const mesh = new THREE.Mesh(geom, mat);
      const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      mesh.position.copy(mid);
      mesh.lookAt(end);

      scene.add(mesh);
      tracers.push({ mesh, material: mat, life: 0.08, maxLife: 0.08 });
    };

    const spawnImpactSparks = (pos: [number, number, number], normal: [number, number, number], color = 0xffb703) => {
      const normVec = new THREE.Vector3(normal[0], normal[1], normal[2]);
      if (normVec.lengthSq() < 0.01) normVec.set(0, 1, 0);
      normVec.normalize();

      const sparkGeom = new THREE.BoxGeometry(0.035, 0.035, 0.035);

      for (let i = 0; i < 8; i++) {
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1.0 });
        const mesh = new THREE.Mesh(sparkGeom, mat);
        mesh.position.set(pos[0], pos[1], pos[2]);

        const spread = 0.9;
        const vel = new THREE.Vector3(
          normVec.x + (Math.random() - 0.5) * spread,
          normVec.y + (Math.random() - 0.5) * spread + 0.2,
          normVec.z + (Math.random() - 0.5) * spread,
        ).normalize().multiplyScalar(4.5 + Math.random() * 6.0);

        scene.add(mesh);
        sparks.push({ mesh, vel, life: 0.22, maxLife: 0.22 });
      }
    };

    // --- 4.6. PROCEDURAL EJECTED BRASS CASINGS ---
    interface Casing {
      mesh: THREE.Mesh;
      vel: THREE.Vector3;
      rotVel: THREE.Vector3;
      life: number;
    }

    const casings: Casing[] = [];
    const casingGeom = new THREE.CylinderGeometry(0.007, 0.007, 0.03, 6);
    const casingMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.25,
      metalness: 0.95,
    });

    const spawnEjectedCasing = () => {
      const mesh = new THREE.Mesh(casingGeom, casingMat);
      mesh.castShadow = true;

      // Ejection port position relative to camera
      const portPos = camera.position.clone();
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

      portPos.addScaledVector(right, 0.22);
      portPos.addScaledVector(up, -0.16);
      portPos.addScaledVector(forward, 0.25);
      mesh.position.copy(portPos);

      // Ejection velocity: right, upward, slightly back
      const vel = new THREE.Vector3();
      vel.addScaledVector(right, 2.2 + Math.random() * 0.8);
      vel.addScaledVector(up, 1.8 + Math.random() * 0.6);
      vel.addScaledVector(forward, -0.6 + Math.random() * 0.4);

      const rotVel = new THREE.Vector3(
        Math.random() * 18 - 9,
        Math.random() * 18 - 9,
        Math.random() * 18 - 9,
      );

      scene.add(mesh);
      casings.push({ mesh, vel, rotVel, life: 1.2 });

      if (casings.length > 20) {
        const oldest = casings.shift();
        if (oldest) {
          scene.remove(oldest.mesh);
        }
      }
    };

    // --- 5. CONTROLLER & PHYSICS STATE ---
    const teamSpawns = mapData.spawns.filter((s) => s.team === localPlayer.team);
    const initialSpawn = teamSpawns.length > 0 ? teamSpawns[0].position : (localPlayer.team === 'red' ? [0, 0, 48] : [0, 0, -48]);
    let kccState: KCCState = createInitialKCCState(initialSpawn as [number, number, number]);
    let gunplayState: GunplayState = createInitialGunplayState();
    gunplayState.activeWeaponId = localPlayer.activeWeaponId;

    let yaw = teamSpawns.length > 0 ? teamSpawns[0].yaw : (localPlayer.team === 'red' ? 0 : Math.PI);
    let pitch = 0;
    const maxPitch = (89 * Math.PI) / 180;

    let mouseDeltaX = 0;
    let mouseDeltaY = 0;
    let isMouseDown = false;
    let netSeq = 0;
    const beepTimer = { timer: 0 };

    let accumulatedStepDist = 0;
    let wasGrounded = true;
    let jumpBufferSec = 0;
    let continuousShotCount = 0;
    let lastFireTimeSec = 0;

    const switchWeapon = (weaponId: HolodeckWeaponId) => {
      gunplayState.activeWeaponId = weaponId;
      viewmodel.setWeapon(weaponId);
      useHolodeckStore.getState().switchWeapon(weaponId);
      setActiveWeapon(weaponId);
      sounds.playWeaponPickup();
    };

    const keys: Record<string, boolean> = {};

    // --- 6. INPUT EVENT LISTENERS ---
    const handleKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;

      // Weapon switching
      if (e.code === 'Digit1') {
        switchWeapon('vandal');
      } else if (e.code === 'Digit2') {
        switchWeapon('operator');
      } else if (e.code === 'Digit3') {
        switchWeapon('classic');
      } else if (e.code === 'Digit4') {
        switchWeapon('knife');
      } else if (e.code === 'KeyR') {
        gunplayState = startReload(gunplayState, performance.now() / 1000);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      const sensitivity = 0.0022;
      mouseDeltaX += e.movementX;
      mouseDeltaY += e.movementY;

      yaw -= e.movementX * sensitivity;
      pitch -= e.movementY * sensitivity;
      pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas && !('ontouchstart' in window)) {
        void canvas.requestPointerLock();
        return;
      }
      if (e.button === 0) {
        isMouseDown = true;
      } else if (e.button === 2) {
        if (gunplayState.activeWeaponId === 'operator') {
          gunplayState.isScoped = !gunplayState.isScoped;
          setIsScoped(gunplayState.isScoped);
          sounds.playUiClick();
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) isMouseDown = false;
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('contextmenu', handleContextMenu);

    // --- 7. DECOUPLED 60 FPS RENDER LOOP ---
    let lastTime = performance.now();
    let animId: number;

    const renderLoop = (now: number) => {
      animId = requestAnimationFrame(renderLoop);
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      const nowSec = now / 1000;

      const holodeckStore = useHolodeckStore.getState();
      const isPlayerAlive = holodeckStore.localPlayer.health > 0;

      // Apply Mobile Touch Look Deltas
      if (touchLookDelta.current.yaw !== 0 || touchLookDelta.current.pitch !== 0) {
        yaw += touchLookDelta.current.yaw;
        pitch += touchLookDelta.current.pitch;
        pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));
        touchLookDelta.current.yaw = 0;
        touchLookDelta.current.pitch = 0;
      }

      // A. Movement Input Gathering (Keyboard + Touch Virtual Joystick)
      const keyboardForward = isPlayerAlive ? (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0) : 0;
      const keyboardRight = isPlayerAlive ? (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0) : 0;
      const moveForward = Math.abs(touchState.current.moveForward) > 0.05 ? touchState.current.moveForward : keyboardForward;
      const moveRight = Math.abs(touchState.current.moveRight) > 0.05 ? touchState.current.moveRight : keyboardRight;
      const isCrouching = isPlayerAlive && Boolean(keys['ControlLeft'] || keys['KeyC'] || touchState.current.crouch);
      const isSprinting = isPlayerAlive && Boolean(keys['ShiftLeft'] || Math.hypot(moveForward, moveRight) > 0.85);

      // Jump input with 160ms buffer window
      if (touchState.current.jump || keys['Space']) {
        jumpBufferSec = 0.16;
        touchState.current.jump = false;
      } else if (jumpBufferSec > 0) {
        jumpBufferSec = Math.max(0, jumpBufferSec - dt);
      }
      const isJumping = isPlayerAlive && jumpBufferSec > 0;
      const isInteracting = isPlayerAlive && Boolean(keys['KeyE'] || touchState.current.interact);

      const kccInput: KCCInput = {
        moveForward,
        moveRight,
        jump: isJumping,
        crouch: isCrouching,
        sprint: isSprinting,
        yaw,
      };

      // B. Kinematic Physics Step
      kccState = stepCharacterController(kccState, kccInput, mapData.colliders, dt);

      // Round Staging Freeze & Containment
      if (stagingTimerSec > 0) {
        stagingTimerSec -= dt;
        setStagingCountdown(Math.ceil(Math.max(0, stagingTimerSec)));

        // Constrain player inside spawn area
        if (localPlayer.team === 'red') {
          kccState.position[2] = Math.max(35, kccState.position[2]);
        } else {
          kccState.position[2] = Math.min(-35, kccState.position[2]);
        }

        if (stagingTimerSec <= 0) {
          if (blueBarrier.visible) {
            blueBarrier.visible = false;
            redBarrier.visible = false;
            sounds.playSpikePlanted();
          }
        }
      }

      // C. Camera Transform
      camera.position.set(
        kccState.position[0],
        kccState.position[1] + kccState.cameraHeight,
        kccState.position[2],
      );
      camera.rotation.order = 'YXZ';
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;

      // Scope FOV zoom
      const targetFov = gunplayState.isScoped ? 24 : 75;
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, dt * 16);
      camera.updateProjectionMatrix();

      // D. Gunplay Update & Firing
      const playerSpeed = Math.hypot(kccState.velocity[0], kccState.velocity[2]);
      gunplayState = updateGunplayBloom(gunplayState, dt, playerSpeed, kccState.isGrounded);
      gunplayState = finishReloadIfReady(gunplayState, nowSec);

      // Footstep & Landing Impact Audio Telemetry
      if (wasGrounded && !kccState.isGrounded && kccState.velocity[1] > 2.0) {
        jumpBufferSec = 0;
        sounds.playFootstep(isSprinting, isCrouching);
      } else if (!wasGrounded && kccState.isGrounded) {
        sounds.playLandingThud(Math.abs(kccState.velocity[1]));
      }
      wasGrounded = kccState.isGrounded;

      if (kccState.isGrounded && playerSpeed > 0.4) {
        accumulatedStepDist += playerSpeed * dt;
        const stepThreshold = isSprinting ? 1.25 : 1.85;
        if (accumulatedStepDist >= stepThreshold) {
          accumulatedStepDist = 0;
          sounds.playFootstep(isSprinting, isCrouching);
        }
      } else if (playerSpeed <= 0.2) {
        accumulatedStepDist = 0;
      }

      // Reset spray pattern tracking when trigger released
      if (nowSec - lastFireTimeSec > 0.18) {
        continuousShotCount = 0;
      }

      const activeConfig = HOLODECK_WEAPONS[gunplayState.activeWeaponId];
      const isFiring = isPlayerAlive && (isMouseDown || touchState.current.fire);
      const canShoot = stagingTimerSec <= 0;

      if (isFiring && canShoot && canFireWeapon(gunplayState, nowSec)) {
        gunplayState = executeShot(gunplayState, nowSec);
        continuousShotCount++;
        lastFireTimeSec = nowSec;
        setLastFiredAt(performance.now());

        // Sound trigger
        if (gunplayState.activeWeaponId === 'vandal') {
          sounds.playRifle();
        } else if (gunplayState.activeWeaponId === 'operator') {
          sounds.playSniper();
        } else if (gunplayState.activeWeaponId === 'classic') {
          sounds.playPistol();
        }

        // Camera Recoil Pitch Climbing & Horizontal Spray Drift
        if (activeConfig.automatic) {
          const pitchClimb = continuousShotCount <= 3 ? 0.010 : continuousShotCount <= 7 ? 0.016 : 0.007;
          pitch += pitchClimb;
          pitch = Math.min(maxPitch, pitch);

          if (continuousShotCount >= 4 && continuousShotCount <= 8) {
            yaw -= 0.005; // slight right pull
          } else if (continuousShotCount > 8) {
            yaw += continuousShotCount % 4 < 2 ? 0.006 : -0.006;
          }
        }

        // Viewmodel Kick
        viewmodel.triggerRecoilImpulse(
          gunplayState.activeWeaponId === 'operator' ? 0.12 : 0.05,
          gunplayState.activeWeaponId === 'operator' ? 0.22 : 0.1,
        );

        // Hitscan Raycast
        const spreadRad = calculateCurrentSpread(gunplayState, activeConfig, gunplayState.isScoped);
        const spreadAngleX = (Math.random() - 0.5) * spreadRad;
        const spreadAngleY = (Math.random() - 0.5) * spreadRad;

        const rayDir = new THREE.Vector3(0, 0, -1);
        rayDir.applyEuler(new THREE.Euler(pitch + spreadAngleY, yaw + spreadAngleX, 0, 'YXZ'));
        const rayOrigin: [number, number, number] = [camera.position.x, camera.position.y, camera.position.z];
        const rayDirTuple: [number, number, number] = [rayDir.x, rayDir.y, rayDir.z];

        // Viewmodel muzzle beam origin
        const tracerStart = camera.position.clone();
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
        tracerStart.addScaledVector(right, 0.18);
        tracerStart.addScaledVector(up, -0.14);
        tracerStart.addScaledVector(forward, 0.45);

        let hitPoint: [number, number, number] | null = null;
        let hitNormal: [number, number, number] = [0, 1, 0];
        let hitBotTarget = false;

        // Raycast against active bots
        for (const bot of bots) {
          if (!bot.isAlive) continue;
          if (matchRules.mode === 'tdm' && bot.team === localPlayer.team) continue;

          const hitboxes = buildPlayerHitboxes(bot.id, bot.position, false);
          const hit = raycastPlayerHitboxes(rayOrigin, rayDirTuple, hitboxes);
          if (hit.hit) {
            hitPoint = hit.point;
            hitNormal = [-rayDirTuple[0], -rayDirTuple[1], -rayDirTuple[2]];
            hitBotTarget = true;
            sounds.playHitMarker();
            const damage = Math.round(activeConfig.damageBody * hit.multiplier);
            bot.health -= damage;
            if (bot.health <= 0) {
              bot.isAlive = false;
              sounds.playExplosion();
              pushKillFeed(localPlayer.callsign || 'Spectre', bot.name, gunplayState.activeWeaponId, hit.multiplier >= 4.0);
              updateLocalPlayer({
                kills: holodeckStore.localPlayer.kills + 1,
                credits: holodeckStore.localPlayer.credits + 200,
              });
              const rig = avatarRigs.get(bot.id);
              if (rig) rig.root.visible = false;

              const curRemote = useHolodeckStore.getState().remotePlayers[bot.id];
              if (curRemote) {
                useHolodeckStore.getState().setRemotePlayer(bot.id, {
                  ...curRemote,
                  health: 0,
                  isAlive: false,
                });
              }

              if (matchRules.mode === 'tdm') {
                const s = useHolodeckStore.getState();
                const nextAtk = localPlayer.team === 'red' ? s.scoreAttackers + 1 : s.scoreAttackers;
                const nextDef = localPlayer.team === 'blue' ? s.scoreDefenders + 1 : s.scoreDefenders;
                useHolodeckStore.getState().setScores(nextAtk, nextDef);
                botRespawnTimers.set(bot.id, matchRules.respawnDelaySec || 2.5);
              } else if (matchRules.mode === 'ffa') {
                botRespawnTimers.set(bot.id, 2.5);
              }
            }
            break;
          }
        }

        // If no bot hit, raycast against static map geometry colliders
        if (!hitBotTarget) {
          let closestDist = 120.0;
          for (const box of mapData.colliders) {
            const hit = rayIntersectsAABB(rayOrigin, rayDirTuple, box);
            if (hit.hit && hit.distance < closestDist) {
              closestDist = hit.distance;
              hitPoint = [
                rayOrigin[0] + rayDirTuple[0] * hit.distance,
                rayOrigin[1] + rayDirTuple[1] * hit.distance,
                rayOrigin[2] + rayDirTuple[2] * hit.distance,
              ];
              hitNormal = hit.normal;
            }
          }
        }

        // If shot into distance without hitting wall
        if (!hitPoint) {
          hitPoint = [
            rayOrigin[0] + rayDirTuple[0] * 80.0,
            rayOrigin[1] + rayDirTuple[1] * 80.0,
            rayOrigin[2] + rayDirTuple[2] * 80.0,
          ];
        } else {
          // Spawn impact sparks
          const sparkColor = hitBotTarget ? 0x00f0ff : 0xffdd55;
          spawnImpactSparks(hitPoint, hitNormal, sparkColor);
        }

        // Draw tracer laser beam & eject brass casing
        if (gunplayState.activeWeaponId !== 'knife') {
          const tracerColor =
            localPlayer.team === 'red'
              ? 0xff1e56
              : gunplayState.activeWeaponId === 'operator'
                ? 0xffb703
                : 0x00f0ff;
          spawnTracer(tracerStart, new THREE.Vector3(hitPoint[0], hitPoint[1], hitPoint[2]), tracerColor);
          spawnEjectedCasing();
        }
      }

      // E. Step 3D Bots AI
      for (const bot of bots) {
        if (!bot.isAlive) continue;

        // In staging phase, bots hold spawn positions
        if (stagingTimerSec > 0) {
          const botRig = avatarRigs.get(bot.id);
          if (botRig) {
            botRig.updatePose(bot.position, bot.yaw, 0, false, 0, dt);
          }
          continue;
        }

        const botRes = stepBot3D(
          bot,
          kccState.position,
          isPlayerAlive,
          holodeckStore.spike,
          mapData.colliders,
          dt,
          nowSec,
        );
        Object.assign(bot, botRes.bot);

        // Update bot puppet with procedural walk cycle and tactical crouching
        const prevPos = lastBotPositions.get(bot.id) || bot.position;
        const botSpeed = Math.hypot(bot.position[0] - prevPos[0], bot.position[2] - prevPos[2]) / Math.max(dt, 0.001);
        lastBotPositions.set(bot.id, [bot.position[0], bot.position[1], bot.position[2]]);

        const botRig = avatarRigs.get(bot.id);
        if (botRig) {
          botRig.updatePose(bot.position, bot.yaw, bot.pitch, Boolean(bot.isCrouching), botSpeed, dt);
        }

        if (isSoloSkirmish) {
          const curRemote = holodeckStore.remotePlayers[bot.id];
          if (curRemote) {
            useHolodeckStore.getState().setRemotePlayer(bot.id, {
              ...curRemote,
              position: bot.position,
              yaw: bot.yaw,
              health: bot.health,
              armor: bot.armor,
              isAlive: bot.isAlive,
            });
          }
        }

        // Bot fires weapon with 3D spatialized audio
        if (botRes.shouldShoot) {
          const weaponKey = bot.activeWeaponId === 'operator' ? 'operator' : 'vandal';
          sounds.playSpatializedGunshot(weaponKey, bot.position, kccState.position, yaw);

          const botMuzzle = new THREE.Vector3(bot.position[0], bot.position[1] + 1.2, bot.position[2]);
          const botTracerColor = bot.team === 'red' ? 0xff1e56 : 0x00f0ff;

          // Damage to player
          if (botRes.damageDealtToPlayer > 0 && isPlayerAlive) {
            sounds.playHitMarker();
            const playerChest = new THREE.Vector3(
              kccState.position[0],
              kccState.position[1] + 1.1,
              kccState.position[2],
            );
            spawnTracer(botMuzzle, playerChest, botTracerColor);
            spawnImpactSparks([playerChest.x, playerChest.y, playerChest.z], [0, 1, 0], 0xff1e56);

            let curArmor = holodeckStore.localPlayer.armor;
            let curHp = holodeckStore.localPlayer.health;

            const armorAbsorb = Math.min(curArmor, Math.round(botRes.damageDealtToPlayer * 0.66));
            curArmor -= armorAbsorb;
            const healthDmg = botRes.damageDealtToPlayer - armorAbsorb;
            curHp = Math.max(0, curHp - healthDmg);

            updateLocalPlayer({ armor: curArmor, health: curHp });

            if (curHp <= 0) {
              sounds.playExplosion();
              pushKillFeed(bot.name, localPlayer.callsign || 'Spectre', bot.activeWeaponId, false);
              updateLocalPlayer({ deaths: holodeckStore.localPlayer.deaths + 1 });

              if (matchRules.mode === 'tdm') {
                const s = useHolodeckStore.getState();
                const nextAtk = bot.team === 'red' ? s.scoreAttackers + 1 : s.scoreAttackers;
                const nextDef = bot.team === 'blue' ? s.scoreDefenders + 1 : s.scoreDefenders;
                useHolodeckStore.getState().setScores(nextAtk, nextDef);
                playerRespawnTimerSec = matchRules.respawnDelaySec || 2.5;
              } else if (matchRules.mode === 'ffa') {
                playerRespawnTimerSec = 2.5;
              }
            }
          } else {
            // Bot shot missed player, tracer whizzes past
            const missTarget = new THREE.Vector3(
              kccState.position[0] + (Math.random() - 0.5) * 4.0,
              kccState.position[1] + 1.0 + (Math.random() - 0.5) * 2.0,
              kccState.position[2] + (Math.random() - 0.5) * 4.0,
            );
            spawnTracer(botMuzzle, missTarget, botTracerColor);
          }
        }
      }

      // F. WebRTC P2P Packet Sync (Send 16-byte Packet)
      const isHoldingPlant = isInteracting && localPlayer.team === 'red';
      const isHoldingDefuse = isInteracting && localPlayer.team === 'blue';

      const packetBuf = encodeHolodeckPacket({
        seq: netSeq++ & 0xff,
        x: kccState.position[0],
        y: kccState.position[1],
        z: kccState.position[2],
        vx: kccState.velocity[0],
        vy: kccState.velocity[1],
        vz: kccState.velocity[2],
        yaw,
        pitch,
        inputs: {
          forward: moveForward > 0,
          backward: moveForward < 0,
          left: moveRight < 0,
          right: moveRight > 0,
          jump: isJumping,
          crouch: isCrouching,
          sprint: isSprinting,
          fire: isMouseDown,
          plant: isHoldingPlant,
          defuse: isHoldingDefuse,
          reload: gunplayState.isReloading,
          weapon: gunplayState.activeWeaponId,
          isAlive: isPlayerAlive,
          team: localPlayer.team,
        },
        health: holodeckStore.localPlayer.health,
        armor: holodeckStore.localPlayer.armor,
      });

      networkManager.broadcast3DPacket(packetBuf);

      // Render Remote Players from network
      for (const [pId, rPlayer] of Object.entries(holodeckStore.remotePlayers)) {
        let pRig = avatarRigs.get(pId);
        if (!pRig) {
          pRig = new ProceduralAvatarRig(rPlayer.team);
          pRig.setWeapon(rPlayer.activeWeaponId);
          scene.add(pRig.root);
          avatarRigs.set(pId, pRig);
        }
        pRig.root.visible = rPlayer.isAlive;
        pRig.setWeapon(rPlayer.activeWeaponId);
        const rSpeed = Math.hypot(rPlayer.velocity[0], rPlayer.velocity[2]);
        pRig.updatePose(rPlayer.position, rPlayer.yaw, rPlayer.pitch, rPlayer.isCrouching, rSpeed, dt);
      }

      // G. Viewmodel Sway & Spring Update
      viewmodel.update(
        dt,
        mouseDeltaX,
        mouseDeltaY,
        playerSpeed,
        kccState.isGrounded,
        gunplayState.isScoped,
      );
      mouseDeltaX = 0;
      mouseDeltaY = 0;

      // H. Spike Mechanics (Plant & Defuse)
      const currentSite: PlantSite | null = isPointInsideZone(kccState.position, mapData.plantZones[0])
        ? 'A'
        : isPointInsideZone(kccState.position, mapData.plantZones[1])
          ? 'B'
          : null;

      const isBotDefusing = bots.some((b) => b.isAlive && b.isDefusing);
      const holdingPlant = isHoldingPlant && currentSite !== null;
      const holdingDefuse = (isHoldingDefuse || isBotDefusing) && (holodeckStore.spike.state === 'planted' || holodeckStore.spike.state === 'defusing');

      const spikeResult = stepSpike(
        holodeckStore.spike,
        dt,
        holdingPlant,
        currentSite,
        holdingDefuse,
        localPlayer.id,
        localPlayer.id,
        beepTimer,
      );

      holodeckStore.updateSpike(spikeResult.spike);

      // Volumetric Spike Pillar Mesh
      if (spikeResult.justPlanted && !plantedSpikeMesh) {
        plantedSpikeMesh = buildPlantedSpikeMesh(spikeResult.spike.site || 'A');
        plantedSpikeMesh.position.set(
          kccState.position[0],
          kccState.position[1],
          kccState.position[2],
        );
        scene.add(plantedSpikeMesh);
        updateLocalPlayer({
          plants: holodeckStore.localPlayer.plants + 1,
          credits: holodeckStore.localPlayer.credits + 300,
        });
      }

      if (spikeResult.justDefused) {
        updateLocalPlayer({
          defuses: holodeckStore.localPlayer.defuses + 1,
          credits: holodeckStore.localPlayer.credits + 300,
        });
      }

      // Update HUD Spike Progress
      if (spikeResult.spike.state === 'planting') {
        setSpikeAction({ action: 'planting', progress: spikeResult.spike.plantProgress, total: 4.0 });
      } else if (spikeResult.spike.state === 'defusing') {
        setSpikeAction({ action: 'defusing', progress: spikeResult.spike.defuseProgress, total: 7.0 });
      } else {
        setSpikeAction(null);
      }

      // I. Match & Round Outcome Evaluation
      if (matchRules.mode === 'holodeck') {
        const aliveBotDefenders = bots.filter((b) => b.team === 'blue' && b.isAlive).length;
        const aliveRemoteDefenders = Object.values(holodeckStore.remotePlayers).filter(
          (p) => p.team === 'blue' && p.isAlive && !p.id.startsWith('bot_'),
        ).length;
        const totalDefendersAlive =
          (localPlayer.team === 'blue' && isPlayerAlive ? 1 : 0) +
          aliveBotDefenders +
          aliveRemoteDefenders;

        const aliveBotAttackers = bots.filter((b) => b.team === 'red' && b.isAlive).length;
        const aliveRemoteAttackers = Object.values(holodeckStore.remotePlayers).filter(
          (p) => p.team === 'red' && p.isAlive && !p.id.startsWith('bot_'),
        ).length;
        const totalAttackersAlive =
          (localPlayer.team === 'red' && isPlayerAlive ? 1 : 0) +
          aliveBotAttackers +
          aliveRemoteAttackers;

        const totalAttackers =
          (localPlayer.team === 'red' ? 1 : 0) + aliveBotAttackers + aliveRemoteAttackers;
        const totalDefenders =
          (localPlayer.team === 'blue' ? 1 : 0) + aliveBotDefenders + aliveRemoteDefenders;

        if (totalAttackers > 0 && totalDefenders > 0) {
          const outcome = evaluateRoundOutcome({
            roundPhase: holodeckStore.roundPhase,
            roundTimeRemainingSec: holodeckStore.roundTimerSec,
            spikeState: spikeResult.spike.state,
            aliveAttackers: totalAttackersAlive,
            aliveDefenders: totalDefendersAlive,
          });

          if (outcome.roundEnded && outcome.winningTeam) {
            advanceRound(outcome.winningTeam);
            if (plantedSpikeMesh) {
              scene.remove(plantedSpikeMesh);
              plantedSpikeMesh = null;
            }
            // Respawn bots ONLY if in Solo Skirmish
            bots = isSoloSkirmish ? createInitialBots3D(selectedMap.id, localPlayer.team) : [];
            for (const b of bots) {
              const rig = avatarRigs.get(b.id);
              if (rig) {
                rig.root.visible = true;
                rig.updatePose(b.position, b.yaw, 0, false, 0, 0.016);
              }
              lastBotPositions.set(b.id, [b.position[0], b.position[1], b.position[2]]);
              if (isSoloSkirmish) {
                useHolodeckStore.getState().setRemotePlayer(b.id, createBotPlayerState(b));
              }
            }
            // Reset 3s staging phase & freeze barriers
            stagingTimerSec = 3.0;
            blueBarrier.visible = true;
            redBarrier.visible = true;
            setStagingCountdown(3);
          }
        }
      } else {
        // TDM / FFA Outcome & Respawn Loop
        if (holodeckStore.roundPhase === 'active') {
          matchTimerSec -= dt;
          useHolodeckStore.getState().setRoundTimerSec(matchTimerSec);
          if (matchTimerSec <= 0) {
            useHolodeckStore.getState().setRoundPhase('game_over');
          }
        }

        if (matchRules.mode === 'tdm') {
          const targetKills = 25;
          if (holodeckStore.scoreAttackers >= targetKills || holodeckStore.scoreDefenders >= targetKills) {
            useHolodeckStore.getState().setRoundPhase('game_over');
          }
        } else if (matchRules.mode === 'ffa') {
          const targetKills = 15;
          if (holodeckStore.localPlayer.kills >= targetKills) {
            useHolodeckStore.getState().setRoundPhase('game_over');
          }
        }

        // Respawn Player
        if (!isPlayerAlive) {
          playerRespawnTimerSec -= dt;
          if (playerRespawnTimerSec <= 0) {
            const respawnPoints =
              matchRules.mode === 'ffa'
                ? mapData.spawns
                : mapData.spawns.filter((s) => s.team === localPlayer.team);
            const chosen =
              respawnPoints[Math.floor(Math.random() * respawnPoints.length)] || respawnPoints[0];
            const spawnPos = chosen ? chosen.position : (localPlayer.team === 'red' ? [0, 0, 48] : [0, 0, -48]);
            kccState.position = [spawnPos[0], spawnPos[1], spawnPos[2]];
            kccState.velocity = [0, 0, 0];
            updateLocalPlayer({
              health: 100,
              armor: 50,
              isAlive: true,
            });
            sounds.playRefill('supply');
          }
        }

        // Respawn Bots
        for (const [botId, timer] of botRespawnTimers.entries()) {
          const nextTimer = timer - dt;
          if (nextTimer <= 0) {
            botRespawnTimers.delete(botId);
            const targetBot = bots.find((b) => b.id === botId);
            if (targetBot) {
              targetBot.health = 100;
              targetBot.armor = 50;
              targetBot.isAlive = true;
              const respawnPoints =
                matchRules.mode === 'ffa'
                  ? mapData.spawns
                  : mapData.spawns.filter((s) => s.team === targetBot.team);
              const chosen =
                respawnPoints[Math.floor(Math.random() * respawnPoints.length)] || respawnPoints[0];
              if (chosen) {
                targetBot.position = [chosen.position[0], chosen.position[1], chosen.position[2]];
                targetBot.yaw = chosen.yaw;
              }
              const rig = avatarRigs.get(targetBot.id);
              if (rig) {
                rig.root.visible = true;
                rig.updatePose(targetBot.position, targetBot.yaw, 0, false, 0, 0.016);
              }
              if (isSoloSkirmish) {
                const curRemote = useHolodeckStore.getState().remotePlayers[targetBot.id];
                if (curRemote) {
                  useHolodeckStore.getState().setRemotePlayer(targetBot.id, {
                    ...curRemote,
                    position: targetBot.position,
                    yaw: targetBot.yaw,
                    health: 100,
                    armor: 50,
                    isAlive: true,
                  });
                }
              }
            }
          } else {
            botRespawnTimers.set(botId, nextTimer);
          }
        }
      }

      // J. Crosshair Spread State Update
      setSpreadRadius(gunplayState.currentBloomRad);

      // K. Update VFX Particles (Tracers & Sparks)
      for (let i = tracers.length - 1; i >= 0; i--) {
        const t = tracers[i];
        t.life -= dt;
        t.material.opacity = Math.max(0, (t.life / t.maxLife) * 0.9);
        if (t.life <= 0) {
          scene.remove(t.mesh);
          t.mesh.geometry.dispose();
          t.material.dispose();
          tracers.splice(i, 1);
        }
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life -= dt;
        s.vel.y -= 14.0 * dt;
        s.mesh.position.addScaledVector(s.vel, dt);
        const sMat = s.mesh.material as THREE.MeshBasicMaterial;
        sMat.opacity = Math.max(0, s.life / s.maxLife);
        if (s.life <= 0) {
          scene.remove(s.mesh);
          s.mesh.geometry.dispose();
          sMat.dispose();
          sparks.splice(i, 1);
        }
      }

      // Update Ejected Brass Casings
      const floorY = kccState.position[1];
      for (let i = casings.length - 1; i >= 0; i--) {
        const c = casings[i];
        c.life -= dt;
        c.vel.y -= 14.0 * dt;
        c.mesh.position.addScaledVector(c.vel, dt);
        c.mesh.rotation.x += c.rotVel.x * dt;
        c.mesh.rotation.y += c.rotVel.y * dt;
        c.mesh.rotation.z += c.rotVel.z * dt;

        // Ground / floor bounce & roll damping
        if (c.mesh.position.y <= floorY + 0.015) {
          c.mesh.position.y = floorY + 0.015;
          c.vel.y = -c.vel.y * 0.42;
          c.vel.x *= 0.72;
          c.vel.z *= 0.72;
          c.rotVel.multiplyScalar(0.65);
        }

        if (c.life <= 0) {
          scene.remove(c.mesh);
          casings.splice(i, 1);
        }
      }

      // L. Render Three.js Frame
      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(renderLoop);

    // --- CLEANUP ---
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('resize', handleResize);

      for (const t of tracers) {
        scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        t.material.dispose();
      }
      for (const s of sparks) {
        scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        (s.mesh.material as THREE.Material).dispose();
      }
      for (const c of casings) {
        scene.remove(c.mesh);
      }
      casingGeom.dispose();
      casingMat.dispose();

      renderer.dispose();
    };
  }, [localPlayer.team, localPlayer.activeWeaponId, advanceRound, pushKillFeed, updateLocalPlayer]);

  return (
    <div ref={containerRef} className="fixed inset-0 w-full h-full bg-[#060913] overflow-hidden select-none">
      {/* 60 FPS Three.js Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair" />

      {/* 3s Staging Countdown Banner */}
      {stagingCountdown > 0 && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-slate-950/90 border border-cyan-400 px-5 py-2 clip-chamfer shadow-[0_0_25px_rgba(6,182,212,0.6)] flex items-center gap-3 animate-pulse pointer-events-none">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
          <span className="text-xs sm:text-sm font-mono font-black text-cyan-200 uppercase tracking-widest">
            ROUND STAGING: {stagingCountdown}s • BARRIERS ACTIVE
          </span>
        </div>
      )}

      {/* Dynamic Tactical Crosshair */}
      <TacticalCrosshair spreadRadius={spreadRadius} isScoped={isScoped} />

      {/* Sniper Scope Overlay */}
      <ScopeView isScoped={isScoped} spreadFactor={spreadRadius} />

      {/* Hold E Radial Progress Ring */}
      {spikeAction && (
        <SpikeProgressRing
          action={spikeAction.action}
          progress={spikeAction.progress}
          total={spikeAction.total}
        />
      )}

      {/* Mobile Dual-Zone Virtual Touch Controls */}
      <MobileTouchOverlay
        onMove={(f, r) => {
          touchState.current.moveForward = f;
          touchState.current.moveRight = r;
        }}
        onLook={(dY, dP) => {
          touchLookDelta.current.yaw += dY;
          touchLookDelta.current.pitch += dP;
        }}
        onFireStart={() => {
          touchState.current.fire = true;
        }}
        onFireEnd={() => {
          touchState.current.fire = false;
        }}
        onJump={() => {
          touchState.current.jump = true;
        }}
        onCrouchToggle={() => {
          touchState.current.crouch = !touchState.current.crouch;
          setIsCrouchedTouch(touchState.current.crouch);
        }}
        onReload={() => {
          // Trigger reload
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }));
        }}
        onScopeToggle={() => {
          // Trigger scope toggle
          window.dispatchEvent(new MouseEvent('mousedown', { button: 2 }));
        }}
        onSelectWeapon={(wId) => {
          setActiveWeapon(wId);
          const keyMap: Record<string, string> = {
            vandal: 'Digit1',
            operator: 'Digit2',
            classic: 'Digit3',
            knife: 'Digit4',
          };
          window.dispatchEvent(new KeyboardEvent('keydown', { code: keyMap[wId] || 'Digit1' }));
        }}
        onInteractStart={() => {
          touchState.current.interact = true;
        }}
        onInteractEnd={() => {
          touchState.current.interact = false;
        }}
        isCrouching={isCrouchedTouch}
        isScoped={isScoped}
        activeWeaponId={activeWeapon}
        ammo={localPlayer.ammo[activeWeapon]}
        canInteractSpike={Boolean(spikeAction) || spike.state === 'planted'}
        spikeAction={spikeAction}
        lastFiredAt={lastFiredAt}
      />

      {/* Match Victory / Defeat Modal */}
      <HolodeckGameOverModal onExitToWarRoom={onExitToWarRoom || (() => {})} />
    </div>
  );
}
