# Fluid GPU Particles · Audio-Reactive Bloom

A WebGL demo combining four advanced real-time techniques in one scene:

| Feature | How it's done |
| --- | --- |
| **流体粒子 (Fluid particles)** | Trajectories driven by **3D Simplex curl-noise** — divergence-free flow gives organic, swirling motion instead of random drift. See `src/shaders/noise.glsl.js` (`curlNoise`). |
| **GPGPU** | Thousands of particles updated entirely on the GPU via `GPUComputationRenderer`. Position/velocity live in float textures; the CPU only sets a few uniforms. Particle count scales with the device (96² ≈ 9k on mobile, 256² ≈ 65k on desktop) and DPR is capped at 2 to hold **60fps on phones**. See `src/GPUParticles.js`, `src/shaders/gpgpu.glsl.js`. |
| **音楽連動シェーダー (Music-reactive)** | Web Audio FFT → smoothed bass/mid/treble + a spectrum `DataTexture`. Concentric **rings pulse outward with the frequency bands**; bass drives the swarm's flow strength, mids pulse the containment shell, treble makes particles twinkle. See `src/AudioAnalyser.js`, `src/shaders/rings.glsl.js`. |
| **Selective bloom** | Two-pass layer-based bloom: non-bloom objects are blacked out, `UnrealBloomPass` renders the glow, then it's composited back over the full-color scene. Only the particles + rings glow; the background starfield stays dim. See `src/main.js`. |
| **Three.js + GSAP + Lenis** | GSAP animates the intro flourish (camera dolly, bloom ramp, particle grow-in). Lenis smooth-scroll drives a "journey" parameter (auto-rotate speed + bloom intensity). |

## Run it

No build step — it uses ES module import maps loaded from a CDN. Just serve the
folder over HTTP (modules and `<audio>` won't load from `file://`):

```bash
cd web
python3 -m http.server 8000
# open http://localhost:8000
```

Then pick **デモを見る** (synthesised beat, no audio needed), **マイク入力**
(microphone), or load your own audio file. Web Audio requires a user gesture,
which is why audio starts from a button.

## Controls

- **Drag** — orbit the camera
- **Scroll** — increase flow / bloom intensity (Lenis-smoothed)
- **Move pointer** — attract the particle swarm

## Files

```
web/
├── index.html              # import map, UI, canvas
├── src/
│   ├── main.js             # scene, selective-bloom pipeline, GSAP/Lenis, loop
│   ├── GPUParticles.js     # GPGPU swarm (GPUComputationRenderer)
│   ├── AudioAnalyser.js    # Web Audio FFT → bands + spectrum texture
│   └── shaders/
│       ├── noise.glsl.js   # simplex + curl-noise chunk
│       ├── gpgpu.glsl.js   # position/velocity compute shaders
│       ├── particles.glsl.js  # particle render shaders
│       └── rings.glsl.js   # audio-reactive ring shader
```
