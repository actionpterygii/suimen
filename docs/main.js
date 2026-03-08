import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";

// 3D空間を作成し、背景色を設定する。
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f172a);

// カメラの視野角・アスペクト比・描画範囲を設定する。
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 3;

// WebGLレンダラーを作成し、キャンバスをDOMに追加する。
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// 立方体メッシュを生成してシーンに追加する。
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0x38bdf8 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// 陰影を出すためのライトを追加する。
const light = new THREE.DirectionalLight(0xffffff, 1.4);
light.position.set(2, 2, 3);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.5));

function onResize() {
  // 画面サイズ変更時にカメラと描画サイズを更新する。
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// リサイズイベントを監視する。
window.addEventListener("resize", onResize);

function animate() {
  // 次フレームを予約してループさせる。
  requestAnimationFrame(animate);
  // 毎フレーム回転量を加算する。
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.015;
  // 現在のシーンを描画する。
  renderer.render(scene, camera);
}

// アニメーションを開始する。
animate();
