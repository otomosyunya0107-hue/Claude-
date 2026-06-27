import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import { velocityFragment, positionFragment } from './shaders/gpgpu.glsl.js';
import { particlesVertex, particlesFragment } from './shaders/particles.glsl.js';

// GPGPU particle swarm. All per-particle state lives in floating-point textures
// updated entirely on the GPU each frame; the CPU only updates a handful of
// uniforms. This is what lets thousands of particles run at 60fps on a phone.
export class GPUParticles {
  // `size` is the side length of the square data texture; particle count = size^2.
  constructor(renderer, { size = 128, radius = 6, color = 0x66ccff, fastColor = 0xff4488 } = {}) {
    this.size = size;
    this.count = size * size;
    this.radius = radius;
    this.renderer = renderer;

    this.gpu = new GPUComputationRenderer(size, size, renderer);

    // GPUComputationRenderer falls back to byte textures on devices without
    // float-RTT support; clamp gracefully if so (motion is coarser but runs).
    if (!renderer.capabilities.isWebGL2 && !renderer.extensions.has('OES_texture_float')) {
      console.warn('Float textures unavailable; GPGPU may be limited on this device.');
    }

    const pos = this.gpu.createTexture();
    const vel = this.gpu.createTexture();
    this._seed(pos, vel);

    this.posVar = this.gpu.addVariable('texturePosition', positionFragment, pos);
    this.velVar = this.gpu.addVariable('textureVelocity', velocityFragment, vel);
    this.gpu.setVariableDependencies(this.posVar, [this.posVar, this.velVar]);
    this.gpu.setVariableDependencies(this.velVar, [this.posVar, this.velVar]);

    Object.assign(this.posVar.material.uniforms, {
      uTime: { value: 0 }, uDelta: { value: 0 },
      uRadius: { value: radius }, uAudioBass: { value: 0 },
    });
    Object.assign(this.velVar.material.uniforms, {
      uTime: { value: 0 }, uDelta: { value: 0 },
      uNoiseScale: { value: 0.18 }, uNoiseSpeed: { value: 0.25 },
      uFlowStrength: { value: 1.6 }, uDamping: { value: 0.94 },
      uAudioBass: { value: 0 }, uAudioMid: { value: 0 },
      uRadius: { value: radius }, uAttractor: { value: new THREE.Vector3(0, 0, 0) },
    });

    // Wrap noise sampling so curl flow tiles seamlessly.
    this.posVar.wrapS = this.posVar.wrapT = THREE.RepeatWrapping;
    this.velVar.wrapS = this.velVar.wrapT = THREE.RepeatWrapping;

    const err = this.gpu.init();
    if (err !== null) console.error('GPUComputationRenderer:', err);

    this.points = this._buildPoints(color, fastColor);
  }

  _seed(posTex, velTex) {
    const p = posTex.image.data;
    const v = velTex.image.data;
    for (let i = 0; i < this.count; i++) {
      const i4 = i * 4;
      // Random point in a ball of `radius`.
      const r = this.radius * Math.cbrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      p[i4 + 0] = r * Math.sin(phi) * Math.cos(theta);
      p[i4 + 1] = r * Math.sin(phi) * Math.sin(theta);
      p[i4 + 2] = r * Math.cos(phi);
      p[i4 + 3] = Math.random();          // life
      v[i4 + 0] = 0; v[i4 + 1] = 0; v[i4 + 2] = 0;
      v[i4 + 3] = Math.random();          // per-particle seed
    }
  }

  _buildPoints(color, fastColor) {
    const geom = new THREE.BufferGeometry();
    // Each vertex stores only its texel reference into the GPGPU textures.
    const refs = new Float32Array(this.count * 2);
    const positions = new Float32Array(this.count * 3); // dummy; real pos in shader
    for (let i = 0; i < this.count; i++) {
      refs[i * 2 + 0] = (i % this.size) / this.size;
      refs[i * 2 + 1] = Math.floor(i / this.size) / this.size;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('aReference', new THREE.BufferAttribute(refs, 2));
    geom.setDrawRange(0, this.count);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        texturePosition: { value: null },
        textureVelocity: { value: null },
        uTime: { value: 0 },
        uSize: { value: 1.6 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uAudioTreble: { value: 0 },
        uAudioMid: { value: 0 },
        uColorSlow: { value: new THREE.Color(color) },
        uColorFast: { value: new THREE.Color(fastColor) },
      },
      vertexShader: particlesVertex,
      fragmentShader: particlesFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geom, this.material);
    points.frustumCulled = false;
    return points;
  }

  update(time, delta, audio, attractor) {
    const d = Math.min(delta, 1 / 30); // clamp to avoid blowups after stalls
    // Feed audio + time into the compute passes.
    const vu = this.velVar.material.uniforms;
    const pu = this.posVar.material.uniforms;
    vu.uTime.value = pu.uTime.value = time;
    vu.uDelta.value = pu.uDelta.value = d;
    vu.uAudioBass.value = pu.uAudioBass.value = audio.bass;
    vu.uAudioMid.value = audio.mid;
    if (attractor) vu.uAttractor.value.copy(attractor);

    this.gpu.compute();

    this.material.uniforms.texturePosition.value =
      this.gpu.getCurrentRenderTarget(this.posVar).texture;
    this.material.uniforms.textureVelocity.value =
      this.gpu.getCurrentRenderTarget(this.velVar).texture;
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uAudioTreble.value = audio.treble;
    this.material.uniforms.uAudioMid.value = audio.mid;
  }
}
