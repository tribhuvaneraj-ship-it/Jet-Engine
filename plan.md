# Jet Engine Predictive Maintenance — Website Prototype Plan

## Product scope

Build a polished technical diagnostics dashboard for a NASA C-MAPSS jet-engine predictive-maintenance workflow. The prototype pairs a procedural placeholder 3D turbofan model with RUL, sensor, fleet, and alert views from the PRD. The supplied cutaway render is the visual reference; because it is a 2D image, the interactive model is constructed from Three.js geometry and clearly presented as a prototype visual asset.

## Approved experience

- Interactive 3D turbofan engine viewer
- Orbit rotation and zoom
- Reset-view and auto-spin controls
- Cutaway shell toggle
- Clickable/highlightable zones: fan, HPC, combustion, HPT, and nozzle
- Fleet/unit status summary
- RUL estimate with units, confidence context, and urgency status
- Sensor trend visuals for temperature, pressure, vibration, and RPM
- Model metric cards and diagnostic alert context
- Responsive technical interface inspired by the reference image

## Design direction

### Design movement

**Aerospace mission control meets technical cutaway drafting.** The interface treats the engine as the hero object and layers measured telemetry around it like a service-bay diagnostic console rather than a generic SaaS dashboard.

### Core principles

1. **Instrument-first clarity:** every visual hierarchy leads back to engine health, RUL, or inspection focus.
2. **Measured density:** compact labels, telemetry ticks, and data cards create confidence without decorative clutter.
3. **Controlled energy:** cyan and amber accents indicate flow and temperature; red is reserved for actionable risk.
4. **Inspect, then decide:** selecting a zone changes the diagnostic context while preserving the whole-engine view.

### Color philosophy

The near-black navy canvas echoes an avionics display and gives the translucent engine room to glow. Pale blue-white is used for structure and labels. A signature **ion cyan** (`#77F4E4`) signals live telemetry and airflow. Amber (`#FFB86B`) marks thermal areas and attention. Coral red is used only for critical status so it carries real meaning.

### Layout paradigm

A command-console composition: a slim top rail, a left fleet rail, a large asymmetric engine inspection bay, a right-side status stack, and an anchored diagnostic ribbon. The engine is intentionally off-center to make the composition feel like an operator's workstation rather than a centered marketing hero.

### Signature elements

- **Diagnostic reticle:** a circular RUL ring with tick marks and a clear cycle value.
- **Telemetry rails:** compact all-caps labels and vertical accent bars on key panels.
- **Cutaway glow:** a translucent cyan shell around the procedural model, with amber combustion and turbine zones.

### Interaction philosophy

Interactions should feel like inspection tools: orbit, zoom, reset, select a component, and toggle the cutaway. Every control produces an immediate visible change in the 3D scene or the diagnostic panel. The zone list is both a legend and a direct inspection control.

### Animation

Use restrained, purposeful motion: slow rotation only when auto-spin is enabled, subtle emissive pulses in thermal zones, hover lift on cards, and a short camera/selection transition. Avoid noisy parallax or constantly moving UI that would compete with the model.

### Typography system

Use **Space Grotesk** for display and body text, with **IBM Plex Mono** for telemetry, IDs, timestamps, and numeric values. Headings are compact and uppercase; data uses tabular/monospace figures for scanability.

### Brand essence

**A diagnostic cockpit for turning engine telemetry into an inspection focus.** Personality: precise, vigilant, composed.

### Brand voice

Headlines are terse and operational. CTAs and microcopy describe the next inspection action.

- “TRACE THE DEGRADATION PATH.”
- “HPT SIGNAL ELEVATED — REVIEW THERMAL MARGIN.”

### Wordmark and logo concept

A compact `JM` monogram built from two opposing turbine arcs, paired with the wordmark `JET / MAINT`. The prototype uses this motif as a text lockup and favicon placeholder; a production pass can replace it with a custom SVG asset.

### Signature brand color

Ion cyan (`#77F4E4`) is the ownable color: it appears in the active RUL ring, airflow cues, selected zones, and live telemetry accents.

## Frontend architecture

- **Vite + vanilla JavaScript** for a fast, dependency-light prototype.
- **Three.js** for the procedural placeholder 3D engine and orbit controls.
- **CSS custom properties** for the diagnostic palette, spacing, and responsive breakpoints.
- **SVG and semantic HTML** for compact charts, cards, tables, and accessible labels.
- **Single-page composition** with data-driven component/zone state in `src/main.js`.

## Main files

```text
jetmaint/
├── index.html                 # shell, panels, canvas mount, typography imports
├── src/
│   ├── main.js                # Three.js scene, interactions, dashboard state
│   └── styles.css             # responsive console styling and motion
├── public/
│   ├── data/cmapss-summary.json # derived real-data export generated locally
│   └── manus-routes.json      # route manifest for the single-page dashboard
├── scripts/
│   └── prepare_cmapss.py      # Kaggle download, RUL labels, baseline model, JSON export
├── requirements-data.txt      # Python data-preparation dependencies
├── app.config.ts              # project logo metadata
├── package.json               # Vite and Three.js scripts/dependencies
└── plan.md                    # this implementation/design plan
```

## 3D viewer implementation

The model is a clearly labeled placeholder built from reusable geometry: fan blades, compressor discs, combustion rings, turbine stages, shaft, nozzle, and a translucent nacelle/cutaway shell. Each functional zone is grouped and tagged for raycasting. `OrbitControls` handles pointer/touch orbit and wheel zoom; the toolbar controls reset, auto-spin, and shell visibility. The component list and 3D raycast share the same zone data, so selecting in either surface updates the inspection panel.

## Diagnostic data behavior

The dashboard reads `public/data/cmapss-summary.json`, generated from Kaggle's `behrad3d/nasa-cmaps` NASA C-MAPSS archive. `scripts/prepare_cmapss.py` downloads/caches the archive with `kagglehub`, adds per-cycle RUL labels, trains a reproducible Random Forest baseline on the training split, evaluates against the official test RUL labels, and exports fleet rows, a selected engine history, channel statistics, MAE, and RMSE. The UI continues to load its shell if the export is absent and displays a preparation message; it should not be treated as live aircraft telemetry. The UI uses the disclaimer “SIMULATED NASA C-MAPSS DATA — NOT CERTIFIED AVIATION MAINTENANCE GUIDANCE.”

## Delivery constraints

- Placeholder model only; swap in an approved `.glb`/`.gltf` asset later without changing the dashboard contracts.
- Keep the browser bundle self-contained except for the Three.js npm dependency and Google Fonts loaded by CSS.
- Keep raw Kaggle archives and API credentials outside Git; only the small derived JSON export belongs in `public/data/`.
- Preserve the project route manifest and run the Vite server on the configured preview port.
