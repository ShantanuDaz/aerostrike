# AEROSTRIKE: OMEGA — Development Roadmap & Task Tracker

> Living tracker for bugfixes, gameplay feel, networking, testing, and content milestones.  
> Status key: `[x]` Done · `[-]` In Progress · `[ ]` Planned

---

## Phase 0: P1 Stability, Security & Performance Bugfixes
- [x] Fix infinite-ammo weapon swap exploit (`combatStore`: `ammoByWeapon`, `initLoadout`, `grantWeaponPickup`, `cycleWeapon`, HUD ammo badges)
- [x] Fix close-range bullet wall-tunneling (`updateBullets.getSafeMuzzlePoint`, applied locally and on remote `shoot`)
- [x] Fix simultaneous-axis collision snagging (`updatePlayer`: separated X pass -> Y pass -> hazard trigger)
- [x] Fix 0-fuel hover oscillation & network/audio spam (`fuelOverheated` hysteresis threshold + `isBoostingNow` gating)
- [x] Unify local player ID with persistent `getOrCreatePlayerId()` and sync `avatarStore` edits with `engineWorld.localPlayer`
- [x] Enforce spawn invulnerability shield on wire (`fastProtocol` bitmask) and in bullet/splash collision + remote rendering
- [x] Eliminate host/client `startTransition` & duplicate `gamePhase` races (`App.tsx`, `prepareClientArena`)
- [x] Enforce `playerId`-based callsign collision safety, live-match rejoin auth (`verifiedPeerIds`, `host_beacon` gating), and host-authoritative crate cooldown sync
- [x] Add map-aware gravity + obstacle clamping to `stepRemotePlayers` dead reckoning
- [x] Fix mobile touch-fire `110ms` interval desync, frame-0 blind aim misfire, and `touchmove` React re-render storm (`VirtualControls`)
- [x] Add desktop `blur` / `visibilitychange` stuck-input reset and SW cross-origin bypass
- [x] Cache static map layers (`renderMap`), audio noise buffers (`soundEngine`), offscreen haze, and lazy-load `QRScannerModal` (entry chunk `968 kB -> 600 kB`)

---

## Track B: Movement, Combat Feedback & Solo Skirmish (Completed)
- [x] **Platform Drop-Through (`S` / `ArrowDown` / Left-Stick Down)**: Allow dropping cleanly through one-way `platform` tiles while keeping `ground` and `wall` solid (`player/types.ts`, `updatePlayer.ts`, `GameCanvas.tsx`, `VirtualControls.tsx`).
- [x] **Ground Jump Impulse & Thruster Dash (`Shift` / `E` / Mobile Dash Button)**: Add crisp takeoff hop + directional air-dash cooldown with fuel check, thruster spark burst, dash SFX (`soundEngine`), and HUD cooldown indicator.
- [x] **Combat Feedback ("Game Juice")**:
  - [x] Floating damage numbers & critical headshot callouts on Canvas (`GameCanvas.tsx` / `engineWorld.ts`)
  - [x] Directional screen-edge damage indicator pulse when taking hits
  - [x] Kill feed toast strip + `Tab` tactical scoreboard overlay (`K / D / CAP`, Blue vs Red roster, synced over P2P via `kill_feed` & capture attribution)
- [x] **Solo Practice AI Skirmish Bots (`botAI.ts`)**: Spawn 2v2 AI squadmates & defenders in Solo Practice using shared `updatePlayer` physics, line-of-sight checks, crate pickups, hazard avoidance, and CTF flag logic.

---

## Track A: Automated Testing & Multi-Peer QA (In Progress — Live Browser E2E Blocked)
- [x] Set up `vitest` and add pure unit & protocol test suites (`fastProtocol`, `updatePlayer`, `updateBullets`, `combatStore`, `ctfStore`, `engineWorld`, `peerRoom` — 7 suites, 36 tests passing)
- [-] Run end-to-end 2-peer playtest matrix: Host + Cadet launch, mid-match rejoin & crate/station cooldowns, duplicate callsigns, Host disconnect, and anti-cheat caps verified over mocked `PeerJS` in `peerRoom.test.ts`; live Chrome WebRTC + mobile touch & fullscreen browser E2E blocked by missing Chrome remote debugging (`DevToolsActivePort`)

---

