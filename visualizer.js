let scene, camera, renderer, analyser, dataArray;
let particles, particleSystem;
let waves;
const PARTICLE_COUNT = 2048;
const WAVE_COUNT = 128;

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
  // Create scene
  scene = new THREE.Scene();
  
  // Setup camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 100;
  
  // Setup renderer
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
  
  window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  
  if (analyser) {
    analyser.getByteFrequencyData(dataArray);
    const waveformData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(waveformData);
    
    // Update particles based on frequency data
    const positions = particleSystem.geometry.attributes.position.array;
    const colors = particleSystem.geometry.attributes.color.array;
    
    for(let i = 0; i < PARTICLE_COUNT * 3; i += 3) {
      const value = dataArray[i/3] / 128.0;
      const vector = new THREE.Vector3(
        positions[i],
        positions[i + 1],
        positions[i + 2]
      );
      
      vector.normalize();
      vector.multiplyScalar(50 + value * 30);
      
      positions[i] = vector.x;
      positions[i + 1] = vector.y;
      positions[i + 2] = vector.z;
      
      // Update colors based on frequency intensity
      colors[i] = 0.5 + value * 0.5;
      colors[i + 1] = 0.3 + value * 0.7;
      colors[i + 2] = 0.8;
    }
    
    particleSystem.geometry.attributes.position.needsUpdate = true;
    particleSystem.geometry.attributes.color.needsUpdate = true;
    
    // Update waves based on waveform data
    const wavePositions = waves.geometry.attributes.position.array;
    const waveColors = waves.geometry.attributes.color.array;
    
    for(let i = 0; i < WAVE_COUNT * 3; i += 3) {
      const value = waveformData[i/3] / 128.0 - 1;
      wavePositions[i + 1] = value * 20;
      
      // Update wave colors based on amplitude
      const intensity = Math.abs(value);
      waveColors[i] = 0.3 + intensity * 0.7;
      waveColors[i + 1] = 0.5 + intensity * 0.5;
      waveColors[i + 2] = 0.8;
    }
    
    waves.geometry.attributes.position.needsUpdate = true;
    waves.geometry.attributes.color.needsUpdate = true;
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
  
  // Add audio processing nodes
  const lowPassFilter = audioContext.createBiquadFilter();
  lowPassFilter.type = 'lowpass';
  lowPassFilter.frequency.value = 1000;
  
  const highPassFilter = audioContext.createBiquadFilter();
  highPassFilter.type = 'highpass';
  highPassFilter.frequency.value = 50;
  
  // Connect audio nodes
  source.connect(highPassFilter);
  highPassFilter.connect(lowPassFilter);
  lowPassFilter.connect(analyser);
  analyser.connect(audioContext.destination);
  
  audio.play();
}

// Start button event listener
document.getElementById('start-btn').addEventListener('click', () => {
  document.getElementById('start-btn').classList.add('hidden');
  init();
  setupAudio();
  animate();
});