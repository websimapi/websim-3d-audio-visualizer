let scene, camera, renderer, analyser, dataArray;
let particles, particleSystem;
let waves;
let rings = [];
const PARTICLE_COUNT = 2048;
const WAVE_COUNT = 128;
const RING_COUNT = 5;

// Enhanced audio analysis bands with more detail
const BANDS = {
  subBass: [20, 60],
  bass: [60, 250],
  lowMid: [250, 500],
  mid: [500, 2000],
  highMid: [2000, 4000],
  presence: [4000, 6000],
  brilliance: [6000, 20000]
};

// Refined sensitivity controls with smoother transitions
const SENSITIVITY = {
  cameraRotation: 0.008,
  particleMovement: 0.3,
  colorIntensity: 0.8,
  waveAmplitude: 12,
  baseSpeed: 0.0005,
  energyThreshold: 0.15,
  peakDecay: 0.98
};

let lastAverageEnergy = 0;
let energyHistory = new Array(30).fill(0);
let peakEnergy = 0;
let lastUpdate = 0;

// Enhanced tempo and rhythm detection
const TEMPO_DETECTION = {
  beatHistory: [],
  lastBeat: 0,
  currentTempo: 120,
  beatThreshold: 0.15,
  minTempo: 60,
  maxTempo: 180
};

// Camera states for transitions
const CAMERA_STATES = {
  orbit: {
    update: (camera, metrics) => {
      camera.position.x = Math.sin(cameraRotation) * 100;
      camera.position.z = Math.cos(cameraRotation) * 100;
      camera.position.y = cameraHeight;
      camera.lookAt(scene.position);
    }
  },
  waves: {
    update: (camera, metrics) => {
      camera.position.set(0, 50, 50);
      camera.lookAt(new THREE.Vector3(0, 0, 0));
    }
  },
  particle: {
    update: (camera, metrics) => {
      camera.position.set(
        Math.sin(Date.now() * 0.001) * 30,
        Math.cos(Date.now() * 0.0015) * 30,
        50 + Math.sin(Date.now() * 0.002) * 20
      );
      camera.lookAt(particleSystem.position);
    }
  },
  rings: {
    update: (camera, metrics) => {
      camera.position.set(
        Math.sin(Date.now() * 0.0005) * 80,
        Math.cos(Date.now() * 0.0008) * 40,
        Math.sin(Date.now() * 0.001) * 60
      );
      camera.lookAt(rings[Math.floor(Date.now() * 0.001) % rings.length].position);
    }
  }
};

let currentCameraState = 'orbit';
let lastCameraTransition = 0;
const CAMERA_TRANSITION_INTERVAL = 10000; // 10 seconds between transitions

// Enhanced frequency analysis
function getFrequencyBandValue(startFreq, endFreq) {
  const nyquist = analyser.context.sampleRate / 2;
  const startIndex = Math.round((startFreq / nyquist) * dataArray.length);
  const endIndex = Math.round((endFreq / nyquist) * dataArray.length);
  let sum = 0;
  let peak = 0;
  
  for(let i = startIndex; i < endIndex; i++) {
    const value = dataArray[i] / 255;
    sum += value;
    peak = Math.max(peak, value);
  }
  
  return {
    average: sum / (endIndex - startIndex),
    peak: peak
  };
}

function getAudioMetrics() {
  const metrics = {};
  
  // Calculate metrics for each frequency band
  Object.entries(BANDS).forEach(([band, [low, high]]) => {
    metrics[band] = getFrequencyBandValue(low, high);
  });
  
  // Calculate overall energy
  let totalEnergy = 0;
  for (let i = 0; i < dataArray.length; i++) {
    totalEnergy += dataArray[i];
  }
  metrics.energy = totalEnergy / (dataArray.length * 255);
  
  // Update energy history and calculate trends
  energyHistory.push(metrics.energy);
  energyHistory.shift();
  
  metrics.energyTrend = energyHistory.reduce((sum, energy) => sum + energy, 0) / energyHistory.length;
  metrics.energyVariance = Math.sqrt(
    energyHistory.reduce((sum, energy) => sum + Math.pow(energy - metrics.energyTrend, 2), 0) / energyHistory.length
  );
  
  // Peak detection
  if (metrics.energy > peakEnergy) {
    peakEnergy = metrics.energy;
  } else {
    peakEnergy *= SENSITIVITY.peakDecay;
  }
  metrics.peakEnergy = peakEnergy;
  
  return metrics;
}

