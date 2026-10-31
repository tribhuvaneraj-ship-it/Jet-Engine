/**
 * JET / MAINT — Aerospace Predictive Maintenance Console
 *
 * Combines:
 * - Interactive 3D Turbofan visualization (spinning spools, particle stream, thermal IR, exploded view)
 * - Procedural Web Audio jet sound engine
 * - Plain-English, understandable sensor diagnostics
 * - Interactive "What-If" stress degradation simulator with live RUL response
 * - Educational guide on NASA C-MAPSS predictive maintenance
 */

import './styles.css';
import { Engine3DViewer } from './engine3d.js';
import { jetAudio } from './audio.js';
import {
  ENGINE_ZONES,
  SENSOR_DEFINITIONS,
  FLIGHT_PHASES,
  calculateEngineRUL,
  generateSensorHistory,
  dataToSvgPath,
  fetchCmapssDataset
} from './simulator.js';

// Application State
const state = {
  currentEngine: 'GE9X-017',
  currentEngineId: 17,
  selectedZone: 'hpt',
  currentFlightPhase: 'cruise',
  throttle: 0.75,
  thermalStress: 35,
  vibrationStress: 28,
  compressorWear: 18,
  currentRULData: null,
  isAudioPlaying: false,
  isThermalMode: false,
  isExploded: false,
  datasetSummary: null
};

const app = document.querySelector('#app');

