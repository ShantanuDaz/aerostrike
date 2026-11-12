import type { GameMap } from '../types';

export const ctfArenaMap: GameMap = {
  id: 'ctf-canyon-arena',
  name: 'Canyon Outpost (CTF 3200x1800)',
  width: 3200,
  height: 1800,
  backgroundColor: '#0a0f1d',
  theme: 'canyon_outpost',

  baseBlue: {
    x: 120,
    y: 1250,
    width: 320,
    height: 350,
  },

  baseRed: {
    x: 2760,
    y: 1250,
    width: 320,
    height: 350,
  },

  flagBlue: {
    x: 280,
    y: 1320,
  },

  flagRed: {
    x: 2920,
    y: 1320,
  },

  spawnPointsBlue: [
    { x: 220, y: 1300 },
    { x: 340, y: 1300 },
    { x: 280, y: 1050 },
  ],

  spawnPointsRed: [
    { x: 2860, y: 1300 },
    { x: 2980, y: 1300 },
    { x: 2920, y: 1050 },
  ],

  weaponSpawns: [
    { id: 'w-mid-rocket', x: 1600, y: 880, weaponType: 'rocket' },
    { id: 'w-sky-sniper-left', x: 1000, y: 380, weaponType: 'sniper' },
    { id: 'w-sky-sniper-right', x: 2200, y: 380, weaponType: 'sniper' },
    { id: 'w-mid-shotgun-left', x: 800, y: 1000, weaponType: 'shotgun' },
    { id: 'w-mid-shotgun-right', x: 2400, y: 1000, weaponType: 'shotgun' },
    { id: 'w-tunnel-rifle-left', x: 950, y: 1540, weaponType: 'rifle' },
    { id: 'w-tunnel-rifle-right', x: 2250, y: 1540, weaponType: 'rifle' },
  ],

  bouncePads: [
    // Deep pit edge shafts -> catapult up into mid tier
    { id: 'ctf-pad-pit-l', x: 1260, y: 1708, width: 60, height: 12, launchVy: -13.2, color: '#22d3ee' },
    { id: 'ctf-pad-pit-r', x: 1880, y: 1708, width: 60, height: 12, launchVy: -13.2, color: '#22d3ee' },
    // Mid-flank slingshots toward Sky Islands
    { id: 'ctf-pad-sky-l', x: 665, y: 1138, width: 54, height: 12, launchVy: -12.6, launchVx: -2.2, color: '#34d399' },
    { id: 'ctf-pad-sky-r', x: 2481, y: 1138, width: 54, height: 12, launchVy: -12.6, launchVx: 2.2, color: '#34d399' },
    // Low bridge flank launchers
    { id: 'ctf-pad-bridge-l', x: 1425, y: 1538, width: 48, height: 12, launchVy: -12.2, launchVx: -1.8, color: '#38bdf8' },
    { id: 'ctf-pad-bridge-r', x: 1727, y: 1538, width: 48, height: 12, launchVy: -12.2, launchVx: 1.8, color: '#38bdf8' },
  ],

  refillStations: [
    { id: 'ctf-supply-bridge', x: 1600, y: 1522, stationType: 'supply', cooldownSec: 16 },
    { id: 'ctf-med-mid-l', x: 1180, y: 1022, stationType: 'medkit', cooldownSec: 14 },
    { id: 'ctf-med-mid-r', x: 2020, y: 1022, stationType: 'medkit', cooldownSec: 14 },
    { id: 'ctf-fuel-base-l', x: 220, y: 1072, stationType: 'fuel', cooldownSec: 10 },
    { id: 'ctf-fuel-base-r', x: 2980, y: 1072, stationType: 'fuel', cooldownSec: 10 },
  ],

  obstacles: [
    // --- 1. PERIMETER BOUNDARIES ---
    // Floor
    { x: 0, y: 1720, width: 3200, height: 80, color: '#1e293b', type: 'ground' },
    // Ceiling
    { x: 0, y: 0, width: 3200, height: 40, color: '#1e293b', type: 'ground' },
    // Left Boundary Wall
    { x: 0, y: 0, width: 40, height: 1800, color: '#1e293b', type: 'wall' },
    // Right Boundary Wall
    { x: 3160, y: 0, width: 40, height: 1800, color: '#1e293b', type: 'wall' },

    // --- 2. BLUE BASE FORTRESS (LEFT) ---
    // Ground floor base
    { x: 100, y: 1380, width: 360, height: 340, color: '#1e3a5f', type: 'wall' },
    // Flag pedestal platform
    { x: 200, y: 1340, width: 160, height: 20, color: '#38bdf8', type: 'platform' },
    // Base roof / upper watchtower
    { x: 100, y: 1100, width: 280, height: 24, color: '#2563eb', type: 'platform' },
    // Defensive rampart barrier
    { x: 420, y: 1200, width: 40, height: 180, color: '#1d4ed8', type: 'wall' },

    // --- 3. RED BASE FORTRESS (RIGHT) ---
    // Ground floor base
    { x: 2740, y: 1380, width: 360, height: 340, color: '#5c1d24', type: 'wall' },
    // Flag pedestal platform
    { x: 2840, y: 1340, width: 160, height: 20, color: '#f87171', type: 'platform' },
    // Base roof / upper watchtower
    { x: 2820, y: 1100, width: 280, height: 24, color: '#dc2626', type: 'platform' },
    // Defensive rampart barrier
    { x: 2740, y: 1200, width: 40, height: 180, color: '#b91c1c', type: 'wall' },

    // --- 4. UNDERGROUND TUNNEL SYSTEM (y: 1400 - 1720) ---
    // Tunnel Ceiling Left
    { x: 600, y: 1440, width: 550, height: 28, color: '#334155', type: 'platform' },
    // Tunnel Choke Left
    { x: 850, y: 1560, width: 200, height: 20, color: '#475569', type: 'platform' },
    // Tunnel Ceiling Right
    { x: 2050, y: 1440, width: 550, height: 28, color: '#334155', type: 'platform' },
    // Tunnel Choke Right
    { x: 2150, y: 1560, width: 200, height: 20, color: '#475569', type: 'platform' },

    // Central Hazard Floor (Deep pit)
    { x: 1450, y: 1700, width: 300, height: 20, color: '#991b1b', type: 'hazard' },
    // Low bridge over hazard pit
    { x: 1400, y: 1550, width: 400, height: 22, color: '#475569', type: 'platform' },

    // --- 5. MIDGROUND COMBAT ARENA (y: 800 - 1200) ---
    // Left mid platforms
    { x: 650, y: 1150, width: 260, height: 22, color: '#475569', type: 'platform' },
    { x: 750, y: 920, width: 220, height: 22, color: '#475569', type: 'platform' },
    { x: 1050, y: 1050, width: 260, height: 22, color: '#475569', type: 'platform' },

    // Center Mid Hub (Major contest zone for Rocket Launcher)
    { x: 1450, y: 900, width: 300, height: 24, color: '#e2e8f0', type: 'platform' },
    { x: 1350, y: 1100, width: 200, height: 22, color: '#475569', type: 'platform' },
    { x: 1650, y: 1100, width: 200, height: 22, color: '#475569', type: 'platform' },
    // Center pillar cover
    { x: 1580, y: 924, width: 40, height: 176, color: '#334155', type: 'wall' },

    // Right mid platforms
    { x: 1890, y: 1050, width: 260, height: 22, color: '#475569', type: 'platform' },
    { x: 2230, y: 920, width: 220, height: 22, color: '#475569', type: 'platform' },
    { x: 2290, y: 1150, width: 260, height: 22, color: '#475569', type: 'platform' },

    // --- 6. HIGH SKYWAY (SNIPER NESTS) (y: 350 - 650) ---
    // Left Sky Island
    { x: 450, y: 650, width: 240, height: 20, color: '#64748b', type: 'platform' },
    { x: 880, y: 400, width: 260, height: 22, color: '#94a3b8', type: 'platform' },

    // Central Sky Zeppelin / High Platform
    { x: 1420, y: 450, width: 360, height: 24, color: '#cbd5e1', type: 'platform' },
    { x: 1570, y: 350, width: 60, height: 100, color: '#475569', type: 'wall' },

    // Right Sky Island
    { x: 2060, y: 400, width: 260, height: 22, color: '#94a3b8', type: 'platform' },
    { x: 2510, y: 650, width: 240, height: 20, color: '#64748b', type: 'platform' },
  ],

  terrainShapes: [
    // Outer Base Cliff Slope Ramps (run up/down seamlessly between courtyard cliff & canyon floor)
    {
      kind: 'polygon',
      id: 'ctf-ramp-blue-base',
      type: 'ground',
      style: 'rock',
      color: '#1e293b',
      trimColor: '#38bdf8',
      points: [
        { x: 460, y: 1585 },
        { x: 620, y: 1720 },
        { x: 460, y: 1720 },
      ],
    },
    {
      kind: 'polygon',
      id: 'ctf-ramp-red-base',
      type: 'ground',
      style: 'rock',
      color: '#1e293b',
      trimColor: '#fb7185',
      points: [
        { x: 2580, y: 1720 },
        { x: 2740, y: 1585 },
        { x: 2740, y: 1720 },
      ],
    },
    // Sloped Rampart Deflectors atop Forward Base Barriers
    {
      kind: 'polygon',
      id: 'ctf-cap-blue',
      type: 'wall',
      style: 'deflector',
      color: '#1d4ed8',
      trimColor: '#38bdf8',
      points: [
        { x: 420, y: 1170 },
        { x: 460, y: 1200 },
        { x: 420, y: 1200 },
      ],
    },
    {
      kind: 'polygon',
      id: 'ctf-cap-red',
      type: 'wall',
      style: 'deflector',
      color: '#b91c1c',
      trimColor: '#fb7185',
      points: [
        { x: 2780, y: 1170 },
        { x: 2780, y: 1200 },
        { x: 2740, y: 1200 },
      ],
    },
    // Smooth Canyon Berms Leading Down Toward Pit Rescue Pads
    {
      kind: 'spline_floor',
      id: 'ctf-berm-left',
      type: 'ground',
      style: 'rock',
      color: '#233149',
      trimColor: '#38bdf8',
      bottomY: 1720,
      samples: 12,
      topPoints: [
        { x: 1110, y: 1645 },
        { x: 1185, y: 1672 },
        { x: 1245, y: 1720 },
      ],
    },
    {
      kind: 'spline_floor',
      id: 'ctf-berm-right',
      type: 'ground',
      style: 'rock',
      color: '#233149',
      trimColor: '#38bdf8',
      bottomY: 1720,
      samples: 12,
      topPoints: [
        { x: 1955, y: 1720 },
        { x: 2015, y: 1672 },
        { x: 2090, y: 1645 },
      ],
    },
    // Arched High Zeppelin Canopy Roof
    {
      kind: 'spline_floor',
      id: 'ctf-zeppelin-arch',
      type: 'wall',
      style: 'alloy',
      color: '#334155',
      trimColor: '#38bdf8',
      samples: 20,
      topPoints: [
        { x: 1380, y: 275 },
        { x: 1600, y: 215 },
        { x: 1820, y: 275 },
      ],
      bottomPoints: [
        { x: 1380, y: 302 },
        { x: 1600, y: 244 },
        { x: 1820, y: 302 },
      ],
    },
  ],
};
