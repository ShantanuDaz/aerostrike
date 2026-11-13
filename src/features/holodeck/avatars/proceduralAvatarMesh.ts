import * as THREE from 'three';
import type { Team } from '../../ctf/types';
import type { HolodeckWeaponId } from '../core/types';
import { buildProceduralWeaponMesh } from '../weapons/proceduralGunMeshes';

export class ProceduralAvatarRig {
  public root: THREE.Group;
  public pelvis: THREE.Group;
  public spine: THREE.Group;
  public headGroup: THREE.Group;
  public weaponHolder: THREE.Group;
  public leftHip: THREE.Group;
  public rightHip: THREE.Group;
  public leftArm: THREE.Group;
  public rightArm: THREE.Group;

  private walkCycle = 0;
  private currentWeaponId: HolodeckWeaponId | null = null;
  private currentWeaponMesh: THREE.Group | null = null;

  constructor(team: Team = 'blue') {
    this.root = new THREE.Group();
    this.root.name = `AvatarRig_${team}`;

    const isBlue = team === 'blue';

    // High-Contrast PBR Palette (Crisp competitive silhouettes)
    // Blue Team: Carbon navy + Cobalt blue armor + Electric Cyan neon trim
    // Red Team: Dark slate tungsten + Crimson armor + Searing Laser Ruby neon trim
    const primaryMat = new THREE.MeshStandardMaterial({
      color: isBlue ? 0x1e293b : 0x221a24,
      roughness: 0.35,
      metalness: 0.8,
    });

    const armorMat = new THREE.MeshStandardMaterial({
      color: isBlue ? 0x2563eb : 0xd91e36,
      roughness: 0.3,
      metalness: 0.6,
    });

    const jointMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.5,
      metalness: 0.9,
    });

    const neonMat = new THREE.MeshBasicMaterial({
      color: isBlue ? 0x00f0ff : 0xff1e56,
    });

    const coreEmissiveMat = new THREE.MeshStandardMaterial({
      color: isBlue ? 0x00f0ff : 0xff1e56,
      emissive: isBlue ? 0x00d4ff : 0xff0044,
      emissiveIntensity: 2.2,
      roughness: 0.2,
      metalness: 0.5,
    });

    // --- 1. PELVIS & LOWER BODY ---
    this.pelvis = new THREE.Group();
    this.pelvis.position.set(0, 0.82, 0);
    this.root.add(this.pelvis);

    const pelvisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.24), primaryMat);
    this.pelvis.add(pelvisMesh);

    // Glowing Neon Cyber Belt
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.04, 0.25), neonMat);
    this.pelvis.add(belt);

    // --- 2. ARTICULATED LEGS (Pivoted from Hips) ---
    this.leftHip = new THREE.Group();
    this.leftHip.position.set(-0.12, 0.8, 0);
    this.root.add(this.leftHip);

    this.rightHip = new THREE.Group();
    this.rightHip.position.set(0.12, 0.8, 0);
    this.root.add(this.rightHip);

    const buildLegGroup = (hipGroup: THREE.Group) => {
      // Upper thigh
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.38, 0.15), primaryMat);
      thigh.position.set(0, -0.19, 0);
      hipGroup.add(thigh);

      // Knee Armor Guard + Glowing neon band (facing forward -Z)
      const knee = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.08), armorMat);
      knee.position.set(0, -0.38, -0.06);
      hipGroup.add(knee);

      const kneeNeon = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.085), neonMat);
      kneeNeon.position.set(0, -0.38, -0.065);
      hipGroup.add(kneeNeon);

      // Tactical Shin / Boot
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.36, 0.16), primaryMat);
      shin.position.set(0, -0.58, -0.01);
      hipGroup.add(shin);

      // Heavy Sole
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.06, 0.22), jointMat);
      sole.position.set(0, -0.76, -0.03);
      hipGroup.add(sole);
    };

    buildLegGroup(this.leftHip);
    buildLegGroup(this.rightHip);

    // --- 3. ARTICULATED TORSO & SPINE ---
    this.spine = new THREE.Group();
    this.spine.position.set(0, 0.9, 0);
    this.root.add(this.spine);

    // Abdominal core joint
    const abdomen = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.12, 8), jointMat);
    abdomen.position.set(0, 0.06, 0);
    this.spine.add(abdomen);

    // Main Chest Chassis
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.28), primaryMat);
    chest.position.set(0, 0.26, 0);
    this.spine.add(chest);

    // Front Ballistic Armor Plate (facing -Z)
    const frontPlate = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 0.08), armorMat);
    frontPlate.position.set(0, 0.26, -0.12);
    this.spine.add(frontPlate);

    // Glowing Cyber Energy Core (High Visibility Beacon facing -Z)
    const chestCore = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.02), coreEmissiveMat);
    chestCore.position.set(0, 0.29, -0.165);
    this.spine.add(chestCore);

    // Cyber Spine Segmented Rungs on Back (+Z)
    for (let r = 0; r < 3; r++) {
      const rung = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.04), armorMat);
      rung.position.set(0, 0.16 + r * 0.1, 0.15);
      this.spine.add(rung);
    }

    // Shoulder Pauldrons with Glowing Border Trim
    const buildPauldron = (xPos: number) => {
      const pGroup = new THREE.Group();
      pGroup.position.set(xPos, 0.44, 0);

      const pMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.18), armorMat);
      pGroup.add(pMesh);

      const pNeon = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.03, 0.19), neonMat);
      pNeon.position.set(0, 0.07, 0);
      pGroup.add(pNeon);

      return pGroup;
    };

    this.spine.add(buildPauldron(-0.28));
    this.spine.add(buildPauldron(0.28));

    // --- 4. HEAD & VISOR ---
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.58, 0);
    this.spine.add(this.headGroup);

    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 8), jointMat);
    neck.position.set(0, 0.05, 0);
    this.headGroup.add(neck);

    // Faceted Combat Helmet
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.28), primaryMat);
    helmet.position.set(0, 0.2, 0);
    this.headGroup.add(helmet);

    // Forehead Plate
    const browPlate = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.16), armorMat);
    browPlate.position.set(0, 0.3, -0.08);
    this.headGroup.add(browPlate);

    // High-Contrast Glowing Cyber Visor Band (facing -Z)
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.06), neonMat);
    visor.position.set(0, 0.2, -0.135);
    this.headGroup.add(visor);

    // Lateral Telemetry Pods
    const podL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.08), armorMat);
    podL.position.set(-0.14, 0.2, 0);
    const podR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.08), armorMat);
    podR.position.set(0.14, 0.2, 0);
    this.headGroup.add(podL, podR);

    // --- 5. ARTICULATED ARMS & WEAPON ---
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.28, 0.42, 0);
    this.spine.add(this.leftArm);

    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.28, 0.42, 0);
    this.spine.add(this.rightArm);

    const buildArm = (armGroup: THREE.Group, isRight: boolean) => {
      const bicep = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, 0.1), primaryMat);
      bicep.position.set(0, -0.12, 0);
      armGroup.add(bicep);

      const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.26, 0.09), armorMat);
      forearm.position.set(isRight ? -0.04 : 0.04, -0.28, -0.1);
      forearm.rotation.x = -0.5;
      armGroup.add(forearm);

      // Glove
      const glove = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.1), jointMat);
      glove.position.set(isRight ? -0.06 : 0.06, -0.38, -0.22);
      armGroup.add(glove);
    };

    buildArm(this.leftArm, false);
    buildArm(this.rightArm, true);

    // Weapon holder attached to right arm space
    this.weaponHolder = new THREE.Group();
    this.weaponHolder.position.set(0.22, 0.28, -0.24);
    this.spine.add(this.weaponHolder);

    // Enable soft shadow casting & receiving across the entire rig
    this.root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }

  public setWeapon(weaponId: HolodeckWeaponId) {
    if (this.currentWeaponId === weaponId && this.currentWeaponMesh) return;

    if (this.currentWeaponMesh) {
      this.weaponHolder.remove(this.currentWeaponMesh);
    }

    this.currentWeaponId = weaponId;
    this.currentWeaponMesh = buildProceduralWeaponMesh(weaponId);
    this.currentWeaponMesh.scale.set(0.85, 0.85, 0.85);

    // Enable shadows on weapon mesh
    this.currentWeaponMesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    this.weaponHolder.add(this.currentWeaponMesh);
  }

  /**
   * Updates remote puppet's rotation, yaw, pitch, crouch, speed, and walk cycles.
   * Completely avoids crude model squashing; uses anatomical crouching.
   */
  public updatePose(
    pos: [number, number, number],
    yaw: number,
    pitch: number,
    isCrouching = false,
    speed = 0,
    dt = 0.016,
  ) {
    this.root.position.set(pos[0], pos[1], pos[2]);
    this.root.rotation.y = yaw;

    // Pitch spine and head up/down with aim
    const clampedPitch = Math.max(-1.4, Math.min(1.4, pitch));
    this.spine.rotation.x = clampedPitch * 0.7;
    this.headGroup.rotation.x = clampedPitch * 0.3;

    // 1. Anatomical Crouch (No squashed box scaling)
    const targetPelvisY = isCrouching ? 0.54 : 0.82;
    const targetSpineY = isCrouching ? 0.62 : 0.90;
    const targetHipY = isCrouching ? 0.54 : 0.80;

    this.pelvis.position.y = THREE.MathUtils.lerp(this.pelvis.position.y, targetPelvisY, dt * 16);
    this.spine.position.y = THREE.MathUtils.lerp(this.spine.position.y, targetSpineY, dt * 16);
    this.leftHip.position.y = THREE.MathUtils.lerp(this.leftHip.position.y, targetHipY, dt * 16);
    this.rightHip.position.y = THREE.MathUtils.lerp(this.rightHip.position.y, targetHipY, dt * 16);

    // Anatomical crouch spine slight forward lean
    const crouchLean = isCrouching ? -0.15 : 0;
    this.spine.rotation.x += crouchLean;

    // 2. Procedural Locomotion Walk Cycle
    const baseKneeBend = isCrouching ? -0.55 : 0;

    if (speed > 0.3) {
      const cycleCadence = Math.min(speed, 6.0) * 3.2;
      this.walkCycle += dt * cycleCadence;

      const legSwing = Math.sin(this.walkCycle) * (isCrouching ? 0.35 : 0.55);
      this.leftHip.rotation.x = baseKneeBend + legSwing;
      this.rightHip.rotation.x = baseKneeBend - legSwing;

      // Arm counter-swing
      const armSwing = Math.sin(this.walkCycle) * 0.35;
      this.leftArm.rotation.x = -0.5 - armSwing;
      this.rightArm.rotation.x = -0.5 + armSwing;
    } else {
      // Smoothly damp leg and arm rotations back to resting stance
      this.leftHip.rotation.x = THREE.MathUtils.lerp(this.leftHip.rotation.x, baseKneeBend, dt * 12);
      this.rightHip.rotation.x = THREE.MathUtils.lerp(this.rightHip.rotation.x, baseKneeBend, dt * 12);
      this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, -0.5, dt * 12);
      this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, -0.5, dt * 12);
    }

    // Keep rig scale pristine (never distort geometry)
    this.root.scale.set(1.0, 1.0, 1.0);
  }
}