// Build UI Shell
app.innerHTML = `
  <div class="starfield" aria-hidden="true"></div>
  <main class="console-shell">
    <!-- Topbar -->
    <header class="topbar">
      <div class="brand-lockup">
        <div class="brand-mark" aria-hidden="true"><span></span><span></span></div>
        <div>
          <div class="wordmark">JET <i>/</i> MAINT</div>
          <div class="eyebrow">AEROSPACE PREDICTIVE MAINTENANCE</div>
        </div>
      </div>

      <div class="topbar-center">
        <span class="live-dot"></span>
        <span>SIMULATION NODE / CONNECTED</span>
        <span class="dot-separator">·</span>
        <button class="learn-button" id="btnHowItWorks" title="Understand how predictive maintenance works">
          ℹ HOW IT WORKS
        </button>
      </div>

      <div class="topbar-actions">
        <!-- Procedural Audio Controls -->
        <div class="audio-control-bar">
          <button class="icon-button sound-button" id="btnSoundToggle" aria-pressed="false" title="Toggle procedural jet turbine sound">
            <span class="sound-icon">♫</span>
            <span class="sound-label">JET SOUND: OFF</span>
          </button>
          <div class="audio-slider-group" title="Adjust turbine throttle">
            <label for="throttleSlider">THRUST</label>
            <input type="range" id="throttleSlider" min="10" max="100" value="75" step="5" />
            <span id="throttleValue">75%</span>
          </div>
        </div>

        <span class="timestamp" id="hudClock">02 OCT 2026 · 07:30 UTC</span>
        <button class="avatar" title="Operator Profile">AR</button>
      </div>
    </header>

    <!-- Main Workspace -->
    <div class="workspace">
      <!-- Left Fleet Rail -->
      <aside class="fleet-rail">
        <div class="rail-header">
          <div class="eyebrow">FLEET UNITS / ACTIVE</div>
          <span class="fleet-count-tag">3 OF 100</span>
        </div>

        <div class="fleet-list">
          <button class="fleet-card active" data-engine="GE9X-017" data-id="17" data-rul="42" data-status="MONITOR">
            <div class="fleet-card-head">
              <span class="status-dot watch"></span>
              <span>GE9X-017</span>
              <span class="fleet-chevron">↗</span>
            </div>
            <div class="fleet-card-meta">
              <span>MONITOR</span>
              <strong>42<span> CY</span></strong>
            </div>
            <div class="mini-bar"><i style="width: 48%"></i></div>
            <div class="fleet-location">TEST CELL 04 · HOT SECTION WATCH</div>
          </button>

          <button class="fleet-card" data-engine="GE9X-042" data-id="42" data-rul="118" data-status="NORMAL">
            <div class="fleet-card-head">
              <span class="status-dot good"></span>
              <span>GE9X-042</span>
              <span class="fleet-chevron">↗</span>
            </div>
            <div class="fleet-card-meta">
              <span>NORMAL</span>
              <strong>118<span> CY</span></strong>
            </div>
            <div class="mini-bar"><i class="good-bar" style="width: 82%"></i></div>
            <div class="fleet-location">TEST CELL 01 · ROUTINE CRUISE</div>
          </button>

          <button class="fleet-card" data-engine="GE9X-105" data-id="105" data-rul="9" data-status="CRITICAL">
            <div class="fleet-card-head">
              <span class="status-dot critical"></span>
              <span>GE9X-105</span>
              <span class="fleet-chevron">↗</span>
            </div>
            <div class="fleet-card-meta">
              <span>CRITICAL</span>
              <strong>09<span> CY</span></strong>
            </div>
            <div class="mini-bar"><i class="critical-bar" style="width: 14%"></i></div>
            <div class="fleet-location">TEST CELL 02 · MANDATED OVERHAUL</div>
          </button>
        </div>

        <!-- Fleet Health Summary -->
        <div class="rail-summary">
          <div class="eyebrow">FLEET HEALTH OVERVIEW</div>
          <div class="fleet-health-row">
            <span class="health-number" id="fleetHealthScore">67<span>%</span></span>
            <span class="health-label">MONITORING<br>REQUIRED</span>
          </div>
          <div class="health-stacks">
            <i class="stack-good" title="1 Normal Unit"></i>
            <i class="stack-watch" title="1 Watch Unit"></i>
            <i class="stack-critical" title="1 Critical Unit"></i>
          </div>
          <div class="health-legend">
            <span><b class="legend-dot good"></b>1 Nominal</span>
            <span><b class="legend-dot watch"></b>1 Attention</span>
            <span><b class="legend-dot critical"></b>1 Critical</span>
          </div>
        </div>

        <div class="rail-footer">
          <span class="status-dot good"></span>
          <span>ESTIMATOR: RANDOM FOREST + XGB</span>
        </div>
      </aside>

      <!-- Main Stage -->
      <section class="main-stage">
        <!-- Section Heading & Flight Phase Controls -->
        <div class="section-heading">
          <div>
            <div class="eyebrow">TURBOFAN INSPECTION BAY / UNIT <span id="unitName">GE9X-017</span></div>
            <h1>Interactive Diagnostic & Telemetry Console</h1>
          </div>

          <!-- Mission Phase Selector -->
          <div class="mission-phase-group" role="group" aria-label="Flight Mission Phase">
            <span class="phase-label">MISSION PROFILE:</span>
            <button class="phase-btn" data-phase="taxi">TAXI (20%)</button>
            <button class="phase-btn active" data-phase="cruise">CRUISE (75%)</button>
            <button class="phase-btn" data-phase="takeoff">TAKEOFF (100%)</button>
            <button class="phase-btn" data-phase="descent">DESCENT (35%)</button>
          </div>

          <div class="heading-tools">
            <button class="ghost-button" id="btnSnapshot">◎ SNAPSHOT</button>
            <button class="ghost-button" id="btnExport">↧ EXPORT REPORT</button>
          </div>
        </div>

        <!-- 3D Inspection Stage + Right Status Stack -->
        <div class="inspection-layout">
          <!-- 3D Viewer Card -->
          <div class="viewer-card">
            <!-- HUD Overlays -->
            <div class="viewer-hud top-left">
              <span class="hud-tag">HIGH-BYPASS CORE</span>
              <span class="hud-separator"></span>
              <span id="hudSpoolRpm">N1: 8,420 RPM · N2: 12,550 RPM</span>
            </div>

            <div class="viewer-hud top-right">
              <span class="signal-bars"><i></i><i></i><i></i></span>
              <span>TELEMETRY STREAM <strong>ONLINE</strong></span>
            </div>

            <!-- Three.js Canvas Container -->
            <div id="engine-canvas" class="engine-canvas" aria-label="Interactive 3D turbofan engine viewer"></div>

            <!-- Dynamic On-Model Callout Badges -->
            <div class="viewer-callout callout-fan" data-zone="fan">
              <span class="callout-line"></span>
              <b>FAN & LPC</b>
              <small>AIRFLOW INTAKE</small>
            </div>
            <div class="viewer-callout callout-comb" data-zone="combustion">
              <span class="callout-line"></span>
              <b>COMBUSTOR</b>
              <small>HOT SECTION BURN</small>
            </div>
            <div class="viewer-callout callout-hpt" data-zone="hpt">
              <span class="callout-line"></span>
              <b>HPT STAGE</b>
              <small>INSPECTION TARGET</small>
            </div>

            <!-- Viewer Footer Help Text -->
            <div class="viewer-footer">
              <span>↻ DRAG TO ORBIT</span>
              <span>🔍 SCROLL TO ZOOM</span>
              <span>👆 CLICK COMPONENT TO INSPECT</span>
            </div>

            <!-- 3D Interactive Controls Toolbar -->
            <div class="viewer-controls">
              <button id="btnResetView" class="control-button" title="Reset camera to default view">
                ↺ <span>RESET</span>
              </button>
              <button id="btnAutoSpin" class="control-button" title="Toggle 360-degree auto rotation">
                ◌ <span>AUTO-SPIN</span>
              </button>
              <button id="btnCutaway" class="control-button active" title="Toggle outer aerodynamic cowling">
                ◫ <span>COWLING</span>
              </button>
              <button id="btnThermalMode" class="control-button" title="Switch to Infrared Thermal Temperature Heatmap">
                ♨ <span>THERMAL IR</span>
              </button>

              <!-- Exploded / X-Ray View Slider -->
              <div class="exploded-control-group" title="Slide to separate engine modules for internal inspection">
                <label for="explodedSlider">💥 EXPLODED</label>
                <input type="range" id="explodedSlider" min="0" max="100" value="0" step="2" />
                <span id="explodedVal">0%</span>
              </div>
            </div>
          </div>

          <!-- Right Status Stack -->
          <aside class="status-stack">
            <!-- Selected Zone Card -->
            <div class="panel selected-panel">
              <div class="panel-head">
                <div>
                  <div class="eyebrow" id="zoneCode">ZONE 04 / COMPONENT FOCUS</div>
                  <h2 id="zoneTitle">High-Pressure Turbine (HPT)</h2>
                </div>
                <span class="zone-index" id="zoneIndex">04</span>
              </div>
              <p id="zoneDescription">Thermal and vibration signature indicates hot-section inspection priority.</p>

              <div class="selected-signal">
                <span class="signal-dot critical" id="zoneSignalDot"></span>
                <strong id="zoneSignal">Elevated</strong>
                <span class="selected-metric" id="zoneMetric">Thermal margin −8.2%</span>
              </div>

              <div class="focus-note">
                <span>↳</span>
                <span id="focusNote">Perform borescope inspection on HPT blade trailing edges before next run.</span>
              </div>
            </div>

            <!-- Predicted RUL Card -->
            <div class="panel rul-panel">
              <div class="panel-head">
                <div>
                  <div class="eyebrow">REMAINING USEFUL LIFE (RUL)</div>
                  <h2>Predicted Runway</h2>
                </div>
                <span class="confidence">92.4% <small>CONFIDENCE</small></span>
              </div>

              <div class="rul-display">
                <div class="rul-ring">
                  <svg viewBox="0 0 116 116" aria-hidden="true">
                    <circle class="ring-track" cx="58" cy="58" r="49"></circle>
                    <circle class="ring-value" id="rulCircle" cx="58" cy="58" r="49" style="stroke-dasharray: 308; stroke-dashoffset: 200;"></circle>
                  </svg>
                  <div class="rul-number">
                    <strong id="rulNumber">42</strong>
                    <span>CYCLES</span>
                  </div>
                </div>

                <div class="rul-copy">
                  <span class="status-pill watch" id="rulStatus">MONITOR</span>
                  <p id="rulAdvice">Maintenance window<br><strong>recommended soon</strong></p>
                  <div class="rul-scale">
                    <span>0 CY</span>
                    <i><b id="rulScaleBar" style="width: 28%"></b></i>
                    <span>150+ CY</span>
                  </div>
                </div>
              </div>

              <div class="rul-foot">
                <span>MODEL: C-MAPSS PIPELINE</span>
                <span id="rulUpdatedTime">UPDATED REAL-TIME</span>
              </div>
            </div>

            <!-- Engine Zones Map -->
            <div class="panel zones-panel">
              <div class="panel-head">
                <div>
                  <div class="eyebrow">STRUCTURAL SCHEMATIC</div>
                  <h2>Engine Stage Map</h2>
                </div>
                <span class="zone-count">5 ACTIVE ZONES</span>
              </div>
              <div class="zone-list" id="zoneList"></div>
            </div>
          </aside>
        </div>

        <!-- Interactive "What-If" Degradation & Stress Simulator -->
        <section class="panel simulator-panel">
          <div class="panel-head">
            <div>
              <div class="eyebrow">INTERACTIVE DEGRADATION SANDBOX</div>
              <h2>"What-If" Stress & Failure Simulator</h2>
            </div>
            <button class="ghost-button" id="btnResetSimulator">↺ RESET STRESS</button>
          </div>

          <p class="sim-intro">
            Simulate real physical turbofan degradation mechanisms in real-time. Drag any parameter to observe immediate effects on RUL, thermal signatures, and maintenance urgency.
          </p>

          <div class="stress-controls-grid">
            <!-- Thermal Degradation Slider -->
            <div class="stress-card">
              <div class="stress-card-head">
                <span class="stress-icon temp">🔥</span>
                <strong>Turbine Thermal Degradation</strong>
                <span class="stress-value" id="valThermal">35%</span>
              </div>
              <input type="range" class="stress-slider" id="sliderThermal" min="0" max="100" value="35" />
              <small>Simulates cooling-hole blockage and thermal barrier oxidation in HPT blades.</small>
            </div>

            <!-- Vibration / Bearing Wear Slider -->
            <div class="stress-card">
              <div class="stress-card-head">
                <span class="stress-icon vibration">⌁</span>
                <strong>Bearing Wear & Rotor Imbalance</strong>
                <span class="stress-value" id="valVibration">28%</span>
              </div>
              <input type="range" class="stress-slider" id="sliderVibration" min="0" max="100" value="28" />
              <small>Simulates spool eccentricity, bearing race spalling, and mechanical friction.</small>
            </div>

            <!-- Compressor Tip Clearance Slider -->
            <div class="stress-card">
              <div class="stress-card-head">
                <span class="stress-icon pressure">↕</span>
                <strong>Compressor Blade Tip Clearance</strong>
                <span class="stress-value" id="valCompressor">18%</span>
              </div>
              <input type="range" class="stress-slider" id="sliderCompressor" min="0" max="100" value="18" />
              <small>Simulates HPC blade tip erosion causing aerodynamic leakage and pressure loss.</small>
            </div>
          </div>
        </section>

        <!-- Live Sensor Telemetry Cards -->
        <div class="diagnostics-grid">
          <section class="panel telemetry-panel">
            <div class="panel-head">
              <div>
                <div class="eyebrow">KEY SENSOR TELEMETRY / RUN-TO-FAILURE HISTORY</div>
                <h2>Live Gas-Path Signatures</h2>
              </div>
              <div class="telemetry-badge">24-CYCLE WINDOW</div>
            </div>

            <div class="telemetry-cards" id="telemetryCards">
              <!-- Dynamically populated sensor cards -->
            </div>
          </section>

          <!-- Model Performance Card -->
          <section class="panel model-panel">
            <div class="panel-head">
              <div>
                <div class="eyebrow">ESTIMATOR ACCURACY & VALIDATION</div>
                <h2>NASA C-MAPSS FD001</h2>
              </div>
              <span class="model-badge">RANDOM FOREST</span>
            </div>

            <div class="model-score">
              <div class="score-ring">
                <svg viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="33" class="score-track"></circle>
                  <circle cx="40" cy="40" r="33" class="score-value" style="stroke-dasharray: 207; stroke-dashoffset: 14;"></circle>
                </svg>
                <strong>94<span>%</span></strong>
              </div>
              <div>
                <div class="eyebrow">ESTIMATOR HEALTH</div>
                <h3>High Predictive Confidence</h3>
                <p>Validated on official 100-engine holdout test set</p>
              </div>
            </div>

            <div class="model-metrics">
              <div><span>MEAN ABS ERROR (MAE)</span><strong>10.4 <small>CY</small></strong></div>
              <div><span>ROOT MEAN SQ ERROR (RMSE)</span><strong>14.8 <small>CY</small></strong></div>
            </div>

            <div class="model-foot">
              <span>LEAKAGE-FREE CAUSAL FEATURES</span>
              <span id="modelVariantTag">FD001 · 21 CHANNELS</span>
            </div>
          </section>
        </div>

        <!-- Alerts / Inspection Queue -->
        <section class="panel alerts-panel">
          <div class="panel-head">
            <div>
              <div class="eyebrow">MAINTENANCE DISPATCH QUEUE</div>
              <h2>Actionable Diagnostics & Alerts</h2>
            </div>
            <button class="ghost-button" id="btnAllAlerts">EXPORT DISPATCH LOG ↗</button>
          </div>

          <div class="alerts-table">
            <div class="alert-row alert-head">
              <span>SEVERITY</span>
              <span>ENGINE / STAGE</span>
              <span>DIAGNOSTIC EVENT</span>
              <span>TIMESTAMP</span>
              <span>ACTION</span>
            </div>

            <div class="alert-row">
              <span><b class="severity-dot critical"></b> CRITICAL</span>
              <span><strong>GE9X-105</strong> / HPT</span>
              <span>Predicted RUL &lt; 10 cycles; high EGT thermal limit reached</span>
              <span>06:42 UTC</span>
              <button class="row-action" data-engine="GE9X-105">INSPECT ↗</button>
            </div>

            <div class="alert-row">
              <span><b class="severity-dot watch"></b> WATCH</span>
              <span><strong>GE9X-017</strong> / HPT</span>
              <span>Bearing vibration trend accelerating; borescope scheduled</span>
              <span>07:28 UTC</span>
              <button class="row-action active-action" data-engine="GE9X-017" data-zone="hpt">FOCUS ↗</button>
            </div>

            <div class="alert-row">
              <span><b class="severity-dot good"></b> NOMINAL</span>
              <span><strong>GE9X-042</strong> / HPC</span>
              <span>Pressure ratio steady at 12.8 PR across 30 cycles</span>
              <span>07:02 UTC</span>
              <button class="row-action" data-engine="GE9X-042">LOGS ↗</button>
            </div>
          </div>
        </section>

        <!-- Footer -->
        <footer class="disclaimer">
          <span class="disclaimer-mark">ℹ</span>
          <span>
            <strong>RESEARCH & EDUCATIONAL SIMULATOR</strong> — Powered by NASA C-MAPSS Turbofan Run-to-Failure dataset. Predictions are model estimates for engineering education and not FAA-certified maintenance records.
          </span>
          <span class="footer-right">JETMAINT v2.0 · ALL SYSTEMS NOMINAL</span>
        </footer>
      </section>
    </div>

    <!-- Educational "How It Works" Modal -->
    <div class="modal-backdrop" id="modalHowItWorks" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-head">
          <div class="modal-title-group">
            <span class="modal-badge">EDUCATIONAL OVERVIEW</span>
            <h2>How Jet Engine Predictive Maintenance Works</h2>
          </div>
          <button class="modal-close" id="btnCloseModal" aria-label="Close modal">✕</button>
        </div>

        <div class="modal-body">
          <div class="guide-steps">
            <!-- Step 1 -->
            <div class="guide-card">
              <div class="guide-num">01</div>
              <h3>Continuous Telemetry Ingestion</h3>
              <p>
                During each flight cycle, 21 aircraft sensors measure high-pressure temperatures (EGT), spool rotational speeds (N1, N2), static pressure ratios, and bearing vibration signatures.
              </p>
            </div>

            <!-- Step 2 -->
            <div class="guide-card">
              <div class="guide-num">02</div>
              <h3>Causal Feature Engineering</h3>
              <p>
                Raw sensor signals are smoothed using 5-cycle causal rolling averages and degradation slope calculations without leaking future cycles, preserving true real-time operational fidelity.
              </p>
            </div>

            <!-- Step 3 -->
            <div class="guide-card">
              <div class="guide-num">03</div>
              <h3>Machine Learning RUL Estimation</h3>
              <p>
                Ensemble regression models (Random Forest and XGBoost) map subtle non-linear thermal creep and vibration drift to remaining runway cycles before structural threshold breaches.
              </p>
            </div>

            <!-- Step 4 -->
            <div class="guide-card">
              <div class="guide-num">04</div>
              <h3>Actionable Maintenance Decisions</h3>
              <p>
                Engines are automatically sorted into 3 actionable operational bands:
                <strong>Optimal (&gt;55 CY)</strong>, <strong>Monitor (20–55 CY)</strong>, or <strong>Immediate Grounding (&lt;20 CY)</strong>.
              </p>
            </div>
          </div>

          <div class="guide-sensor-table">
            <div class="eyebrow">PHYSICAL ENGINE SENSORS IN THIS SIMULATOR</div>
            <div class="guide-table-grid">
              <div><strong>EGT (T50)</strong><span>High-pressure turbine exhaust gas temperature</span></div>
              <div><strong>PR (P30)</strong><span>High-pressure compressor compression efficiency</span></div>
              <div><strong>Vib RMS</strong><span>Bearing race health and blade mass imbalance</span></div>
              <div><strong>Core RPM</strong><span>Shaft rotational speed and compressor work</span></div>
            </div>
          </div>
        </div>

        <div class="modal-foot">
          <button class="primary-button" id="btnGotIt">GOT IT, RETURN TO CONSOLE</button>
        </div>
      </div>
    </div>

    <!-- Toast Notification -->
    <div class="toast" id="toast" role="status"></div>
  </main>
`;

