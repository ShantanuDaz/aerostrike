import { describe, expect, it } from 'vitest';
import type { GameMap } from './types';
import { availableMaps, heliosCalderaMap } from './maps';
import {
  getCompiledTerrainShapes,
  isPointInSolidTerrain,
  raycastMapTerrain,
} from './terrainGeometry';
import { PLAYER_HALF_HEIGHT, PLAYER_HALF_WIDTH, updatePlayer } from '../player/updatePlayer';
import type { InputState, Player } from '../player/types';
import { updateBullets } from '../combat/updateBullets';

function makeSlopeTestMap(overrides: Partial<GameMap> = {}): GameMap {
  return {
    id: 'slope-test-map',
    name: 'Slope Test',
    width: 1600,
    height: 1000,
    backgroundColor: '#000',
    theme: 'caldera_orbital',
    baseBlue: { x: 40, y: 700, width: 160, height: 150 },
    baseRed: { x: 1400, y: 700, width: 160, height: 150 },
    flagBlue: { x: 120, y: 810 },
    flagRed: { x: 1480, y: 810 },
    spawnPointsBlue: [{ x: 120, y: 820 }],
    spawnPointsRed: [{ x: 1480, y: 820 }],
    weaponSpawns: [],
    obstacles: [{ x: 0, y: 860, width: 1600, height: 140, type: 'ground' }],
    terrainShapes: [
      // Counter-clockwise 35-deg ramp going up to the right from (300, 860) to (520, 720)
      {
        kind: 'polygon',
        id: 'test-ramp',
        type: 'ground',
        points: [
          { x: 300, y: 860 },
          { x: 520, y: 860 },
          { x: 520, y: 720 },
        ],
      },
      // Curved U-shaped half-pipe bowl from (700, 760) down to (900, 855) and up to (1100, 760)
      {
        kind: 'spline_floor',
        id: 'test-halfpipe',
        type: 'ground',
        bottomY: 860,
        samples: 20,
        topPoints: [
          { x: 700, y: 760 },
          { x: 800, y: 830 },
          { x: 900, y: 850 },
          { x: 1000, y: 830 },
          { x: 1100, y: 760 },
        ],
      },
    ],
    ...overrides,
  };
}

function makeTestPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p_slope_test',
    team: 'blue',
    x: 260,
    y: 860 - PLAYER_HALF_HEIGHT,
    vx: 0,
    vy: 0,
    radius: 16,
    boostFuel: 100,
    maxFuel: 100,
    health: 100,
    maxHealth: 100,
    aimAngle: 0,
    color: '#3b82f6',
    avatar: {
      callsign: 'Test',
      bodyColor: '#2563eb',
      skinTone: '#fed7aa',
      headgear: 'none',
      headgearColor: '#1e293b',
      visorStyle: 'classic',
      visorColor: '#00f0ff',
      jetpackStyle: 'dual_tank',
    },
    isDead: false,
    respawnTimer: 0,
    invulnerableTimer: 0,
    carryingFlag: false,
    isGrounded: true,
    fuelOverheated: false,
    dropThroughTimer: 0,
    coyoteTimer: 0,
    wasBoostInput: false,
    dashCooldown: 0,
    dashActiveTimer: 0,
    bounceCooldownTimer: 0,
    ...overrides,
  };
}

const IDLE: InputState = {
  moveX: 0,
  moveY: 0,
  boosting: false,
  aimAngle: 0,
  shooting: false,
  dash: false,
};

