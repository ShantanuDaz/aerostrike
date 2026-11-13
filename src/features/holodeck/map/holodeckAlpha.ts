import * as THREE from 'three';
import { createTriplanarGridMaterial } from './shaders/triplanarGridShader';
import {
  blockToAABB,
  type MapBlockDef,
  type MapSpawnDef,
  type PlantZoneDef,
} from './mapColliders';
import type { AABB } from '../physics/sweptAABB';

export interface HolodeckMapData {
  blocks: MapBlockDef[];
  plantZones: PlantZoneDef[];
  spawns: MapSpawnDef[];
  colliders: AABB[];
}

export function generateHolodeckAlphaData(): HolodeckMapData {
  const blocks: MapBlockDef[] = [
    // --- MAIN GROUNDS & CORRIDOR FLOORS ---
    { id: 'floor_main', name: 'Main Ground Floor', position: [0, -0.5, 0], size: [110, 1, 130], materialType: 'slate' },

    // --- PERIMETER BOUNDARY WALLS (H = 6m) ---
    { id: 'wall_north', name: 'North Boundary Wall', position: [0, 3, -65], size: [110, 6, 2], materialType: 'slate' },
    { id: 'wall_south', name: 'South Boundary Wall', position: [0, 3, 65], size: [110, 6, 2], materialType: 'slate' },
    { id: 'wall_west', name: 'West Boundary Wall', position: [-55, 3, 0], size: [2, 6, 130], materialType: 'slate' },
    { id: 'wall_east', name: 'East Boundary Wall', position: [55, 3, 0], size: [2, 6, 130], materialType: 'slate' },

    // --- LANE DIVIDERS (Creating 3-Lane Structure: Lane A, Mid, Lane B) ---
    // West Divider (Between Lane B and Mid)
    { id: 'div_west_south', name: 'West Divider South', position: [-18, 3, 30], size: [2, 6, 40], materialType: 'slate' },
    { id: 'div_west_north', name: 'West Divider North', position: [-18, 3, -30], size: [2, 6, 40], materialType: 'slate' },

    // East Divider (Between Lane A and Mid)
    { id: 'div_east_south', name: 'East Divider South', position: [18, 3, 30], size: [2, 6, 40], materialType: 'slate' },
    { id: 'div_east_north', name: 'East Divider North', position: [18, 3, -30], size: [2, 6, 40], materialType: 'slate' },

    // --- SITE A (CYAN THEATER, X = +35, Z = -20) ---
    // Site A Main Platform
    { id: 'site_a_plat', name: 'Site A Platform', position: [35, 0.4, -20], size: [24, 0.8, 24], materialType: 'site_a' },
    // Site A Cover Crates
    { id: 'site_a_box1', name: 'Site A Double Box', position: [32, 1.5, -18], size: [3, 2.2, 3], materialType: 'accent' },
    { id: 'site_a_box2', name: 'Site A Rad Box', position: [38, 1.2, -24], size: [2.5, 1.6, 2.5], materialType: 'site_a' },
    { id: 'site_a_pillar', name: 'Site A Anchor Pillar', position: [44, 3, -15], size: [3, 6, 3], materialType: 'slate' },
    // A Catwalk (Sniper Rafter)
    { id: 'site_a_catwalk', name: 'A Long Catwalk', position: [48, 3.2, -32], size: [10, 0.4, 16], materialType: 'accent' },
    { id: 'site_a_ramp', name: 'A Catwalk Access Ramp', position: [48, 1.5, -43], size: [4, 0.4, 8], materialType: 'slate' },

    // --- SITE B (ORANGE THEATER, X = -35, Z = -20) ---
    // Site B Main Platform
    { id: 'site_b_plat', name: 'Site B Platform', position: [-35, 0.4, -20], size: [24, 0.8, 24], materialType: 'site_b' },
    // Site B Cover Structures & Choke Pillars
    { id: 'site_b_pillar1', name: 'Site B Left Pillar', position: [-38, 3, -22], size: [2.8, 6, 2.8], materialType: 'site_b' },
    { id: 'site_b_pillar2', name: 'Site B Right Pillar', position: [-30, 3, -22], size: [2.8, 6, 2.8], materialType: 'site_b' },
    { id: 'site_b_box1', name: 'Site B Storage Container', position: [-32, 1.4, -12], size: [6, 2.0, 3], materialType: 'accent' },
    { id: 'site_b_box2', name: 'Site B Low Wall', position: [-44, 0.9, -20], size: [4, 1.0, 2], materialType: 'site_b' },

    // --- MID LANE & CONNECTORS ---
    // Mid Tower / Sniper Window
    { id: 'mid_nest', name: 'Mid Sniper Nest', position: [0, 2.6, -10], size: [14, 0.6, 12], materialType: 'accent' },
    { id: 'mid_ramp_def', name: 'Mid Defender Ramp', position: [0, 1.2, -20], size: [6, 0.4, 10], materialType: 'slate' },
    // Mid Cover Boxes
    { id: 'mid_box_center', name: 'Mid Center Barrier', position: [0, 1.2, 5], size: [4, 1.6, 2.5], materialType: 'slate' },
    { id: 'mid_connector_a', name: 'Mid to A Choke Wall', position: [24, 3, 0], size: [10, 6, 2], materialType: 'slate' },
    { id: 'mid_connector_b', name: 'Mid to B Choke Wall', position: [-24, 3, 0], size: [10, 6, 2], materialType: 'slate' },

    // --- DEFENDER SPAWN (NORTH, Z = -52) ---
    { id: 'def_spawn_backwall', name: 'Defender Spawn Screen', position: [0, 2.5, -55], size: [22, 4, 1.5], materialType: 'slate' },
    { id: 'def_spawn_box_l', name: 'Defender Left Bench', position: [-12, 0.8, -50], size: [3, 0.8, 3], materialType: 'accent' },
    { id: 'def_spawn_box_r', name: 'Defender Right Bench', position: [12, 0.8, -50], size: [3, 0.8, 3], materialType: 'accent' },

    // --- ATTACKER SPAWN (SOUTH, Z = +52) ---
    { id: 'atk_spawn_backwall', name: 'Attacker Spawn Screen', position: [0, 2.5, 55], size: [22, 4, 1.5], materialType: 'slate' },
    { id: 'atk_spawn_box_l', name: 'Attacker Left Pod', position: [-14, 0.8, 48], size: [3.5, 1.0, 3.5], materialType: 'accent' },
    { id: 'atk_spawn_box_r', name: 'Attacker Right Pod', position: [14, 0.8, 48], size: [3.5, 1.0, 3.5], materialType: 'accent' },
  ];

  const plantZones: PlantZoneDef[] = [
    {
      site: 'A',
      center: [35, 0.8, -20],
      size: [18, 3.0, 18],
      label: 'Site A (Cyan)',
    },
    {
      site: 'B',
      center: [-35, 0.8, -20],
      size: [18, 3.0, 18],
      label: 'Site B (Orange)',
    },
  ];

  const spawns: MapSpawnDef[] = [
    // Defenders (Blue) - North facing South (yaw = PI)
    { team: 'blue', position: [0, 0, -50], yaw: Math.PI },
    { team: 'blue', position: [-6, 0, -50], yaw: Math.PI },
    { team: 'blue', position: [6, 0, -50], yaw: Math.PI },
    { team: 'blue', position: [-10, 0, -52], yaw: Math.PI },
    { team: 'blue', position: [10, 0, -52], yaw: Math.PI },

    // Attackers (Red) - South facing North (yaw = 0)
    { team: 'red', position: [0, 0, 50], yaw: 0 },
    { team: 'red', position: [-6, 0, 50], yaw: 0 },
    { team: 'red', position: [6, 0, 50], yaw: 0 },
    { team: 'red', position: [-10, 0, 52], yaw: 0 },
    { team: 'red', position: [10, 0, 52], yaw: 0 },
  ];

  const colliders = blocks.map(blockToAABB);

  return { blocks, plantZones, spawns, colliders };
}