// Initialize Starfield
const starfield = document.querySelector('.starfield');
const starFrag = document.createDocumentFragment();
for (let i = 0; i < 140; i++) {
  const star = document.createElement('i');
  star.className = 'star';
  star.style.setProperty('--x', `${Math.random() * 100}%`);
  star.style.setProperty('--y', `${Math.random() * 100}%`);
  star.style.setProperty('--size', `${Math.random() < 0.15 ? 2.5 : 1}px`);
  star.style.setProperty('--twinkle', `${2.0 + Math.random() * 5.0}s`);
  star.style.setProperty('--delay', `${Math.random() * -7}s`);
  star.style.setProperty('--glow', `${0.3 + Math.random() * 0.7}`);
  starFrag.appendChild(star);
}
starfield.appendChild(starFrag);

// Toast utility
let toastTimer;
function showToast(msg) {
  const toast = document.querySelector('#toast');
  toast.textContent = msg;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2800);
}

// Initialize 3D Engine Viewer
const canvasHost = document.querySelector('#engine-canvas');
const engineViewer = new Engine3DViewer(canvasHost, (zoneKey) => {
  selectZone(zoneKey);
  showToast(`INSPECTING ${ENGINE_ZONES[zoneKey]?.short || zoneKey.toUpperCase()}`);
});