// Enhanced audio analysis
function detectTempo(metrics) {
  const now = Date.now();
  const energyThreshold = 0.6;
  
  if (metrics.energy > energyThreshold && 
      now - TEMPO_DETECTION.lastBeat > 200) { // Minimum 200ms between beats
    
    TEMPO_DETECTION.beatHistory.push(now - TEMPO_DETECTION.lastBeat);
    if (TEMPO_DETECTION.beatHistory.length > 8) {
      TEMPO_DETECTION.beatHistory.shift();
    }
    
    // Calculate average tempo from beat history
    const averageInterval = TEMPO_DETECTION.beatHistory.reduce((a, b) => a + b, 0) / 
                          TEMPO_DETECTION.beatHistory.length;
    TEMPO_DETECTION.currentTempo = Math.min(
      Math.max(60000 / averageInterval, TEMPO_DETECTION.minTempo),
      TEMPO_DETECTION.maxTempo
    );
    
    TEMPO_DETECTION.lastBeat = now;
  }
  
  return TEMPO_DETECTION.currentTempo;
}

function createRing(radius) {
  const geometry = new THREE.TorusGeometry(radius, 0.5, 32, 200); // Increased detail
  const material = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.3,
    wireframe: true,
    shininess: 50,
    specular: 0xffffff
  });
  const ring = new THREE.Mesh(geometry, material);
  scene.add(ring);
  return ring;
}

function createWaves() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(WAVE_COUNT * 3);
  const colors = new Float32Array(WAVE_COUNT * 3);
  
  for(let i = 0; i < WAVE_COUNT * 3; i += 3) {
    positions[i] = (i/3 - WAVE_COUNT/2);
    positions[i + 1] = 0;
    positions[i + 2] = 0;
    
    colors[i] = 0.5 + Math.sin(i/WAVE_COUNT) * 0.5;
    colors[i + 1] = 0.5 + Math.cos(i/WAVE_COUNT) * 0.5;
    colors[i + 2] = 0.8;
  }
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  
  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    linewidth: 2
  });
  
  waves = new THREE.Line(geometry, material);
  scene.add(waves);
}

function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 100;
  
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('visualizer').appendChild(renderer.domElement);
  
  // Create particles
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  
  for(let i = 0; i < PARTICLE_COUNT * 3; i += 3) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const r = Math.random() * 50;
    
    positions[i] = r * Math.sin(phi) * Math.cos(theta);
    positions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i + 2] = r * Math.cos(phi);
    
    colors[i] = 0.5 + Math.sin(theta) * 0.5;
    colors[i + 1] = 0.5 + Math.cos(phi) * 0.5;
    colors[i + 2] = 0.8;
  }
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  
  const material = new THREE.PointsMaterial({
    size: 0.5,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending
  });
  
  particleSystem = new THREE.Points(geometry, material);
  scene.add(particleSystem);
  
  // Create waves visualization
  createWaves();
  
  // Create rings
  for(let i = 0; i < RING_COUNT; i++) {
    const ring = createRing(20 + i * 15);
    rings.push(ring);
  }
  
  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  
  // Add directional lights for better ring illumination
  const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.5);
  directionalLight1.position.set(1, 1, 1);
  scene.add(directionalLight1);
  
  const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
  directionalLight2.position.set(-1, -1, -1);
  scene.add(directionalLight2);
  
  // Add point lights for dynamic lighting
  const lightColors = [0xff0000, 0x00ff00, 0x0000ff, 0xff00ff];
  lightColors.forEach((color, i) => {
    const light = new THREE.PointLight(color, 0.5, 100);
    light.position.set(
      Math.cos(i * Math.PI / 2) * 30,
      Math.sin(i * Math.PI / 2) * 30,
      0
    );
    scene.add(light);
    rings.push({ light, initialColor: color });
  });
  
  window.addEventListener('resize', onWindowResize, false);
}

