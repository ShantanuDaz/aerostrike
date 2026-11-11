# Architecture & Engineering Proposal: 2D Multiplayer Team CTF Shooter

**Project Name**: Mini Militia: Capture The Flag (P2P)  
**Status**: Architecture & Design Phase  
**Tech Stack**: React 19, TypeScript, Vite, Tailwind CSS v4, Zustand, HTML5 Canvas 2D, Trystero (WebRTC / Nostr)  
**Author**: Antigravity & Engineering Team  

---

## 1. Executive Summary & Vision

We are building a fast-paced, serverless, peer-to-peer (P2P) 2D multiplayer shooter inspired by *Mini Militia*, *Teeworlds*, and *Soldat*. The flagship game mode is **Team Capture the Flag (CTF)** (Red vs. Blue) with vertical jetpack mobility, distinct physics-driven weapons, procedural visual design, and zero required asset downloads.

### Core Objectives
1. **Zero-Asset High Fidelity**: 100% procedural vector graphics rendered on HTML5 Canvas 2D and procedural Web Audio API sound synthesis. Fast initial load (<500 KB bundle total) with crisp rendering on any resolution or DPI.
2. **Scrollable Big-World Camera**: Large competitive map (3200 × 1800 px) viewed through a responsive camera viewport window with smooth lerp tracking, boundary clamping, and an integrated minimap radar.
3. **Robust P2P Networking (Trystero)**: Instant room creation, copy-to-clipboard invite links, decentralized room-mesh over Nostr relays, deterministic Host Election for CTF state authority, and smooth entity interpolation.
4. **Deep Combat & Customization**: Modular avatar creator (colors, headgear, visors, jetpacks), 5 distinct weapon archetypes (Rifle, Shotgun, Sniper, Rocket Launcher, Bouncing Grenade) with recoil impulse and projectile physics.
5. **Rock-Solid Game Logic**: Deterministic 60 Hz physics loop, decoupled rendering, comprehensive CTF rule engine (flags, bases, carrier buffs/penalties, drops, return countdowns, and scoring).

---

## 2. Asset Strategy: Procedural Canvas vs. External Assets

> **Evaluation of User Question**: *"I don't want to have assets, but if you feel like using assets is better then suggest me."*

### Comparative Analysis

| Feature | Option A: Pure Procedural (Recommended) | Option B: Sprite Assets (PNG/Atlas) |
| :--- | :--- | :--- |
| **Download Size** | **0 KB assets** (~250 KB JS bundle only) | 5 MB – 25 MB sprite sheets, audio files |
| **Load Time** | **Instantaneous** (0 network roundtrips) | Requires preloading screen & asset manifest |
| **Customization** | **Infinite dynamic variations** (colors, gear, sizes rendered dynamically via Canvas math) | Requires recolor shaders, duplicate sprites, or atlas permutations |
| **Resolution/Scaling** | **Infinite vector crispness** on 4K, Retina, or mobile | Pixelation or filtering blur when zoomed/scaled |
| **Development Velocity** | No design bottlenecks, no sprite cutting or alignment bugs | Requires sprite slicing, collision box alignment, animation sheet rigging |

### Recommendation: **Procedural First with Asset-Ready Abstraction**
- **Phase 1-3 (Now)**: Stick **100% to procedural canvas geometry and procedural Web Audio**. This matches the Mini Militia aesthetic, keeps development ultra-rapid, eliminates asset loading race conditions, and gives the Avatar Creator limitless real-time color and shape flexibility.
- **Architectural Safeguard**: Structure render functions with a clean interface (`renderPlayer(ctx, player)`, `renderWeapon(ctx, weapon)`). If sprite packs (e.g., Kenney.nl CC0 vector assets) are desired later, they can be plugged into the renderer without touching physics, network, or game rules.

---

## 3. Camera & Viewport System (World vs. Screen)

Currently, the game canvas draws the entire 900 × 500 map 1:1 on the screen. For competitive CTF, the map must be much larger (e.g., 3200 × 1800 px) to allow flanking routes, underground tunnels, and sky dogfights.