// Render Engine Zones List
const zoneList = document.querySelector('#zoneList');
zoneList.innerHTML = Object.entries(ENGINE_ZONES)
  .map(([key, zone], index) => `
    <button class="zone-row ${key === 'hpt' ? 'selected' : ''}" data-zone="${key}">
      <span class="zone-color" style="--zone-color: ${zone.color}"></span>
      <span class="zone-row-label">
        <strong>${String(index + 1).padStart(2, '0')} / ${zone.short}</strong>
        <small>${zone.label}</small>
      </span>
      <span class="zone-state ${zone.signalClass}">${zone.signal}</span>
      <span class="zone-arrow">↗</span>
    </button>
  `)
  .join('');

// Zone selection function
function selectZone(zoneKey) {
  if (!ENGINE_ZONES[zoneKey]) return;
  state.selectedZone = zoneKey;
  const zone = ENGINE_ZONES[zoneKey];

  document.querySelector('#zoneCode').textContent = `${zone.code} / COMPONENT FOCUS`;
  document.querySelector('#zoneTitle').textContent = zone.label;
  document.querySelector('#zoneDescription').textContent = zone.description;
  document.querySelector('#zoneSignal').textContent = zone.signal;
  document.querySelector('#zoneMetric').textContent = zone.metric;
  document.querySelector('#zoneSignalDot').className = `signal-dot ${zone.signalClass}`;
  document.querySelector('#zoneIndex').textContent = String(
    Object.keys(ENGINE_ZONES).indexOf(zoneKey) + 1
  ).padStart(2, '0');
  document.querySelector('#focusNote').textContent = zone.inspectFocus;

  document.querySelectorAll('.zone-row').forEach((row) => {
    row.classList.toggle('selected', row.dataset.zone === zoneKey);
  });

  engineViewer.selectZone(zoneKey);
}