let cameraRotation = 0;
let cameraHeight = 0;

function animate() {
  requestAnimationFrame(animate);
  
  if (analyser) {
    analyser.getByteFrequencyData(dataArray);
    const metrics = getAudioMetrics();
    const deltaTime = (Date.now() - lastUpdate) / 1000;
    lastUpdate = Date.now();
    
    // Detect tempo and adjust visualization speed
    const currentTempo = detectTempo(metrics);
    const tempoFactor = (currentTempo - TEMPO_DETECTION.minTempo) / 
                       (TEMPO_DETECTION.maxTempo - TEMPO_DETECTION.minTempo);
    
    // Camera state transitions
    if (Date.now() - lastCameraTransition > CAMERA_TRANSITION_INTERVAL) {
      const states = Object.keys(CAMERA_STATES);
      const nextIndex = (states.indexOf(currentCameraState) + 1) % states.length;
      currentCameraState = states[nextIndex];
      lastCameraTransition = Date.now();
    }
    
    // Update camera based on current state
    CAMERA_STATES[currentCameraState].update(camera, metrics);
    
    // Adjust rotation speeds based on tempo
    const baseRotationSpeed = SENSITIVITY.cameraRotation * (1 + tempoFactor);
    cameraRotation += baseRotationSpeed * deltaTime * (1 + metrics.energy);
    
    // Enhanced ring rotation based on tempo
    rings.forEach((ring, index) => {
      if (!ring.light) {
        const ringSpeed = baseRotationSpeed * (index + 1) * (1 + tempoFactor);
        ring.rotation.x += ringSpeed * metrics.lowMid.average;
        ring.rotation.y += ringSpeed * metrics.highMid.average;
        ring.rotation.z += ringSpeed * 0.5 * metrics.bass.average;
        
        // Pulse size with tempo
        const basePulse = Math.sin(Date.now() * 0.001 * tempoFactor);
        const pulseScale = 1 + basePulse * metrics.energy * 0.5;
        ring.scale.set(pulseScale, pulseScale, pulseScale);
      }
    });
    
    // Enhanced particle system updates
    const positions = particleSystem.geometry.attributes.position.array;
    const colors = particleSystem.geometry.attributes.color.array;
    
    for(let i = 0; i < PARTICLE_COUNT * 3; i += 3) {
      const vector = new THREE.Vector3(
        positions[i], 
        positions[i + 1], 
        positions[i + 2]
      );
      
      vector.normalize();
      
      // Dynamic particle movement based on frequency bands
      const scale = 50 + 
                    metrics.bass.average * 30 + 
                    metrics.mid.peak * 20 + 
                    metrics.highMid.average * 10;
      
      vector.multiplyScalar(scale);
      
      positions[i] = vector.x;
      positions[i + 1] = vector.y;
      positions[i + 2] = vector.z;
      
      // Enhanced color transitions based on frequency analysis
      const hue = (Date.now() * 0.0001 + i / PARTICLE_COUNT) % 1;
      const saturation = 0.5 + metrics.energy * 0.5;
      const lightness = 0.3 + metrics.peakEnergy * 0.4;
      
      const color = new THREE.Color().setHSL(hue, saturation, lightness);
      colors[i] = color.r;
      colors[i + 1] = color.g;
      colors[i + 2] = color.b;
    }
    
    particleSystem.geometry.attributes.position.needsUpdate = true;
    particleSystem.geometry.attributes.color.needsUpdate = true;
    
    // Enhanced wave animation
    const wavePositions = waves.geometry.attributes.position.array;
    const waveColors = waves.geometry.attributes.color.array;
    
    for(let i = 0; i < WAVE_COUNT * 3; i += 3) {
      const index = Math.floor(i / 3);
      const normalizedIndex = index / WAVE_COUNT;
      
      // Complex wave form combining multiple frequency bands
      const displacement = 
        Math.sin(normalizedIndex * Math.PI * 2 + Date.now() * 0.001) * metrics.bass.average * 10 +
        Math.sin(normalizedIndex * Math.PI * 4 + Date.now() * 0.002) * metrics.mid.average * 8 +
        Math.sin(normalizedIndex * Math.PI * 8 + Date.now() * 0.003) * metrics.highMid.average * 6;
      
      wavePositions[i + 1] = displacement * SENSITIVITY.waveAmplitude;
      
      // Dynamic wave coloring based on frequency content
      const hue = (Date.now() * 0.0002 + normalizedIndex) % 1;
      const saturation = 0.7 + metrics.energy * 0.3;
      const lightness = 0.4 + Math.abs(displacement) * 0.3;
      
      const color = new THREE.Color().setHSL(hue, saturation, lightness);
      waveColors[i] = color.r;
      waveColors[i + 1] = color.g;
      waveColors[i + 2] = color.b;
    }
    
    waves.geometry.attributes.position.needsUpdate = true;
    waves.geometry.attributes.color.needsUpdate = true;
    
    // Enhanced ring updates
    rings.forEach((ring, index) => {
      if (ring.light) {
        const time = Date.now() * 0.001;
        const radius = 30 + 
                      Math.sin(time + index) * 10 * metrics.energy;
        
        ring.light.position.x = Math.cos(time * 0.5 + index) * radius;
        ring.light.position.y = Math.sin(time * 0.5 + index) * radius;
        ring.light.intensity = 0.5 + metrics.peakEnergy * 0.5;
        
        // Dynamic light color based on frequency content
        const hue = (time * 0.1 + index * 0.2) % 1;
        const saturation = 0.8 + metrics.mid.peak * 0.2;
        const lightness = 0.5 + metrics.energy * 0.5;
        
        ring.light.color.setHSL(hue, saturation, lightness);
      } else {
        // Torus ring updates based on frequency bands
        const scale = 1 + 
                     metrics.bass.average * 0.5 + 
                     metrics.mid.average * 0.3 + 
                     metrics.highMid.average * 0.2;
        
        ring.scale.set(scale, scale, scale);
        ring.rotation.x += metrics.lowMid.average * 0.05 * (index + 1);
        ring.rotation.y += metrics.highMid.average * 0.05 * (index + 1);
        ring.material.opacity = 0.3 + metrics.presence.average * 0.5;
        
        // Dynamic ring color
        const hue = (Date.now() * 0.0005 + index * 0.2) % 1;
        const saturation = 0.7 + metrics.energy * 0.3;
        const lightness = 0.4 + metrics.peakEnergy * 0.3;
        
        ring.material.color.setHSL(hue, saturation, lightness);
      }
    });
  }
  
  renderer.render(scene, camera);
}