describe('Terrain geometry, slope/curve physics, and map integrity', () => {
  it('compiles clockwise outward normals regardless of author winding order', () => {
    const map = makeSlopeTestMap();
    const compiled = getCompiledTerrainShapes(map);
    expect(compiled).toHaveLength(2);

    const ramp = compiled[0];
    // Find diagonal hypotenuse edge from (300, 860) <-> (520, 720)
    const slopeEdge = ramp.edges.find(
      (e) => Math.abs(e.dx) > 100 && Math.abs(e.dy) > 100,
    )!;
    expect(slopeEdge).toBeDefined();
    expect(slopeEdge.nx).toBeLessThan(0); // points left-up
    expect(slopeEdge.ny).toBeLessThan(-0.7); // points strictly upward
    expect(slopeEdge.isWalkable).toBe(true);
  });

  it('raycasts bullets against sloped & curved hulls and blocks shots behind deflector shields', () => {
    const map = makeSlopeTestMap();

    // Ray firing horizontally at y=790 from x=280 into slope covering (300, 860)-(520, 720)
    // At y=790 (halfway up 140px ramp), slope surface x is 410
    const hit = raycastMapTerrain(280, 790, 500, 790, map);
    expect(hit).not.toBeNull();
    expect(hit!.hitX).toBeCloseTo(410, 0);
    expect(hit!.ny).toBeLessThan(-0.7);

    const res = updateBullets(
      [
        {
          id: 'b_slope',
          shooterId: 's1',
          team: 'blue',
          weaponType: 'rifle',
          x: 280,
          y: 790,
          vx: 180,
          vy: 0,
          damage: 25,
          blastRadius: 0,
          lifespan: 40,
          maxLifespan: 40,
        },
      ],
      map,
      [
        {
          id: 'target_behind',
          team: 'red',
          x: 455,
          y: 790,
          radius: 16,
        },
      ],
      1 / 60,
    );

    expect(res.hits).toHaveLength(0);
    expect(res.activeBullets).toHaveLength(0);
    expect(res.newParticles.length).toBeGreaterThan(0);
  });

  it('allows smooth uphill climbing, downhill ground snapping, and idle stability on slopes', () => {
    const map = makeSlopeTestMap();
    let p = makeTestPlayer({ x: 285, y: 860 - PLAYER_HALF_HEIGHT });

    // Walk up the slope from x=285 past x=410 cleanly on the 300..520 slope face
    for (let i = 0; i < 60; i++) {
      p = updatePlayer(p, { ...IDLE, moveX: 1 }, map, 1 / 60, false);
    }
    expect(p.x).toBeGreaterThan(400);
    expect(p.x).toBeLessThan(505);
    expect(p.y).toBeLessThan(860 - PLAYER_HALF_HEIGHT - 45);
    expect(p.isGrounded).toBe(true);

    // Stand idle on slope: player must settle cleanly without sliding downhill
    for (let i = 0; i < 12; i++) {
      p = updatePlayer(p, IDLE, map, 1 / 60, false);
    }
    const restX = p.x;
    const restY = p.y;
    for (let i = 0; i < 30; i++) {
      p = updatePlayer(p, IDLE, map, 1 / 60, false);
    }
    expect(Math.abs(p.x - restX)).toBeLessThan(0.5);
    expect(Math.abs(p.y - restY)).toBeLessThan(0.5);

    // Run downhill toward x=310: must remain smoothly grounded without hopping
    let groundedFrames = 0;
    for (let i = 0; i < 40; i++) {
      p = updatePlayer(p, { ...IDLE, moveX: -1 }, map, 1 / 60, false);
      if (p.isGrounded) groundedFrames++;
    }
    expect(p.x).toBeLessThan(restX - 50);
    expect(groundedFrames).toBeGreaterThan(32);
  });

  it('glides smoothly along curved arched overhead canopies instead of snagging sharp corners', () => {
    const map = makeSlopeTestMap({
      terrainShapes: [
        {
          kind: 'spline_floor',
          id: 'test-arch-dome',
          type: 'wall',
          samples: 20,
          topPoints: [
            { x: 400, y: 580 },
            { x: 600, y: 500 },
            { x: 800, y: 580 },
          ],
          bottomPoints: [
            { x: 400, y: 620 },
            { x: 600, y: 545 },
            { x: 800, y: 620 },
          ],
        },
      ],
    });

    // Jetpack diagonally up-right into the arched underside curve on the left wing (x=500)
    let p = makeTestPlayer({
      x: 500,
      y: 620,
      vx: 2.5,
      vy: -5.2,
      isGrounded: false,
      boostFuel: 100,
    });

    for (let i = 0; i < 25; i++) {
      p = updatePlayer(
        p,
        { ...IDLE, moveX: 1, boosting: true },
        map,
        1 / 60,
        false,
      );
    }

    // Should slide cleanly upward & rightward beneath/around the dome without tunneling through top
    expect(p.x).toBeGreaterThan(560);
    expect(p.y).toBeGreaterThan(545 + PLAYER_HALF_HEIGHT - 2);
  });

  it('curves horizontal dash velocity smoothly upward along a half-pipe bowl', () => {
    const map = makeSlopeTestMap();
    let p = makeTestPlayer({
      x: 900,
      y: 850 - PLAYER_HALF_HEIGHT - 1,
      vx: 0,
      vy: 0,
      isGrounded: true,
    });

    // Trigger horizontal air-dash rightward into the curved half-pipe lip (900 -> 1100)
    p = updatePlayer(p, { ...IDLE, moveX: 1, dash: true }, map, 1 / 60, false);
    let minVySeen = 0;
    for (let i = 0; i < 26; i++) {
      p = updatePlayer(p, { ...IDLE, moveX: 1 }, map, 1 / 60, false);
      if (p.vy < minVySeen) minVySeen = p.vy;
    }

    // Sliding along the curved upward lip converts dash speed into upward launch velocity
    expect(p.x).toBeGreaterThan(1020);
    expect(p.y).toBeLessThan(850 - PLAYER_HALF_HEIGHT - 25);
    expect(minVySeen).toBeLessThan(-1.5);
  });

  it('keeps spawns, flags, pickups, bounce pads, and stations clear of solids across all maps', () => {
    const allMaps = Object.values(availableMaps);
    expect(allMaps.some((m) => m.id === heliosCalderaMap.id)).toBe(true);

    for (const map of allMaps) {
      expect(map.theme).toBeDefined();

      for (const sp of [...map.spawnPointsBlue, ...map.spawnPointsRed]) {
        expect(sp.x).toBeGreaterThan(PLAYER_HALF_WIDTH);
        expect(sp.x).toBeLessThan(map.width - PLAYER_HALF_WIDTH);
        expect(sp.y).toBeGreaterThan(PLAYER_HALF_HEIGHT);
        expect(sp.y).toBeLessThan(map.height - PLAYER_HALF_HEIGHT);
        expect(isPointInSolidTerrain(sp.x, sp.y, map)).toBe(false);
      }

      expect(isPointInSolidTerrain(map.flagBlue.x, map.flagBlue.y, map)).toBe(false);
      expect(isPointInSolidTerrain(map.flagRed.x, map.flagRed.y, map)).toBe(false);

      for (const wp of map.weaponSpawns) {
        expect(isPointInSolidTerrain(wp.x, wp.y, map)).toBe(false);
      }

      for (const st of map.refillStations ?? []) {
        expect(isPointInSolidTerrain(st.x, st.y, map)).toBe(false);
      }

      for (const pad of map.bouncePads ?? []) {
        const cx = pad.x + pad.width * 0.5;
        const cy = pad.y + 2;
        expect(isPointInSolidTerrain(cx, cy, map)).toBe(false);
      }
    }
  });
});
