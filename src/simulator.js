/**
 * Jet Engine Predictive Maintenance & Telemetry Simulator.
 *
 * Provides clear, educational, and easy-to-understand functions for:
 * 1. Estimating Remaining Useful Life (RUL) from sensor telemetry.
 * 2. Evaluating Engine Health Score (0-100%).
 * 3. Explaining what each sensor actually measures in plain English.
 * 4. Simulating "What-If" stress scenarios (blade wear, thermal creep, vibration).
 */

// Plain-English sensor documentation for technicians and learners
export const SENSOR_DEFINITIONS = {
  egt: {
    name: 'Exhaust Gas Temperature (EGT)',
    code: 'T50 (Sensor 4)',
    unit: '°C',
    nominal: 1380,
    maxLimit: 1460,
    critical: 1435,
    icon: '°',
    zone: 'hpt',
    explanation:
      'Measures gas temperature leaving the high-pressure turbine. As turbine blades degrade or get thermal micro-cracks, cooling efficiency drops and EGT rises sharply.',
    failureRisk: 'High-temperature thermal fatigue, blade tip melting, and creep rupture.'
  },
  pressureRatio: {
    name: 'HPC Pressure Ratio',
    code: 'P30/P2 (Sensor 11)',
    unit: 'PR',
    nominal: 12.8,
    minLimit: 11.8,
    critical: 12.1,
    icon: '↕',
    zone: 'hpc',
    explanation:
      'Measures how effectively the high-pressure compressor stages compress incoming air before fuel injection. Dropping pressure signals blade erosion or tip clearance loss.',
    failureRisk: 'Compressor stall, surge risk, and decreased fuel efficiency.'
  },
  vibration: {
    name: 'Turbine Bearing Vibration',
    code: 'RMS Vib (Sensor 2 & 15)',
    unit: 'g RMS',
    nominal: 0.18,
    maxLimit: 0.45,
    critical: 0.35,
    icon: '⌁',
    zone: 'hpt',
    explanation:
      'Captures rotor imbalance and mechanical bearing health. Elevated high-frequency vibration indicates blade deformation, bearing spalling, or loose stator vanes.',
    failureRisk: 'Catastrophic bearing seizure, blade shedding, and uncontained failure.'
  },
  coreRpm: {
    name: 'Core Spool Speed (N2)',
    code: 'Nc (Sensor 14)',
    unit: 'RPM',
    nominal: 12550,
    maxLimit: 13200,
    critical: 12900,
    icon: '◒',
    zone: 'fan',
    explanation:
      'Rotational speed of the high-pressure compressor and turbine spool. Shifts relative to fuel flow reveal aerodynamic drag or mechanical friction.',
    failureRisk: 'Rotor overspeed stress and shaft torsion overload.'
  }
};

