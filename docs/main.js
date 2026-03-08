import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";
import { Water } from "https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/objects/Water.js";
import { Sky } from "https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/objects/Sky.js";

// シーンとカメラを作成する。水中側から水面を見上げる前提。
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  50000
);

// レンダラー。色空間とトーンマッピングを設定して白飛びを抑える。
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
document.body.appendChild(renderer.domElement);

// UI と同期するパラメーター。
const params = {
  sunIntensity: 1.1,
  sunSpread: 1.2,
  waveHeight: 0.14,
  waveFrequency: 0.9,
  waveSpeed: 0.35,
  waveRandomness: 0.35,
  cameraDistance: 8,
  cameraPitch: 16,
  cameraYaw: 0,
};

// 太陽光。水面シェーダーの sunDirection と合わせる。
const sunLight = new THREE.DirectionalLight(0xffffff, params.sunIntensity);
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x9fc5ff, 0.22));

// 空。three.js 公式 Sky を利用。
const sky = new Sky();
sky.scale.setScalar(20000);
scene.add(sky);

// 環境マップ生成に使う PMREM。
const pmremGenerator = new THREE.PMREMGenerator(renderer);
let envRenderTarget = null;

// 公式 Water。法線テクスチャは公式サンプルと同じものを利用。
const waterGeometry = new THREE.PlaneGeometry(40000, 40000);
const waterNormals = new THREE.TextureLoader().load(
  "https://threejs.org/examples/textures/waternormals.jpg",
  (tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  }
);

const water = new Water(waterGeometry, {
  textureWidth: 1024,
  textureHeight: 1024,
  waterNormals,
  sunDirection: new THREE.Vector3(0, 1, 0),
  sunColor: 0xffffff,
  waterColor: 0x1a4f7a,
  distortionScale: 1.1,
  fog: false,
});
water.rotation.x = -Math.PI / 2;
water.position.y = 0;
scene.add(water);

const sun = new THREE.Vector3();

// 太陽・空・環境マップをまとめて更新する。
function updateSkyAndSun() {
  const skyUniforms = sky.material.uniforms;

  // spread を太陽高度と散乱強度へ割り当てる。
  const spread = THREE.MathUtils.clamp(params.sunSpread, 0.2, 3.0);
  const elevation = THREE.MathUtils.lerp(8, 34, (spread - 0.2) / (3.0 - 0.2));
  const azimuth = 180;

  skyUniforms.turbidity.value = THREE.MathUtils.lerp(1.2, 4.0, spread / 3.0);
  skyUniforms.rayleigh.value = THREE.MathUtils.lerp(0.9, 2.4, spread / 3.0);
  skyUniforms.mieCoefficient.value = THREE.MathUtils.lerp(0.001, 0.01, spread / 3.0);
  skyUniforms.mieDirectionalG.value = THREE.MathUtils.lerp(0.86, 0.95, spread / 3.0);

  const phi = THREE.MathUtils.degToRad(90 - elevation);
  const theta = THREE.MathUtils.degToRad(azimuth);
  sun.setFromSphericalCoords(1, phi, theta);

  sky.material.uniforms.sunPosition.value.copy(sun);
  water.material.uniforms.sunDirection.value.copy(sun).normalize();

  sunLight.position.copy(sun).multiplyScalar(10000);
  sunLight.intensity = params.sunIntensity;

  // 空を環境マップ化して水面反射に使う。
  if (envRenderTarget) envRenderTarget.dispose();
  envRenderTarget = pmremGenerator.fromScene(sky);
  scene.environment = envRenderTarget.texture;
}

// 波関連パラメーターを水面シェーダーへ反映する。
function updateWaveParams() {
  const waveHeight = THREE.MathUtils.clamp(params.waveHeight, 0, 0.45);
  const waveFreq = THREE.MathUtils.clamp(params.waveFrequency, 0.2, 2.2);

  // distortionScale を波高へ対応。
  water.material.uniforms.distortionScale.value = 0.2 + waveHeight * 10.0;

  // size は波のスケール。大きいほど細かく揺れる。
  water.material.uniforms.size.value = 0.6 + waveFreq * 2.0;
}

// 距離・角度パラメーターからカメラ姿勢を再計算する。
function updateCameraPose() {
  camera.position.y = -params.cameraDistance;

  const pitch = THREE.MathUtils.degToRad(params.cameraPitch);
  const yaw = THREE.MathUtils.degToRad(params.cameraYaw);
  const dir = new THREE.Vector3(
    Math.sin(pitch) * Math.sin(yaw),
    Math.cos(pitch),
    Math.sin(pitch) * Math.cos(yaw)
  );

  const target = camera.position.clone().add(dir.multiplyScalar(50));
  camera.lookAt(target);
}

// UI 要素を取得し、変更を反映する。
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

// 初期値を反映する。
updateSkyAndSun();
updateWaveParams();
updateCameraPose();

// リサイズ時に描画設定を更新する。
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", onResize);

// 毎フレームで time を更新し、ゆるいランダム揺らぎを加える。
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);

  const t = clock.getElapsedTime();
  const dt = clock.getDelta();

  const speed = 0.12 + params.waveSpeed * 0.9;
  water.material.uniforms.time.value += dt * speed;

  // 波のランダムさで size を微小変動させ、穏やかな不規則性を出す。
  const baseSize = 0.6 + THREE.MathUtils.clamp(params.waveFrequency, 0.2, 2.2) * 2.0;
  const randomFactor =
    1.0 +
    Math.sin(t * 0.37) * 0.06 * params.waveRandomness +
    Math.sin(t * 0.61 + 1.7) * 0.04 * params.waveRandomness;
  water.material.uniforms.size.value = baseSize * randomFactor;

  renderer.render(scene, camera);
}
animate();
