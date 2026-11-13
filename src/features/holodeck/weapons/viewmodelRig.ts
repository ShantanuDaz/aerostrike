import * as THREE from 'three';
import { buildProceduralWeaponMesh } from './proceduralGunMeshes';
import type { HolodeckWeaponId } from '../core/types';
import type { Team } from '../../ctf/types';

export class ViewmodelRig {
  public group: THREE.Group;
  private currentWeaponMesh: THREE.Group | null = null;
  private currentWeaponId: HolodeckWeaponId | null = null;

  // Rest offsets relative to camera
  private defaultRestPos = new THREE.Vector3(0.24, -0.22, -0.45);
  private defaultRestRot = new THREE.Euler(0, 0, 0);

  // Dynamic spring state
  private kickZ = 0;
  private kickRotX = 0;
  private kickVelZ = 0;
  private kickVelRotX = 0;

  // Mouse sway
  private swayX = 0;
  private swayY = 0;

  // Walk bob
  private bobCycle = 0;

  // Articulated Hands & Pilot Arms
  public handsGroup: THREE.Group;
  private leftArmGroup: THREE.Group;
  private rightArmGroup: THREE.Group;

  // Procedural Muzzle Flash & Dynamic Light
  private muzzleGroup: THREE.Group;
  private muzzleFlashMesh: THREE.Group;
  private muzzleLight: THREE.PointLight;
  private flashTimer = 0;

