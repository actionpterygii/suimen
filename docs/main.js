import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";

// シーン。霧は使わず、輪郭の甘さを減らす。
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x041428);
scene.fog = null;

// 水中側から水面を見上げるカメラ。
const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  240
);
camera.position.set(0, -8, 0.4);
camera.lookAt(0, 0.1, 0);

// レンダラー。色空間のみ有効化し、トーンマッピングは無効にしてにじみを抑える。
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
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

// 波の方向と位相を乱数で固定し、毎回同じ雰囲気で揺れるようにする。
const waveDirs = [];
const wavePhase = [];
for (let i = 0; i < 4; i += 1) {
  const a = Math.random() * Math.PI * 2;
  waveDirs.push(new THREE.Vector2(Math.cos(a), Math.sin(a)));
  wavePhase.push(Math.random() * Math.PI * 2);
}

// シェーダーへ渡す値。
const uniforms = {
  uTime: { value: 0 },
  uSunIntensity: { value: params.sunIntensity },
  uSunSpread: { value: params.sunSpread },
  uWaveHeight: { value: params.waveHeight },
  uWaveFrequency: { value: params.waveFrequency },
  uWaveSpeed: { value: params.waveSpeed },
  uWaveRandomness: { value: params.waveRandomness },
  uWaveDir: { value: waveDirs },
  uWavePhase: { value: wavePhase },
};

