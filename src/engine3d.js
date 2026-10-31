/**
 * 3D Turbofan Engine Visualization using Three.js.
 *
 * Features:
 * - Rotating Fan and High-Pressure Core Rotor spools.
 * - Dynamic continuous particle airflow stream (cold intake -> compressed blue -> fiery combustion -> hot exhaust).
 * - Thermal Infrared Heatmap mode showing internal temperature gradients.
 * - Exploded / X-Ray inspection view separating modules along the axis.
 * - Smooth OrbitControls with raycasting zone inspection.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class Engine3DViewer {
  constructor(container, onSelectZone) {
    this.container = container;
    this.onSelectZone = onSelectZone;

    // View state
    this.isAutoSpin = false;
    this.isCutaway = true;
    this.isThermalMode = false;
    this.explodedAmount = 0.0; // 0.0 (assembled) to 1.0 (fully exploded)
    this.selectedZone = 'hpt';
    this.throttle = 0.5;

    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#050e1a');

    const rect = container.getBoundingClientRect();
    const width = Math.max(rect.width, 320);
    const height = Math.max(rect.height, 380);

    this.camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
    this.defaultCamPos = new THREE.Vector3(8.8, 4.6, 7.2);
    this.camera.position.copy(this.defaultCamPos);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = false;
    this.controls.minDistance = 4.5;
    this.controls.maxDistance = 15;
    this.controls.target.set(0.3, 0, 0);

    // Engine groups
    this.engineRoot = new THREE.Group();
    this.engineRoot.rotation.z = -0.06;
    this.scene.add(this.engineRoot);

    // Spools that rotate
    this.fanRotorGroup = new THREE.Group();
    this.coreRotorGroup = new THREE.Group();

    // Module groups for exploded view
    this.modules = {
      fan: new THREE.Group(),
      hpc: new THREE.Group(),
      combustion: new THREE.Group(),
      hpt: new THREE.Group(),
      nozzle: new THREE.Group(),
      nacelle: new THREE.Group()
    };

    // Track meshes for material swapping & thermal mode
    this.zoneMeshes = new Map();
    this.thermalMeshes = [];

    this.initLighting();
    this.initMaterials();
    this.buildEngineGeometry();
    this.initAirflowParticles();
    this.initInteractions();

    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);

    // Resize observer
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.container);
  }

  initLighting() {
    // Ambient & hemisphere light
    this.scene.add(new THREE.HemisphereLight('#8ee2ff', '#040b14', 1.8));

    // Key light (cool aviation key)
    this.keyLight = new THREE.DirectionalLight('#d6f3ff', 3.0);
    this.keyLight.position.set(-4, 7, 6);
    this.scene.add(this.keyLight);

    // Rim light (contrasting warm fill)
    this.rimLight = new THREE.DirectionalLight('#ffad70', 1.5);
    this.rimLight.position.set(5, -3, -5);
    this.scene.add(this.rimLight);

    // Combustor internal glow point light
    this.fireLight = new THREE.PointLight('#ff7c24', 9, 8, 2);
    this.fireLight.position.set(0.8, 0, 0);
    this.scene.add(this.fireLight);

    // Floor tech grid
    const grid = new THREE.GridHelper(18, 36, '#173c5c', '#081a2c');
    grid.position.set(0, -2.4, 0);
    grid.material.transparent = true;
    grid.material.opacity = 0.45;
    this.scene.add(grid);
  }

  initMaterials() {
    const makeStd = (color, rough = 0.3, metal = 0.8, emissive = '#000000', emInt = 0) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: rough,
        metalness: metal,
        emissive,
        emissiveIntensity: emInt
      });

    this.materials = {
      // Standard realistic materials
      silver: makeStd('#c5d4e4', 0.22, 0.88),
      darkSilver: makeStd('#3d4e60', 0.28, 0.92),
      titaniumFan: makeStd('#8ec5db', 0.2, 0.85, '#077a94', 0.15),
      coreAlloy: makeStd('#388da6', 0.25, 0.82, '#065d70', 0.25),
      combustorCasing: makeStd('#9c5c36', 0.32, 0.7, '#e65100', 0.6),
      flameCore: new THREE.MeshBasicMaterial({
        color: '#ff9838',
        transparent: true,
        opacity: 0.85
      }),
      turbineGold: makeStd('#d9823b', 0.24, 0.75, '#ff4d15', 0.85),
      nozzleMetal: makeStd('#516579', 0.26, 0.86),

      // Cutaway translucent nacelle cowling
      nacelleShell: new THREE.MeshPhysicalMaterial({
        color: '#5cd5e8',
        metalness: 0.15,
        roughness: 0.14,
        transmission: 0.55,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        emissive: '#138b9e',
        emissiveIntensity: 0.28
      }),

      // Thermal Infrared mode materials
      thermalCold: makeStd('#0066ff', 0.4, 0.2, '#0055ff', 0.7), // Fan ~25°C
      thermalLpc: makeStd('#00f0ff', 0.4, 0.2, '#00e0ff', 0.75), // LPC ~90°C
      thermalHpc: makeStd('#ffee00', 0.35, 0.2, '#ffdd00', 0.8), // HPC ~480°C
      thermalCombustor: makeStd('#ffffff', 0.2, 0.1, '#ff3700', 1.8), // Combustor ~1500°C
      thermalTurbine: makeStd('#ff1100', 0.3, 0.2, '#ff0033', 1.3), // HPT ~1200°C
      thermalExhaust: makeStd('#ff6600', 0.4, 0.2, '#ff5500', 0.85) // Exhaust ~650°C
    };
  }

  buildEngineGeometry() {
    // Add module groups to engineRoot
    Object.values(this.modules).forEach((mod) => this.engineRoot.add(mod));

    // Attach rotating groups
    this.modules.fan.add(this.fanRotorGroup);
    this.modules.hpc.add(this.coreRotorGroup);

    // Central high-speed multi-spool shafts (spans across LPC and HPC)
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 5.8, 24),
      this.materials.silver
    );
    shaft.rotation.z = Math.PI / 2;
    shaft.position.set(0.2, 0, 0);
    this.coreRotorGroup.add(shaft);

    // ==========================================
    // 1. FAN & LPC MODULE (Low Pressure Compressor)
    // ==========================================
    this.modules.fan.name = 'fan';
    this.modules.fan.userData.baseX = -2.4;
    this.modules.fan.position.x = -2.4;

    // Aerodynamic Titanium Spinner Nose Cone
    const spinner = new THREE.Mesh(
      new THREE.ConeGeometry(0.48, 0.95, 32),
      this.materials.titaniumFan
    );
    spinner.rotation.z = Math.PI / 2;
    spinner.position.set(-0.55, 0, 0);
    this.registerMesh(spinner, 'fan');
    this.fanRotorGroup.add(spinner);

    // Fan Rotor Disk
    const fanHub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.52, 0.4, 32),
      this.materials.darkSilver
    );
    fanHub.rotation.z = Math.PI / 2;
    this.registerMesh(fanHub, 'fan');
    this.fanRotorGroup.add(fanHub);

    // 22 Curved Wide-Chord Titanium Fan Blades
    const bladeGeo = new THREE.BoxGeometry(0.42, 0.05, 1.45);
    for (let i = 0; i < 22; i++) {
      const angle = (i / 22) * Math.PI * 2;
      const blade = new THREE.Mesh(bladeGeo, this.materials.titaniumFan);
      blade.position.set(
        -0.08,
        Math.cos(angle) * 0.98,
        Math.sin(angle) * 0.98
      );
      blade.rotation.set(0, angle, angle * 0.12);
      this.registerMesh(blade, 'fan');
      this.fanRotorGroup.add(blade);
    }

    // Outer Fan Containment Ring & Stator Vanes (stationary)
    const fanCasingRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.68, 0.065, 16, 64),
      this.materials.silver
    );
    fanCasingRing.rotation.y = Math.PI / 2;
    fanCasingRing.position.set(0.1, 0, 0);
    this.registerMesh(fanCasingRing, 'fan');
    this.modules.fan.add(fanCasingRing);

    // ==========================================
    // 2. HIGH PRESSURE COMPRESSOR (HPC) MODULE
    // ==========================================
    this.modules.hpc.name = 'hpc';
    this.modules.hpc.userData.baseX = -0.7;
    this.modules.hpc.position.x = -0.7;

    // 6 Multistage compressor bladed disks (decreasing radius along spool)
    for (let stage = 0; stage < 6; stage++) {
      const stageX = -0.75 + stage * 0.32;
      const radius = 0.92 - stage * 0.045;

      const disk = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.085, 14, 48),
        this.materials.coreAlloy
      );
      disk.rotation.y = Math.PI / 2;
      disk.position.set(stageX, 0, 0);
      this.registerMesh(disk, 'hpc');
      this.coreRotorGroup.add(disk);

      // Radial compressor rotor blades per stage
      const bladeCount = 14;
      for (let b = 0; b < bladeCount; b++) {
        const bAngle = (b / bladeCount) * Math.PI * 2 + stage * 0.2;
        const compBlade = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.035, 0.42),
          this.materials.coreAlloy
        );
        compBlade.position.set(
          stageX,
          Math.cos(bAngle) * (radius - 0.08),
          Math.sin(bAngle) * (radius - 0.08)
        );
        compBlade.rotation.set(0, bAngle, 0.25);
        this.registerMesh(compBlade, 'hpc');
        this.coreRotorGroup.add(compBlade);
      }
    }

    // HPC Outer Casing Guide Frame
    const hpcCasing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 1.05, 1.95, 32, 1, true),
      new THREE.MeshStandardMaterial({
        color: '#2a445b',
        wireframe: true,
        transparent: true,
        opacity: 0.35
      })
    );
    hpcCasing.rotation.z = Math.PI / 2;
    hpcCasing.position.set(0.05, 0, 0);
    this.modules.hpc.add(hpcCasing);

    // ==========================================
    // 3. COMBUSTION CHAMBER MODULE
    // ==========================================
    this.modules.combustion.name = 'combustion';
    this.modules.combustion.userData.baseX = 0.85;
    this.modules.combustion.position.x = 0.85;

    // Annular Combustor Housing Rings
    const combRingOuter = new THREE.Mesh(
      new THREE.TorusGeometry(0.88, 0.12, 16, 48),
      this.materials.combustorCasing
    );
    combRingOuter.rotation.y = Math.PI / 2;
    this.registerMesh(combRingOuter, 'combustion');
    this.modules.combustion.add(combRingOuter);

    const combRingInner = new THREE.Mesh(
      new THREE.TorusGeometry(0.56, 0.08, 16, 48),
      this.materials.combustorCasing
    );
    combRingInner.rotation.y = Math.PI / 2;
    this.registerMesh(combRingInner, 'combustion');
    this.modules.combustion.add(combRingInner);

    // 10 Circumferential Fuel Injector Nozzles
    for (let f = 0; f < 10; f++) {
      const fAngle = (f / 10) * Math.PI * 2;
      const nozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.38, 12),
        this.materials.silver
      );
      nozzle.position.set(
        -0.08,
        Math.cos(fAngle) * 0.72,
        Math.sin(fAngle) * 0.72
      );
      nozzle.rotation.z = Math.PI / 2;
      this.registerMesh(nozzle, 'combustion');
      this.modules.combustion.add(nozzle);
    }

    // Dynamic Pulsating Fire Cone inside combustor
    this.flameMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.44, 1.15, 24),
      this.materials.flameCore
    );
    this.flameMesh.rotation.z = -Math.PI / 2;
    this.flameMesh.position.set(0.12, 0, 0);
    this.registerMesh(this.flameMesh, 'combustion');
    this.modules.combustion.add(this.flameMesh);

    // ==========================================
    // 4. HIGH PRESSURE TURBINE (HPT) MODULE
    // ==========================================
    this.modules.hpt.name = 'hpt';
    this.modules.hpt.userData.baseX = 1.95;
    this.modules.hpt.position.x = 1.95;

    // 4 Turbine Stages (Superalloy ceramic-coated)
    for (let t = 0; t < 4; t++) {
      const tX = -0.35 + t * 0.28;
      const tRadius = 0.82 - t * 0.03;

      const turbDisk = new THREE.Mesh(
        new THREE.TorusGeometry(tRadius, 0.09, 16, 48),
        this.materials.turbineGold
      );
      turbDisk.rotation.y = Math.PI / 2;
      turbDisk.position.set(tX, 0, 0);
      this.registerMesh(turbDisk, 'hpt');
      this.coreRotorGroup.add(turbDisk);

      // High-temperature single-crystal turbine blades
      const turbBlades = 16;
      for (let tb = 0; tb < turbBlades; tb++) {
        const tbAngle = (tb / turbBlades) * Math.PI * 2;
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.16, 0.045, 0.38),
          this.materials.turbineGold
        );
        blade.position.set(
          tX,
          Math.cos(tbAngle) * (tRadius - 0.06),
          Math.sin(tbAngle) * (tRadius - 0.06)
        );
        blade.rotation.set(0, tbAngle, -0.22);
        this.registerMesh(blade, 'hpt');
        this.coreRotorGroup.add(blade);
      }
    }

    // Outer HPT Thermal Shroud Ring
    const hptShroud = new THREE.Mesh(
      new THREE.TorusGeometry(0.98, 0.05, 16, 48),
      this.materials.turbineGold
    );
    hptShroud.rotation.y = Math.PI / 2;
    hptShroud.position.set(0.35, 0, 0);
    this.registerMesh(hptShroud, 'hpt');
    this.modules.hpt.add(hptShroud);

    // ==========================================
    // 5. EXHAUST & NOZZLE GUIDE VANES MODULE
    // ==========================================
    this.modules.nozzle.name = 'nozzle';
    this.modules.nozzle.userData.baseX = 3.25;
    this.modules.nozzle.position.x = 3.25;

    // Aerodynamic Central Exhaust Plug
    const exhaustCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.72, 1.8, 32, 1, false),
      this.materials.nozzleMetal
    );
    exhaustCone.rotation.z = -Math.PI / 2;
    exhaustCone.position.set(0.6, 0, 0);
    this.registerMesh(exhaustCone, 'nozzle');
    this.modules.nozzle.add(exhaustCone);

    // Convergent Exhaust Casing Ring
    const nozzleDuct = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.95, 1.4, 32, 1, true),
      this.materials.nozzleMetal
    );
    nozzleDuct.rotation.z = Math.PI / 2;
    nozzleDuct.position.set(0.2, 0, 0);
    this.registerMesh(nozzleDuct, 'nozzle');
    this.modules.nozzle.add(nozzleDuct);

    // Glowing exhaust exit ring
    const exitRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.56, 0.05, 14, 48),
      new THREE.MeshStandardMaterial({
        color: '#ff5522',
        emissive: '#ff3300',
        emissiveIntensity: 1.1
      })
    );
    exitRing.rotation.y = Math.PI / 2;
    exitRing.position.set(0.88, 0, 0);
    this.registerMesh(exitRing, 'nozzle');
    this.modules.nozzle.add(exitRing);

    // ==========================================
    // 6. CUTAWAY NACELLE COWLING (Outer aerodynamic shell)
    // ==========================================
    this.modules.nacelle.name = 'nacelle';
    this.modules.nacelle.userData.baseX = 0.35;
    this.modules.nacelle.position.x = 0.35;

    // Main 3/4 cutaway translucent shell cylinder
    this.nacelleShell = new THREE.Mesh(
      new THREE.CylinderGeometry(
        1.72,
        1.48,
        5.8,
        64,
        1,
        true,
        -Math.PI * 0.25,
        Math.PI * 1.42
      ),
      this.materials.nacelleShell
    );
    this.nacelleShell.rotation.z = Math.PI / 2;
    this.modules.nacelle.add(this.nacelleShell);

    // Metallic Lip Rings
    const intakeLip = new THREE.Mesh(
      new THREE.TorusGeometry(1.72, 0.045, 16, 64),
      this.materials.silver
    );
    intakeLip.rotation.y = Math.PI / 2;
    intakeLip.position.set(-2.88, 0, 0);
    this.modules.nacelle.add(intakeLip);

    const aftCowlingRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.48, 0.035, 16, 64),
      this.materials.silver
    );
    aftCowlingRing.rotation.y = Math.PI / 2;
    aftCowlingRing.position.set(2.88, 0, 0);
    this.modules.nacelle.add(aftCowlingRing);
  }

  registerMesh(mesh, zone) {
    mesh.userData.zone = zone;
    mesh.userData.baseMat = mesh.material;
    if (!this.zoneMeshes.has(zone)) {
      this.zoneMeshes.set(zone, []);
    }
    this.zoneMeshes.get(zone).push(mesh);
  }

  initAirflowParticles() {
    // 350 dynamic particles moving through engine stages
    this.particleCount = 350;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    const colors = new Float32Array(this.particleCount * 3);
    const speeds = new Float32Array(this.particleCount);

    for (let i = 0; i < this.particleCount; i++) {
      this.resetParticle(i, positions, colors, speeds, true);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.particleSpeeds = speeds;

    const material = new THREE.PointsMaterial({
      size: 0.14,
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.particles = new THREE.Points(geometry, material);
    this.engineRoot.add(this.particles);
  }

  resetParticle(i, positions, colors, speeds, initial = false) {
    const idx = i * 3;
    // Initial random placement along X axis, or reset to intake on loop
    positions[idx] = initial ? (Math.random() - 0.5) * 8.0 : -4.2 - Math.random() * 0.6;

    // Radial distance from engine center (bypass or core)
    const isBypass = Math.random() > 0.45;
    const r = isBypass ? 0.95 + Math.random() * 0.65 : 0.15 + Math.random() * 0.65;
    const angle = Math.random() * Math.PI * 2;

    positions[idx + 1] = Math.cos(angle) * r;
    positions[idx + 2] = Math.sin(angle) * r;

    speeds[i] = (2.2 + Math.random() * 2.8);

    // Initial color
    this.updateParticleColor(i, positions[idx], colors);
  }

  updateParticleColor(i, x, colors) {
    const idx = i * 3;
    // Cold intake -> Compressed blue -> Combustor flame -> Hot exhaust
    if (x < -1.5) {
      // Intake (Cyan / Ice blue)
      colors[idx] = 0.0;
      colors[idx + 1] = 0.94;
      colors[idx + 2] = 1.0;
    } else if (x < 0.6) {
      // Compressor (Electric blue to warm)
      colors[idx] = 0.2;
      colors[idx + 1] = 0.7;
      colors[idx + 2] = 1.0;
    } else if (x < 2.0) {
      // Combustion chamber (Fiery orange / gold)
      colors[idx] = 1.0;
      colors[idx + 1] = 0.65;
      colors[idx + 2] = 0.1;
    } else {
      // Turbine & Exhaust (Red-orange jet flame)
      colors[idx] = 1.0;
      colors[idx + 1] = 0.25;
      colors[idx + 2] = 0.08;
    }
  }

  initInteractions() {
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.renderer.domElement.addEventListener('pointerup', (e) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.engineRoot.children, true);

      for (const hit of hits) {
        let obj = hit.object;
        while (obj && obj !== this.engineRoot) {
          if (obj.userData.zone && this.zoneMeshes.has(obj.userData.zone)) {
            this.selectZone(obj.userData.zone);
            if (this.onSelectZone) this.onSelectZone(obj.userData.zone);
            return;
          }
          obj = obj.parent;
        }
      }
    });
  }

  selectZone(zoneKey) {
    this.selectedZone = zoneKey;
    this.updateZoneHighlights();
  }

  updateZoneHighlights() {
    this.zoneMeshes.forEach((meshes, zone) => {
      const isSelected = zone === this.selectedZone;
      meshes.forEach((mesh) => {
        if (!mesh.material) return;
        if (mesh.material.emissive) {
          if (isSelected) {
            mesh.material.emissiveIntensity = 0.95;
            mesh.material.emissive.set(zone === 'hpt' ? '#ff4d4d' : zone === 'combustion' ? '#ff9900' : '#00f0ff');
          } else {
            mesh.material.emissiveIntensity = mesh.userData.baseMat?.emissiveIntensity || 0;
            if (mesh.userData.baseMat?.emissive) {
              mesh.material.emissive.copy(mesh.userData.baseMat.emissive);
            }
          }
        }
      });
    });
  }

  /**
   * Exploded / X-Ray inspection slider (0.0 to 1.0)
   * Smoothly slides components apart along the X axis.
   */
  setExplodedAmount(val) {
    this.explodedAmount = Math.max(0, Math.min(1.0, val));
    const factor = this.explodedAmount * 1.8;

    // Fan slides forward
    this.modules.fan.position.x = this.modules.fan.userData.baseX - factor * 0.9;
    // HPC slides slightly forward
    this.modules.hpc.position.x = this.modules.hpc.userData.baseX - factor * 0.3;
    // Combustor slides rearward
    this.modules.combustion.position.x = this.modules.combustion.userData.baseX + factor * 0.4;
    // HPT slides further rearward
    this.modules.hpt.position.x = this.modules.hpt.userData.baseX + factor * 0.95;
    // Exhaust slides furthest rearward
    this.modules.nozzle.position.x = this.modules.nozzle.userData.baseX + factor * 1.6;

    // Nacelle shell fades or slides outward
    if (this.nacelleShell) {
      this.nacelleShell.material.opacity = Math.max(0.04, 0.22 - this.explodedAmount * 0.18);
    }
  }

  /**
   * Switch into Thermal Infrared Heatmap Mode
   */
  setThermalMode(active) {
    this.isThermalMode = active;

    const thermalMap = {
      fan: this.materials.thermalCold,
      hpc: this.materials.thermalHpc,
      combustion: this.materials.thermalCombustor,
      hpt: this.materials.thermalTurbine,
      nozzle: this.materials.thermalExhaust
    };

    this.zoneMeshes.forEach((meshes, zone) => {
      meshes.forEach((mesh) => {
        mesh.material = active ? (thermalMap[zone] || mesh.userData.baseMat) : mesh.userData.baseMat;
      });
    });

    // Make nacelle shell wireframe or dim in thermal mode
    if (this.nacelleShell) {
      this.nacelleShell.material.opacity = active ? 0.08 : 0.22;
    }
  }

  setCutaway(visible) {
    this.isCutaway = visible;
    this.modules.nacelle.visible = visible;
  }

  setThrottle(val) {
    this.throttle = Math.max(0.1, Math.min(1.0, val));
  }

  resetCamera() {
    this.camera.position.copy(this.defaultCamPos);
    this.controls.target.set(0.3, 0, 0);
    this.controls.update();
  }

  toggleAutoSpin() {
    this.isAutoSpin = !this.isAutoSpin;
    this.controls.autoRotate = this.isAutoSpin;
    this.controls.autoRotateSpeed = 1.2;
    return this.isAutoSpin;
  }

  onResize() {
    if (!this.container) return;
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(rect.width, 320);
    const height = Math.max(rect.height, 380);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  animate() {
    requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();
    const elapsed = this.clock.getElapsedTime();

    this.controls.update();

    // 1. Spool Rotations
    // Fan rotates at smooth proportional speed (titanium fan blades)
    const fanSpeed = (1.5 + this.throttle * 4.5) * delta;
    this.fanRotorGroup.rotation.x += fanSpeed;

    // Core spool (HPC & HPT) rotates at high speed
    const coreSpeed = (3.2 + this.throttle * 9.5) * delta;
    this.coreRotorGroup.rotation.x += coreSpeed;

    // 2. Combustor Fire & Light Pulse
    if (this.flameMesh) {
      const pulse = 1.0 + Math.sin(elapsed * 12.0) * 0.08;
      this.flameMesh.scale.set(pulse, 0.95 + Math.cos(elapsed * 10.0) * 0.06, pulse);
    }
    if (this.fireLight) {
      this.fireLight.intensity = (7 + this.throttle * 5) + Math.sin(elapsed * 15.0) * 1.2;
    }

    // 3. Dynamic Airflow Particles Animation
    if (this.particles) {
      const positions = this.particles.geometry.attributes.position.array;
      const colors = this.particles.geometry.attributes.color.array;
      const speedMultiplier = 0.8 + this.throttle * 1.8;

      for (let i = 0; i < this.particleCount; i++) {
        const idx = i * 3;
        positions[idx] += this.particleSpeeds[i] * speedMultiplier * delta;

        // Swirl around X axis
        const curY = positions[idx + 1];
        const curZ = positions[idx + 2];
        const swirlAngle = 0.45 * delta * (positions[idx] > -1.0 ? 3.0 : 1.0);
        positions[idx + 1] = curY * Math.cos(swirlAngle) - curZ * Math.sin(swirlAngle);
        positions[idx + 2] = curY * Math.sin(swirlAngle) + curZ * Math.cos(swirlAngle);

        this.updateParticleColor(i, positions[idx], colors);

        // Reset when exiting exhaust
        if (positions[idx] > 4.6) {
          this.resetParticle(i, positions, colors, this.particleSpeeds);
        }
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
      this.particles.geometry.attributes.color.needsUpdate = true;
    }

    this.renderer.render(this.scene, this.camera);
  }
}