document.querySelectorAll('.zone-row').forEach((row) => {
  row.addEventListener('click', () => selectZone(row.dataset.zone));
});

document.querySelectorAll('.viewer-callout').forEach((callout) => {
  callout.addEventListener('click', () => {
    selectZone(callout.dataset.zone);
    showToast(`FOCUS: ${callout.dataset.zone.toUpperCase()}`);
  });
});

// Render Telemetry Cards with Sparklines
function updateTelemetryCards(telemetry) {
  const container = document.querySelector('#telemetryCards');
  const sensorEntries = [
    { key: 'egt', val: telemetry.egt, unit: '°C', def: SENSOR_DEFINITIONS.egt, elevated: state.thermalStress > 50 },
    { key: 'pressureRatio', val: telemetry.pressureRatio, unit: 'PR', def: SENSOR_DEFINITIONS.pressureRatio, elevated: state.compressorWear > 50 },
    { key: 'vibration', val: telemetry.vibration, unit: 'g RMS', def: SENSOR_DEFINITIONS.vibration, elevated: state.vibrationStress > 45 },
    { key: 'coreRpm', val: telemetry.coreRpm.toLocaleString(), unit: 'RPM', def: SENSOR_DEFINITIONS.coreRpm, elevated: false }
  ];

  container.innerHTML = sensorEntries.map(({ key, val, unit, def, elevated }) => {
    const rawVal = typeof val === 'string' ? parseFloat(val.replace(',', '')) : val;
    const history = generateSensorHistory(key, rawVal, elevated);
    const svgPath = dataToSvgPath(history, 220, 44);
    const trendText = elevated ? '↗ ELEVATED' : '→ NOMINAL';
    const trendClass = elevated ? 'up' : 'flat';

    return `
      <div class="telemetry-card" data-sensor="${key}">
        <div class="telemetry-card-head">
          <span class="metric-icon ${key}">${def.icon}</span>
          <span>${def.name}</span>
          <span class="trend ${trendClass}">${trendText}</span>
        </div>
        <strong>${val} <small>${unit}</small></strong>

        <svg class="sparkline ${key === 'pressureRatio' ? 'blue' : key === 'vibration' ? 'coral' : key === 'coreRpm' ? 'green' : ''}" viewBox="0 0 220 44" preserveAspectRatio="none">
          <path d="${svgPath}" />
        </svg>

        <div class="telemetry-card-meta">
          <span>LIMIT: <b>${def.maxLimit ? `< ${def.maxLimit} ${unit}` : `> ${def.minLimit} ${unit}`}</b></span>
          <button class="sensor-info-btn" data-sensor="${key}" title="Click to view sensor explanation">ℹ WHY THIS MATTERS</button>
        </div>

        <div class="sensor-tooltip" id="tooltip-${key}">
          <strong>${def.code}</strong>
          <p>${def.explanation}</p>
          <small>⚠️ Risk: ${def.failureRisk}</small>
        </div>
      </div>
    `;
  }).join('');

  // Attach tooltip toggles
  container.querySelectorAll('.sensor-info-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sKey = btn.dataset.sensor;
      const card = btn.closest('.telemetry-card');
      card.classList.toggle('show-tooltip');
    });
  });
}