// 広い平面を水面として使う。端が見えないように十分大きくする。
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(260, 260, 320, 320),
  new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: false,
    uniforms,
    vertexShader: `
      uniform float uTime;
      uniform float uWaveHeight;
      uniform float uWaveFrequency;
      uniform float uWaveSpeed;
      uniform float uWaveRandomness;
      uniform vec2 uWaveDir[4];
      uniform float uWavePhase[4];

      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      varying float vWave;

      // 複数のサイン波を合成して、静かなランダム波を作る。
      float wave(vec2 p) {
        float f = uWaveFrequency;
        float t = uTime * uWaveSpeed;
        float w = 0.0;
        w += sin(dot(p, uWaveDir[0] * f * 1.1) + t * 1.1 + uWavePhase[0]);
        w += sin(dot(p, uWaveDir[1] * f * 1.6) + t * 0.8 + uWavePhase[1]);
        w += sin(dot(p, uWaveDir[2] * f * 2.0) + t * 0.6 + uWavePhase[2]);
        w += sin(dot(p, uWaveDir[3] * f * 2.7) + t * 0.4 + uWavePhase[3]);

        float rnd = sin((p.x + t * 0.5) * 3.1) * sin((p.y - t * 0.35) * 2.7);
        return (w * 0.23 + rnd * 0.22 * uWaveRandomness) * uWaveHeight;
      }

      void main() {
        vec3 pos = position;
        vec2 p = pos.xz;

        float h = wave(p);
        pos.y += h;

        // 法線の差分幅を小さめにして、反射ハイライトを鋭くする。
        float e = 0.02;
        float hx = wave(p + vec2(e, 0.0)) - h;
        float hz = wave(p + vec2(0.0, e)) - h;
        vec3 n = normalize(cross(vec3(0.0, hz, e), vec3(e, hx, 0.0)));

        vec4 world = modelMatrix * vec4(pos, 1.0);
        vWorldPos = world.xyz;
        vNormalW = normalize(mat3(modelMatrix) * n);
        vWave = h;

        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uSunIntensity;
      uniform float uSunSpread;

      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      varying float vWave;

      // 空の色。ここではグラデーションのみを返す。
      vec3 skyColor(vec3 dir) {
        float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 horizon = vec3(0.70, 0.86, 0.99);
        vec3 zenith = vec3(0.12, 0.36, 0.78);
        return mix(horizon, zenith, pow(h, 1.55));
      }

      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec3 normal = normalize(vNormalW);
        vec3 up = vec3(0.0, 1.0, 0.0);
        vec3 sunDir = normalize(vec3(0.15, 1.0, 0.25));

        // 太陽像が崩れ過ぎないよう、屈折計算は穏やかな法線を使う。
        vec3 calmNormal = normalize(mix(normal, up, 0.88));

        // 屈折方向を使って、水越しに見える空色を計算する。
        vec3 refrDir = refract(-viewDir, calmNormal, 1.0 / 1.333);
        if (length(refrDir) < 0.0001) {
          refrDir = normalize(mix(up, calmNormal, 0.2));
        }

        // フレネルで反射寄与を決める。
        float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 5.0);

        vec3 refrSkyDir = normalize(mix(up, refrDir, 0.96));
        vec3 reflSkyDir = reflect(-viewDir, calmNormal);
        vec3 skyRefract = skyColor(refrSkyDir);
        vec3 skyReflect = skyColor(reflSkyDir);

        // 太陽ディスクを角距離で描き、円形を保ちやすくする。
        float sunAngle = dot(refrSkyDir, sunDir);
        float sunDisk = smoothstep(0.9996, 0.99995, sunAngle);
        float sunHalo = smoothstep(0.995, 0.9996, sunAngle) * (1.0 - sunDisk);
        vec3 sunShape = vec3(1.0, 0.97, 0.90) * (sunDisk * 3.2 + sunHalo * 0.9) * uSunIntensity;

        // 水中の減衰。弱めにしてクリアな見え方を優先する。
        float opticalPath = clamp((-cameraPosition.y) / max(dot(up, refrDir), 0.12), 0.0, 80.0);
        vec3 absorption = vec3(0.10, 0.04, 0.02);
        vec3 transmittance = exp(-absorption * opticalPath * 0.12);

        vec3 transmitted = skyRefract * transmittance;
        vec3 reflected = skyReflect * (0.08 + 0.50 * fresnel);

        // 水面の太陽グリントを鋭くする。
        float sunDot = max(dot(normal, sunDir), 0.0);
        float sunGlow = pow(sunDot, 24.0 / max(uSunSpread, 0.15)) * uSunIntensity;

        // わずかな揺らぎ模様。
        float caustic = sin(vWorldPos.x * 2.0 + uTime * 0.35) * sin(vWorldPos.z * 2.4 - uTime * 0.28);
        caustic = (caustic * 0.5 + 0.5) * 0.06 * uSunIntensity;

        vec3 color = transmitted + reflected;
        color += vec3(0.95, 0.98, 1.0) * sunGlow;
        color += sunShape;
        color += vec3(0.08, 0.20, 0.24) * caustic;

        // 最後に軽くコントラストを上げて眠い画を防ぐ。
        color = pow(max(color, vec3(0.0)), vec3(0.92));

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  })
);
water.rotation.x = -Math.PI / 2;
water.position.y = 0;
scene.add(water);

// UI 要素を取得する。
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

  const target = camera.position.clone().add(dir.multiplyScalar(6));
  camera.lookAt(target);
}

// スライダー変更をパラメーターとシェーダーへ反映する。
Object.keys(sliders).forEach((key) => {
  const input = sliders[key];
  if (!input) return;

  input.addEventListener("input", () => {
    const v = Number(input.value);
    params[key] = v;

    const uniformKey = `u${key[0].toUpperCase()}${key.slice(1)}`;
    if (uniforms[uniformKey]) {
      uniforms[uniformKey].value = v;
    }

    if (key === "cameraDistance" || key === "cameraPitch" || key === "cameraYaw") {
      updateCameraPose();
    }
  });
});
updateCameraPose();

// 画面サイズ変更時にレンダラーとカメラを更新する。
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", onResize);

// 毎フレーム、時刻ユニフォームを更新して描画する。
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  uniforms.uTime.value = clock.getElapsedTime();
  renderer.render(scene, camera);
}
animate();
