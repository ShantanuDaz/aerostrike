import { describe, expect, it } from 'vitest';
import type { GameMap } from '../map/types';
import type { InputState, Player } from './types';
import {
  BOOST_RECOVER_THRESHOLD,
  BOOST_REGEN_AIR,
  DASH_COOLDOWN_SEC,
  DASH_FUEL_COST,
  PLAYER_HALF_HEIGHT,
  PLAYER_HALF_WIDTH,
  updatePlayer,
} from './updatePlayer';

function createTestMap(overrides: Partial<GameMap> = {}): GameMap {
  return {
    id: 'test-arena',
    name: 'Test Arena',
    width: 1600,
    height: 1000,
    backgroundColor: '#000',
    baseBlue: { x: 40, y: 700, width: 200, height: 150 },
    baseRed: { x: 1360, y: 700, width: 200, height: 150 },
    flagBlue: { x: 140, y: 800 },
    flagRed: { x: 1460, y: 800 },
    spawnPointsBlue: [{ x: 150, y: 800 }],
    spawnPointsRed: [{ x: 1450, y: 800 }],
    weaponSpawns: [],
    obstacles: [
      { x: 0, y: 860, width: 1600, height: 140, type: 'ground' },
    ],
    ...overrides,
  };
}

function createTestPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'pilot_test_1',
    team: 'blue',
    x: 400,
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
      callsign: 'TestPilot',
      bodyColor: '#2563eb',
      skinTone: '#fed7aa',
      headgear: 'soldier_helmet',
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

const IDLE_INPUT: InputState = {
  moveX: 0,
  moveY: 0,
  boosting: false,
  aimAngle: 0,
  shooting: false,
  dash: false,
};