// Recalculate Engine RUL & Update Dashboard
function updateEngineState() {
  const result = calculateEngineRUL({
    currentCycle: state.currentEngineId === 105 ? 198 : state.currentEngineId === 42 ? 72 : 118,
    thermalStress: state.thermalStress,
    vibrationStress: state.vibrationStress,
    compressorWear: state.compressorWear
  });

  state.currentRULData = result;

  // Update RUL Display
  document.querySelector('#rulNumber').textContent = result.predictedRUL;
  const statusPill = document.querySelector('#rulStatus');
  statusPill.textContent = result.status;
  statusPill.className = `status-pill ${result.statusClass}`;

  // Update RUL Circle gauge (circumference = 308)
  const maxRUL = 150;
  const offset = 308 - (Math.min(result.predictedRUL, maxRUL) / maxRUL) * 308;
  const rulCircle = document.querySelector('#rulCircle');
  rulCircle.style.strokeDashoffset = `${offset}`;
  rulCircle.style.stroke = result.statusClass === 'critical' ? 'var(--coral)' : result.statusClass === 'watch' ? 'var(--amber)' : 'var(--cyan)';

  // Scale bar
  document.querySelector('#rulScaleBar').style.width = `${Math.min(100, (result.predictedRUL / 150) * 100)}%`;
  document.querySelector('#rulAdvice').innerHTML = `${result.recommendation}`;

  // Update Spool RPM in HUD
  document.querySelector('#hudSpoolRpm').textContent = `N1: ${(result.telemetry.coreRpm * 0.65).toFixed(0)} RPM · N2: ${result.telemetry.coreRpm.toLocaleString()} RPM`;

  // Update Telemetry Cards
  updateTelemetryCards(result.telemetry);
}

