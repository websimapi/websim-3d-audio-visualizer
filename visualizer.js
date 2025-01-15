let scene, camera, renderer, analyser, dataArray;
let particles, particleSystem;
let waves;
let rings = [];
const PARTICLE_COUNT = 2048;
const WAVE_COUNT = 128;
const RING_COUNT = 5;

// Audio analysis bands
const BANDS = {
  bass: [20, 140],
  lowMid: [140, 400],
  mid: [400, 2600],
  highMid: [2600, 5200],
  treble: [5200, 14000]
};

function getFrequencyBandValue(startFreq, endFreq) {
  const nyquist = analyser.context.sampleRate / 2;
  const startIndex = Math.round(startFreq / nyquist * dataArray.length);
  const endIndex = Math.round(endFreq / nyquist * dataArray.length);
  let total = 0;
  
  for(let i = startIndex; i < endIndex; i++) {
    total += dataArray[i];
  }
  
  return total / (endIndex - startIndex) / 255;
}

function createRing(radius) {
  const geometry = new THREE.TorusGeometry(radius, 0.5, 16, 100);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.3,
    wireframe: true
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
  
  window.addEventListener('resize', onWindowResize, false);
}

let cameraRotation = 0;
let cameraHeight = 0;

function animate() {
  requestAnimationFrame(animate);
  
  if (analyser) {
    analyser.getByteFrequencyData(dataArray);
    const waveformData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(waveformData);
    
    // Get frequency band values
    const bass = getFrequencyBandValue(...BANDS.bass);
    const lowMid = getFrequencyBandValue(...BANDS.lowMid);
    const mid = getFrequencyBandValue(...BANDS.mid);
    const highMid = getFrequencyBandValue(...BANDS.highMid);
    const treble = getFrequencyBandValue(...BANDS.treble);
    
    // Update camera based on bass and mid frequencies
    cameraRotation += bass * 0.03;
    cameraHeight = Math.sin(Date.now() * 0.001) * 10 * mid;
    camera.position.x = Math.sin(cameraRotation) * 100;
    camera.position.z = Math.cos(cameraRotation) * 100;
    camera.position.y = cameraHeight;
    camera.lookAt(scene.position);
    
    // Update particles
    const positions = particleSystem.geometry.attributes.position.array;
    const colors = particleSystem.geometry.attributes.color.array;
    
    for(let i = 0; i < PARTICLE_COUNT * 3; i += 3) {
      const value = dataArray[i/3] / 128.0;
      const vector = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
      
      vector.normalize();
      const scale = 50 + value * 30 + (bass * 20);
      vector.multiplyScalar(scale);
      
      positions[i] = vector.x;
      positions[i + 1] = vector.y;
      positions[i + 2] = vector.z;
      
      // Color based on frequency bands
      colors[i] = 0.5 + bass * 0.5;
      colors[i + 1] = 0.3 + mid * 0.7;
      colors[i + 2] = 0.2 + treble * 0.8;
    }
    
    particleSystem.geometry.attributes.position.needsUpdate = true;
    particleSystem.geometry.attributes.color.needsUpdate = true;
    
    // Update waves
    const wavePositions = waves.geometry.attributes.position.array;
    const waveColors = waves.geometry.attributes.color.array;
    
    for(let i = 0; i < WAVE_COUNT * 3; i += 3) {
      const value = waveformData[i/3] / 128.0 - 1;
      wavePositions[i + 1] = value * 20 * (1 + lowMid);
      
      const intensity = Math.abs(value);
      waveColors[i] = 0.3 + intensity * 0.7 + bass * 0.3;
      waveColors[i + 1] = 0.5 + intensity * 0.5 + mid * 0.3;
      waveColors[i + 2] = 0.8 + treble * 0.2;
    }
    
    waves.geometry.attributes.position.needsUpdate = true;
    waves.geometry.attributes.color.needsUpdate = true;
    
    // Update rings
    rings.forEach((ring, index) => {
      ring.scale.set(
        1 + bass * 0.5,
        1 + mid * 0.5,
        1 + highMid * 0.5
      );
      ring.rotation.x += 0.01 * (index + 1) * lowMid;
      ring.rotation.y += 0.01 * (index + 1) * highMid;
      ring.material.opacity = 0.3 + treble * 0.5;
    });
  }
  
  particleSystem.rotation.x += 0.001;
  particleSystem.rotation.y += 0.002;
  
  waves.rotation.z += 0.005;
  
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