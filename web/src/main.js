import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { gsap } from 'gsap';
import Lenis from 'lenis';

import { GPUParticles } from './GPUParticles.js';
import { AudioAnalyser } from './AudioAnalyser.js';
import { ringsVertex, ringsFragment } from './shaders/rings.glsl.js';

// Objects on this layer are the only ones that glow (selective bloom).
const BLOOM_LAYER = 1;
const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_LAYER);

// ---------------------------------------------------------------------------
// Renderer / scene / camera
// ---------------------------------------------------------------------------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
// Cap DPR: the single biggest 60fps-on-mobile lever.
const DPR = Math.min(window.devicePixelRatio, 2);
renderer.setPixelRatio(DPR);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060a);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 0, 16);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 8;
controls.maxDistance = 40;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.4;

// ---------------------------------------------------------------------------
// Adaptive particle budget — scale texture size to the device.
// ---------------------------------------------------------------------------
const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
const gpuSize = isMobile ? 96 : 256;            // 9,216 vs 65,536 particles
const audio = new AudioAnalyser();

const particles = new GPUParticles(renderer, {
  size: gpuSize,
  radius: 6.5,
  color: 0x2e7dff,
  fastColor: 0xff3d7f,
});
particles.points.layers.enable(BLOOM_LAYER);
scene.add(particles.points);

// ---------------------------------------------------------------------------
// Audio-reactive rings (on the bloom layer so crests glow).
// ---------------------------------------------------------------------------
const ringsMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uAudioTex: { value: audio.texture },
    uBass: { value: 0 },
    uColorA: { value: new THREE.Color(0x00e5ff) },
    uColorB: { value: new THREE.Color(0xff2d95) },
    uRingCount: { value: 9 },
  },
  vertexShader: ringsVertex,
  fragmentShader: ringsFragment,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
});
const rings = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), ringsMat);
rings.position.z = -6;
rings.layers.enable(BLOOM_LAYER);
scene.add(rings);

// ---------------------------------------------------------------------------
// Non-blooming background starfield — demonstrates that bloom is *selective*.
// ---------------------------------------------------------------------------
const starGeo = new THREE.BufferGeometry();
const starN = 1200;
const starPos = new Float32Array(starN * 3);
for (let i = 0; i < starN; i++) {
  const r = 40 + Math.random() * 50;
  const t = Math.random() * Math.PI * 2;
  const p = Math.acos(2 * Math.random() - 1);
  starPos[i * 3 + 0] = r * Math.sin(p) * Math.cos(t);
  starPos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t);
  starPos[i * 3 + 2] = r * Math.cos(p);
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x334466, size: 0.15, sizeAttenuation: true }));
scene.add(stars); // NOT on the bloom layer → stays dim

// Debug/customisation toggles via URL query, e.g. ?norings or ?noparticles.
const params = new URLSearchParams(location.search);
if (params.has('norings')) rings.visible = false;
if (params.has('noparticles')) particles.points.visible = false;

// ---------------------------------------------------------------------------
// Selective bloom pipeline (two-pass: darken non-bloom → bloom → composite).
// ---------------------------------------------------------------------------
const renderScene = new RenderPass(scene, camera);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.6,   // strength
  0.6,   // radius
  0.15   // threshold (extra guard; selectivity also done via layers)
);

// GSAP animates this base; the render loop adds scroll + audio on top of it.
const bloomState = { base: 0.6 };

const bloomComposer = new EffectComposer(renderer);
bloomComposer.renderToScreen = false;
bloomComposer.addPass(renderScene);
bloomComposer.addPass(bloomPass);

