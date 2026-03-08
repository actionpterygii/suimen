import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";

// Create the 3D scene and set its background color.
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f172a);

// Configure camera: field of view, aspect ratio, near/far clipping planes.
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 3;

// Create WebGL renderer, size it to viewport, then append canvas to DOM.
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Build a cube mesh and add it to the scene.
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0x38bdf8 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// Add directional and ambient lights for visible shading.
const light = new THREE.DirectionalLight(0xffffff, 1.4);
light.position.set(2, 2, 3);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.5));

function onResize() {
  // Recalculate projection and renderer size on window resize.
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Listen for viewport size changes.
window.addEventListener("resize", onResize);

function animate() {
  // Schedule next frame using browser animation timing.
  requestAnimationFrame(animate);
  // Update cube rotation every frame.
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.015;
  // Render one frame from current scene and camera.
  renderer.render(scene, camera);
}

// Start the render loop.
animate();