/**
 * Builds the Three.js 3D Scene Group for Holodeck Alpha.
 * Uses PBR materials, soft cast/receive shadow pipeline, and overhead cyber rafters.
 */
export function buildHolodeckAlphaMapGroup(data: HolodeckMapData): THREE.Group {
  const root = new THREE.Group();
  root.name = 'HolodeckAlpha_Map';

  // 1. High-Contrast PBR Materials with Procedural Dev Grid
  const slateMat = createTriplanarGridMaterial({
    baseColor: '#111827', // Rich dark slate
    gridColor: '#1f293d',
    edgeColor: '#38bdf8', // Cyber sky line
    gridScale: 1.0,
    lineWidth: 0.04,
    roughness: 0.55,
    metalness: 0.2,
  });

  const siteAMat = createTriplanarGridMaterial({
    baseColor: '#0c233c',
    gridColor: '#0369a1',
    edgeColor: '#00f0ff', // Vivid Neon Cyan
    gridScale: 0.8,
    lineWidth: 0.06,
    roughness: 0.45,
    metalness: 0.4,
  });

  const siteBMat = createTriplanarGridMaterial({
    baseColor: '#381609',
    gridColor: '#c2410c',
    edgeColor: '#ff7700', // Vivid High-Energy Orange
    gridScale: 0.8,
    lineWidth: 0.06,
    roughness: 0.45,
    metalness: 0.4,
  });

  const accentMat = createTriplanarGridMaterial({
    baseColor: '#1e1b4b',
    gridColor: '#4338ca',
    edgeColor: '#a855f7', // Electric Purple
    gridScale: 1.2,
    lineWidth: 0.05,
    roughness: 0.5,
    metalness: 0.35,
  });

  const materials = {
    slate: slateMat,
    site_a: siteAMat,
    site_b: siteBMat,
    accent: accentMat,
    glass: accentMat,
  };

  // Build Geometry with Shadows
  for (const block of data.blocks) {
    const geo = new THREE.BoxGeometry(block.size[0], block.size[1], block.size[2]);
    const mat = materials[block.materialType ?? 'slate'] || slateMat;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(block.position[0], block.position[1], block.position[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = block.id;
    root.add(mesh);
  }

  // 2. Overhead Cybernetic Ceiling Structural Rafters (adds depth & stadium realism)
  const rafterMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.3,
    metalness: 0.8,
  });

  // Cross-trusses across the roof at Y = 8.5m
  for (let z = -50; z <= 50; z += 25) {
    const truss = new THREE.Mesh(new THREE.BoxGeometry(110, 0.6, 0.8), rafterMat);
    truss.position.set(0, 8.5, z);
    truss.castShadow = true;
    root.add(truss);
  }

  // Longitudinal Spine Beams
  for (const x of [-18, 0, 18]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 130), rafterMat);
    beam.position.set(x, 8.8, 0);
    beam.castShadow = true;
    root.add(beam);
  }

  // 3. Volumetric Energized Plant Boundaries for Site A & Site B
  for (const zone of data.plantZones) {
    const isA = zone.site === 'A';
    const color = isA ? 0x00f0ff : 0xff7700;

    // A. Floor Ring Outline
    const ringGeo = new THREE.RingGeometry(zone.size[0] / 2 - 0.4, zone.size[0] / 2, 4);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.rotation.z = Math.PI / 4;
    ringMesh.position.set(zone.center[0], zone.center[1] + 0.05, zone.center[2]);
    root.add(ringMesh);

    // B. Corner Boundary Hologram Pylons (4 vertical energy pillars per site)
    const half = zone.size[0] / 2;
    const cornerOffsets = [
      [-half, -half],
      [half, -half],
      [-half, half],
      [half, half],
    ];

    const pylonMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
      wireframe: true,
    });

    for (const [ox, oz] of cornerOffsets) {
      const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.5, 6), pylonMat);
      pylon.position.set(zone.center[0] + ox, zone.center[1] + 1.75, zone.center[2] + oz);
      root.add(pylon);
    }
  }

  return root;
}
