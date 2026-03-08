import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x031021);
scene.fog = new THREE.Fog(0x031021, 6, 18);

const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  60
);
camera.position.set(0, -2.6, 0.4);
camera.lookAt(0, 0.1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const params = {
  sunIntensity: 1.1,
  sunSpread: 1.2,
  waveHeight: 0.14,
  waveFrequency: 0.9,
  waveSpeed: 0.35,
  waveRandomness: 0.35,
  cameraDistance: 2.6,
  cameraPitch: 12,
  cameraYaw: 0,
};

// 波の向きと位相を固定乱数で作り、穏やかで自然なゆらぎを出す。
const waveDirs = [];
const wavePhase = [];
for (let i = 0; i < 4; i += 1) {
  const a = Math.random() * Math.PI * 2;
  waveDirs.push(new THREE.Vector2(Math.cos(a), Math.sin(a)));
  wavePhase.push(Math.random() * Math.PI * 2);
}

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

const water = new THREE.Mesh(
  new THREE.PlaneGeometry(26, 26, 220, 220),
  new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
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

        float e = 0.05;
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

      void main() {
        vec3 deep = vec3(0.02, 0.14, 0.27);
        vec3 shallow = vec3(0.12, 0.44, 0.62);

        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec3 normal = normalize(vNormalW);

        vec3 sunDir = normalize(vec3(0.15, 1.0, 0.25));
        float sunDot = max(dot(normal, sunDir), 0.0);
        float sunGlow = pow(sunDot, 6.0 / max(uSunSpread, 0.15)) * uSunIntensity;

        float rim = pow(1.0 - max(dot(viewDir, normal), 0.0), 2.4);

        float caustic =
          sin(vWorldPos.x * 2.0 + uTime * 0.35) *
          sin(vWorldPos.z * 2.4 - uTime * 0.28);
        caustic = (caustic * 0.5 + 0.5) * 0.18 * uSunIntensity;

        float blend = clamp(0.45 + vWave * 2.2 + rim * 0.6, 0.0, 1.0);
        vec3 color = mix(deep, shallow, blend);
        color += vec3(0.8, 0.95, 1.0) * sunGlow;
        color += vec3(0.15, 0.35, 0.4) * caustic;

        float alpha = clamp(0.84 + rim * 0.12, 0.0, 1.0);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  })
);
water.rotation.x = -Math.PI / 2;
water.position.y = 0;
scene.add(water);

const haze = new THREE.Mesh(
  new THREE.SphereGeometry(18, 24, 24),
  new THREE.MeshBasicMaterial({ color: 0x052241, side: THREE.BackSide, transparent: true, opacity: 0.33 })
);
scene.add(haze);

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

function updateCameraDistance() {
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
      updateCameraDistance();
    }
  });
});
updateCameraDistance();

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", onResize);

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  uniforms.uTime.value = clock.getElapsedTime();
  renderer.render(scene, camera);
}
animate();