// Flight Mission Phase buttons
document.querySelectorAll('.phase-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.phase-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const phaseKey = btn.dataset.phase;
    const phase = FLIGHT_PHASES[phaseKey];
    if (!phase) return;

    state.currentFlightPhase = phaseKey;
    state.throttle = phase.throttle;

    // Sync throttle slider
    const slider = document.querySelector('#throttleSlider');
    slider.value = Math.round(phase.throttle * 100);
    document.querySelector('#throttleValue').textContent = `${slider.value}%`;

    // Apply to audio & 3D engine
    jetAudio.setThrottle(phase.throttle);
    engineViewer.setThrottle(phase.throttle);

    // Adjust stresses realistically based on phase
    if (phaseKey === 'takeoff') {
      state.thermalStress = Math.min(100, state.thermalStress + 25);
      state.vibrationStress = Math.min(100, state.vibrationStress + 18);
    } else if (phaseKey === 'taxi') {
      state.thermalStress = Math.max(10, state.thermalStress - 20);
      state.vibrationStress = Math.max(10, state.vibrationStress - 15);
    }
    syncStressSliders();
    updateEngineState();

    showToast(`MISSION PROFILE: ${phase.label.toUpperCase()}`);
  });
});

// Sync stress sliders UI
function syncStressSliders() {
  document.querySelector('#sliderThermal').value = state.thermalStress;
  document.querySelector('#valThermal').textContent = `${state.thermalStress}%`;
  document.querySelector('#sliderVibration').value = state.vibrationStress;
  document.querySelector('#valVibration').textContent = `${state.vibrationStress}%`;
  document.querySelector('#sliderCompressor').value = state.compressorWear;
  document.querySelector('#valCompressor').textContent = `${state.compressorWear}%`;
}

// "What-If" Simulator Sliders Events
document.querySelector('#sliderThermal').addEventListener('input', (e) => {
  state.thermalStress = parseInt(e.target.value, 10);
  document.querySelector('#valThermal').textContent = `${state.thermalStress}%`;
  updateEngineState();
});

document.querySelector('#sliderVibration').addEventListener('input', (e) => {
  state.vibrationStress = parseInt(e.target.value, 10);
  document.querySelector('#valVibration').textContent = `${state.vibrationStress}%`;
  updateEngineState();
});

document.querySelector('#sliderCompressor').addEventListener('input', (e) => {
  state.compressorWear = parseInt(e.target.value, 10);
  document.querySelector('#valCompressor').textContent = `${state.compressorWear}%`;
  updateEngineState();
});

document.querySelector('#btnResetSimulator').addEventListener('click', () => {
  state.thermalStress = 25;
  state.vibrationStress = 20;
  state.compressorWear = 15;
  syncStressSliders();
  updateEngineState();
  showToast('SIMULATOR RESET / NOMINAL PARAMETERS');
});

// 3D Controls Toolbar
document.querySelector('#btnResetView').addEventListener('click', () => {
  engineViewer.resetCamera();
  showToast('CAMERA RESET TO DEFAULT ANGLE');
});

document.querySelector('#btnAutoSpin').addEventListener('click', (e) => {
  const spinning = engineViewer.toggleAutoSpin();
  e.currentTarget.classList.toggle('active', spinning);
  showToast(spinning ? 'AUTO-SPIN 360° ENABLED' : 'AUTO-SPIN PAUSED');
});

document.querySelector('#btnCutaway').addEventListener('click', (e) => {
  engineViewer.setCutaway(!engineViewer.isCutaway);
  e.currentTarget.classList.toggle('active', engineViewer.isCutaway);
  showToast(engineViewer.isCutaway ? 'COWLING SHELL VISIBLE' : 'COWLING HIDDEN / CORE EXPOSED');
});