  constructor(team: Team = 'blue') {
    this.group = new THREE.Group();
    this.group.name = 'ViewmodelRig';

    const isBlue = team === 'blue';

    // --- 1. PROCEDURAL TACTICAL HANDS & PILOT ARMS ---
    this.handsGroup = new THREE.Group();
    this.handsGroup.name = 'ViewmodelHands';

    const sleeveMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.7,
      metalness: 0.2,
    });

    const guardMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.4,
      metalness: 0.6,
    });

    const gloveMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.5,
      metalness: 0.4,
    });

    const knuckleMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.3,
      metalness: 0.8,
    });

    const wristNeonMat = new THREE.MeshBasicMaterial({
      color: isBlue ? 0x00f0ff : 0xff1e56,
    });

    // Right Arm (Pistol Grip Support)
    this.rightArmGroup = new THREE.Group();
    this.rightArmGroup.name = 'RightArmRig';

    // Forearm extending from lower right forward towards pistol grip
    const rightForearm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.36), sleeveMat);
    rightForearm.position.set(0.14, -0.22, 0.22);
    rightForearm.rotation.set(-0.35, -0.25, 0.15);
    this.rightArmGroup.add(rightForearm);

    // Ballistic guard plate on forearm
    const rightGuard = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.03, 0.22), guardMat);
    rightGuard.position.set(0.14, -0.19, 0.22);
    rightGuard.rotation.set(-0.35, -0.25, 0.15);
    this.rightArmGroup.add(rightGuard);

    // Biometric wrist telemetry band
    const rightWristBand = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.092, 0.03), wristNeonMat);
    rightWristBand.position.set(0.07, -0.15, 0.1);
    rightWristBand.rotation.set(-0.35, -0.25, 0.15);
    this.rightArmGroup.add(rightWristBand);

    // Tactical Glove around grip
    const rightGlove = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.085, 0.1), gloveMat);
    rightGlove.position.set(0.02, -0.11, 0.06);
    this.rightArmGroup.add(rightGlove);

    const rightKnuckles = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.035, 0.07), knuckleMat);
    rightKnuckles.position.set(0.02, -0.08, 0.05);
    this.rightArmGroup.add(rightKnuckles);

    const rightFingers = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.06), gloveMat);
    rightFingers.position.set(-0.01, -0.12, 0.08);
    this.rightArmGroup.add(rightFingers);

    this.handsGroup.add(this.rightArmGroup);

    // Left Arm (Handguard Support Arm)
    this.leftArmGroup = new THREE.Group();
    this.leftArmGroup.name = 'LeftArmRig';

    // Left Forearm extending from bottom left forward to handguard
    const leftForearm = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.085, 0.42), sleeveMat);
    leftForearm.position.set(-0.2, -0.24, -0.12);
    leftForearm.rotation.set(-0.25, 0.45, -0.2);
    this.leftArmGroup.add(leftForearm);

    // Left Forearm Guard
    const leftGuard = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.24), guardMat);
    leftGuard.position.set(-0.2, -0.21, -0.12);
    leftGuard.rotation.set(-0.25, 0.45, -0.2);
    this.leftArmGroup.add(leftGuard);

    // Left biometric wrist band
    const leftWristBand = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.088, 0.03), wristNeonMat);
    leftWristBand.position.set(-0.11, -0.18, -0.28);
    leftWristBand.rotation.set(-0.25, 0.45, -0.2);
    this.leftArmGroup.add(leftWristBand);

    // Left Glove holding handguard
    const leftGlove = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.12), gloveMat);
    leftGlove.position.set(-0.03, -0.12, -0.42);
    leftGlove.rotation.set(0.15, 0.3, -0.2);
    this.leftArmGroup.add(leftGlove);

    const leftKnuckles = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.03, 0.08), knuckleMat);
    leftKnuckles.position.set(-0.04, -0.09, -0.42);
    this.leftArmGroup.add(leftKnuckles);

    this.handsGroup.add(this.leftArmGroup);
    this.group.add(this.handsGroup);

    // --- 2. PROCEDURAL MUZZLE FLASH & DYNAMIC LIGHT ---
    this.muzzleGroup = new THREE.Group();
    this.muzzleGroup.name = 'MuzzleFlashRig';

    this.muzzleFlashMesh = new THREE.Group();

    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xfffaed,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    });

    const flashCoreMat = new THREE.MeshBasicMaterial({
      color: 0xffaa22,
    });

    // 4-point star cross-quads
    const starPlane1 = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), flashMat);
    const starPlane2 = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), flashMat);
    starPlane2.rotation.z = Math.PI / 4;

    const starPlane3 = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14), flashMat);
    starPlane3.rotation.y = Math.PI / 2;

    const flashCore = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), flashCoreMat);

    this.muzzleFlashMesh.add(starPlane1, starPlane2, starPlane3, flashCore);
    this.muzzleFlashMesh.visible = false;
    this.muzzleGroup.add(this.muzzleFlashMesh);

    // Dynamic Muzzle Point Light illuminates viewmodel & surroundings
    this.muzzleLight = new THREE.PointLight(0xffaa33, 2.8, 5.0);
    this.muzzleLight.visible = false;
    this.muzzleGroup.add(this.muzzleLight);

    this.group.add(this.muzzleGroup);
  }

  public setWeapon(weaponId: HolodeckWeaponId) {
    if (this.currentWeaponId === weaponId && this.currentWeaponMesh) return;

    if (this.currentWeaponMesh) {
      this.group.remove(this.currentWeaponMesh);
    }

    this.currentWeaponId = weaponId;
    this.currentWeaponMesh = buildProceduralWeaponMesh(weaponId);
    this.group.add(this.currentWeaponMesh);

    // Position muzzle flash & adapt left hand stance per weapon geometry
    if (weaponId === 'vandal') {
      this.muzzleGroup.position.set(0, 0.02, -0.92);
      this.leftArmGroup.visible = true;
      this.leftArmGroup.position.set(0, 0, 0);
    } else if (weaponId === 'operator') {
      this.muzzleGroup.position.set(0, 0.03, -1.26);
      this.leftArmGroup.visible = true;
      this.leftArmGroup.position.set(0.02, 0.02, 0.05);
    } else if (weaponId === 'classic') {
      this.muzzleGroup.position.set(0, 0.04, -0.22);
      this.leftArmGroup.visible = true;
      this.leftArmGroup.position.set(0.12, 0.04, 0.42);
    } else {
      // Tactical knife
      this.muzzleGroup.position.set(0, 0, 0);
      this.leftArmGroup.visible = false;
    }
  }

  /**
   * Applies recoil impulse to viewmodel when firing and flashes procedural muzzle effect.
   */
  public triggerRecoilImpulse(kickDistance = 0.06, kickAngle = 0.12) {
    this.kickVelZ += kickDistance * 8.0;
    this.kickVelRotX -= kickAngle * 6.0;

    // Trigger visual muzzle flash for 0.045s on firearms
    if (this.currentWeaponId !== 'knife') {
      this.flashTimer = 0.045;
      this.muzzleFlashMesh.visible = true;
      this.muzzleLight.visible = true;

      // Randomize flash rotation and scale for dynamic spark juice
      this.muzzleFlashMesh.rotation.z = Math.random() * Math.PI * 2;
      const s = 0.85 + Math.random() * 0.4;
      this.muzzleFlashMesh.scale.set(s, s, s);
    }
  }

  /**
   * Updates viewmodel position, sway, bob, muzzle timer, and spring recovery each frame.
   */
  public update(
    dt: number,
    mouseDeltaX: number,
    mouseDeltaY: number,
    playerSpeed: number,
    isGrounded: boolean,
    isScoped = false,
  ) {
    const clampedDt = Math.min(Math.max(dt, 0.001), 0.1);

    // Muzzle flash timer decay
    if (this.flashTimer > 0) {
      this.flashTimer -= clampedDt;
      if (this.flashTimer <= 0) {
        this.muzzleFlashMesh.visible = false;
        this.muzzleLight.visible = false;
      }
    }

    // If sniper scoped, hide viewmodel or push down
    if (isScoped) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;

    // 1. Mouse Sway Lag
    const targetSwayX = -mouseDeltaX * 0.0008;
    const targetSwayY = mouseDeltaY * 0.0008;
    this.swayX = THREE.MathUtils.lerp(this.swayX, targetSwayX, clampedDt * 14);
    this.swayY = THREE.MathUtils.lerp(this.swayY, targetSwayY, clampedDt * 14);

    // 2. Walk / Sprint Bob
    if (isGrounded && playerSpeed > 0.5) {
      const bobFreq = playerSpeed > 5.5 ? 12 : 9;
      this.bobCycle += clampedDt * bobFreq;
    } else {
      // Gentle decay towards 0
      this.bobCycle *= Math.pow(0.9, clampedDt * 60);
    }

    const bobX = Math.cos(this.bobCycle * 0.5) * 0.015 * Math.min(1, playerSpeed / 4);
    const bobY = Math.abs(Math.sin(this.bobCycle)) * 0.018 * Math.min(1, playerSpeed / 4);

    // 3. Damped Spring Recoil Kick
    // F = -k * x - c * v
    const springK = 180.0;
    const damping = 18.0;

    const accelZ = -springK * this.kickZ - damping * this.kickVelZ;
    this.kickVelZ += accelZ * clampedDt;
    this.kickZ += this.kickVelZ * clampedDt;

    const accelRot = -springK * this.kickRotX - damping * this.kickVelRotX;
    this.kickVelRotX += accelRot * clampedDt;
    this.kickRotX += this.kickVelRotX * clampedDt;

    // Apply combined transform
    this.group.position.set(
      this.defaultRestPos.x + this.swayX + bobX,
      this.defaultRestPos.y - this.swayY - bobY,
      this.defaultRestPos.z + this.kickZ,
    );

    this.group.rotation.set(
      this.defaultRestRot.x + this.kickRotX - this.swayY * 1.5,
      this.defaultRestRot.y + this.swayX * 1.5,
      this.defaultRestRot.z + this.swayX * 0.8,
    );
  }
}
