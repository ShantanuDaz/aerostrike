# AEROSTRIKE: OMEGA

> **High-Octane 2D P2P Aerial Arena Shooter & Capture The Flag**  
> *Built with React 19, TypeScript, Vite, Tailwind CSS v4, PeerJS (WebRTC), and 60 FPS HTML5 Canvas.*

---

## ⚡ Overview

**AEROSTRIKE: OMEGA** is a fast-paced, serverless peer-to-peer 2D multiplayer shooter inspired by arcade classics like *Soldat*, *Teeworlds*, and *Mini Militia*. Players engage in aerial acrobatics, armed dogfights, and high-stakes Capture The Flag (CTF) matches across sprawling cyberpunk arenas.

The game is built with a dogmatic commitment to procedural purity: **zero external bitmap image assets and zero audio sample files**. Every sprite, armor plate, robotic limb, weapon fire, explosion, and engine roar is synthesized in real time via HTML5 Canvas vector math and the browser's native Web Audio API.

---

## 🚀 Key Architectural & Systems Highlights

### 1. 14-Byte Quantized WebRTC Protocol (`fastProtocol.ts`)
State synchronization runs over unreliable WebRTC DataChannels at 25 Hz. An entire player snapshot—sub-pixel coordinates, velocity vectors, normalized aiming angles, 7-bit health, invulnerability shields, equipped weapons, and jetpack boost states—is packed into a compact **14-byte binary ArrayBuffer**, keeping packet overhead near zero even on constrained mobile networks.

### 2. High-Frequency State Decoupling
To prevent React re-render cascades during high-intensity 60+ FPS firefights:
* **UI Overlays (HUD, Radar, Chat, Menus):** Managed reactively via Zustand stores.
* **Physics & Canvas Render Loop:** Reads imperatively from pre-allocated memory pools (`engineWorld.ts`, `arenaSimulation.ts`) inside `requestAnimationFrame`, achieving zero garbage collector stutter.

### 3. Procedural Inverse Kinematics (IK) Soldier Rigging
Soldier models feature custom **2-bone analytic Inverse Kinematics** (`solveTwoBoneIK`) that naturally bend elbows and knees to dynamically aim weapons 360° while tracking running and flight momentum.

### 4. Pure Web Audio API Sound Engine (`soundEngine.ts`)
Every sound in the game is synthesized procedurally in real time:
* **Combat Shotgun:** Dual-layer acoustic stack with an initial supersonic transient crack, resonant pellet blast, concussive sub-thump, and mechanical pump action.
* **Rail Sniper:** Hypersonic ionization crack layered over an electromagnetic bore hum and sub-bass kinetic discharge.
* **Explosions:** Multi-stage shockwave wavefront, concussive seismic sub-bass drop, turbulent debris rattle, and ground reverberation tail.
* **Thruster Dash & Jetpack:** Compressed pneumatic air hiss with pitch-modulated thruster flare.

### 5. Smart Bot AI & Obstacle Navigation (`botAI.ts`)
Practice in solo skirmishes against bots equipped with:
* Overhang and ceiling edge detection that prevents burning fuel into solid obstacles.
* Predictive velocity leading and humanized aiming sway across Cadet, Veteran, and Ace difficulties.
* Strategic objective routing for CTF flag grabs, returns, weapon crates, and refill stations.

### 6. Universal Controls & Mobile PWA
* **Desktop:** Mouse + Keyboard (WASD movement, Space jetpack, Shift/E air-dash, Left-Click fire, Right-Click grenade).
* **Mobile / Touch:** Dual virtual thumbsticks (left: movement & thrust, right: 360° aim & auto-fire) with dedicated touch buttons, multi-touch isolation, and standalone PWA offline installation.

---

## ⚔️ The Armory

| Weapon | Base Dmg | Fire Rate | Max Ammo | Special Mechanics |
| :--- | :---: | :---: | :---: | :--- |
| **Tactical Pistol** | 20 | 220 ms | $\infty$ | Reliable sidearm; 28 dmg on headshots; infinite backup reserve. |
| **Assault Rifle** | 12 | 125 ms | 30 | Balanced automatic rifle (~96 DPS); effective mid-range suppression. |
| **Combat Shotgun** | $8 \times 11$ (88) | 650 ms | 8 | Tight 0.14 spread; devastating point-blank meatshots and CQB control. |
| **Rail Sniper** | 75 | 1100 ms | 5 | Hyper-velocity rail beam (34 speed); **105 dmg headshots** (1-hit kill). |
| **RPG Launcher** | 100 | 1300 ms | 3 | Direct-hit 100 dmg lethal rocket with wide radial splash knockback. |
| **Frag Grenade** | 100 | 900 ms | 3 | Arc-lob explosive; 100 dmg at blast epicenter with bouncy fuse physics. |

> **Critical Headshots:** Precision head hits trigger a **$1.4\times$ multiplier**, rewarding sharpshooters with instant eliminations and combat score bonuses.

---

## 🕹️ Controls Guide

| Action | Desktop (Keyboard & Mouse) | Mobile (Touch Controls) |
| :--- | :--- | :--- |
| **Move Left / Right** | `A` / `D` or `ArrowLeft` / `ArrowRight` | Left Joystick (Drag Horizontal) |
| **Jetpack Thrust** | `W` / `Space` / `ArrowUp` | Left Joystick (Drag Up) |
| **Drop Through Platform** | `S` / `ArrowDown` | Left Joystick (Drag Down) |
| **Thruster Air-Dash** | `Shift` / `E` | Right-side Dash Button |
| **Aim Weapon** | Mouse Cursor | Right Joystick (360° Drag) |
| **Fire Weapon** | Left Mouse Button | Right Joystick / Fire Button |
| **Throw Grenade** | Right Mouse Button / `G` | Quick Grenade Button |
| **Cycle Weapon** | `Q` / Mouse Wheel / `1`-`5` | Weapon Slot Bar |
| **Scoreboard** | `Tab` | Tactical Menu / Settings |

---

## 🛠️ Development & Testing

### Prerequisites
* **Node.js** 20+
* **npm** 10+

### Quick Start
```bash
# Clone the repository
git clone https://github.com/shantanudas/aerostrike.git
cd aerostrike

# Install dependencies
npm install

# Start local Vite development server
npm run dev
```

### Running Tests
The project features a comprehensive test suite covering protocol quantization, player physics, bullet collision SAT resolution, bot AI, host security, and audio synthesis:
```bash
# Run full Vitest suite (100+ tests passing)
npm test

# Run tests in watch mode
npm run test:watch
```

### Building for Production
```bash
# Typecheck and bundle production assets
npm run build

# Preview production build locally
npm run preview
```

---

## 📜 License
MIT License. Created by the AEROSTRIKE Team.
