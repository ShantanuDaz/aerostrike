import * as THREE from 'three';
import type { HolodeckWeaponId } from '../core/types';

/**
 * Procedurally generates 3D low-poly hard-surface weapon meshes in code with zero external assets.
 */
export function buildProceduralWeaponMesh(weaponId: HolodeckWeaponId): THREE.Group {
  const group = new THREE.Group();
  group.name = `Weapon_${weaponId}`;

  // Palette: Dark matte tungsten, gunmetal gray, cyber-cyan emissive accents
  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.35,
    metalness: 0.85,
  });

  const gunmetal = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.4,
    metalness: 0.7,
  });

  const accentCyan = new THREE.MeshBasicMaterial({
    color: 0x06b6d4,
  });

  const accentOrange = new THREE.MeshBasicMaterial({
    color: 0xf97316,
  });

  if (weaponId === 'vandal') {
    // --- VANDAL (ASSAULT RIFLE) ---
    // Receiver / Main Body
    const receiverGeo = new THREE.BoxGeometry(0.08, 0.12, 0.55);
    const receiver = new THREE.Mesh(receiverGeo, darkMetal);
    receiver.position.set(0, 0, -0.1);
    group.add(receiver);

    // Angular Handguard
    const handguardGeo = new THREE.BoxGeometry(0.07, 0.09, 0.35);
    const handguard = new THREE.Mesh(handguardGeo, gunmetal);
    handguard.position.set(0, 0, -0.45);
    group.add(handguard);

    // Barrel & Muzzle Brake
    const barrelGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.35, 8);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, darkMetal);
    barrel.position.set(0, 0.02, -0.7);
    group.add(barrel);

    const brakeGeo = new THREE.BoxGeometry(0.04, 0.05, 0.08);
    const brake = new THREE.Mesh(brakeGeo, gunmetal);
    brake.position.set(0, 0.02, -0.88);
    group.add(brake);

    // Curved Magazine
    const magGeo = new THREE.BoxGeometry(0.05, 0.22, 0.1);
    const mag = new THREE.Mesh(magGeo, gunmetal);
    mag.rotation.x = 0.25;
    mag.position.set(0, -0.12, -0.15);
    group.add(mag);

    // Pistol Grip & Stock
    const gripGeo = new THREE.BoxGeometry(0.05, 0.16, 0.07);
    const grip = new THREE.Mesh(gripGeo, darkMetal);
    grip.rotation.x = -0.3;
    grip.position.set(0, -0.12, 0.1);
    group.add(grip);

    const stockGeo = new THREE.BoxGeometry(0.06, 0.1, 0.28);
    const stock = new THREE.Mesh(stockGeo, gunmetal);
    stock.position.set(0, 0.02, 0.28);
    group.add(stock);

    // Holographic Sight Mount & Glowing Reticle
    const sightGeo = new THREE.BoxGeometry(0.05, 0.05, 0.14);
    const sight = new THREE.Mesh(sightGeo, darkMetal);
    sight.position.set(0, 0.09, -0.1);
    group.add(sight);

    const reticleGeo = new THREE.RingGeometry(0.008, 0.012, 8);
    const reticle = new THREE.Mesh(reticleGeo, accentCyan);
    reticle.position.set(0, 0.09, -0.18);
    group.add(reticle);
  } else if (weaponId === 'operator') {
    // --- OPERATOR (SNIPER) ---
    // Elongated Heavy Receiver
    const bodyGeo = new THREE.BoxGeometry(0.09, 0.14, 0.7);
    const body = new THREE.Mesh(bodyGeo, darkMetal);
    body.position.set(0, 0, -0.1);
    group.add(body);

    // Heavy Fluted Barrel
    const barrelGeo = new THREE.CylinderGeometry(0.022, 0.025, 0.75, 8);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, gunmetal);
    barrel.position.set(0, 0.03, -0.8);
    group.add(barrel);

    // Massive Muzzle Compensator
    const compGeo = new THREE.BoxGeometry(0.06, 0.06, 0.12);
    const comp = new THREE.Mesh(compGeo, darkMetal);
    comp.position.set(0, 0.03, -1.2);
    group.add(comp);

    // High-Power Scope Tube
    const scopeGeo = new THREE.CylinderGeometry(0.03, 0.035, 0.4, 12);
    scopeGeo.rotateX(Math.PI / 2);
    const scope = new THREE.Mesh(scopeGeo, gunmetal);
    scope.position.set(0, 0.14, -0.15);
    group.add(scope);

    // Scope Mount Rings
    const ringGeo = new THREE.BoxGeometry(0.08, 0.06, 0.04);
    const ringF = new THREE.Mesh(ringGeo, darkMetal);
    ringF.position.set(0, 0.1, -0.28);
    const ringR = new THREE.Mesh(ringGeo, darkMetal);
    ringR.position.set(0, 0.1, -0.02);
    group.add(ringF, ringR);

    // Scope Lens Ring Glowing Orange
    const lensGeo = new THREE.RingGeometry(0.015, 0.028, 12);
    const lens = new THREE.Mesh(lensGeo, accentOrange);
    lens.position.set(0, 0.14, -0.36);
    group.add(lens);

    // Solid Sniper Stock
    const stockGeo = new THREE.BoxGeometry(0.07, 0.14, 0.35);
    const stock = new THREE.Mesh(stockGeo, darkMetal);
    stock.position.set(0, -0.02, 0.35);
    group.add(stock);

    // Magazine & Grip
    const magGeo = new THREE.BoxGeometry(0.06, 0.18, 0.12);
    const mag = new THREE.Mesh(magGeo, gunmetal);
    mag.position.set(0, -0.14, -0.1);
    group.add(mag);

    const gripGeo = new THREE.BoxGeometry(0.05, 0.15, 0.06);
    const grip = new THREE.Mesh(gripGeo, darkMetal);
    grip.rotation.x = -0.35;
    grip.position.set(0, -0.12, 0.12);
    group.add(grip);
  } else if (weaponId === 'classic') {
    // --- CLASSIC (SIDEARM / PISTOL) ---
    // Slide
    const slideGeo = new THREE.BoxGeometry(0.055, 0.07, 0.26);
    const slide = new THREE.Mesh(slideGeo, gunmetal);
    slide.position.set(0, 0.04, -0.05);
    group.add(slide);

    // Frame
    const frameGeo = new THREE.BoxGeometry(0.05, 0.06, 0.22);
    const frame = new THREE.Mesh(frameGeo, darkMetal);
    frame.position.set(0, -0.01, -0.04);
    group.add(frame);

    // Grip
    const gripGeo = new THREE.BoxGeometry(0.045, 0.15, 0.07);
    const grip = new THREE.Mesh(gripGeo, darkMetal);
    grip.rotation.x = -0.28;
    grip.position.set(0, -0.1, 0.04);
    group.add(grip);

    // Front / Rear Sights
    const frontSightGeo = new THREE.BoxGeometry(0.01, 0.015, 0.02);
    const frontSight = new THREE.Mesh(frontSightGeo, accentCyan);
    frontSight.position.set(0, 0.08, -0.17);
    group.add(frontSight);
  } else {
    // --- TACTICAL KNIFE ---
    const handleGeo = new THREE.BoxGeometry(0.04, 0.05, 0.18);
    const handle = new THREE.Mesh(handleGeo, darkMetal);
    handle.position.set(0, 0, 0.08);
    group.add(handle);

    const guardGeo = new THREE.BoxGeometry(0.06, 0.08, 0.02);
    const guard = new THREE.Mesh(guardGeo, gunmetal);
    guard.position.set(0, 0, -0.02);
    group.add(guard);

    // Tanto-style angular blade
    const bladeGeo = new THREE.BoxGeometry(0.015, 0.06, 0.24);
    const blade = new THREE.Mesh(bladeGeo, gunmetal);
    blade.position.set(0, 0.01, -0.14);
    group.add(blade);

    // Glowing Neon Edge
    const edgeGeo = new THREE.BoxGeometry(0.005, 0.01, 0.22);
    const edge = new THREE.Mesh(edgeGeo, accentCyan);
    edge.position.set(0, -0.025, -0.14);
    group.add(edge);
  }

  return group;
}
