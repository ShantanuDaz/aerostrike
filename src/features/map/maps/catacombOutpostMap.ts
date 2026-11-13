import type { GameMap } from '../types';

export const catacombOutpostMap: GameMap = {
  id: 'catacomb-outpost',
  name: 'Catacomb Outpost (Mini Militia Style 2600x1500)',
  width: 2600,
  height: 1500,
  backgroundColor: '#070b14',
  theme: 'canyon_outpost',

  baseBlue: {
    x: 80,
    y: 840,
    width: 320,
    height: 300,
  },

  baseRed: {
    x: 2200,
    y: 840,
    width: 320,
    height: 300,
  },

  flagBlue: {
    x: 220,
    y: 980,
  },

  flagRed: {
    x: 2380,
    y: 980,
  },

  spawnPointsBlue: [
    { x: 160, y: 980 },
    { x: 280, y: 980 },
    { x: 220, y: 560 }, // High watchtower loft
  ],

  spawnPointsRed: [
    { x: 2440, y: 980 },
    { x: 2320, y: 980 },
    { x: 2380, y: 560 }, // High watchtower loft
  ],

  weaponSpawns: [
    // 1. Deep Catacomb Vault: The Contested Center RPG
    { id: 'cat-vault-rocket', x: 1300, y: 1320, weaponType: 'rocket' },
    // 2. High Watchtower Sniper Wings
    { id: 'cat-tower-sniper-l', x: 440, y: 460, weaponType: 'sniper' },
    { id: 'cat-tower-sniper-r', x: 2160, y: 460, weaponType: 'sniper' },
    // 3. Narrow Tunnel Shotguns (CQB Warrens)
    { id: 'cat-cave-shotgun-l', x: 820, y: 1280, weaponType: 'shotgun' },
    { id: 'cat-cave-shotgun-r', x: 1780, y: 1280, weaponType: 'shotgun' },
    // 4. Mid Suspension Bridge Rifles
    { id: 'cat-bridge-rifle-l', x: 1040, y: 810, weaponType: 'rifle' },
    { id: 'cat-bridge-rifle-r', x: 1560, y: 810, weaponType: 'rifle' },
    // 5. Sky Island Mid-Air Assault Rifles
    { id: 'cat-sky-rifle-l', x: 920, y: 340, weaponType: 'rifle' },
    { id: 'cat-sky-rifle-r', x: 1680, y: 340, weaponType: 'rifle' },
  ],

  bouncePads: [
    // Base courtyard launch pads -> Catapult straight over bunker rampart or up to watchtower loft
    { id: 'cat-pad-base-l', x: 330, y: 1028, width: 56, height: 12, launchVy: -13.6, launchVx: 1.2, color: '#22d3ee' },
    { id: 'cat-pad-base-r', x: 2214, y: 1028, width: 56, height: 12, launchVy: -13.6, launchVx: -1.2, color: '#22d3ee' },
    // Deep Catacomb Vertical Shaft Lifters -> Jet blast straight up to Mid Suspension Bridge
    { id: 'cat-pad-shaft-l', x: 1020, y: 1418, width: 52, height: 12, launchVy: -14.4, color: '#38bdf8' },
    { id: 'cat-pad-shaft-r', x: 1528, y: 1418, width: 52, height: 12, launchVy: -14.4, color: '#38bdf8' },
    // Mid Bridge Flank Slingshots toward High Sky Island
    { id: 'cat-pad-sky-l', x: 900, y: 818, width: 50, height: 12, launchVy: -12.8, launchVx: 2.2, color: '#34d399' },
    { id: 'cat-pad-sky-r', x: 1650, y: 818, width: 50, height: 12, launchVy: -12.8, launchVx: -2.2, color: '#34d399' },
  ],

  refillStations: [
    // Subterranean Tunnel Medkits
    { id: 'cat-med-tunnel-l', x: 640, y: 1240, stationType: 'medkit', cooldownSec: 14 },
    { id: 'cat-med-tunnel-r', x: 1960, y: 1240, stationType: 'medkit', cooldownSec: 14 },
    // Watchtower Fuel Stations
    { id: 'cat-fuel-tower-l', x: 220, y: 580, stationType: 'fuel', cooldownSec: 10 },
    { id: 'cat-fuel-tower-r', x: 2380, y: 580, stationType: 'fuel', cooldownSec: 10 },
    // Central Suspension Bridge Tactical Supply Crate
    { id: 'cat-supply-bridge', x: 1300, y: 810, stationType: 'supply', cooldownSec: 16 },
  ],

  obstacles: [
    // --- 1. OUTER ARENA PERIMETER ---
    // Floor
    { id: 'cat-ground', x: 0, y: 1430, width: 2600, height: 70, color: '#161f30', type: 'ground' },
    // Ceiling
    { id: 'cat-ceiling', x: 0, y: 0, width: 2600, height: 40, color: '#161f30', type: 'ground' },
    // Left Boundary Wall
    { id: 'cat-wall-l', x: 0, y: 0, width: 40, height: 1500, color: '#161f30', type: 'wall' },
    // Right Boundary Wall
    { id: 'cat-wall-r', x: 2560, y: 0, width: 40, height: 1500, color: '#161f30', type: 'wall' },

    // --- 2. BLUE WATCHTOWER BUNKERS (LEFT FORTRESS) ---
    // Base Ground Foundation
    { id: 'cat-base-wall-l', x: 60, y: 1040, width: 340, height: 390, color: '#152e4d', type: 'wall' },
    // Flag Pedestal Platform
    { id: 'cat-pedestal-l', x: 140, y: 1010, width: 160, height: 20, color: '#38bdf8', type: 'platform' },
    // Watchtower Upper Loft (Elevated Sniper Deck)
    { id: 'cat-loft-l', x: 80, y: 600, width: 280, height: 22, color: '#2563eb', type: 'platform' },
    // Watchtower Canopy Roof
    { id: 'cat-roof-l', x: 120, y: 440, width: 240, height: 20, color: '#1e3a5f', type: 'platform' },
    // Outer Bunker Deflector Rampart
    { id: 'cat-rampart-l', x: 400, y: 880, width: 36, height: 160, color: '#1d4ed8', type: 'wall' },

    // --- 3. RED WATCHTOWER BUNKERS (RIGHT FORTRESS) ---
    // Base Ground Foundation
    { id: 'cat-base-wall-r', x: 2200, y: 1040, width: 340, height: 390, color: '#4a151d', type: 'wall' },
    // Flag Pedestal Platform
    { id: 'cat-pedestal-r', x: 2300, y: 1010, width: 160, height: 20, color: '#fb7185', type: 'platform' },
    // Watchtower Upper Loft (Elevated Sniper Deck)
    { id: 'cat-loft-r', x: 2240, y: 600, width: 280, height: 22, color: '#dc2626', type: 'platform' },
    // Watchtower Canopy Roof
    { id: 'cat-roof-r', x: 2240, y: 440, width: 240, height: 20, color: '#5c1d24', type: 'platform' },
    // Outer Bunker Deflector Rampart
    { id: 'cat-rampart-r', x: 2164, y: 880, width: 36, height: 160, color: '#b91c1c', type: 'wall' },

    // --- 4. CENTRAL SUSPENSION BRIDGE (MID TIER) ---
    // Left Span
    { id: 'cat-span-l', x: 580, y: 830, width: 380, height: 22, color: '#334155', type: 'platform' },
    // Central Contested Deck
    { id: 'cat-bridge-mid', x: 1100, y: 830, width: 400, height: 24, color: '#475569', type: 'platform' },
    // Right Span
    { id: 'cat-span-r', x: 1640, y: 830, width: 380, height: 22, color: '#334155', type: 'platform' },

    // --- 5. THE CATACOMB TUNNELS & ROCK CEILINGS (SUBTERRANEAN TIER) ---
    // Tunnel Ceiling Left (forms the underground catacomb roof beneath the canyon floor)
    { id: 'cat-cave-roof-l', x: 440, y: 1140, width: 520, height: 32, color: '#1e293b', type: 'platform' },
    // Tunnel Choke Barrier Left (creates the Mini Militia tight crawl-space)
    { id: 'cat-choke-l', x: 740, y: 1240, width: 60, height: 140, color: '#1e293b', type: 'wall' },
    // Tunnel Ceiling Right
    { id: 'cat-cave-roof-r', x: 1640, y: 1140, width: 520, height: 32, color: '#1e293b', type: 'platform' },
    // Tunnel Choke Barrier Right
    { id: 'cat-choke-r', x: 1800, y: 1240, width: 60, height: 140, color: '#1e293b', type: 'wall' },

    // Central Subterranean Pillar (Anchors the deep RPG catacomb chamber)
    { id: 'cat-vault-pillar-l', x: 1120, y: 1180, width: 60, height: 250, color: '#1e293b', type: 'wall' },
    { id: 'cat-vault-pillar-r', x: 1420, y: 1180, width: 60, height: 250, color: '#1e293b', type: 'wall' },

    // Central Under-Chamber Catwalk
    { id: 'cat-vault-catwalk', x: 1200, y: 1340, width: 200, height: 18, color: '#475569', type: 'platform' },

    // --- 6. HIGH SKY ISLANDS & CANOPY PERCHES (TOP TIER) ---
    // Left Sky Rock
    { id: 'cat-sky-isle-l', x: 820, y: 360, width: 220, height: 20, color: '#334155', type: 'platform' },
    // Right Sky Rock
    { id: 'cat-sky-isle-r', x: 1560, y: 360, width: 220, height: 20, color: '#334155', type: 'platform' },
    // Apex Center Cloud Platform
    { id: 'cat-sky-center', x: 1180, y: 220, width: 240, height: 18, color: '#475569', type: 'platform' },

    // Deep Cavern Sump Hazard (Thermal acid pit in deep center)
    { id: 'cat-acid-pit', x: 1180, y: 1410, width: 240, height: 20, color: '#991b1b', type: 'hazard' },
  ],

  terrainShapes: [
    // 1. Organic Rock Slopes for Left Fortress Approach
    {
      kind: 'polygon',
      id: 'cat-slope-l',
      type: 'ground',
      style: 'rock',
      color: '#1a2333',
      trimColor: '#38bdf8',
      points: [
        { x: 440, y: 1080 },
        { x: 560, y: 1140 },
        { x: 440, y: 1140 },
      ],
    },
    // 2. Organic Rock Slopes for Right Fortress Approach
    {
      kind: 'polygon',
      id: 'cat-slope-r',
      type: 'ground',
      style: 'rock',
      color: '#1a2333',
      trimColor: '#fb7185',
      points: [
        { x: 2040, y: 1140 },
        { x: 2160, y: 1080 },
        { x: 2160, y: 1140 },
      ],
    },
    // 3. Subterranean Cavern Stalactites hanging into the catacomb crawlways
    {
      kind: 'polygon',
      id: 'cat-stalactite-l',
      type: 'ground',
      style: 'rock',
      color: '#111827',
      trimColor: '#34d399',
      points: [
        { x: 860, y: 1140 },
        { x: 885, y: 1210 },
        { x: 910, y: 1140 },
      ],
    },
    {
      kind: 'polygon',
      id: 'cat-stalactite-r',
      type: 'ground',
      style: 'rock',
      color: '#111827',
      trimColor: '#34d399',
      points: [
        { x: 1690, y: 1140 },
        { x: 1715, y: 1210 },
        { x: 1740, y: 1140 },
      ],
    },
    // 4. Natural Vaulted Rock Arches framing the Central Canyon
    {
      kind: 'spline_floor',
      id: 'cat-arch-l',
      type: 'wall',
      style: 'rock',
      color: '#1a2333',
      trimColor: '#22d3ee',
      samples: 16,
      topPoints: [
        { x: 540, y: 830 },
        { x: 700, y: 760 },
        { x: 860, y: 830 },
      ],
      bottomPoints: [
        { x: 540, y: 852 },
        { x: 700, y: 792 },
        { x: 860, y: 852 },
      ],
    },
    {
      kind: 'spline_floor',
      id: 'cat-arch-r',
      type: 'wall',
      style: 'rock',
      color: '#1a2333',
      trimColor: '#22d3ee',
      samples: 16,
      topPoints: [
        { x: 1740, y: 830 },
        { x: 1900, y: 760 },
        { x: 2060, y: 830 },
      ],
      bottomPoints: [
        { x: 1740, y: 852 },
        { x: 1900, y: 792 },
        { x: 2060, y: 852 },
      ],
    },
  ],
};
