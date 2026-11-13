import * as THREE from 'three';
import type { PlantSite, SpikeEntity } from '../core/types';
import { sounds } from '../../audio/soundEngine';

export const PLANT_DURATION_SEC = 4.0;
export const DEFUSE_DURATION_SEC = 7.0;
export const HALF_DEFUSE_SEC = 3.5;
export const DETONATION_FUSE_SEC = 45.0;

export function createInitialSpikeEntity(): SpikeEntity {
  return {
    state: 'idle',
    carrierId: null,
    planterId: null,
    defuserId: null,
    site: null,
    position: [0, 0, 0],
    plantProgress: 0,
    defuseProgress: 0,
    detonationTimer: DETONATION_FUSE_SEC,
  };
}

export interface SpikeUpdateResult {
  spike: SpikeEntity;
  justPlanted: boolean;
  justDefused: boolean;
  justDetonated: boolean;
  shouldBeep: boolean;
}

/**
 * Steps the Spike state machine by dt seconds.
 */
export function stepSpike(
  current: SpikeEntity,
  dt: number,
  isHoldingPlant: boolean,
  currentSite: PlantSite | null,
  isHoldingDefuse: boolean,
  planterId: string | null,
  defuserId: string | null,
  lastBeepTimer: { timer: number },
): SpikeUpdateResult {
  const spike: SpikeEntity = { ...current };
  let justPlanted = false;
  let justDefused = false;
  let justDetonated = false;
  let shouldBeep = false;

  if (spike.state === 'idle' || spike.state === 'carried') {
    if (isHoldingPlant && currentSite) {
      spike.state = 'planting';
      spike.planterId = planterId;
      spike.site = currentSite;
      spike.plantProgress = Math.min(PLANT_DURATION_SEC, spike.plantProgress + dt);
      sounds.playSpikePlantTick(spike.plantProgress / PLANT_DURATION_SEC);
      if (spike.plantProgress >= PLANT_DURATION_SEC) {
        spike.state = 'planted';
        spike.detonationTimer = DETONATION_FUSE_SEC;
        justPlanted = true;
        sounds.playSpikePlanted();
      }
    } else {
      spike.plantProgress = 0;
    }
  } else if (spike.state === 'planting') {
    if (isHoldingPlant && currentSite) {
      spike.plantProgress = Math.min(PLANT_DURATION_SEC, spike.plantProgress + dt);
      sounds.playSpikePlantTick(spike.plantProgress / PLANT_DURATION_SEC);
      if (spike.plantProgress >= PLANT_DURATION_SEC) {
        spike.state = 'planted';
        spike.detonationTimer = DETONATION_FUSE_SEC;
        justPlanted = true;
        sounds.playSpikePlanted();
      }
    } else {
      // Aborted plant
      spike.state = 'carried';
      spike.plantProgress = 0;
    }
  } else if (spike.state === 'planted' || spike.state === 'defusing') {
    // Tick down detonation fuse
    spike.detonationTimer = Math.max(0, spike.detonationTimer - dt);

    // Beep interval calculation
    let beepInterval = 1.0;
    if (spike.detonationTimer < 5.0) {
      beepInterval = 0.125;
    } else if (spike.detonationTimer < 10.0) {
      beepInterval = 0.25;
    } else if (spike.detonationTimer < 20.0) {
      beepInterval = 0.5;
    }

    lastBeepTimer.timer += dt;
    if (lastBeepTimer.timer >= beepInterval) {
      lastBeepTimer.timer = 0;
      shouldBeep = true;
      sounds.playSpikeBeep(1.0 / beepInterval);
    }

    if (spike.detonationTimer <= 0) {
      spike.state = 'detonated';
      justDetonated = true;
      sounds.playSpikeDetonated();
      return { spike, justPlanted, justDefused, justDetonated, shouldBeep };
    }

    // Handle Defusal
    if (isHoldingDefuse) {
      spike.state = 'defusing';
      spike.defuserId = defuserId;
      spike.defuseProgress = Math.min(DEFUSE_DURATION_SEC, spike.defuseProgress + dt);
      if (spike.defuseProgress >= DEFUSE_DURATION_SEC) {
        spike.state = 'defused';
        justDefused = true;
        sounds.playSpikeDefused();
      }
    } else {
      spike.state = 'planted';
      spike.defuserId = null;
      // Half-defuse milestone preservation
      if (spike.defuseProgress >= HALF_DEFUSE_SEC) {
        spike.defuseProgress = HALF_DEFUSE_SEC;
      } else {
        spike.defuseProgress = 0;
      }
    }
  }

  return { spike, justPlanted, justDefused, justDetonated, shouldBeep };
}

/**
 * Builds a procedural volumetric glowing pillar for the planted Spike.
 */
export function buildPlantedSpikeMesh(site: PlantSite = 'A'): THREE.Group {
  const group = new THREE.Group();
  group.name = 'PlantedSpikeCore';

  const isA = site === 'A';
  const color = isA ? 0x06b6d4 : 0xf97316;

  // 1. Central Core Cube
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.9,
    roughness: 0.2,
  });
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), coreMat);
  core.position.set(0, 0.2, 0);
  core.rotation.y = Math.PI / 4;
  group.add(core);

  // 2. Glowing Emissive Bands
  const glowMat = new THREE.MeshBasicMaterial({ color });
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.38), glowMat);
  band.position.set(0, 0.2, 0);
  band.rotation.y = Math.PI / 4;
  group.add(band);

  // 3. Volumetric Vertical Light Beam Pillar
  const beamMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.45,
    wireframe: true,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 20, 8), beamMat);
  beam.position.set(0, 10, 0);
  group.add(beam);

  return group;
}
