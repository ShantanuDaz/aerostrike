import * as THREE from 'three';
import { createTriplanarGridMaterial } from './shaders/triplanarGridShader';
import {
  blockToAABB,
  type MapBlockDef,
  type MapSpawnDef,
  type PlantZoneDef,
} from './mapColliders';
import type { HolodeckMapData } from './holodeckAlpha';

export function generateHolodeckBravoData(): HolodeckMapData {
  const blocks: MapBlockDef[] = [
    // --- MAIN GROUNDS & COURTYARD (120m x 120m) ---
    { id: 'bravo_floor_main', name: 'Nexus Main Floor', position: [0, -0.5, 0], size: [120, 1, 120], materialType: 'slate' },

    // --- PERIMETER BOUNDARY WALLS (H = 7m) ---
    { id: 'bravo_wall_n', name: 'North Boundary Wall', position: [0, 3.5, -60], size: [120, 7, 2], materialType: 'slate' },
    { id: 'bravo_wall_s', name: 'South Boundary Wall', position: [0, 3.5, 60], size: [120, 7, 2], materialType: 'slate' },
    { id: 'bravo_wall_w', name: 'West Boundary Wall', position: [-60, 3.5, 0], size: [2, 7, 120], materialType: 'slate' },
    { id: 'bravo_wall_e', name: 'East Boundary Wall', position: [60, 3.5, 0], size: [2, 7, 120], materialType: 'slate' },

    // --- ELEVATED CATWALK (MID HIGH GROUND, Y = 3.6m) ---
    { id: 'catwalk_bridge', name: 'Central Skybridge', position: [0, 3.6, 0], size: [12, 0.6, 44], materialType: 'accent' },
    { id: 'catwalk_guard_w', name: 'Catwalk West Railing', position: [-5.6, 4.4, 0], size: [0.4, 1.2, 44], materialType: 'slate' },
    { id: 'catwalk_guard_e', name: 'Catwalk East Railing', position: [5.6, 4.4, 0], size: [0.4, 1.2, 44], materialType: 'slate' },
    // Catwalk Access Ramps
    { id: 'catwalk_ramp_n', name: 'North Access Ramp', position: [0, 1.8, -28], size: [8, 0.4, 12], materialType: 'slate' },
    { id: 'catwalk_ramp_s', name: 'South Access Ramp', position: [0, 1.8, 28], size: [8, 0.4, 12], materialType: 'slate' },

    // --- CENTRAL TOWER SUPPORT PILLARS ---
    { id: 'pillar_c1', name: 'Pillar NW', position: [-4, 1.8, -12], size: [2, 3.6, 2], materialType: 'slate' },
    { id: 'pillar_c2', name: 'Pillar NE', position: [4, 1.8, -12], size: [2, 3.6, 2], materialType: 'slate' },
    { id: 'pillar_c3', name: 'Pillar SW', position: [-4, 1.8, 12], size: [2, 3.6, 2], materialType: 'slate' },
    { id: 'pillar_c4', name: 'Pillar SE', position: [4, 1.8, 12], size: [2, 3.6, 2], materialType: 'slate' },

    // --- SITE A (EMERALD SANCTUM, EAST: X = +36, Z = 0) ---
    { id: 'site_a_dais', name: 'Site A Raised Dais', position: [36, 0.5, 0], size: [26, 1.0, 26], materialType: 'site_a' },
    { id: 'site_a_column_n', name: 'Site A Pillar North', position: [36, 3.5, -8], size: [3.5, 6, 3.5], materialType: 'site_a' },
    { id: 'site_a_column_s', name: 'Site A Pillar South', position: [36, 3.5, 8], size: [3.5, 6, 3.5], materialType: 'site_a' },
    { id: 'site_a_crate_1', name: 'Site A Core Crate', position: [42, 1.6, 0], size: [4, 2.2, 4], materialType: 'accent' },
    { id: 'site_a_crate_2', name: 'Site A Rad Shield', position: [28, 1.3, -4], size: [3, 1.6, 2.5], materialType: 'site_a' },
    { id: 'site_a_wall_outer', name: 'Site A Outer Deflector', position: [50, 2.5, 0], size: [2, 5, 20], materialType: 'slate' },

    // --- SITE B (RUBY REACTOR, WEST: X = -36, Z = 0) ---
    { id: 'site_b_dais', name: 'Site B Raised Dais', position: [-36, 0.5, 0], size: [26, 1.0, 26], materialType: 'site_b' },
    { id: 'site_b_column_n', name: 'Site B Reactor Column N', position: [-36, 3.5, -8], size: [3.5, 6, 3.5], materialType: 'site_b' },
    { id: 'site_b_column_s', name: 'Site B Reactor Column S', position: [-36, 3.5, 8], size: [3.5, 6, 3.5], materialType: 'site_b' },
    { id: 'site_b_crate_1', name: 'Site B Core Crate', position: [-42, 1.6, 0], size: [4, 2.2, 4], materialType: 'accent' },
    { id: 'site_b_crate_2', name: 'Site B Rad Shield', position: [-28, 1.3, 4], size: [3, 1.6, 2.5], materialType: 'site_b' },
    { id: 'site_b_wall_outer', name: 'Site B Outer Deflector', position: [-50, 2.5, 0], size: [2, 5, 20], materialType: 'slate' },

    // --- CHOKEPOINT PARTITIONS & FLANK WALLS ---
    { id: 'flank_wall_nw', name: 'Northwest Flank Wall', position: [-20, 3, -34], size: [18, 6, 2], materialType: 'slate' },
    { id: 'flank_wall_ne', name: 'Northeast Flank Wall', position: [20, 3, -34], size: [18, 6, 2], materialType: 'slate' },
    { id: 'flank_wall_sw', name: 'Southwest Flank Wall', position: [-20, 3, 34], size: [18, 6, 2], materialType: 'slate' },
    { id: 'flank_wall_se', name: 'Southeast Flank Wall', position: [20, 3, 34], size: [18, 6, 2], materialType: 'slate' },

    // --- DEFENDER SPAWN (NORTH, Z = -48) ---
    { id: 'def_screen', name: 'Defender Main Screen', position: [0, 2.5, -52], size: [24, 4, 1.5], materialType: 'slate' },
    { id: 'def_bench_l', name: 'Defender Left Pod', position: [-14, 0.8, -48], size: [3.5, 1, 3.5], materialType: 'accent' },
    { id: 'def_bench_r', name: 'Defender Right Pod', position: [14, 0.8, -48], size: [3.5, 1, 3.5], materialType: 'accent' },

    // --- ATTACKER SPAWN (SOUTH, Z = +48) ---
    { id: 'atk_screen', name: 'Attacker Main Screen', position: [0, 2.5, 52], size: [24, 4, 1.5], materialType: 'slate' },
    { id: 'atk_bench_l', name: 'Attacker Left Pod', position: [-14, 0.8, 48], size: [3.5, 1, 3.5], materialType: 'accent' },
    { id: 'atk_bench_r', name: 'Attacker Right Pod', position: [14, 0.8, 48], size: [3.5, 1, 3.5], materialType: 'accent' },
  ];

  const plantZones: PlantZoneDef[] = [
    {
      site: 'A',
      center: [36, 0.8, 0],
      size: [20, 3.0, 20],
      label: 'Site A (Emerald Dais)',
    },
    {
      site: 'B',
      center: [-36, 0.8, 0],
      size: [20, 3.0, 20],
      label: 'Site B (Ruby Reactor)',
    },
  ];

  const spawns: MapSpawnDef[] = [
    // Defenders (Blue) - North facing South
    { team: 'blue', position: [0, 0, -48], yaw: Math.PI },
    { team: 'blue', position: [-8, 0, -48], yaw: Math.PI },
    { team: 'blue', position: [8, 0, -48], yaw: Math.PI },
    { team: 'blue', position: [-14, 0, -50], yaw: Math.PI },
    { team: 'blue', position: [14, 0, -50], yaw: Math.PI },
    // Attackers (Red) - South facing North
    { team: 'red', position: [0, 0, 48], yaw: 0 },
    { team: 'red', position: [-8, 0, 48], yaw: 0 },
    { team: 'red', position: [8, 0, 48], yaw: 0 },
    { team: 'red', position: [-14, 0, 50], yaw: 0 },
    { team: 'red', position: [14, 0, 50], yaw: 0 },
    // TDM / FFA Distributed Respawn Anchors
    { team: 'blue', position: [36, 0.5, 16], yaw: -Math.PI / 2 },
    { team: 'red', position: [-36, 0.5, -16], yaw: Math.PI / 2 },
    { team: 'blue', position: [0, 3.6, 0], yaw: 0 },
    { team: 'red', position: [0, 3.6, 6], yaw: Math.PI },
  ];

  const colliders = blocks.map(blockToAABB);

  return { blocks, plantZones, spawns, colliders };
}