// Detailed zone definitions with operational functions and inspection points
export const ENGINE_ZONES = {
  fan: {
    label: 'Fan & Low-Pressure Compressor',
    short: 'FAN / LPC',
    code: 'ZONE 01',
    description: 'Front titanium bypass fan blades and initial 3-stage compressor rotor.',
    inspectFocus: 'FOD (Foreign Object Damage), leading-edge erosion, and blade balance.',
    nominalTemp: '25 – 120 °C',
    nominalPressure: '1.0 – 2.4 bar',
    signal: 'Stable',
    signalClass: 'good',
    metric: 'Vibration 0.16 g RMS',
    color: '#00f0ff',
    xOffset: -2.3,
    camTarget: [-1.8, 0, 0]
  },
  hpc: {
    label: 'High-Pressure Compressor',
    short: 'HPC CORE',
    code: 'ZONE 02',
    description: 'Multi-stage axial compressor compressing air up to 30:1 ratio before combustion.',
    inspectFocus: 'Rotor tip clearance, stator vane wear, and air-bleed valve seal leakage.',
    nominalTemp: '380 – 620 °C',
    nominalPressure: '12 – 32 bar',
    signal: 'Watch',
    signalClass: 'watch',
    metric: 'Pressure Ratio 12.5 PR',
    color: '#38bdf8',
    xOffset: -0.6,
    camTarget: [-0.4, 0, 0]
  },
  combustion: {
    label: 'Combustion Chamber',
    short: 'COMBUSTOR',
    code: 'ZONE 03',
    description: 'Annular flame tube mixing jet fuel with compressed air for steady high-energy burn.',
    inspectFocus: 'Fuel injector nozzle coking, thermal barrier coating spalling, and liner burn-through.',
    nominalTemp: '1,400 – 1,750 °C',
    nominalPressure: '28 – 30 bar',
    signal: 'Nominal',
    signalClass: 'good',
    metric: 'Core Flame 1,418 °C',
    color: '#fbbf24',
    xOffset: 0.8,
    camTarget: [0.6, 0, 0]
  },
  hpt: {
    label: 'High-Pressure Turbine',
    short: 'HPT STAGE',
    code: 'ZONE 04',
    description: 'Single-crystal superalloy bladed disk absorbing energy to drive the HPC compressor shaft.',
    inspectFocus: 'Creep elongation, thermal oxidation micro-cracks, and film-cooling hole blockage.',
    nominalTemp: '1,100 – 1,440 °C',
    nominalPressure: '8 – 14 bar',
    signal: 'Elevated',
    signalClass: 'critical',
    metric: 'Thermal Margin −8.2%',
    color: '#f87171',
    xOffset: 1.8,
    camTarget: [1.6, 0, 0]
  },
  nozzle: {
    label: 'Exhaust & Nozzle Guide Vanes',
    short: 'EXHAUST / NOZZLE',
    code: 'ZONE 05',
    description: 'Convergent gas-path duct maximizing thrust velocity while reducing noise signature.',
    inspectFocus: 'Center plug distortion, strut crack inspection, and acoustic liner integrity.',
    nominalTemp: '580 – 820 °C',
    nominalPressure: '1.2 – 2.0 bar',
    signal: 'Stable',
    signalClass: 'good',
    metric: 'Flow Alignment 98.4%',
    color: '#a78bfa',
    xOffset: 3.2,
    camTarget: [2.8, 0, 0]
  }
};

// Flight Mission presets
export const FLIGHT_PHASES = {
  taxi: {
    label: 'Taxi / Idle',
    throttle: 0.2,
    rpm: 8200,
    egt: 680,
    pressureRatio: 4.8,
    vibration: 0.12,
    desc: 'Low power ground taxiing. Minimal aerodynamic and thermal stress.'
  },
  takeoff: {
    label: 'Takeoff / Climb',
    throttle: 1.0,
    rpm: 12900,
    egt: 1425,
    pressureRatio: 13.2,
    vibration: 0.32,
    desc: 'Maximum rated thrust. Highest thermal and centrifugal mechanical loads.'
  },
  cruise: {
    label: 'Cruise (Nominal)',
    throttle: 0.75,
    rpm: 12100,
    egt: 1140,
    pressureRatio: 12.6,
    vibration: 0.19,
    desc: 'High altitude steady flight. Optimal fuel efficiency and balanced thermal margins.'
  },
  descent: {
    label: 'Descent / Idle',
    throttle: 0.35,
    rpm: 9600,
    egt: 820,
    pressureRatio: 7.2,
    vibration: 0.15,
    desc: 'Low power descent profile. Thermal cooling gradients across turbine blades.'
  }
};

/**
 * Easy, intuitive RUL (Remaining Useful Life) calculation.
 *
 * In physical turbofan engines, degradation is driven by:
 * 1. Thermal creep (higher EGT reduces turbine life exponentially).
 * 2. Rotor vibration (excessive vibration accelerates bearing fatigue).
 * 3. Compressor loss (reduced pressure ratio causes core inefficiency).
 *
 * @param {Object} params
 * @param {number} params.currentCycle - How many cycles the engine has already flown
 * @param {number} params.thermalStress - User-injected thermal degradation (0 to 100)
 * @param {number} params.vibrationStress - User-injected mechanical vibration (0 to 100)
 * @param {number} params.compressorWear - User-injected blade tip wear (0 to 100)
 * @returns {Object} Calculated RUL, health score, and status band
 */
