import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";

// 水中から水面を見上げるシーン。
const scene = new THREE.Scene();

// カメラ。水中側（y<0）から上方向を見る。
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  5000
);

// レンダラー。自然な明るさで見えるよう露出を控えめにする。
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
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

// 空（背景）を three.js 公式 Sky で描画する。
const sky = new Sky();
sky.scale.setScalar(12000);
scene.add(sky);

// 太陽方向ベクトル。
const sun = new THREE.Vector3();

// 水面シェーダーへ渡す値。
const uniforms = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunIntensity: { value: params.sunIntensity },
  uSunSpread: { value: params.sunSpread },
  uWaveHeight: { value: params.waveHeight },
  uWaveFrequency: { value: params.waveFrequency },
  uWaveSpeed: { value: params.waveSpeed },
  uWaveRandomness: { value: params.waveRandomness },
};

// 水面。広い平面を使い、視界外まで十分に広げる。
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(3000, 3000, 360, 360),
  new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: true,
    uniforms,
    vertexShader: `
      uniform float uTime;
      uniform float uWaveHeight;
      uniform float uWaveFrequency;
      uniform float uWaveSpeed;
      uniform float uWaveRandomness;

      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      varying float vWave;

      // 穏やかな波を生成する関数。
      float waveFn(vec2 p, float t) {
        float f = uWaveFrequency;

        float w = 0.0;
        w += sin(p.x * f * 0.65 + t * 0.75);
        w += sin((p.x * 0.35 + p.y * 0.9) * f * 1.15 + t * 0.55 + 1.7);
        w += sin((p.x * 0.85 - p.y * 0.45) * f * 1.9 + t * 0.38 + 2.4);

        // ランダムさは高周波成分の量で調整する。
        float rnd =
          sin((p.x * 2.1 + t * 0.22) * 1.9) *
          sin((p.y * 1.7 - t * 0.19) * 1.7);

        // 水中視点でも形が見えるように、波高を強めに反映する。
        return (w * 0.24 + rnd * 0.20 * uWaveRandomness) * uWaveHeight * 3.6;
      }

      void main() {
        vec3 pos = position;
        vec2 p = pos.xz;
        float t = uTime * (0.35 + uWaveSpeed * 1.25);

        float h = waveFn(p, t);
        pos.y += h;

        // 法線を数値微分で計算し、波の陰影を明確に出す。
        float e = 0.06;
        float hx = waveFn(p + vec2(e, 0.0), t) - h;
        float hz = waveFn(p + vec2(0.0, e), t) - h;
        vec3 n = normalize(cross(vec3(0.0, hz, e), vec3(e, hx, 0.0)));

        vec4 world = modelMatrix * vec4(pos, 1.0);
        vWorldPos = world.xyz;
        vNormalW = normalize(mat3(modelMatrix) * n);
        vWave = h;

        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDir;
      uniform float uSunIntensity;
      uniform float uSunSpread;

      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      varying float vWave;

      // 空色（水平線〜天頂）を返す。
      vec3 skyColor(vec3 dir) {
        float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 horizon = vec3(0.74, 0.88, 1.0);
        vec3 zenith = vec3(0.16, 0.42, 0.86);
        return mix(horizon, zenith, pow(h, 1.35));
      }

      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec3 n = normalize(vNormalW);
        vec3 up = vec3(0.0, 1.0, 0.0);

        // 屈折: 水中から空へ抜ける方向。
        vec3 refrDir = refract(-viewDir, n, 1.333 / 1.0);
        if (length(refrDir) < 0.0001) {
          refrDir = normalize(mix(up, reflect(-viewDir, n), 0.3));
        }

        // 反射: フレネルで寄与を増やす。
        vec3 reflDir = reflect(-viewDir, n);
        float fresnel = pow(1.0 - max(dot(viewDir, n), 0.0), 3.6);

        vec3 refrSky = skyColor(normalize(mix(up, refrDir, 0.95)));
        vec3 reflSky = skyColor(normalize(mix(up, reflDir, 0.95)));

        // 水の吸収。赤を少し強く吸収して青みを残す。
        float path = clamp((-cameraPosition.y) / max(dot(up, refrDir), 0.18), 0.0, 40.0);
        vec3 absorption = vec3(0.24, 0.09, 0.03);
        vec3 transmittance = exp(-absorption * path * 0.08);

        vec3 transmitted = refrSky * transmittance;
        vec3 reflected = reflSky * (0.07 + 0.55 * fresnel);

        // 太陽ディスクは円形を維持しやすい角距離ベースで描画。
        float sunAngle = dot(normalize(mix(up, refrDir, 0.98)), normalize(uSunDir));
        float spread = clamp(uSunSpread, 0.2, 3.0);
        float disk = smoothstep(0.99945 - spread * 0.0001, 0.99992 - spread * 0.00003, sunAngle);
        float halo = smoothstep(0.994, 0.99945, sunAngle) * (1.0 - disk);
        vec3 sunColor = vec3(1.0, 0.98, 0.92) * (disk * 3.4 + halo * 0.85) * uSunIntensity;

        // 波の明暗を少し足して形を見えやすくする。
        float shape = clamp(vWave * 6.0 + 0.5, 0.0, 1.0);
        vec3 waveTint = mix(vec3(0.0), vec3(0.03, 0.09, 0.12), shape * 0.32);

        // 法線と太陽方向の内積で陰影を追加し、波の凹凸を視認しやすくする。
        float sunShade = max(dot(n, normalize(uSunDir)), 0.0);
        vec3 shadeTint = vec3(0.10, 0.22, 0.30) * pow(sunShade, 1.2) * uSunIntensity;

        vec3 color = transmitted + reflected + sunColor + waveTint + shadeTint;

        // 完全不透明ではなく、背景の空が透ける透明水として描画する。
        float alpha = clamp(0.78 + fresnel * 0.16, 0.0, 0.96);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  })
);
water.rotation.x = -Math.PI / 2;
water.position.y = 0;
scene.add(water);

// 太陽と空パラメーターを更新する。
function updateSkyAndSun() {
  const spread = THREE.MathUtils.clamp(params.sunSpread, 0.2, 3.0);
  const elevation = THREE.MathUtils.lerp(10, 38, (spread - 0.2) / (3.0 - 0.2));
  const azimuth = 180;

  const skyUniforms = sky.material.uniforms;
  skyUniforms.turbidity.value = THREE.MathUtils.lerp(0.9, 2.4, spread / 3.0);
  skyUniforms.rayleigh.value = THREE.MathUtils.lerp(1.5, 3.0, spread / 3.0);
  skyUniforms.mieCoefficient.value = THREE.MathUtils.lerp(0.0005, 0.004, spread / 3.0);
  skyUniforms.mieDirectionalG.value = THREE.MathUtils.lerp(0.80, 0.88, spread / 3.0);

  const phi = THREE.MathUtils.degToRad(90 - elevation);
  const theta = THREE.MathUtils.degToRad(azimuth);
  sun.setFromSphericalCoords(1, phi, theta);
  sky.material.uniforms.sunPosition.value.copy(sun);

  uniforms.uSunDir.value.copy(sun).normalize();
  uniforms.uSunIntensity.value = params.sunIntensity;
  uniforms.uSunSpread.value = params.sunSpread;
}

// 波パラメーターを更新する。
function updateWaveParams() {
  // 波パラメーターはそのままユニフォームへ渡す。
  uniforms.uWaveHeight.value = params.waveHeight;
  uniforms.uWaveFrequency.value = params.waveFrequency;
  uniforms.uWaveSpeed.value = params.waveSpeed;
  uniforms.uWaveRandomness.value = params.waveRandomness;
}

// 距離・角度パラメーターからカメラ姿勢を更新する。
function updateCameraPose() {
  camera.position.y = -params.cameraDistance;

  const pitch = THREE.MathUtils.degToRad(params.cameraPitch);
  const yaw = THREE.MathUtils.degToRad(params.cameraYaw);
  const dir = new THREE.Vector3(
    Math.sin(pitch) * Math.sin(yaw),
    Math.cos(pitch),
    Math.sin(pitch) * Math.cos(yaw)
  );

  // 視線先を近めにして、局所的な波の起伏を見えやすくする。
  const target = camera.position.clone().add(dir.multiplyScalar(18));
  camera.lookAt(target);
}

// UI を取得し、変更時に反映する。
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

// UI表示と内部パラメーターを同期する。
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

    if (
      key === "waveHeight" ||
      key === "waveFrequency" ||
      key === "waveSpeed" ||
      key === "waveRandomness"
    ) {
      updateWaveParams();
    }

    if (key === "cameraDistance" || key === "cameraPitch" || key === "cameraYaw") {
      updateCameraPose();
    }
  });
});

// 初期状態を反映する。
updateSkyAndSun();
updateWaveParams();
updateCameraPose();

// リサイズ時にカメラと描画サイズを更新する。
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", onResize);

// 毎フレーム描画する。
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  uniforms.uTime.value = clock.getElapsedTime();
  renderer.render(scene, camera);
}
animate();