export function buildHolodeckBravoMapGroup(data: HolodeckMapData): THREE.Group {
  const root = new THREE.Group();
  root.name = 'HolodeckBravo_Map';

  // Materials with vibrant Cyberpunk Dev-Grid
  const slateMat = createTriplanarGridMaterial({
    baseColor: '#0a0f1d',
    gridColor: '#1e293b',
    edgeColor: '#38bdf8', // Cyber sky cyan
    gridScale: 1.0,
    lineWidth: 0.04,
    roughness: 0.55,
    metalness: 0.25,
  });

  const siteAMat = createTriplanarGridMaterial({
    baseColor: '#06281e',
    gridColor: '#047857',
    edgeColor: '#10b981', // Vivid Emerald
    gridScale: 0.8,
    lineWidth: 0.06,
    roughness: 0.45,
    metalness: 0.4,
  });

  const siteBMat = createTriplanarGridMaterial({
    baseColor: '#350a14',
    gridColor: '#be123c',
    edgeColor: '#f43f5e', // Vivid Ruby
    gridScale: 0.8,
    lineWidth: 0.06,
    roughness: 0.45,
    metalness: 0.4,
  });

  const accentMat = createTriplanarGridMaterial({
    baseColor: '#2e1065',
    gridColor: '#6d28d9',
    edgeColor: '#c084fc', // Neon Violet
    gridScale: 1.1,
    lineWidth: 0.05,
    roughness: 0.48,
    metalness: 0.35,
  });

  const materials = {
    slate: slateMat,
    site_a: siteAMat,
    site_b: siteBMat,
    accent: accentMat,
    glass: accentMat,
  };

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

  // Overhead Cybernetic Ceiling Structural Rafters at Y = 9.5m
  const rafterMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.3,
    metalness: 0.8,
  });

  for (let z = -50; z <= 50; z += 25) {
    const truss = new THREE.Mesh(new THREE.BoxGeometry(120, 0.6, 0.8), rafterMat);
    truss.position.set(0, 9.5, z);
    truss.castShadow = true;
    root.add(truss);
  }

  for (const x of [-24, 0, 24]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 120), rafterMat);
    beam.position.set(x, 9.5, 0);
    beam.castShadow = true;
    root.add(beam);
  }

  return root;
}