## Track C: Network Resilience & Bundle/Code Hygiene (Completed)
- [x] **Host Disconnect Handling**: Surface a clear `"Host signal lost"` reconnect/exit banner in `HUD`, `WarRoomScreen`, and `ConnectingScreen` when Host drops instead of silent infinite retry.
- [x] **Host Damage Rate/Magnitude Sanity Check**: Validate incoming `damage` packets against weapon caps, dealer identity, team, rolling DPS/rate budgets, and spawn-shield state on Host (`peerRoom.ts` + `playerStore.ts` finiteness guards).
- [x] **Route-Level Code Splitting**: Lazy-load `GameCanvas`, `HUD`, `GameOverModal`, `WarRoomScreen`, `ConnectingScreen`, and `SettingsScreen` in `App.tsx`, bringing the main entry chunk down from `635.21 kB` to `434.07 kB` (under Vite's `500 kB` threshold).
- [x] **Orphan Cleanup**: Remove unused legacy files (`LobbyModal.tsx`, `RoomQRCodeCard.tsx`, `WelcomeScreen.tsx`, `AvatarCreatorModal.tsx`) and drop unused `trystero` dependency from `package.json`.

---

## Track D: War Room Match Rules & Map Content (Completed)
- [x] **War Room Host Match Configuration & Clock/Overtime**: Added host-configurable capture limit (`FT1` / `FT3` / `FT5` / `FT7`), match clock (`Untimed` / `3:00` / `5:00` / `8:00`) with Sudden-Death Overtime on `0:00` ties, and redeploy respawn delay (`2.5s` / `4.5s` / `6.5s`), synchronized across `ctfStore`, `WarRoomScreen`, `HUD`, `GameOverModal`, `updatePlayer`, `botAI`, and `peerRoom` WebRTC beacons/control/rejoin.
- [x] **Arena Mechanics & New Symmetrical CTF Maps**: Implemented directional **Bounce / Jump Pads** (`BouncePad` physics, animated chevron visuals, minimap blips, launch particles/SFX, bot ascent targeting) and host-synced **Refill Stations** (`medkit`, `fuel`, `supply` with smart non-wasting consumption, cooldown HUD/minimap sync, sparks/SFX, and bot navigation), enriched existing arenas (`ctfArenaMap`, `defaultMap`, `bunkerMap`), and added two symmetrical arenas (`skyCitadelMap` `2800x1600` & `cryoFacilityMap` `2400x1400`).

---

## Track E: Movement, Armory Balance, Audio & Bot AI Overhaul (v2.0 — Completed)
- [x] **Traversal & Jetpack Physics Tuning**:
  - Ground speed increased from `2.75` to `3.8` (+38%); air speed increased from `3.6` to `4.8` (+33%).
  - Jetpack fuel burn rate reduced from `0.42` to `0.26` (flight extended to 6+ seconds).
  - Quicker ground and air fuel regeneration; overheat recovery threshold lowered from `14` to `10`.
  - Air dash cooldown reduced from `2.4s` to `1.25s`, fuel cost reduced from `18` to `10`, dash velocity boosted to `11.2`.
- [x] **Armory Sandbox Rebalance**:
  - Unified `HEADSHOT_MULTIPLIER = 1.4` across combat simulation, host security, and test suites.
  - Rail Sniper headshot damage elevated to `105` (1-shot elimination on 100 HP targets). Bullet velocity increased to `34`.
  - Assault Rifle damage rebalanced to `12` with `125ms` cadence (~96 DPS down from ~122 DPS).
  - Combat Shotgun spread tightened from `0.22` to `0.14`; pellet count increased from `6` to `8` (`88` point-blank meatshot damage); cycle speed snappier at `650ms`.
  - RPG rocket speed boosted from `9.5` to `13.5`; direct epicenter damage increased to `100`.
  - Frag Grenade epicenter damage increased to `100`. Tactical Pistol damage tuned to `20` with `220ms` cadence.
- [x] **Bot AI Bridge & Ledge Navigation**:
  - Added `hasCeilingAbove()` and `findCeilingEscapeDirection()` to detect overhead terrain and solid platforms.
  - Suppressed upward thruster burn when obstructed vertically by solid ceilings; bots steer horizontally to clear the overhang before firing thrusters.
  - Scaled bot aiming sway across Cadet (`0.15`), Veteran (`0.085`), and Ace (`0.055`) for competitive yet humanized gunfights.
- [x] **Procedural Audio Synthesis Overhaul**:
  - Multi-stage combat shotgun: supersonic transient crack + resonant lowpass noise body + sub-thump + mechanical pump click.
  - Hypersonic rail sniper: high-voltage ionization snap + resonant electromagnetic hum + sub-bass kinetic recoil.
  - Multi-stage explosion: initial shockwave snap (0-35ms) + seismic sub-bass drop (0-340ms) + turbulent debris rattle + terrain echo.
  - Dedicated pneumatic thruster dash air burst and pitch swell.
- [x] **Documentation & Repository Showcase**:
  - Replaced stock Vite template in `README.md` with complete cyberpunk game showcase, controls, architecture deep dive, and dev instructions.
  - Updated `PROJECT_CONTEXT.md` to reflect modern PeerJS architecture and v2.0 systems tuning.
