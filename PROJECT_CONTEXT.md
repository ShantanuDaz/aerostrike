# Project Context & Developer Mentorship Guide

> **Project Name:** **AEROSTRIKE: OMEGA** (2D P2P Capture The Flag Shooter)  
> **Framework:** React 19 + TypeScript + Vite + Tailwind CSS v4 + Zustand + Trystero (WebRTC / Nostr)  
> **Visual Identity:** Cyberpunk Orbital Black-Ops / High-Tech Skirmish (CSS Grid Textures, CRT Scanlines, Multi-layered Glows, Screen Shake, 60 FPS Canvas)

---

## 1. Project Overview & Architecture

We are building **AEROSTRIKE: OMEGA**, a fast-paced, serverless, peer-to-peer (P2P) 2D multiplayer shooter inspired by *Mini Militia*, *Teeworlds*, and *Soldat*.

* **Framework**: React 19 + TypeScript + Vite + Tailwind CSS v4.
* **State Management**: **Zustand** (feature-scoped stores, accessible both in React UI and non-reactively via `.getState()` inside the 60 FPS Canvas loop).
* **Styling & Theme**: High-tech Cyberpunk Obsidian & Neon Cyan / Crimson theme using CSS scanline textures, multi-layered glows, and dynamic shadows.
* **Rendering & Physics Engine**: HTML5 Canvas 2D running at 60 FPS via `requestAnimationFrame` with a 2D Lerp Camera Viewport tracking a 3200 × 1800 map.
* **Networking**: Serverless WebRTC via **Trystero** (`trystero/nostr`) using public Nostr relays for zero-cost room-code matchmaking and 25 Hz state synchronization.
* **Graphics & Audio**: Zero external image or audio assets. Procedural vector geometry and procedural Web Audio API sound synthesis.
* **Controls**: Universal input abstraction supporting Keyboard + Mouse (desktop) and on-screen dual virtual joysticks/buttons (mobile).

---

## 2. Completed Milestones

- [x] **Milestone 1: 2D Scrolling Camera & Big Map (3200 × 1800)**: Symmetrical CTF arena with Blue/Red bases, 3 vertical traversal lanes, screen-to-world coordinate transforms, and real-time Minimap radar.
- [x] **Milestone 2: Weapons Arsenal & Ballistics**: 5 distinct weapons (Tactical Pistol, Assault Rifle, Combat Shotgun, Rail Sniper, RPG Rocket Launcher with splash damage), weapon recoil physics, and floating weapon crates.
- [x] **Milestone 3: Procedural Avatar Customizer**: 100% procedural vector drawing (body, visor, headgear, thrusters, and colors) with live 60 FPS preview canvas.
- [x] **Milestone 4: Team Capture The Flag (CTF) Rule Engine**: Full flag state machine (`AT_BASE`, `CARRIED`, `DROPPED` with 20s countdown ring, `CAPTURED`), score target, carrier fuel burn penalties, and respawn protection.
- [x] **Milestone 5: P2P Multiplayer & Host Authority**: Trystero WebRTC Nostr mesh with 6-character room codes, 1-click shareable URLs, live team switching, and Host launch synchronization.
- [x] **Milestone 6: Universal Mobile Controls**: Dual on-screen virtual joysticks for movement, jetpack thrust, and 360-degree aiming.
- [x] **Milestone 7: AEROSTRIKE: OMEGA Theme Overhaul**: Full cyberpunk visual identity with CSS holographic scanlines, glowing cyan/crimson borders, camera screen shake, and tactical HUD.
- [x] **Milestone 8: Mobile Playability & Progressive Web App (PWA)**: Full-bleed `100vw × 100vh` canvas with multi-touch isolation, dynamic floating joysticks (left move/boost, right aim/fire), dedicated thumb quick actions, collapsible radar, standalone PWA manifest, offline service worker caching, and home screen install icons (192px/512px).
- [x] **Milestone 9: Host Authority Enforcement, Lobby QR Code & Optical Scanner**: Enforced room creator host exclusivity for match launches; integrated live QR code display in War Room staging (`qrcode` library) with tap-to-enlarge modal; built full-featured cyberpunk in-game camera QR scanner (`html5-qrcode` library) with auto room-code extraction for instant mobile joining.
- [x] **Milestone 10: Robust Nostr Relays & Reconnection with Host Authority**: Configured high-capacity live Nostr relays (`nos.lol`, `relay.snort.social`, `nostr.mom`, `nostr.wine`, `nostr.land`, `relay.nostr.band`) for zero-mismatch peer discovery; added persistent `playerId` in localStorage; implemented host-verified `roomAuth` protocol allowing original players to rejoin live matches anytime while locking out unauthorized late-joiners.