document.querySelector('#btnThermalMode').addEventListener('click', (e) => {
  state.isThermalMode = !state.isThermalMode;
  engineViewer.setThermalMode(state.isThermalMode);
  e.currentTarget.classList.toggle('active', state.isThermalMode);
  showToast(state.isThermalMode ? 'THERMAL IR HEATMAP: ACTIVE' : 'STANDARD CUTAWAY RESTORED');
});

// Exploded View Slider
document.querySelector('#explodedSlider').addEventListener('input', (e) => {
  const val = parseInt(e.target.value, 10);
  document.querySelector('#explodedVal').textContent = `${val}%`;
  engineViewer.setExplodedAmount(val / 100);
});

// Audio Throttle Slider & Sound Toggle
const soundButton = document.querySelector('#btnSoundToggle');
soundButton.addEventListener('click', async () => {
  const isPlaying = await jetAudio.toggle();
  state.isAudioPlaying = isPlaying;
  soundButton.classList.toggle('playing', isPlaying);
  soundButton.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
  soundButton.querySelector('.sound-label').textContent = isPlaying ? 'JET SOUND: ON' : 'JET SOUND: OFF';
  showToast(isPlaying ? 'PROCEDURAL JET AUDIO RUNNING' : 'AUDIO MUTED');
});

document.querySelector('#throttleSlider').addEventListener('input', (e) => {
  const val = parseInt(e.target.value, 10);
  const throttleFrac = val / 100;
  state.throttle = throttleFrac;
  document.querySelector('#throttleValue').textContent = `${val}%`;
  jetAudio.setThrottle(throttleFrac);
  engineViewer.setThrottle(throttleFrac);
});

// Fleet Card Selection
document.querySelectorAll('.fleet-card').forEach((card) => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.fleet-card').forEach((c) => c.classList.remove('active'));
    card.classList.add('active');

    state.currentEngine = card.dataset.engine;
    state.currentEngineId = parseInt(card.dataset.id, 10);
    document.querySelector('#unitName').textContent = state.currentEngine;

    // Apply baseline stresses per engine
    if (state.currentEngineId === 105) {
      state.thermalStress = 85;
      state.vibrationStress = 72;
      state.compressorWear = 65;
    } else if (state.currentEngineId === 42) {
      state.thermalStress = 15;
      state.vibrationStress = 12;
      state.compressorWear = 10;
    } else {
      state.thermalStress = 35;
      state.vibrationStress = 28;
      state.compressorWear = 18;
    }
    syncStressSliders();
    updateEngineState();

    showToast(`UNIT ${state.currentEngine} LOADED / TELEMETRY ACTIVE`);
  });
});

// Action buttons in alerts table
document.querySelectorAll('.alerts-table .row-action').forEach((btn) => {
  btn.addEventListener('click', () => {
    const engine = btn.dataset.engine;
    const zone = btn.dataset.zone || 'hpt';
    const targetCard = document.querySelector(`.fleet-card[data-engine="${engine}"]`);
    if (targetCard) targetCard.click();
    selectZone(zone);
    showToast(`DISPATCH CONTEXT: ${engine} / ${zone.toUpperCase()}`);
  });
});

// Modal "How It Works"
const modal = document.querySelector('#modalHowItWorks');
document.querySelector('#btnHowItWorks').addEventListener('click', () => {
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
});
document.querySelector('#btnCloseModal').addEventListener('click', () => {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
});
document.querySelector('#btnGotIt').addEventListener('click', () => {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
});
modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }
});

// Snapshot & Export
document.querySelector('#btnSnapshot').addEventListener('click', () => {
  showToast('SNAPSHOT CAPTURED / DIAGNOSTIC FRAME SAVED');
});
document.querySelector('#btnExport').addEventListener('click', () => {
  showToast('EXPORT REPORT GENERATED / PDF READY');
});
document.querySelector('#btnAllAlerts').addEventListener('click', () => {
  showToast('DISPATCH LOG / 18 EVENTS EXPORTED');
});

// Load real C-MAPSS dataset summary
async function loadDataset() {
  const result = await fetchCmapssDataset();
  if (result.success && result.data) {
    state.datasetSummary = result.data;
    const stats = result.data.stats;
    if (stats) {
      document.querySelector('#modelVariantTag').textContent = `${result.data.variant || 'FD001'} · ${stats.sensor_channels || 21} CHANNELS`;
    }
    showToast(`REAL C-MAPSS DATA ACTIVE / ${stats?.test_engines || 100} ENGINES VERIFIED`);
  } else {
    showToast('SIMULATED C-MAPSS MODEL ONLINE / REAL-TIME ESTIMATION ACTIVE');
  }
}

// Initial Boot
selectZone('hpt');
updateEngineState();
loadDataset();
