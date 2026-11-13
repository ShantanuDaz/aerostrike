import { describe, expect, it } from 'vitest';
import { sweptAABB, aabbIntersects, type AABB } from './sweptAABB';
import { tryStepUp } from './stepUpMath';
import {
  createInitialKCCState,
  stepCharacterController,
  DEFAULT_KCC_CONFIG,
  type KCCInput,
} from './characterController';

describe('Holodeck 3D Physics Engine', () => {
  describe('Swept AABB Collision', () => {
    it('detects a direct head-on collision against a static wall', () => {
      const playerBox: AABB = {
        min: [-0.5, 0, -0.5],
        max: [0.5, 2, 0.5],
      };
      const wall: AABB = {
        min: [-5, 0, 5],
        max: [5, 4, 6],
      };
      // Moving 10 units forward along Z
      const delta: [number, number, number] = [0, 0, 10];
      const result = sweptAABB(playerBox, delta, wall);

      expect(result.hit).toBe(true);
      // Entry distance is (5 - 0.5) = 4.5 units, out of 10 -> fraction 0.45
      expect(result.time).toBeCloseTo(0.45, 2);
      expect(result.normal).toEqual([0, 0, -1]);
    });

    it('returns no hit when moving parallel or away from the obstacle', () => {
      const playerBox: AABB = {
        min: [-0.5, 0, -0.5],
        max: [0.5, 2, 0.5],
      };
      const wall: AABB = {
        min: [5, 0, 5],
        max: [6, 4, 6],
      };
      // Moving away in negative Z
      const delta: [number, number, number] = [0, 0, -5];
      const result = sweptAABB(playerBox, delta, wall);
      expect(result.hit).toBe(false);
    });

    it('validates static AABB intersection', () => {
      const b1: AABB = { min: [0, 0, 0], max: [2, 2, 2] };
      const b2: AABB = { min: [1, 1, 1], max: [3, 3, 3] };
      const b3: AABB = { min: [5, 5, 5], max: [6, 6, 6] };
      expect(aabbIntersects(b1, b2)).toBe(true);
      expect(aabbIntersects(b1, b3)).toBe(false);
    });
  });

  describe('Step-Up Stair Math', () => {
    it('allows stepping up a 0.3m curb/stair', () => {
      const playerBox: AABB = {
        min: [-0.35, 0, -0.35],
        max: [0.35, 1.8, 0.35],
      };
      const stepCurb: AABB = {
        min: [-2, 0, 0.2],
        max: [2, 0.3, 2.0],
      };
      const deltaH: [number, number, number] = [0, 0, 0.5];
      const stepResult = tryStepUp(playerBox, deltaH, [stepCurb], 0.45);
      expect(stepResult).not.toBeNull();
      if (stepResult) {
        expect(stepResult[1]).toBeGreaterThanOrEqual(0.3); // stepped up
        expect(stepResult[2]).toBeGreaterThan(0); // made forward progress
      }
    });

    it('refuses to step up a 2.0m tall impassable wall', () => {
      const playerBox: AABB = {
        min: [-0.35, 0, -0.35],
        max: [0.35, 1.8, 0.35],
      };
      const highWall: AABB = {
        min: [-2, 0, 0.2],
        max: [2, 2.5, 2.0],
      };
      const deltaH: [number, number, number] = [0, 0, 0.5];
      const stepResult = tryStepUp(playerBox, deltaH, [highWall], 0.45);
      expect(stepResult).toBeNull();
    });
  });

  describe('Kinematic Character Controller (KCC)', () => {
    const floorCollider: AABB = {
      min: [-100, -1, -100],
      max: [100, 0, 100],
    };

    it('advances player forward when pressing W with yaw=0', () => {
      let state = createInitialKCCState([0, 0, 0]);
      const input: KCCInput = {
        moveForward: 1,
        moveRight: 0,
        jump: false,
        crouch: false,
        sprint: false,
        yaw: 0, // facing -Z
      };

      // Run 5 ticks of 16ms
      for (let i = 0; i < 5; i++) {
        state = stepCharacterController(state, input, [floorCollider], 0.016);
      }

      // In Three.js, forward at yaw=0 is -Z
      expect(state.position[2]).toBeLessThan(0);
      expect(state.velocity[2]).toBeLessThan(0);
      expect(state.isGrounded).toBe(true);
    });

    it('executes snappy counter-strafing stop within 0.08s', () => {
      let state = createInitialKCCState([0, 0, 0]);
      state.velocity = [0, 0, -DEFAULT_KCC_CONFIG.walkSpeed]; // moving full forward

      const neutralInput: KCCInput = {
        moveForward: 0,
        moveRight: 0,
        jump: false,
        crouch: false,
        sprint: false,
        yaw: 0,
      };

      // Step by 0.085s total
      const dt = 0.01;
      const steps = Math.ceil(0.085 / dt);
      for (let i = 0; i < steps; i++) {
        state = stepCharacterController(state, neutralInput, [floorCollider], dt);
      }

      // Velocity must be completely 0 after counter-strafe decay time
      expect(Math.abs(state.velocity[0])).toBe(0);
      expect(Math.abs(state.velocity[2])).toBe(0);
    });

    it('smoothly interpolates camera height during crouch transition', () => {
      let state = createInitialKCCState([0, 0, 0]);
      expect(state.cameraHeight).toBe(DEFAULT_KCC_CONFIG.standHeight);

      const crouchInput: KCCInput = {
        moveForward: 0,
        moveRight: 0,
        jump: false,
        crouch: true,
        sprint: false,
        yaw: 0,
      };

      // Step a few ticks
      state = stepCharacterController(state, crouchInput, [floorCollider], 0.05);
      expect(state.cameraHeight).toBeLessThan(DEFAULT_KCC_CONFIG.standHeight);
      expect(state.cameraHeight).toBeGreaterThan(DEFAULT_KCC_CONFIG.crouchHeight);

      // Run until fully crouched
      for (let i = 0; i < 20; i++) {
        state = stepCharacterController(state, crouchInput, [floorCollider], 0.05);
      }
      expect(state.cameraHeight).toBeCloseTo(DEFAULT_KCC_CONFIG.crouchHeight, 2);
      expect(state.isCrouching).toBe(true);
    });

    it('clears and lands on top of a 0.8m tactical platform (Holodeck Alpha Site A/B)', () => {
      // Floor at y <= 0
      // Platform at z in [-20, -1], top at y = 0.8 (matching Site A/B platform 24m depth)
      const platformCollider: AABB = {
        min: [-20, 0, -20],
        max: [20, 0.8, -1],
      };
      const colliders = [floorCollider, platformCollider];

      // Start at z = 0, facing -Z (yaw = 0)
      let state = createInitialKCCState([0, 0, 0]);

      // Jump forward with sprint
      const jumpInput: KCCInput = {
        moveForward: 1,
        moveRight: 0,
        jump: true,
        crouch: false,
        sprint: true,
        yaw: 0,
      };

      // First tick: initiate jump
      state = stepCharacterController(state, jumpInput, colliders, 0.016);

      // Remaining ticks: continue forward without re-jumping over ~0.85s (54 ticks)
      const airInput: KCCInput = { ...jumpInput, jump: false };
      for (let i = 1; i < 54; i++) {
        state = stepCharacterController(state, airInput, colliders, 0.016);
      }

      // Player must have moved forward onto the platform (z < -1) and landed at y = 0.8
      expect(state.position[2]).toBeLessThan(-1.0);
      expect(state.position[1]).toBeCloseTo(0.8, 1);
      expect(state.isGrounded).toBe(true);
    });

    it('clears and lands on top of a 1.0m raised dais (Holodeck Bravo)', () => {
      const daisCollider: AABB = {
        min: [-20, 0, -20],
        max: [20, 1.0, -1],
      };
      const colliders = [floorCollider, daisCollider];

      let state = createInitialKCCState([0, 0, 0]);
      const jumpInput: KCCInput = {
        moveForward: 1,
        moveRight: 0,
        jump: true,
        crouch: false,
        sprint: true,
        yaw: 0,
      };

      state = stepCharacterController(state, jumpInput, colliders, 0.016);
      const airInput: KCCInput = { ...jumpInput, jump: false };
      for (let i = 1; i < 54; i++) {
        state = stepCharacterController(state, airInput, colliders, 0.016);
      }

      expect(state.position[2]).toBeLessThan(-1.0);
      expect(state.position[1]).toBeCloseTo(1.0, 1);
      expect(state.isGrounded).toBe(true);
    });

    it('preserves forward air momentum during jump when releasing keys in air', () => {
      let state = createInitialKCCState([0, 0, 0]);
      // Step forward for 4 ticks to build sprint speed
      for (let i = 0; i < 4; i++) {
        state = stepCharacterController(
          state,
          { moveForward: 1, moveRight: 0, jump: false, crouch: false, sprint: true, yaw: 0 },
          [floorCollider],
          0.016,
        );
      }

      // Execute jump
      state = stepCharacterController(
        state,
        { moveForward: 1, moveRight: 0, jump: true, crouch: false, sprint: true, yaw: 0 },
        [floorCollider],
        0.016,
      );
      expect(state.isGrounded).toBe(false);
      expect(state.velocity[2]).toBeLessThan(-6.0);

      // Subsequent air ticks with neutral input (released keys in mid-air)
      for (let i = 0; i < 15; i++) {
        state = stepCharacterController(
          state,
          { moveForward: 0, moveRight: 0, jump: false, crouch: false, sprint: false, yaw: 0 },
          [floorCollider],
          0.016,
        );
      }

      // Air momentum must still carry forward (speed > 5.5 m/s)
      expect(state.velocity[2]).toBeLessThan(-5.5);
    });
  });
});
