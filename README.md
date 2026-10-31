# ✈️ JET / MAINT — Turbofan Predictive Maintenance Console

> An advanced, interactive aerospace telemetry and predictive maintenance console powered by **NASA C-MAPSS** turbofan run-to-failure data, **Three.js** 3D visualization, procedural **Web Audio API** turbine acoustics, and **Random Forest / XGBoost** RUL estimation.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Three.js](https://img.shields.io/badge/Three.js-r170-00f0ff.svg)
![Vite](https://img.shields.io/badge/Vite-6.0-646cff.svg)
![NASA C-MAPSS](https://img.shields.io/badge/Dataset-NASA%20C--MAPSS-orange.svg)
![Build](https://img.shields.io/badge/Build-Passing-34d399.svg)

---

## 🌟 Highlights & Creative Features

### 1. 🚀 Interactive 3D Turbofan Engine Model (Three.js)
- **Real-Time Spinning Spools**: Dual-spool simulation with low-pressure fan/LPC spinning at proportional speeds and the high-pressure core rotor (HPC & HPT) spinning at high RPM.
- **Dynamic Airflow & Gas Particle System**: 350+ animated particles illustrating the air cycle:
  - *Cold intake* (ice cyan)
  - *Compression* (electric turquoise)
  - *Combustion burn* (expanding fiery gold & orange)
  - *High-speed exhaust jet* (incandescent red-orange stream)
- **Thermal Infrared (IR) Heatmap Mode**: Instant toggle rendering real-time temperature gradients from ambient inlet (25°C) to core combustion (1,550°C).
- **💥 Exploded / X-Ray Inspection View**: Smooth slider separating fan, HPC, combustor, HPT, and exhaust modules along the X-axis to expose internal shafts, bearings, and rotor stages.
- **Raycasting Zone Inspection**: Click any engine component to inspect its health, failure mechanisms, and diagnostic parameters with glowing highlights.

### 2. ♫ Procedural Web Audio Jet Sound Engine
- 100% browser-synthesized acoustics using **Web Audio API** oscillators, filters, and white noise generators.
- Zero external audio files or downloads required.
- Dynamic turbine spool-up whine, combustion rumble, and airflow hiss that adjust smoothly with the throttle slider and flight mission presets.

### 3. ⚙️ Interactive "What-If" Stress & Failure Simulator
- Real-time sliders to inject simulated physical failure mechanisms:
  - **🔥 Turbine Thermal Degradation (EGT Creep)**
  - **⌁ Bearing Mechanical Wear & Rotor Imbalance**
  - **↕ Compressor Blade Erosion & Tip Clearance Loss**
- Watch Remaining Useful Life (**RUL**), health score dials, and telemetry sparklines recalculate in real time!

### 4. 🧠 Clean, Modular & Understandable Architecture
- Plain-English explanations of all 21 engine sensors (EGT, Pressure Ratio, Bearing Vibration RMS, Core RPM).
- Interactive "Why This Matters" tooltip guides on each telemetry card.
- Built-in educational modal: *"How Jet Engine Predictive Maintenance Works"* breaking down the 4 stages from ingestion to dispatch decisions.

---

## 🏗️ Architecture & Technology Stack

- **Frontend & 3D**: Vanilla JavaScript (ES modules) + [Three.js](https://threejs.org/) + HTML5 Canvas
- **Build Tool**: [Vite 6](https://vite.dev/)
- **Audio Engine**: Native Browser [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- **Styling**: Vanilla CSS3 Glassmorphism with Avionics HUD typography (`Space Grotesk` & `IBM Plex Mono`)
- **Data Source**: NASA C-MAPSS Turbofan Run-to-Failure simulation dataset (`FD001` - `FD004`)

---

## 📁 Repository Structure

```text
├── src/
│   ├── main.js        # UI orchestrator, HUD state, event wiring
│   ├── engine3d.js    # Three.js turbofan scene, animations, particle stream, exploded view
│   ├── audio.js       # Procedural Web Audio jet turbine sound engine
│   ├── simulator.js   # RUL estimation, sensor explanations, stress calculations
│   └── styles.css     # Aerospace HUD design, glassmorphism, responsive layout
├── public/
│   └── data/          # Derived C-MAPSS dataset summary JSON
├── scripts/
│   └── prepare_cmapss.py # Python pipeline for downloading C-MAPSS & training baseline
├── docs/              # Architecture diagrams & implementation plan
├── index.html         # Application mount
└── package.json       # Project dependencies & Vite scripts
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm` or `yarn`

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/tribhuvaneraj-ship-it/Jet-Engine.git
   cd Jet-Engine
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the local development server:
   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000` in your browser.

### Production Build
```bash
npm run build
npm run preview
```

---

## 📊 Maintenance Status Thresholds

| Band | Remaining Useful Life (RUL) | Maintenance Action |
|:---:|:---:|:---|
| **NORMAL** | `> 55 Cycles` | Standard scheduled pre-flight inspection |
| **MONITOR** | `20 – 55 Cycles` | Elevated thermal/vibration; schedule borescope within 10 cycles |
| **CRITICAL** | `< 20 Cycles` | Immediate grounding; hot section overhaul mandated |

---

## 📜 License & Disclaimers

- **NASA C-MAPSS Data**: Public Domain / CC0.
- **Educational Disclaimer**: This project is built for educational and research demonstration purposes. Predictions are model estimates and not certified aviation maintenance decisions.