### 3.1 Camera Follow Mathematics
The camera defines a rectangular window `[viewportWidth, viewportHeight]` inside the larger world `[worldWidth, worldHeight]`.

```
+-------------------------------------------------------------+
| WORLD MAP (3200 x 1800)                                     |
|                                                             |
|           +-------------------------+                       |
|           | CAMERA VIEWPORT         |                       |
|           | (1024 x 640 Canvas)     |                       |
|           |        (Local Player)   |                       |
|           |              @          |                       |
|           +-------------------------+                       |
|                                                             |
+-------------------------------------------------------------+
```

#### Linear Interpolation (Lerp) Tracking:
```typescript
// Smooth camera follow with lerp
const LERP_FACTOR = 0.1; // 10% movement per frame towards player

camera.x += (player.x - viewportWidth / 2 - camera.x) * LERP_FACTOR;
camera.y += (player.y - viewportHeight / 2 - camera.y) * LERP_FACTOR;

// Boundary clamping (camera cannot look outside map edges)
camera.x = Math.max(0, Math.min(camera.x, map.width - viewportWidth));
camera.y = Math.max(0, Math.min(camera.y, map.height - viewportHeight));
```

### 3.2 Coordinate Space Transformations
Any world entity is drawn relative to the camera:

$$\text{screenX} = \text{worldX} - \text{camera.x}$$
$$\text{screenY} = \text{worldY} - \text{camera.y}$$

In Canvas 2D:
```typescript
ctx.save();
ctx.translate(-camera.x, -camera.y);
// Draw all world entities (map, platforms, flags, bullets, players) in world coordinates!
renderMap(ctx, map);
renderFlags(ctx, flags);
renderPlayers(ctx, players);
renderBullets(ctx, bullets);
ctx.restore();
// Draw screen-space UI (HUD, crosshair, minimap) without camera translation!
```

#### Mouse Crosshair World Mapping:
Aim angle must be calculated against world mouse coordinates:
$$\text{worldMouseX} = \text{screenMouseX} + \text{camera.x}$$
$$\text{worldMouseY} = \text{screenMouseY} + \text{camera.y}$$
$$\text{aimAngle} = \operatorname{atan2}(\text{worldMouseY} - \text{player.y}, \text{worldMouseX} - \text{player.x})$$

### 3.3 Minimap Radar HUD
A corner overlay (e.g. 180 × 100 px at top-right) providing critical battlefield awareness:
- **Map Scale Ratio**: $s_x = \text{miniWidth} / \text{mapWidth}$, $s_y = \text{miniHeight} / \text{mapHeight}$.
- **Geometry**: Outlines of major platforms in semi-transparent dark slate.
- **Base & Flag Markers**: Blue icon at $(x_{\text{blue}} \cdot s_x, y_{\text{blue}} \cdot s_y)$ and Red icon at $(x_{\text{red}} \cdot s_x, y_{\text{red}} \cdot s_y)$.
- **Player Blips**: Friendly teammates always visible; enemy carriers permanently visible with flashing beacon; normal enemies visible when firing or within line-of-sight.
- **Viewport Frame**: A wireframe rectangle showing the local player's current camera viewport on the minimap.

---

## 4. Map Architecture & CTF Level Design

CTF maps require horizontal symmetry, vertical multi-lane traversal, and clear base demarcation.

### 4.1 Arena Dimensions: 3200 × 1800 px
- **Three-Lane Topology**:
  1. **High Skyway (y: 200–500)**: Open aerial route for jetpack flight. Fast traversal, high risk of falling or taking sniper fire, low cover.
  2. **Midground Arena (y: 700–1100)**: Floating platforms, weapon drop crates, shield barriers, and intense vertical firefights.
  3. **Underground Tunnels (y: 1300–1700)**: Narrow corridors and choke points with blast blast-doors; ideal for shotgun/grenade defenses and stealth flag extraction.