const mixPass = new ShaderPass(
  new THREE.ShaderMaterial({
    uniforms: {
      baseTexture: { value: null },
      bloomTexture: { value: bloomComposer.renderTarget2.texture },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D baseTexture;
      uniform sampler2D bloomTexture;
      varying vec2 vUv;
      void main(){
        gl_FragColor = texture2D(baseTexture, vUv) + vec4(1.0) * texture2D(bloomTexture, vUv);
      }
    `,
    defines: {},
  }),
  'baseTexture'
);
mixPass.needsSwap = true;

const finalComposer = new EffectComposer(renderer);
finalComposer.addPass(renderScene);
finalComposer.addPass(mixPass);
finalComposer.addPass(new OutputPass());

// Darken everything not on the bloom layer, render bloom, then restore.
const darkMaterial = new THREE.MeshBasicMaterial({ color: 'black' });
const matCache = {};
function darkenNonBloomed(obj) {
  if (obj.isMesh || obj.isPoints) {
    if (!bloomLayer.test(obj.layers)) {
      matCache[obj.uuid] = obj.material;
      obj.material = darkMaterial;
    }
  }
}
function restoreMaterial(obj) {
  if (matCache[obj.uuid]) {
    obj.material = matCache[obj.uuid];
    delete matCache[obj.uuid];
  }
}

// ---------------------------------------------------------------------------
// Lenis smooth scroll → drives a "journey" parameter (camera dolly + intensity)
// ---------------------------------------------------------------------------
const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
let scrollProgress = 0;
lenis.on('scroll', ({ progress }) => { scrollProgress = progress || 0; });
function raf(t) { lenis.raf(t); requestAnimationFrame(raf); }
requestAnimationFrame(raf);

// ---------------------------------------------------------------------------
// Pointer attractor (raycast onto a plane at z=0)
// ---------------------------------------------------------------------------
const attractor = new THREE.Vector3();
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
window.addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  raycaster.ray.intersectPlane(plane, attractor);
});

// ---------------------------------------------------------------------------
// UI: start audio (file / mic / demo) — Web Audio needs a user gesture.
// ---------------------------------------------------------------------------
const ui = document.getElementById('ui');
document.getElementById('btn-demo').addEventListener('click', () => { hideUI(); });
document.getElementById('btn-mic').addEventListener('click', async () => {
  try { await audio.useMicrophone(); hideUI(); }
  catch (e) { alert('Microphone unavailable: ' + e.message); }
});
document.getElementById('file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  await audio.playElement(URL.createObjectURL(file));
  hideUI();
});
function hideUI() {
  gsap.to(ui, { opacity: 0, duration: 0.8, onComplete: () => { ui.style.display = 'none'; } });
  // GSAP intro: bloom + camera flourish on entry.
  gsap.fromTo(bloomState, { base: 0 }, { base: 0.6, duration: 2.0, ease: 'power2.out' });
  gsap.fromTo(camera.position, { z: 34 }, { z: 16, duration: 2.4, ease: 'power3.out' });
  gsap.fromTo(particles.material.uniforms.uSize, { value: 0 }, { value: 1.6, duration: 2.0, ease: 'power2.out' });
}

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------
window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  bloomComposer.setSize(w, h);
  finalComposer.setSize(w, h);
});

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  audio.update(time);
  controls.update();

  // Scroll journey: ease the camera in/out and modulate bloom + flow.
  controls.autoRotateSpeed = 0.4 + scrollProgress * 1.6;
  bloomPass.strength = bloomState.base + scrollProgress * 0.5 + audio.bass * 0.4;

  // Drive the swarm + rings from audio.
  particles.update(time, delta, audio, attractor);
  ringsMat.uniforms.uTime.value = time;
  ringsMat.uniforms.uBass.value = audio.bass;
  rings.rotation.z = time * 0.05;

  // Pass 1: bloom only the glowing layer.
  scene.traverse(darkenNonBloomed);
  const prevBg = scene.background;
  scene.background = null;
  bloomComposer.render();
  scene.background = prevBg;
  scene.traverse(restoreMaterial);

  // Pass 2: composite bloom over the full-color scene.
  finalComposer.render();
}
animate();
