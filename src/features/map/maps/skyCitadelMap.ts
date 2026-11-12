import type { GameMap } from '../types';

export const skyCitadelMap: GameMap = {
  id: 'sky-citadel',
  name: 'Sky Citadel (Aerial CTF 2800x1600)',
  width: 2800,
  height: 1600,
  backgroundColor: '#070d1e',
  theme: 'sky_citadel',

  baseBlue: {
    x: 100,
    y: 1020,
    width: 340,
    height: 200,
  },

  baseRed: {
    x: 2360,
    y: 1020,
    width: 340,
    height: 200,
  },

  flagBlue: {
    x: 250,
    y: 1155,
  },

  flagRed: {
    x: 2550,
    y: 1155,
  },

  spawnPointsBlue: [
    { x: 170, y: 1150 },
    { x: 330, y: 1150 },
    { x: 175, y: 890 },
  ],

  spawnPointsRed: [
    { x: 2630, y: 1150 },
    { x: 2470, y: 1150 },
    { x: 2625, y: 890 },
  ],

  weaponSpawns: [
    { id: 'sc-apex-rocket', x: 1400, y: 396, weaponType: 'rocket' },
    { id: 'sc-sniper-left', x: 960, y: 556, weaponType: 'sniper' },
    { id: 'sc-sniper-right', x: 1840, y: 556, weaponType: 'sniper' },
    { id: 'sc-shotgun-left', x: 760, y: 1156, weaponType: 'shotgun' },
    { id: 'sc-shotgun-right', x: 2040, y: 1156, weaponType: 'shotgun' },
    { id: 'sc-rifle-mid-l', x: 1180, y: 896, weaponType: 'rifle' },
    { id: 'sc-rifle-mid-r', x: 1620, y: 896, weaponType: 'rifle' },
  ],

  bouncePads: [
    // Citadel outer edge slingshots across open sky
    { id: 'sc-pad-citadel-l', x: 460, y: 1208, width: 58, height: 12, launchVy: -12.8, launchVx: 4.8, color: '#22d3ee' },
    { id: 'sc-pad-citadel-r', x: 2282, y: 1208, width: 58, height: 12, launchVy: -12.8, launchVx: -4.8, color: '#22d3ee' },
    // Lower island upward interceptors
    { id: 'sc-pad-island-l', x: 830, y: 1168, width: 56, height: 12, launchVy: -12.6, color: '#38bdf8' },
    { id: 'sc-pad-island-r', x: 1914, y: 1168, width: 56, height: 12, launchVy: -12.6, color: '#38bdf8' },
    // Mid-sanctuary elevator pads to high crown
    { id: 'sc-pad-mid-l', x: 1140, y: 908, width: 52, height: 12, launchVy: -12.4, color: '#34d399' },
    { id: 'sc-pad-mid-r', x: 1608, y: 908, width: 52, height: 12, launchVy: -12.4, color: '#34d399' },
  ],

  refillStations: [
    { id: 'sc-supply-mid', x: 1400, y: 740, stationType: 'supply', cooldownSec: 16 },
    { id: 'sc-med-left', x: 710, y: 850, stationType: 'medkit', cooldownSec: 14 },
    { id: 'sc-med-right', x: 2090, y: 850, stationType: 'medkit', cooldownSec: 14 },
    { id: 'sc-fuel-base-l', x: 300, y: 910, stationType: 'fuel', cooldownSec: 10 },
    { id: 'sc-fuel-base-r', x: 2500, y: 910, stationType: 'fuel', cooldownSec: 10 },
  ],

  obstacles: [
    // Perimeter Shell
    { x: 0, y: 0, width: 2800, height: 36, color: '#1e293b', type: 'ground' },
    { x: 0, y: 0, width: 40, height: 1600, color: '#1e293b', type: 'wall' },
    { x: 2760, y: 0, width: 40, height: 1600, color: '#1e293b', type: 'wall' },

    // Open Thermal Sky Abyss
    { x: 540, y: 1555, width: 1720, height: 45, color: '#991b1b', type: 'hazard' },

    // Blue Citadel Island (Left)
    { x: 40, y: 1220, width: 500, height: 380, color: '#162844', type: 'wall' },
    { x: 180, y: 1180, width: 140, height: 20, color: '#38bdf8', type: 'platform' },
    { x: 120, y: 940, width: 240, height: 22, color: '#2563eb', type: 'platform' },
    { x: 420, y: 1050, width: 32, height: 170, color: '#1d4ed8', type: 'wall' },

    // Red Citadel Island (Right)
    { x: 2260, y: 1220, width: 500, height: 380, color: '#451621', type: 'wall' },
    { x: 2480, y: 1180, width: 140, height: 20, color: '#f87171', type: 'platform' },
    { x: 2440, y: 940, width: 240, height: 22, color: '#dc2626', type: 'platform' },
    { x: 2348, y: 1050, width: 32, height: 170, color: '#b91c1c', type: 'wall' },

    // Lower Abyss Floating Islands (Safely stepped bridges)
    { x: 670, y: 1180, width: 250, height: 26, color: '#334155', type: 'platform' },
    { x: 1060, y: 1320, width: 220, height: 24, color: '#334155', type: 'platform' },
    { x: 1520, y: 1320, width: 220, height: 24, color: '#334155', type: 'platform' },
    { x: 1880, y: 1180, width: 250, height: 26, color: '#334155', type: 'platform' },

    // Mid-Tier Aerial Walkways
    { x: 600, y: 880, width: 220, height: 22, color: '#475569', type: 'platform' },
    { x: 1080, y: 920, width: 230, height: 22, color: '#475569', type: 'platform' },
    { x: 1490, y: 920, width: 230, height: 22, color: '#475569', type: 'platform' },
    { x: 1980, y: 880, width: 220, height: 22, color: '#475569', type: 'platform' },

    // Central Sanctuary Pedestal & Shield Walls
    { x: 1270, y: 770, width: 260, height: 24, color: '#64748b', type: 'platform' },
    { x: 1310, y: 630, width: 26, height: 140, color: '#334155', type: 'wall' },
    { x: 1464, y: 630, width: 26, height: 140, color: '#334155', type: 'wall' },

    // High Sniper Towers & Apex Rocket Crown
    { x: 840, y: 580, width: 240, height: 22, color: '#94a3b8', type: 'platform' },
    { x: 1720, y: 580, width: 240, height: 22, color: '#94a3b8', type: 'platform' },
    { x: 1240, y: 420, width: 320, height: 24, color: '#cbd5e1', type: 'platform' },
  ],

  terrainShapes: [
    // Citadel Island Tapered Hull Prows & Bastion Deflectors
    {
      kind: 'polygon',
      id: 'sc-prow-blue',
      type: 'wall',
      style: 'deflector',
      color: '#1e3a5f',
      trimColor: '#22d3ee',
      points: [
        { x: 540, y: 1220 },
        { x: 635, y: 1280 },
        { x: 540, y: 1410 },
      ],
    },
    {
      kind: 'polygon',
      id: 'sc-prow-red',
      type: 'wall',
      style: 'deflector',
      color: '#5c1d24',
      trimColor: '#fb7185',
      points: [
        { x: 2260, y: 1220 },
        { x: 2260, y: 1410 },
        { x: 2165, y: 1280 },
      ],
    },
    // Sloped Sanctuary Crown Arch Over Central Pedestal
    {
      kind: 'spline_floor',
      id: 'sc-sanctuary-arch',
      type: 'wall',
      style: 'alloy',
      color: '#1e3a5f',
      trimColor: '#22d3ee',
      samples: 22,
      topPoints: [
        { x: 1265, y: 625 },
        { x: 1400, y: 562 },
        { x: 1535, y: 625 },
      ],
      bottomPoints: [
        { x: 1265, y: 650 },
        { x: 1400, y: 590 },
        { x: 1535, y: 650 },
      ],
    },
  ],
};