export function calculateEngineRUL({
  currentCycle = 118,
  thermalStress = 25,
  vibrationStress = 20,
  compressorWear = 15,
  benchmarkRUL = 120
} = {}) {
  // Baseline healthy lifespan in flight cycles
  const BASE_DESIGN_LIFESPAN = 260;

  // Degradation factors (0.0 to 1.0)
  const thermalImpact = (thermalStress / 100) * 0.45;
  const vibrationImpact = (vibrationStress / 100) * 0.35;
  const compressorImpact = (compressorWear / 100) * 0.20;

  const totalDegradation = Math.min(0.95, thermalImpact + vibrationImpact + compressorImpact);

  // Remaining runway calculation
  const remainingPotential = Math.max(0, BASE_DESIGN_LIFESPAN - currentCycle);
  const estimatedRUL = Math.max(3, Math.round(remainingPotential * (1 - totalDegradation * 0.85)));

  // Health Score from 0% to 100%
  const healthScore = Math.max(5, Math.min(100, Math.round((estimatedRUL / 150) * 100)));

  // Maintenance Status Band
  let status = 'NORMAL';
  let statusClass = 'good';
  let recommendation = 'Nominal operation. Continue standard scheduled inspections.';

  if (estimatedRUL < 20) {
    status = 'CRITICAL';
    statusClass = 'critical';
    recommendation = 'IMMEDIATE GROUNDING: Schedule HPT borescope and hot-section overhaul before next flight.';
  } else if (estimatedRUL < 55) {
    status = 'MONITOR';
    statusClass = 'watch';
    recommendation = 'ATTENTION REQUIRED: Accelerated vibration/thermal trend. Schedule test-cell borescope inspection within 10 cycles.';
  }

  // Derive dynamic sensor values based on stress
  const currentEgt = Math.round(1360 + (thermalStress / 100) * 95);
  const currentPR = (12.8 - (compressorWear / 100) * 0.9).toFixed(1);
  const currentVib = (0.16 + (vibrationStress / 100) * 0.28).toFixed(2);
  const currentRpm = Math.round(12480 + (thermalStress * 3));

  return {
    predictedRUL: estimatedRUL,
    benchmarkRUL,
    healthScore,
    status,
    statusClass,
    recommendation,
    telemetry: {
      egt: currentEgt,
      pressureRatio: parseFloat(currentPR),
      vibration: parseFloat(currentVib),
      coreRpm: currentRpm
    }
  };
}

/**
 * Generate 24-point realistic sensor sparkline history.
 * Creates smooth, believable degradation trends.
 */
export function generateSensorHistory(metricType, currentVal, isElevated = false) {
  const points = [];
  const count = 24;
  let val = currentVal * (isElevated ? 0.92 : 0.98);

  for (let i = 0; i < count; i++) {
    const progress = i / (count - 1);
    const noise = (Math.random() - 0.48) * (currentVal * 0.015);
    const trend = isElevated ? (progress * (currentVal - val) * 1.1) : 0;
    const p = Math.max(0, val + trend + noise);
    points.push(Number(p.toFixed(2)));
  }
  // Ensure last point aligns with current value
  points[count - 1] = Number(currentVal);
  return points;
}

/**
 * Convert numerical data series to SVG path data for sparklines.
 */
export function dataToSvgPath(data, width = 220, height = 44) {
  if (!data || data.length < 2) return '';
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const coords = data.map((d, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((d - min) / range) * (height - 8) - 4;
    return [x, y];
  });

  return coords.reduce((acc, [x, y], idx) => {
    if (idx === 0) return `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    const prev = coords[idx - 1];
    const cpX = (prev[0] + x) / 2;
    return `${acc} C ${cpX.toFixed(1)} ${prev[1].toFixed(1)}, ${cpX.toFixed(1)} ${y.toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)}`;
  }, '');
}

/**
 * Load C-MAPSS dataset summary with ultra-safe fallbacks.
 * Ensures the UI is always 100% functional even if offline.
 */
export async function fetchCmapssDataset() {
  try {
    const res = await fetch('/data/cmapss-summary.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('File not available');
    const data = await res.json();
    return {
      success: true,
      data,
      source: 'NASA C-MAPSS FD001 (Kaggle)'
    };
  } catch (err) {
    console.warn('Using built-in C-MAPSS simulator model:', err);
    return {
      success: false,
      data: null,
      source: 'Simulated C-MAPSS Model'
    };
  }
}
