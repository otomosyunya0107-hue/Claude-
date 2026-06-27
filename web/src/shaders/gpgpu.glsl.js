import { noiseChunk } from './noise.glsl.js';

// --- Velocity integration shader -------------------------------------------
// Each texel is one particle's velocity (rgb) + a per-particle "life" seed (a).
// We push velocity toward the local curl-noise flow field, add a gentle pull
// back toward an audio-reactive sphere shell, and apply damping. Audio bass
// energy speeds the flow up so the swarm "breathes" with the music.
export const velocityFragment = /* glsl */ `
${noiseChunk}

uniform float uTime;
uniform float uDelta;
uniform float uNoiseScale;   // spatial frequency of the flow field
uniform float uNoiseSpeed;   // how fast the field evolves
uniform float uFlowStrength; // base curl force
uniform float uDamping;      // velocity retention per step
uniform float uAudioBass;    // 0..1 low-band energy
uniform float uAudioMid;     // 0..1 mid-band energy
uniform float uRadius;       // target shell radius
uniform vec3  uAttractor;    // pointer-driven attractor in world space

void main(){
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 posData = texture2D(texturePosition, uv);
  vec4 velData = texture2D(textureVelocity, uv);

  vec3 pos = posData.xyz;
  vec3 vel = velData.xyz;
  float seed = velData.w;

  // Organic flow: sample curl noise, animated through the 4th dimension via time.
  vec3 samplePos = pos * uNoiseScale + vec3(0.0, 0.0, uTime * uNoiseSpeed);
  vec3 flow = curlNoise(samplePos);

  // Music makes the flow stronger and the curl tighter on the beat.
  float beat = 1.0 + uAudioBass * 1.4;
  vel += flow * uFlowStrength * beat * uDelta;

  // Soft containment: keep the swarm around a shell whose radius pulses to mids.
  float targetR = uRadius * (1.0 + uAudioMid * 0.35);
  float dist = length(pos);
  vec3 toShell = (dist > 0.0001) ? normalize(pos) * (targetR - dist) : vec3(0.0);
  vel += toShell * 0.9 * uDelta;

  // Pointer attractor adds interactivity.
  vec3 toAtt = uAttractor - pos;
  float attLen = length(toAtt);
  if (attLen > 0.001) {
    vel += normalize(toAtt) * (1.5 / (1.0 + attLen * attLen)) * uDelta * 6.0;
  }

  vel *= uDamping;

  // Bound the speed so transients (or float quirks on weak GPUs) can never let
  // the swarm explode across the screen.
  float sp = length(vel);
  float maxSp = 5.0;
  if (sp > maxSp) vel *= maxSp / sp;

  gl_FragColor = vec4(vel, seed);
}
`;

// --- Position integration shader -------------------------------------------
// Advances position by velocity. Particles are slowly "recycled": when their
// life seed cycles past 1.0 they respawn near the origin so the cloud keeps
// regenerating detail instead of diffusing away.
export const positionFragment = /* glsl */ `
${noiseChunk}

uniform float uTime;
uniform float uDelta;
uniform float uRadius;
uniform float uAudioBass;

void main(){
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 posData = texture2D(texturePosition, uv);
  vec4 velData = texture2D(textureVelocity, uv);

  vec3 pos = posData.xyz;
  float life = posData.w;

  pos += velData.xyz * uDelta;

  // Advance life; faster on the beat so respawns sync loosely to the music.
  life -= uDelta * (0.06 + uAudioBass * 0.15);

  if (life <= 0.0) {
    // Respawn on a noisy shell so reborn particles re-seed the flow.
    float a = snoise(vec3(uv * 50.0, uTime)) * 6.2831853;
    float b = snoise(vec3(uv * 50.0 + 33.0, uTime)) * 3.1415926;
    float r = uRadius * (0.2 + 0.3 * fract(snoise(vec3(uv * 17.0, uTime)) * 43.0));
    pos = vec3(sin(b) * cos(a), sin(b) * sin(a), cos(b)) * r;
    life = 1.0;
  }

  // Hard clamp keeps the cloud bounded even if integration overshoots.
  pos = clamp(pos, vec3(-uRadius * 2.5), vec3(uRadius * 2.5));

  gl_FragColor = vec4(pos, life);
}
`;