- **Team Bases**:
  - **Blue Base**: World coordinates $x = 250, y = 1400$. Protected by elevated defensive ramparts.
  - **Red Base**: World coordinates $x = 2950, y = 1400$. Mirror symmetrical layout.
  - **Flag Pedestals**: Distinct glowing platform marking base flag spot.

### 4.2 Platform Types
```typescript
export type ObstacleType = 
  | 'solid'        // Blocks movement & bullets from all 4 sides (bunkers, walls, ground)
  | 'one-way'      // Jump-through from bottom, land on top (metal catwalks, scaffolding)
  | 'hazard'       // Acid / electric floor dealing damage over time
  | 'shield-door'; // Team-exclusive forcefield (friendly pass-through, blocks enemy bullets)
```

---

## 5. Modular Procedural Avatar System & Creator

To achieve zero assets while giving players complete personal expression, we construct avatars using a layered procedural vector pipeline on Canvas.

### 5.1 Avatar Anatomy & Render Layers
Each soldier is rendered in 7 layered canvas steps:
1. **Jetpack Backing**: Twin metallic canisters with animated particle thrust (flame & smoke).
2. **Body Sphere**: Scaled circle with team accent ring (Blue/Red border).
3. **Clothing / Tactical Vest**: Chest strap, ammo pouches, or camouflage pattern.
4. **Visor / Face Mask**: Cylindrical visor or tactical goggles rotated toward `aimAngle`.
5. **Headgear**:
   - `soldier_helmet` (classic curved military pot helmet with strap)
   - `beret` (tilted elite commando beret)
   - `headband` (action-hero ribbon with trailing tail)
   - `gas_mask` (dual canister respirator)
   - `robo_visor` (sci-fi horizontal glowing neon strip)
   - `bandana` (lower-face bandit wrap)
6. **Rotating Weapon Pivot**: Hand grip and weapon barrel dynamically rotated around body center.
7. **Player Callsign Tag**: Floating nickname above health bar with team color glow.

### 5.2 Avatar Configuration Model
```typescript
export interface AvatarConfig {
  callsign: string;         // e.g. "GhostRider"
  bodyColor: string;        // Primary uniform color (hex)
  skinTone: string;         // Head/hands tint
  headgear: 'none' | 'helmet' | 'beret' | 'headband' | 'gas_mask' | 'robo_visor';
  headgearColor: string;    // Custom tint for gear
  visorStyle: 'classic' | 'cyborg' | 'sunglasses' | 'goggles' | 'neon';
  visorColor: string;
  jetpackStyle: 'dual_tank' | 'single_heavy' | 'falcon_wings';
}
```
*Total network payload per avatar: < 150 bytes (JSON).*

### 5.3 Avatar Creator UI Flow
- **Interactive Live Preview Canvas**: Displays the soldier with real-time breathing animation, hovering jetpack particles, and cursor-tracking aim.
- **Palette Selectors & Sliders**: Swift selection of styles and RGB color presets.
- **Local Persistence**: Automatically saves to `localStorage` under `mini_militia_avatar`.

---

## 6. Weapon Arsenal & Combat Mechanics

Combat must be punchy, satisfying, and strategic. We implement 5 distinct weapon types with distinct ballistics, knockback, recoil, and audio signatures.

### 6.1 Weapon Specifications

| Weapon | Fire Rate | Bullets/Shot | Velocity | Damage | Recoil Impulse | Behavior / Special |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Pistol** | Semi (300ms) | 1 | 18 px/f | 18 HP | Low (1.5) | Default sidearm, infinite ammo |
| **Assault Rifle** | Auto (110ms) | 1 | 22 px/f | 14 HP | Med (2.2) | 30-round mag, steady recoil |
| **Combat Shotgun** | Pump (750ms) | 6 pellets | 16 px/f | 10 HP / pellet | Heavy (6.0) | High spread angle, massive close-range knockback |
| **Sniper Rifle** | Bolt (1200ms) | 1 beam | 38 px/f | 70 HP | Severe (7.5) | Instantaneous laser trail, pierces 1 enemy, high screen shake |
| **Rocket Launcher** | Heavy (1500ms)| 1 missile | 9 px/f | 90 HP splash | Extreme (9.0) | Accelerating projectile, smoke plume, radial blast physics |
| **Frag Grenade** | Thrown (Cool: 4s)| 1 throwable | Arc physics | 85 HP blast | None | Bouncing grenade physics with 3-second fuse timer |

