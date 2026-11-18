# 🕹️ Neon Breakout

A vibrant, cyberpunk-inspired retro breakout / brick-breaker game built with **Blazor WebAssembly (.NET 10)**, HTML5 2D Canvas, and the Web Audio API.

![Neon Breakout Banner](wwwroot/icon-192.png)

---

## ✨ Features

- **Cyberpunk / Synthwave Visuals:** Glowing neon palettes, dynamic starfield particle backgrounds, and responsive screen-shake impact effects.
- **Web Audio Sound Effects:** Real-time procedural audio synthesized using the Web Audio API (no external sound files required).
- **Juicy Game Feel:** Particle explosions on brick destruction, combo multipliers, and ball trail rendering.
- **Dynamic Power-Ups:**
  - ⬌ **WIDE**: Expands paddle width for easier catches
  - ✦ **MULTI**: Splits active balls into multiple bouncing projectiles
  - ↑ **LASER**: Arms the paddle with twin laser cannons
  - ◷ **SLOW**: Slows ball velocity for precision control
  - ♥ **+1 UP**: Awards an extra life
  - 🔥 **FIREBALL**: Superheats the ball to pierce straight through bricks
- **Multiple Level Patterns:** Includes classic rows, checkerboards, diamonds, fortresses, retro space invaders, and procedurally generated challenges.
- **Cross-Platform Controls:** Smooth support for keyboard, mouse tracking, and touch gestures.
- **Local High Score Tracking:** Remembers your top score via browser local storage.

---

## 🎮 Controls

| Action | Keyboard | Mouse / Touch |
| :--- | :--- | :--- |
| **Move Paddle** | `←` / `→` or `A` / `D` | Move cursor / drag finger |
| **Launch Ball / Action** | `Space` | Click / Tap |
| **Fire Lasers** | `Space` | Click / Tap |
| **Pause Game** | `P` | — |

---

## 🚀 Getting Started

### Prerequisites
- [.NET 10 SDK](https://dotnet.microsoft.com/download) installed on your system.

### Running Locally

1. **Clone the repository:**
   ```bash
   git clone https://github.com/sachinjat2802/NeonBreakout.git
   cd NeonBreakout
   ```

2. **Run the application:**
   ```bash
   dotnet watch
   ```
   *or*
   ```bash
   dotnet run
   ```

3. Open your browser and navigate to the local URL displayed in the terminal (typically `http://localhost:5000` or `https://localhost:5001`).

---

## 🛠️ Tech Stack

- **Framework:** [Blazor WebAssembly](https://dotnet.microsoft.com/apps/aspnet/web-apps/blazor) (.NET 10)
- **Rendering:** HTML5 Canvas 2D Context with device pixel ratio (HiDPI / Retina) scaling
- **Audio:** Web Audio API (`AudioContext`, `OscillatorNode`, `GainNode`)
- **Interoperability:** Blazor JavaScript Interop (`IJSRuntime`)
- **Styling:** Modern CSS with custom glowing filters and Orbitron monospace typography

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