function setupAudio() {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.85;
  
  const bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);
  
  const audio = new Audio('/Deep Waves of Trance - Mknsy Deep House - Sonauto.wav');
  audio.loop = true;
  
  const source = audioContext.createMediaElementSource(audio);
  
  // Enhanced audio processing chain
  const lowPassFilter = audioContext.createBiquadFilter();
  lowPassFilter.type = 'lowpass';
  lowPassFilter.frequency.value = 1000;
  
  const highPassFilter = audioContext.createBiquadFilter();
  highPassFilter.type = 'highpass';
  highPassFilter.frequency.value = 50;
  
  const compressor = audioContext.createDynamicsCompressor();
  compressor.threshold.value = -50;
  compressor.knee.value = 40;
  compressor.ratio.value = 12;
  compressor.attack.value = 0;
  compressor.release.value = 0.25;
  
  // Connect audio nodes
  source.connect(highPassFilter);
  highPassFilter.connect(lowPassFilter);
  lowPassFilter.connect(compressor);
  compressor.connect(analyser);
  analyser.connect(audioContext.destination);
  
  audio.play();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Start button event listener
document.getElementById('start-btn').addEventListener('click', () => {
  document.getElementById('start-btn').classList.add('hidden');
  init();
  setupAudio();
  animate();
});