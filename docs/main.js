import * as THREE from "three";
import { Water } from "three/addons/objects/Water.js";
import { Sky } from "three/addons/objects/Sky.js";

// 公式 Water + Sky を使った、上から見る海面シーン。
const scene = new THREE.Scene();

// カメラは水面の上に置き、少し斜め下を見る。
const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  20000
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
document.body.appendChild(renderer.domElement);

// UI と同期するパラメーター。
const params = {
  sunIntensity: 1.1,
  sunSpread: 1.2,
  waveHeight: 0.24,
  waveFrequency: 1.1,
  waveSpeed: 0.55,
  waveRandomness: 0.35,
  cameraDistance: 8,
  cameraPitch: 16,
  cameraYaw: 0,
};

// 空。
const sky = new Sky();
sky.scale.setScalar(10000);
scene.add(sky);

// 太陽位置。
const sun = new THREE.Vector3();

// 水面法線テクスチャ。
const waterNormals = new THREE.TextureLoader().load(
  "https://threejs.org/examples/textures/waternormals.jpg",
  (tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  }
);

// 公式 Water。
const water = new Water(new THREE.PlaneGeometry(10000, 10000), {
  textureWidth: 1024,
  textureHeight: 1024,
  waterNormals,
  sunDirection: new THREE.Vector3(0, 1, 0),
  sunColor: 0xffffff,
  waterColor: 0x2a6ea8,
  distortionScale: 3.7,
  fog: false,
});
water.rotation.x = -Math.PI / 2;
scene.add(water);

// 環境マップ（空反射）更新用。
const pmremGenerator = new THREE.PMREMGenerator(renderer);
let envRT = null;

// 補助光。
const sunLight = new THREE.DirectionalLight(0xffffff, params.sunIntensity);
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x9fb7d8, 0.26));

function updateSkyAndSun() {
  const spread = THREE.MathUtils.clamp(params.sunSpread, 0.2, 3.0);

  // spread を空の散乱特性へ割り当てる。
  const skyUniforms = sky.material.uniforms;
  skyUniforms.turbidity.value = THREE.MathUtils.lerp(0.9, 4.0, spread / 3.0);
  skyUniforms.rayleigh.value = THREE.MathUtils.lerp(1.0, 3.2, spread / 3.0);
  skyUniforms.mieCoefficient.value = THREE.MathUtils.lerp(0.0008, 0.01, spread / 3.0);
  skyUniforms.mieDirectionalG.value = THREE.MathUtils.lerp(0.82, 0.94, spread / 3.0);

  // 太陽高度を spread で調整。
  const elevation = THREE.MathUtils.lerp(10, 45, spread / 3.0);
  const azimuth = 180;

  const phi = THREE.MathUtils.degToRad(90 - elevation);
  const theta = THREE.MathUtils.degToRad(azimuth);
  sun.setFromSphericalCoords(1, phi, theta);

  sky.material.uniforms.sunPosition.value.copy(sun);

  // 水面シェーダーへ太陽方向を反映。
  water.material.uniforms.sunDirection.value.copy(sun).normalize();

  // ライト強度。
  sunLight.position.copy(sun).multiplyScalar(5000);
  sunLight.intensity = params.sunIntensity;

  // 空を環境マップ化して反射に使う。
  if (envRT) envRT.dispose();
  envRT = pmremGenerator.fromScene(sky);
  scene.environment = envRT.texture;
}

function updateWaveParams() {
  const h = THREE.MathUtils.clamp(params.waveHeight, 0, 0.45);
  const f = THREE.MathUtils.clamp(params.waveFrequency, 0.2, 2.2);

  // 波高。
  water.material.uniforms.distortionScale.value = 0.4 + h * 18.0;

  // 波の細かさ。
  water.material.uniforms.size.value = 0.6 + f * 3.2;
}

function updateCameraPose() {
  // 上面視点なので y は正方向（空側）に配置する。
  const distance = THREE.MathUtils.max(params.cameraDistance, 1.2);
  camera.position.y = distance;

  // pitch は「水面へ向ける角度」として扱い、常に下向きにする。
  const pitchDeg = THREE.MathUtils.clamp(params.cameraPitch, 5, 85);
  const yaw = THREE.MathUtils.degToRad(params.cameraYaw);

  const horiz = Math.cos(THREE.MathUtils.degToRad(pitchDeg));
  const down = Math.sin(THREE.MathUtils.degToRad(pitchDeg));

  const dir = new THREE.Vector3(
    horiz * Math.sin(yaw),
    -down,
    horiz * Math.cos(yaw)
  );

  const target = camera.position.clone().add(dir.multiplyScalar(50));
  camera.lookAt(target);
}

const sliders = {
  sunIntensity: document.getElementById("sunIntensity"),
  sunSpread: document.getElementById("sunSpread"),
  waveHeight: document.getElementById("waveHeight"),
  waveFrequency: document.getElementById("waveFrequency"),
  waveSpeed: document.getElementById("waveSpeed"),
  waveRandomness: document.getElementById("waveRandomness"),
  cameraDistance: document.getElementById("cameraDistance"),
  cameraPitch: document.getElementById("cameraPitch"),
  cameraYaw: document.getElementById("cameraYaw"),
};

// UI 表示値を現在パラメーターへ同期する。
Object.keys(sliders).forEach((key) => {
  const input = sliders[key];
  if (!input) return;
  input.value = String(params[key]);
});

Object.keys(sliders).forEach((key) => {
  const input = sliders[key];
  if (!input) return;

  input.addEventListener("input", () => {
    params[key] = Number(input.value);

    if (key === "sunIntensity" || key === "sunSpread") {
      updateSkyAndSun();
    }

    if (key === "waveHeight" || key === "waveFrequency") {
      updateWaveParams();
    }

    if (key === "cameraDistance" || key === "cameraPitch" || key === "cameraYaw") {
      updateCameraPose();
    }
  });
});

updateSkyAndSun();
updateWaveParams();
updateCameraPose();

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", onResize);

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();
  const t = clock.getElapsedTime();

  // 公式 Water の time を進める。
  const speed = 0.15 + params.waveSpeed * 1.35;
  water.material.uniforms.time.value += dt * speed;

  // ランダムさは歪み量の微小変化として加える。
  const randomFactor =
    1.0 +
    Math.sin(t * 0.42) * 0.10 * params.waveRandomness +
    Math.sin(t * 0.73 + 1.4) * 0.06 * params.waveRandomness;
  const h = THREE.MathUtils.clamp(params.waveHeight, 0, 0.45);
  water.material.uniforms.distortionScale.value = (0.4 + h * 18.0) * randomFactor;

  renderer.render(scene, camera);
}
animate();
