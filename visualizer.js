let scene, camera, renderer, analyser, dataArray;
let particles, particleSystem;
const PARTICLE_COUNT = 2048;

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
    // Position particles in a sphere
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const r = Math.random() * 50;
    
    positions[i] = r * Math.sin(phi) * Math.cos(theta);
    positions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i + 2] = r * Math.cos(phi);
    
    // Give each particle a color
    colors[i] = Math.random();
    colors[i + 1] = Math.random();
    colors[i + 2] = Math.random();
  }
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  
  const material = new THREE.PointsMaterial({
    size: 0.5,
    vertexColors: true,
    transparent: true
  });
  
  particleSystem = new THREE.Points(geometry, material);
  scene.add(particleSystem);
  
  // Handle window resize
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
    
    const positions = particleSystem.geometry.attributes.position.array;
    
    for(let i = 0; i < PARTICLE_COUNT * 3; i += 3) {
      const value = dataArray[i/3] / 128.0;
      const vector = new THREE.Vector3(
        positions[i],
        positions[i + 1],
        positions[i + 2]
      );
      
      vector.normalize();
      vector.multiplyScalar(50 + value * 20);
      
      positions[i] = vector.x;
      positions[i + 1] = vector.y;
      positions[i + 2] = vector.z;
    }
    
    particleSystem.geometry.attributes.position.needsUpdate = true;
  }
  
  particleSystem.rotation.x += 0.001;
  particleSystem.rotation.y += 0.002;
  
  renderer.render(scene, camera);
}

function setupAudio() {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  
  const bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);
  
  const audio = new Audio('/Deep Waves of Trance - Mknsy Deep House - Sonauto.wav');
  audio.loop = true;
  
  const source = audioContext.createMediaElementSource(audio);
  source.connect(analyser);
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