### 6.2 Combat Math & Physics
1. **Recoil Impulse (Newton's 3rd Law)**:
   Firing a weapon kicks the player backwards against their aim vector:
   $$v_x -= \cos(\text{aimAngle}) \times \text{recoil}$$
   $$v_y -= \sin(\text{aimAngle}) \times \text{recoil}$$
   *Tactical depth: skilled players use shotgun and rocket recoil to boost jetpack climbing speed!*

2. **Rocket & Grenade Radial Splash Damage**:
   Damage decreases linearly from blast center $P_{\text{blast}}$ to blast radius $R_{\text{blast}}$:
   $$\text{dist} = \| P_{\text{player}} - P_{\text{blast}} \|$$
   $$\text{damage} = \text{maxDamage} \times \left(1 - \frac{\text{dist}}{R_{\text{blast}}}\right) \quad (\text{if dist} < R_{\text{blast}})$$
   $$\vec{v}_{\text{knockback}} = \frac{P_{\text{player}} - P_{\text{blast}}}{\text{dist}} \times \text{blastForce}$$

3. **Arena Weapon Pickups**:
   - Weapon crates spawn on midground platforms.
   - Touching a crate replaces current primary weapon and restores full ammo.
   - 20-second respawn timer per crate with rotating holographic crate visual.

---

## 7. Networking Architecture with Trystero (P2P Mesh)

Trystero provides WebRTC data channels brokered by decentralized Nostr relays without requiring an external game server.

### 7.1 Room Creation & Shareable Links
- **Room Code Generation**: 6-character clean room alphanumeric token (e.g., `ROOM-X9K2`).
- **One-Click Share Link**: `https://<domain>/?room=ROOM-X9K2`.
- **Auto-Join**: When a user navigates to the URL with the `?room=` parameter, the game initializes the Trystero room automatically and places them into the lobby.

```
       [Host Peer (Authority)]
       /         |         \
   (WebRTC)   (WebRTC)   (WebRTC)
     /           |           \
[Client A]   [Client B]   [Client C]
```

### 7.2 The Authority Model (Deterministic Host Election)
In a serverless P2P game, someone must referee match-wide state (flags, scores, round timers, weapon crate respawns).
- **Rule**: All connected peers have a unique Trystero `peerId`. The peer with the lowest lexicographical `peerId` is elected as the **Match Authority (Host)**.
- **Host Responsibilities**:
  1. Owns Flag state machine (`AT_BASE`, `CARRIED`, `DROPPED`).
  2. Detects flag touches and broadcasts scoring events.
  3. Tracks match countdown, round timer, and team score counters.
  4. Manages crate spawn schedules.
- **Failover / Host Migration**: If the Host leaves or disconnects, all remaining peers re-evaluate the lowest `peerId` within 1 frame. The new host seamlessly inherits authoritative tracking without match interruption.

### 7.3 Data Channels & Packet Budget
1. **High-Frequency Player Snapshot Channel** (30 Hz):
   ```typescript
   export interface PlayerSnapshot {
     id: string;
     x: number;
     y: number;
     vx: number;
     vy: number;
     aimAngle: number;
     isBoosting: boolean;
     health: number;
   }
   ```
2. **Event-Driven Combat Channel** (Reliable / Instantaneous):
   - `SHOOT`: `{ shooterId, weaponId, originX, originY, angle, bulletId }`
   - `DAMAGE`: `{ targetId, damage, dealerId, knockbackX, knockbackY }`
   - `FLAG_EVENT`: `{ type: 'PICKUP'|'DROP'|'CAPTURE'|'RETURN', team, playerId }`
   - `PLAYER_KILLED`: `{ victimId, killerId, weaponUsed }`

3. **Remote Player Interpolation (Snapshot Lerp)**:
   Remote players are rendered by interpolating between the two most recently received network snapshots with a small 50ms buffer, ensuring silky-smooth 60 FPS motion without jitter.

---

## 8. CTF Game Logic & State Machine

Capture the Flag requires rigorous rules to prevent desyncs and exploit loops.

### 8.1 Match State Machine
```
[LOBBY] 
   │ (All players ready)
   ▼
[COUNTDOWN] (3-second round start)
   │
   ▼
[MATCH_ACTIVE] ◄────────────────────────────────┐
   │                                            │
   ├── (Flag captured by Carrier)               │
   │      │                                     │
   │      ▼                                     │
   │   [POINT_SCORED] (Cheer banner & reset) ───┘
   │
   └── (Score limit reached OR Time Expired)
          │
          ▼
       [MATCH_OVER] (Victory screen, MVPs, Scoreboard)
          │
          ▼
       [POST_GAME_LOBBY]
```

### 8.2 Flag State Machine
Each team has one flag (Blue Flag & Red Flag):

```
                 ┌────────────────────────────────┐
                 │                                │ (Carrier killed)
                 ▼                                │
            [ AT_BASE ] ──(Enemy Touches)──► [ CARRIED ]
                 ▲                                │
                 │ (20s timeout OR               │
                 │  friendly touch)               ▼
                 └────────────────────────── [ DROPPED ]
```

#### Detailed Flag Rules:
1. **Pickup**: When a player touches the enemy flag at its base or where dropped, they become the **Flag Carrier**.
2. **Carrier State**:
   - The flag attaches to the carrier's back and waves with movement.
   - Carrier has 15% reduced jetpack fuel efficiency (high-stakes mobility trade-off).
   - Carrier is highlighted on the radar with a pulsating icon.
3. **Dropping**:
   - If the carrier is killed or falls into a hazard, the flag drops to the ground at that exact coordinate.
   - A 20-second return timer begins with a circular countdown ring rendered above the dropped flag.
4. **Returning**:
   - If any friendly teammate touches their own dropped flag, it is **instantly returned** to base ("Blue flag returned!").
   - If the 20-second timer expires with no interaction, the flag automatically resets to base.
5. **Capturing (Scoring)**:
   - A carrier scores a point for their team when they reach their own team's base pedestal **AND** their own team's flag is currently resting safely `AT_BASE`.
   - Scoring triggers a victory fanfare, scores +1 for the team, awards the carrier 100 bonus score, and resets both flags to base after a 2-second celebration freeze.
6. **Victory Condition**: First team to reach 3 captures (or highest score when 10-minute timer expires) wins the match.

### 8.3 Health, Damage & Respawn Loop
- Max Health: 100 HP.
- Health Bar: Rendered in HUD and directly above player nameplate.
- Death: On reaching 0 HP, player decomposes into 12 procedural ragdoll blast particles, dropping their current flag and weapon.
- Respawn Timer: 5-second countdown with spectator camera tracking the team flag carrier.
- Spawn Protection: 2 seconds of invulnerability shield (semi-transparent glowing bubble) upon respawning to prevent base-camping.

---

## 9. Player Onboarding Flow & User Experience

A frictionless, 3-step onboarding flow guarantees players jump into the action within seconds.

```
+---------------------------------------------------------------+
|                      STEP 1: IDENTITY                         |
|   Enter Callsign: [ GhostRider      ]                         |
|   Avatar Customizer: [Helmet: Beret] [Color: Teal]            |
|   [ Ready to Fight -> ]                                       |
+---------------------------------------------------------------+
                               │
                               ▼
+---------------------------------------------------------------+
|                      STEP 2: PLAY MENU                        |
|   [ CREATE ROOM ]              [ JOIN ROOM ]                  |
|   Generate share link          Enter 6-char room code         |
|                                                               |
|   [ PRACTICE RANGE (Single-Player Target Dummy Mode) ]        |
+---------------------------------------------------------------+
                               │
                               ▼
+---------------------------------------------------------------+
|                      STEP 3: LOBBY                            |
|   Room: ALPHA-9  |  [ Copy Invite Link ]                      |
|                                                               |
|   BLUE TEAM (2)                  RED TEAM (2)                 |
|   - GhostRider [READY]           - Stryker [READY]            |
|   - Viper      [READY]           - Neo     [READY]            |
|                                                               |
|   [ SWITCH TEAM ]                 [ START MATCH (Host) ]      |
+---------------------------------------------------------------+
```

---

## 10. Modular Code Architecture & Component Breakdown

We maintain strict feature separation so individual components remain cleanly decoupled, testable, and maintainable.

### 10.1 Directory Structure
```
src/
├── features/
│   ├── avatar/                  # Avatar customization & procedural renderer
│   │   ├── types.ts             # AvatarConfig, HeadgearType, VisorStyle
│   │   ├── avatarStore.ts       # Local player avatar store (localStorage sync)
│   │   ├── renderAvatar.ts      # Pure canvas vector drawing functions
│   │   └── AvatarCreatorModal.tsx # Interactive UI modal with preview
│   │
│   ├── camera/                  # Scrollable 2D Viewport System
│   │   ├── types.ts             # Camera, Viewport dimensions
│   │   ├── cameraMath.ts        # worldToScreen, screenToWorld, lerpCamera
│   │   └── cameraStore.ts       # Viewport state
│   │
│   ├── map/                     # Maps, Geometry & Minimap
│   │   ├── types.ts             # GameMap, Obstacle, BaseLocation
│   │   ├── maps/                # bunkerMap, fortressMap, ctfArenaMap
│   │   ├── renderMap.ts         # Canvas background, grid, platforms
│   │   └── renderMinimap.ts     # Minimap radar HUD renderer
│   │
│   ├── player/                  # Player physics & state
│   │   ├── types.ts             # Player, InputState
│   │   ├── updatePlayer.ts      # Kinematics, jetpack, collision resolution
│   │   ├── renderPlayer.ts      # Procedural body, visor, name tag
│   │   └── playerStore.ts       # Local player state
│   │
│   ├── combat/                  # Weapons, Ballistics & Recoil
│   │   ├── types.ts             # WeaponDef, Bullet, Grenade, Particle
│   │   ├── weaponsConfig.ts     # Rifle, Shotgun, Sniper, Rocket specs
│   │   ├── updateBullets.ts     # Projectile movement, lifetime, obstacle hit
│   │   ├── renderBullets.ts     # Tracers, rockets, grenade rendering
│   │   ├── particleSystem.ts    # Explosions, jetpack smoke, blood splatters
│   │   └── combatStore.ts       # Active bullets, particles, weapon crates
│   │
│   ├── ctf/                     # Capture The Flag Rule Engine
│   │   ├── types.ts             # Flag, FlagState, Team, ScoreBoard
│   │   ├── ctfEngine.ts         # Flag pickup, drop, return, capture logic
│   │   ├── renderFlags.ts       # Waving cloth flag & pedestal renderer
│   │   └── ctfStore.ts          # Match scores, round state, flag states
│   │
│   ├── network/                 # P2P Networking (Trystero)
│   │   ├── types.ts             # NetworkPackets, PeerState
│   │   ├── trysteroRoom.ts      # Nostr room initialization, message actions
│   │   ├── hostElection.ts      # Deterministic Host selection & failover
│   │   ├── networkStore.ts      # Remote peer list, ping, connection status
│   │   └── useNetworkSync.ts    # React hook binding Canvas loop to WebRTC
│   │
│   ├── audio/                   # Procedural Web Audio Synthesizer
│   │   ├── soundEngine.ts       # Tone synthesis (laser, shotgun, explosion, jet)
│   │   └── sounds.ts            # Sound triggers (fire, hit, capture, jump)
│   │
│   ├── ui/                      # React UI Overlays (Tailwind CSS)
│   │   ├── HUD.tsx              # Health, Fuel, Score, Timer, Ammo
│   │   ├── MinimapView.tsx      # Minimap canvas wrapper
│   │   ├── KillFeed.tsx         # Kill stream notifications
│   │   ├── LobbyView.tsx        # Team selection & room link sharing
│   │   └── GameOverModal.tsx    # Victory screen & scoreboard
│   │
│   └── game/                    # Canvas loop & orchestration
│       ├── GameCanvas.tsx       # 60 FPS requestAnimationFrame canvas loop
│       └── useGameLoop.ts       # Fixed-timestep physics update coordinator
│
└── App.tsx                      # Top-level screen router (Onboarding -> Lobby -> Game)
```

---

## 11. Step-by-Step Implementation Roadmap

Following our iterative learning protocol, we will break the build into clear, testable milestones:

```
[Milestone 1: Camera & Big Map] ──► [Milestone 2: Weapons & Combat]
              │                                      │
              ▼                                      ▼
[Milestone 3: Avatar Creator]   ──► [Milestone 4: CTF Rules & Flags]
              │                                      │
              ▼                                      ▼
[Milestone 5: P2P Matchmaking]  ──► [Milestone 6: Complete Integration & Polish]
```

### Detailed Milestones:
- **Milestone 1: Big Map & Camera Follow**
  - Implement 3200 × 1800 px symmetric CTF map.
  - Implement `cameraMath.ts` (lerp follow, clamp, world $\leftrightarrow$ screen coordinates).
  - Update `GameCanvas.tsx` to render through camera viewport.
  - Render top-right Minimap radar with player blip.

- **Milestone 2: Combat System & Weapon Variety**
  - Implement `combatStore` and bullet physics loop (`updateBullets.ts`).
  - Add Mouse-click shooting with weapon recoil pushing player velocity.
  - Implement 4 weapon archetypes: Assault Rifle, Shotgun spread, Sniper beam, and Rocket Launcher.
  - Implement explosive particle system on bullet impact.

- **Milestone 3: Procedural Avatar Customizer**
  - Create `AvatarCreatorModal.tsx` with color pickers and headgear selectors.
  - Build procedural rendering layers (`renderAvatar.ts`) for helmets, berets, visors, and backpacks.
  - Sync avatar to `localStorage` and display on game soldier.

- **Milestone 4: Team Capture The Flag Engine**
  - Add Red & Blue bases and flag entities (`FlagState`).
  - Implement flag pickup collision (carrier attaching).
  - Implement dropped flag timer (20s return) and friendly touch return.
  - Implement capture detection (scoring when friendly flag is at base).
  - Add match scoreboard and capture celebrations.

- **Milestone 5: Trystero P2P Multiplayer & Room Links**
  - Initialize Trystero Nostr room with 6-character room codes.
  - Parse URL query parameter `?room=XYZ` for 1-click joining.
  - Add Lobby view with Red vs. Blue team selection and Ready buttons.
  - Host election algorithm for authoritative CTF match state.
  - Broadcast player 30 Hz position snapshots and interpolate remote soldiers.

- **Milestone 6: Audio, Juice & Polish**
  - Procedural sound effects using Web Audio API (gunshots, jetpack buzz, flag captured fanfare, rocket explosion).
  - Screen shake on heavy impacts and rocket blasts.
  - Kill feed and responsive UI overlays.

---

## 12. Summary & Next Actions

This proposal gives us a clean, scalable roadmap to turn the prototype into a full-featured, zero-asset, high-octane 2D team shooter.

**Immediate Next Steps for Review**:
1. Review the proposed camera follow and minimap design.
2. Review the procedural avatar customization options.
3. Review the CTF rules and Host Election architecture.
4. Confirm any desired tweaks or additions, and we will begin Milestone 1!
