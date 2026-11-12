import type { GameMap } from '../types';

export const heliosCalderaMap: GameMap = {
  id: 'helios-caldera',
  name: 'Helios Caldera (Sloped Gorge 3400x1900)',
  width: 3400,
  height: 1900,
  backgroundColor: '#0b0816',
  theme: 'caldera_orbital',

  baseBlue: {
    x: 90,
    y: 1270,
    width: 340,
    height: 190,
  },

  baseRed: {
    x: 2970,
    y: 1270,
    width: 340,
    height: 190,
  },

  flagBlue: {
    x: 250,
    y: 1388,
  },

  flagRed: {
    x: 3150,
    y: 1388,
  },

  spawnPointsBlue: [
    { x: 145, y: 1425 },
    { x: 355, y: 1425 },
    { x: 190, y: 1125 },
  ],

  spawnPointsRed: [
    { x: 3255, y: 1425 },
    { x: 3045, y: 1425 },
    { x: 3210, y: 1125 },
  ],

  weaponSpawns: [
    // Apex Solar Dome Rocket Launcher
    { id: 'hc-dome-rocket', x: 1700, y: 730, weaponType: 'rocket' },
    // Center Half-Pipe Bowl Shotgun
    { id: 'hc-bowl-shotgun', x: 1700, y: 1575, weaponType: 'shotgun' },
    // High Sniper Wings
    { id: 'hc-wing-sniper-l', x: 1010, y: 512, weaponType: 'sniper' },
    { id: 'hc-wing-sniper-r', x: 2390, y: 512, weaponType: 'sniper' },
    // Mid Cambered Balcony Rifles
    { id: 'hc-balcony-rifle-l', x: 860, y: 956, weaponType: 'rifle' },
    { id: 'hc-balcony-rifle-r', x: 2540, y: 956, weaponType: 'rifle' },
    // Canyon Crest Mid-Skirmish Rifles
    { id: 'hc-ridge-rifle-l', x: 935, y: 1322, weaponType: 'rifle' },
    { id: 'hc-ridge-rifle-r', x: 2465, y: 1322, weaponType: 'rifle' },
  ],

  bouncePads: [
    // Courtyard catapults over forward deflector & toward high tier
    { id: 'hc-pad-base-l', x: 400, y: 1448, width: 54, height: 12, launchVy: -13.4, launchVx: 1.6, color: '#fb923c' },
    { id: 'hc-pad-base-r', x: 2946, y: 1448, width: 54, height: 12, launchVy: -13.4, launchVx: -1.6, color: '#fb923c' },
    // Upper canopy launchers toward Sniper Wings
    { id: 'hc-pad-sky-l', x: 305, y: 1148, width: 52, height: 12, launchVy: -13.2, launchVx: 3.0, color: '#38bdf8' },
    { id: 'hc-pad-sky-r', x: 3043, y: 1148, width: 52, height: 12, launchVy: -13.2, launchVx: -3.0, color: '#38bdf8' },
    // Subterranean Gorge Pit Lifters
    { id: 'hc-pad-pit-l', x: 1190, y: 1698, width: 54, height: 12, launchVy: -13.6, color: '#22d3ee' },
    { id: 'hc-pad-pit-r', x: 2156, y: 1698, width: 54, height: 12, launchVy: -13.6, color: '#22d3ee' },
    // Under-Bowl Cavern Catwalk Exits
    { id: 'hc-pad-vault-l', x: 1485, y: 1756, width: 50, height: 12, launchVy: -13.4, launchVx: -3.6, color: '#fb923c' },
    { id: 'hc-pad-vault-r', x: 1865, y: 1756, width: 50, height: 12, launchVy: -13.4, launchVx: 3.6, color: '#fb923c' },
  ],

  refillStations: [
    { id: 'hc-supply-vault', x: 1700, y: 1736, stationType: 'supply', cooldownSec: 16 },
    { id: 'hc-med-valley-l', x: 755, y: 1465, stationType: 'medkit', cooldownSec: 14 },
    { id: 'hc-med-valley-r', x: 2645, y: 1465, stationType: 'medkit', cooldownSec: 14 },
    { id: 'hc-fuel-base-l', x: 240, y: 1128, stationType: 'fuel', cooldownSec: 10 },
    { id: 'hc-fuel-base-r', x: 3160, y: 1128, stationType: 'fuel', cooldownSec: 10 },
  ],

  obstacles: [
    // Perimeter Shell
    { x: 0, y: 0, width: 3400, height: 36, color: '#1b1524', type: 'ground' },
    { x: 0, y: 0, width: 40, height: 1900, color: '#1b1524', type: 'wall' },
    { x: 3360, y: 0, width: 40, height: 1900, color: '#1b1524', type: 'wall' },

    // Blue & Red Outpost Bedrock Decks
    { x: 40, y: 1460, width: 580, height: 440, color: '#17253e', type: 'ground' },
    { x: 2780, y: 1460, width: 580, height: 440, color: '#3b1520', type: 'ground' },

    // Flag Pedestals & Upper Canopy Decks
    { x: 180, y: 1418, width: 140, height: 16, color: '#38bdf8', type: 'platform' },
    { x: 90, y: 1160, width: 280, height: 22, color: '#2563eb', type: 'platform' },
    { x: 3080, y: 1418, width: 140, height: 16, color: '#f87171', type: 'platform' },
    { x: 3030, y: 1160, width: 280, height: 22, color: '#dc2626', type: 'platform' },

    // Outer High Step Platforms
    { x: 460, y: 800, width: 210, height: 20, color: '#475569', type: 'platform' },
    { x: 2730, y: 800, width: 210, height: 20, color: '#475569', type: 'platform' },

    // Central Magma Fissure Floor Hazard
    { x: 1180, y: 1845, width: 1040, height: 55, color: '#991b1b', type: 'hazard' },

    // Subterranean Gorge Rescue Steps & Under-Bowl Catwalk
    { x: 1160, y: 1710, width: 115, height: 20, color: '#334155', type: 'platform' },
    { x: 2125, y: 1710, width: 115, height: 20, color: '#334155', type: 'platform' },
    { x: 1470, y: 1768, width: 460, height: 20, color: '#475569', type: 'platform' },
  ],

  terrainShapes: [
    // 1. Sloped 40° Forward Blast Deflectors (Blue Left & Red Right)
    {
      kind: 'polygon',
      id: 'hc-deflector-blue',
      type: 'wall',
      style: 'deflector',
      color: '#1e3a5f',
      trimColor: '#38bdf8',
      points: [
        { x: 470, y: 1340 },
        { x: 505, y: 1340 },
        { x: 645, y: 1460 },
        { x: 470, y: 1460 },
      ],
    },
    {
      kind: 'polygon',
      id: 'hc-deflector-red',
      type: 'wall',
      style: 'deflector',
      color: '#5c1d24',
      trimColor: '#fb7185',
      points: [
        { x: 2895, y: 1340 },
        { x: 2930, y: 1340 },
        { x: 2930, y: 1460 },
        { x: 2755, y: 1460 },
      ],
    },

    // 2. Rolling Organic Canyon Approach Ridges
    {
      kind: 'spline_floor',
      id: 'hc-canyon-ridge-left',
      type: 'ground',
      style: 'rock',
      color: '#261c2e',
      trimColor: '#fb923c',
      bottomY: 1900,
      samples: 24,
      topPoints: [
        { x: 618, y: 1460 },
        { x: 755, y: 1495 },
        { x: 935, y: 1350 },
        { x: 1095, y: 1410 },
        { x: 1205, y: 1525 },
      ],
    },
    {
      kind: 'spline_floor',
      id: 'hc-canyon-ridge-right',
      type: 'ground',
      style: 'rock',
      color: '#261c2e',
      trimColor: '#fb923c',
      bottomY: 1900,
      samples: 24,
      topPoints: [
        { x: 2195, y: 1525 },
        { x: 2305, y: 1410 },
        { x: 2465, y: 1350 },
        { x: 2645, y: 1495 },
        { x: 2782, y: 1460 },
      ],
    },

    // 3. Signature Center "Half-Pipe" Reactor Bowl (dash-ski across for vertical sling launches!)
    {
      kind: 'spline_floor',
      id: 'hc-center-halfpipe',
      type: 'ground',
      style: 'alloy',
      color: '#1e293b',
      trimColor: '#38bdf8',
      samples: 28,
      topPoints: [
        { x: 1300, y: 1415 },
        { x: 1460, y: 1535 },
        { x: 1620, y: 1595 },
        { x: 1700, y: 1605 },
        { x: 1780, y: 1595 },
        { x: 1940, y: 1535 },
        { x: 2100, y: 1415 },
      ],
      bottomPoints: [
        { x: 1300, y: 1475 },
        { x: 1460, y: 1600 },
        { x: 1700, y: 1672 },
        { x: 1940, y: 1600 },
        { x: 2100, y: 1475 },
      ],
    },

    // 4. Arched "Solar Dome" Sniper Canopy Bridge
    {
      kind: 'spline_floor',
      id: 'hc-solar-dome-bridge',
      type: 'wall',
      style: 'deflector',
      color: '#292536',
      trimColor: '#fb923c',
      samples: 26,
      topPoints: [
        { x: 1290, y: 890 },
        { x: 1460, y: 800 },
        { x: 1700, y: 760 },
        { x: 1940, y: 800 },
        { x: 2110, y: 890 },
      ],
      bottomPoints: [
        { x: 1290, y: 932 },
        { x: 1460, y: 846 },
        { x: 1700, y: 806 },
        { x: 1940, y: 846 },
        { x: 2110, y: 932 },
      ],
    },

    // 5. Cambered Flank Balconies
    {
      kind: 'spline_floor',
      id: 'hc-balcony-left',
      type: 'ground',
      style: 'alloy',
      color: '#243145',
      trimColor: '#38bdf8',
      samples: 14,
      topPoints: [
        { x: 690, y: 1020 },
        { x: 860, y: 985 },
        { x: 1030, y: 1025 },
      ],
      bottomPoints: [
        { x: 690, y: 1052 },
        { x: 860, y: 1018 },
        { x: 1030, y: 1057 },
      ],
    },
    {
      kind: 'spline_floor',
      id: 'hc-balcony-right',
      type: 'ground',
      style: 'alloy',
      color: '#243145',
      trimColor: '#38bdf8',
      samples: 14,
      topPoints: [
        { x: 2370, y: 1025 },
        { x: 2540, y: 985 },
        { x: 2710, y: 1020 },
      ],
      bottomPoints: [
        { x: 2370, y: 1057 },
        { x: 2540, y: 1018 },
        { x: 2710, y: 1052 },
      ],
    },

    // 6. High Cambered Sniper Wings
    {
      kind: 'spline_floor',
      id: 'hc-skywing-left',
      type: 'ground',
      style: 'rock',
      color: '#2d3748',
      trimColor: '#fb923c',
      samples: 14,
      topPoints: [
        { x: 840, y: 585 },
        { x: 1010, y: 540 },
        { x: 1180, y: 575 },
      ],
      bottomPoints: [
        { x: 840, y: 615 },
        { x: 1010, y: 572 },
        { x: 1180, y: 605 },
      ],
    },
    {
      kind: 'spline_floor',
      id: 'hc-skywing-right',
      type: 'ground',
      style: 'rock',
      color: '#2d3748',
      trimColor: '#fb923c',
      samples: 14,
      topPoints: [
        { x: 2220, y: 575 },
        { x: 2390, y: 540 },
        { x: 2560, y: 585 },
      ],
      bottomPoints: [
        { x: 2220, y: 605 },
        { x: 2390, y: 572 },
        { x: 2560, y: 615 },
      ],
    },
  ],
};
