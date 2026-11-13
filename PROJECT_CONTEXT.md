# Project Context & Developer Mentorship Guide

> **Project Name:** **AEROSTRIKE: OMEGA** (2D P2P Capture The Flag Shooter)  
> **Framework:** React 19 + TypeScript + Vite + Tailwind CSS v4 + Zustand + PeerJS (WebRTC DataChannels)  
> **Visual Identity:** Cyberpunk Orbital Black-Ops / High-Tech Skirmish (CSS Grid Textures, CRT Scanlines, Multi-layered Glows, Screen Shake, 60 FPS Canvas)

---

## 1. Project Overview & Architecture

We are building **AEROSTRIKE: OMEGA**, a fast-paced, serverless, peer-to-peer (P2P) 2D multiplayer shooter inspired by *Mini Militia*, *Teeworlds*, and *Soldat*.

* **Framework**: React 19 + TypeScript + Vite + Tailwind CSS v4.
* **State Management**: **Zustand** (feature-scoped stores, accessible both in React UI and non-reactively via `.getState()` inside the 60 FPS Canvas loop).
* **Styling & Theme**: High-tech Cyberpunk Obsidian & Neon Cyan / Crimson theme using CSS scanline textures, multi-layered glows, and dynamic shadows.
* **Rendering & Physics Engine**: HTML5 Canvas 2D running at 60 FPS via `requestAnimationFrame` with a 2D Lerp Camera Viewport tracking multi-tiered arenas.
* **Networking**: Direct WebRTC DataChannels via **PeerJS** with room-code matchmaking and a quantized 14-byte binary ArrayBuffer state synchronization protocol running at 25 Hz.
* **Graphics & Audio**: Zero external image or audio assets. 100% procedural vector geometry (with 2-bone analytic IK limb solvers) and real-time procedural Web Audio API synthesis.
* **Controls**: Universal input abstraction supporting Keyboard + Mouse (desktop) and on-screen dual virtual joysticks/buttons with standalone PWA support (mobile).

---

## 2. Completed Milestones

- [x] **Milestone 1: 2D Scrolling Camera & Symmetrical Arenas**: Symmetrical CTF arena with Blue/Red bases, 3 vertical traversal lanes, screen-to-world coordinate transforms, and real-time Minimap radar.
- [x] **Milestone 2: Weapons Arsenal & Ballistics**: 6 distinct weapons (Tactical Pistol, Assault Rifle, Combat Shotgun, Rail Sniper, RPG Launcher with splash damage, Frag Grenade with lob physics), weapon recoil physics, and floating weapon crates.
- [x] **Milestone 3: Procedural Avatar Customizer**: 100% procedural vector drawing (body, visor, headgear, thrusters, and colors) with 2-bone analytic IK limb solving and live 60 FPS preview canvas.
- [x] **Milestone 4: Team Capture The Flag (CTF) Rule Engine**: Full flag state machine (`AT_BASE`, `CARRIED`, `DROPPED` with 20s countdown ring, `CAPTURED`), score target, carrier fuel burn penalties, and respawn protection.
- [x] **Milestone 5: P2P Multiplayer & PeerJS Migration**: High-performance WebRTC DataChannels mesh via PeerJS with 6-character room codes, 1-click shareable URLs, host migration guards, and 14-byte binary state quantization.
- [x] **Milestone 6: Universal Mobile Controls**: Dual on-screen virtual joysticks for movement, jetpack thrust, and 360-degree aiming.
- [x] **Milestone 7: AEROSTRIKE: OMEGA Theme Overhaul**: Full cyberpunk visual identity with CSS holographic scanlines, glowing cyan/crimson borders, camera screen shake, and tactical HUD.
- [x] **Milestone 8: Mobile Playability & Progressive Web App (PWA)**: Full-bleed `100vw × 100vh` canvas with multi-touch isolation, dynamic floating joysticks (left move/boost, right aim/fire), dedicated thumb quick actions, collapsible radar, standalone PWA manifest, offline service worker caching, and home screen install icons (192px/512px).
- [x] **Milestone 9: Host Authority Enforcement, Lobby QR Code & Optical Scanner**: Enforced room creator host exclusivity for match launches; integrated live QR code display in War Room staging (`qrcode` library) with tap-to-enlarge modal; built full-featured cyberpunk in-game camera QR scanner (`html5-qrcode` library) with auto room-code extraction for instant mobile joining.
- [x] **Milestone 10: Reconnection & Host Security**: Added persistent `playerId` in localStorage; implemented host-verified `roomAuth` protocol allowing original players to rejoin live matches anytime while locking out unauthorized late-joiners; verified damage rate limiting and weapon caps.
- [x] **Milestone 11: Pacing, Armory & Bot AI Overhaul (v2.0)**:
  - **Fluid Traversal**: Increased ground speed ($2.75 \to 3.8$) and air speed ($3.6 \to 4.8$); reduced jetpack fuel burn ($0.42 \to 0.26$) granting 6+ seconds of flight; reduced dash cooldown ($2.4\text{s} \to 1.25\text{s}$) and fuel penalty ($18 \to 10$).
  - **Armory Sandbox Rebalance**: Buffed Rail Sniper headshot multiplier to $1.4\times$ ($105\text{ dmg}$, 1-shot kill); rebalanced Assault Rifle DPS (~$96\text{ DPS}$); tightened Combat Shotgun spread ($0.22 \to 0.14$) with 8 pellets ($88\text{ dmg}$ meatshots); increased RPG rocket velocity to $13.5$ and direct damage to $100$.
  - **Bot AI Bridge Navigation**: Added overhead ceiling and platform detection (`hasCeilingAbove`); bots now intelligently navigate horizontally to the nearest open ledge before boosting rather than pinning themselves against ceilings.
  - **Procedural Sound Overhaul**: Multi-stage audio synthesis featuring supersonic transient cracks, dual-layer noise bursts, sub-bass seismic rumbles, and dedicated thruster dash acoustics.