describe('updatePlayer physics and collision', () => {
  it('blocks horizontal motion cleanly against solid walls without snagging', () => {
    const map = createTestMap({
      obstacles: [
        { x: 0, y: 860, width: 1600, height: 140, type: 'ground' },
        { x: 500, y: 760, width: 40, height: 100, type: 'wall' },
      ],
    });
    let player = createTestPlayer({ x: 484, vx: 2.5 });

    for (let i = 0; i < 10; i++) {
      player = updatePlayer(player, { ...IDLE_INPUT, moveX: 1 }, map, 1 / 60, true);
    }

    expect(player.x).toBeLessThanOrEqual(500 - PLAYER_HALF_WIDTH + 0.001);
    expect(player.vx).toBe(0);
    expect(player.isGrounded).toBe(true);
  });

  it('supports one-way platforms from above and drop-through via moveY > 0.5 while keeping ground solid', () => {
    const map = createTestMap({
      obstacles: [
        { x: 0, y: 860, width: 1600, height: 140, type: 'ground' },
        { x: 300, y: 740, width: 200, height: 16, type: 'platform' },
      ],
    });

    // Landing on platform from just above
    let player = createTestPlayer({
      x: 400,
      y: 740 - PLAYER_HALF_HEIGHT - 1,
      vy: 3,
      isGrounded: false,
    });
    player = updatePlayer(player, IDLE_INPUT, map, 1 / 60, true);
    expect(player.y).toBeCloseTo(740 - PLAYER_HALF_HEIGHT, 3);
    expect(player.isGrounded).toBe(true);

    // Pressing down initiates drop-through past platform top
    player = updatePlayer(player, { ...IDLE_INPUT, moveY: 1 }, map, 1 / 60, true);
    for (let i = 0; i < 18; i++) {
      player = updatePlayer(player, { ...IDLE_INPUT, moveY: 1 }, map, 1 / 60, true);
    }
    expect(player.y).toBeGreaterThan(740);

    // Ground still stops player even while holding down
    for (let i = 0; i < 40; i++) {
      player = updatePlayer(player, { ...IDLE_INPUT, moveY: 1 }, map, 1 / 60, true);
    }
    expect(player.y).toBeLessThanOrEqual(860 - PLAYER_HALF_HEIGHT + 0.01);
    expect(player.isGrounded).toBe(true);
    expect(player.vy).toBe(0);
  });

  it('prevents high-speed dash tunneling through narrow solid walls and pushes out deep overlaps', () => {
    const map = createTestMap({
      obstacles: [
        { x: 0, y: 860, width: 1600, height: 140, type: 'ground' },
        { x: 500, y: 650, width: 12, height: 210, type: 'wall' },
      ],
    });

    // At dt = 0.05 (dtScale = 3), dash displacement exceeds 28px and would clear a 12px wall without sweep
    const preDash = createTestPlayer({
      x: 500 - PLAYER_HALF_WIDTH - 2,
      y: 780,
      isGrounded: false,
      boostFuel: 100,
    });
    const postDash = updatePlayer(
      preDash,
      { ...IDLE_INPUT, moveX: 1, dash: true },
      map,
      0.05,
      true,
    );
    expect(postDash.x).toBeLessThanOrEqual(500 - PLAYER_HALF_WIDTH + 0.001);
    expect(postDash.vx).toBe(0);

    // Overlapping past the old 2px edge threshold still resolves cleanly out of the wall
    const overlapped = createTestPlayer({
      x: 500 - PLAYER_HALF_WIDTH + 5,
      y: 780,
      vx: 2,
      isGrounded: false,
    });
    const resolved = updatePlayer(overlapped, IDLE_INPUT, map, 1 / 60, true);
    expect(resolved.x).toBeLessThanOrEqual(500 - PLAYER_HALF_WIDTH + 0.001);

    // Shallow vertical overlap into a wide ground floor pushes upward onto floor, never teleporting horizontally
    const sunkOnFloor = createTestPlayer({
      x: 800,
      y: 860 - PLAYER_HALF_HEIGHT + 6,
      vx: 0,
      vy: 0,
      isGrounded: true,
    });
    const lifted = updatePlayer(sunkOnFloor, IDLE_INPUT, map, 1 / 60, true);
    expect(lifted.x).toBeCloseTo(800, 3);
    expect(lifted.y).toBeCloseTo(860 - PLAYER_HALF_HEIGHT, 2);
    expect(lifted.isGrounded).toBe(true);
  });

  it('enforces jetpack fuel overheat hysteresis and 1.15x flag-carrier drain penalty', () => {
    const map = createTestMap();
    const boostInput: InputState = { ...IDLE_INPUT, boosting: true };

    const normal = updatePlayer(
      createTestPlayer({ boostFuel: 50, isGrounded: false, y: 500 }),
      boostInput,
      map,
      1 / 60,
      true,
    );
    const carrier = updatePlayer(
      createTestPlayer({ boostFuel: 50, carryingFlag: true, isGrounded: false, y: 500 }),
      boostInput,
      map,
      1 / 60,
      true,
    );
    expect(50 - carrier.boostFuel).toBeCloseTo((50 - normal.boostFuel) * 1.15, 4);

    // Depleting fuel locks fuelOverheated until fuel reaches threshold
    let empty = createTestPlayer({ boostFuel: 0.2, isGrounded: false, y: 500 });
    empty = updatePlayer(empty, boostInput, map, 1 / 60, true);
    expect(empty.boostFuel).toBe(0);
    expect(empty.fuelOverheated).toBe(true);

    // Regenerating below threshold must stay overheated and refuse thrust even if boosting is held
    let recovering = { ...empty, boostFuel: BOOST_RECOVER_THRESHOLD - 2, vy: 2 };
    recovering = updatePlayer(recovering, boostInput, map, 1 / 60, true);
    expect(recovering.fuelOverheated).toBe(true);
    expect(recovering.vy).toBeGreaterThan(2); // Falling due to gravity, no thrust

    // Crossing recovery threshold clears fuelOverheated
    const recovered = updatePlayer(
      { ...empty, boostFuel: BOOST_RECOVER_THRESHOLD + 0.5, isGrounded: true },
      IDLE_INPUT,
      map,
      1 / 60,
      true,
    );
    expect(recovered.fuelOverheated).toBe(false);
  });

  it('triggers ground hop on boost tap and directional dash with fuel cost and cooldown', () => {
    const map = createTestMap();

    // Ground hop impulse
    const hopped = updatePlayer(
      createTestPlayer({ isGrounded: true, wasBoostInput: false }),
      { ...IDLE_INPUT, boosting: true },
      map,
      1 / 60,
      true,
    );
    expect(hopped.vy).toBeLessThan(-3.5);

    // Thruster dash consumes DASH_FUEL_COST fuel and starts air regen
    const dashed = updatePlayer(
      createTestPlayer({ x: 400, y: 500, isGrounded: false, boostFuel: 80 }),
      { ...IDLE_INPUT, moveX: -1, dash: true },
      map,
      1 / 60,
      true,
    );
    expect(dashed.vx).toBeLessThan(-8);
    expect(dashed.boostFuel).toBeCloseTo(80 - DASH_FUEL_COST + BOOST_REGEN_AIR, 4);
    expect(dashed.dashCooldown).toBeCloseTo(DASH_COOLDOWN_SEC, 3);

    // Immediate second dash ignored while on cooldown (only air regen applies, no dash cost)
    const blocked = updatePlayer(
      dashed,
      { ...IDLE_INPUT, moveX: 1, dash: true },
      map,
      1 / 60,
      true,
    );
    expect(blocked.vx).toBeLessThan(0);
    expect(blocked.boostFuel).toBeCloseTo(dashed.boostFuel + BOOST_REGEN_AIR, 4);
  });

  it('launches on bounce pads cleanly and applies configurable respawn delay on hazards', () => {
    const map = createTestMap({
      bouncePads: [
        { id: 'pad-1', x: 600, y: 848, width: 60, height: 12, launchVy: -13.5, launchVx: 4.2 },
      ],
      obstacles: [
        { x: 0, y: 860, width: 1600, height: 140, type: 'ground' },
        { x: 900, y: 830, width: 120, height: 30, type: 'hazard' },
      ],
    });

    // Bounce pad launch sets upward & horizontal velocity + cooldown
    const bounced = updatePlayer(
      createTestPlayer({ x: 625, y: 855 - PLAYER_HALF_HEIGHT }),
      IDLE_INPUT,
      map,
      1 / 60,
      true,
    );
    expect(bounced.vy).toBeCloseTo(-13.5, 4);
    expect(bounced.vx).toBeCloseTo(4.2, 4);
    expect(bounced.isGrounded).toBe(false);
    expect(bounced.bounceCooldownTimer).toBeCloseTo(0.18, 4);

    // Hazard kills player, strips flag, and uses provided respawnDelaySec (e.g., 6.5s tactical rule)
    const killed = updatePlayer(
      createTestPlayer({ x: 940, y: 845 - PLAYER_HALF_HEIGHT, carryingFlag: true }),
      IDLE_INPUT,
      map,
      1 / 60,
      true,
      6.5,
    );
    expect(killed.isDead).toBe(true);
    expect(killed.health).toBe(0);
    expect(killed.carryingFlag).toBe(false);
    expect(killed.respawnTimer).toBe(6.5);

    // Ticking 6.5s revives pilot at team spawn with spawn invulnerability
    let dead = killed;
    for (let i = 0; i < 135 && dead.isDead; i++) {
      dead = updatePlayer(dead, IDLE_INPUT, map, 0.05, true, 6.5);
    }
    expect(dead.isDead).toBe(false);
    expect(dead.x).toBe(150);
    expect(dead.y).toBe(800);
    expect(dead.health).toBe(100);
    expect(dead.invulnerableTimer).toBe(2.5);
    expect(dead.bounceCooldownTimer).toBe(0);
  });
});
