// Concentric "audio rings" rendered on a single screen-facing plane. Each ring
// maps to a frequency band sampled from the FFT texture, so the rings literally
// pulse outward with the spectrum. The plane lives on the bloom layer, so the
// bright ring crests glow via selective bloom.
export const ringsVertex = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const ringsFragment = /* glsl */ `
uniform float uTime;
uniform sampler2D uAudioTex; // 1D FFT data packed into a texture (width = bins)
uniform float uBass;
uniform vec3  uColorA;
uniform vec3  uColorB;
uniform float uRingCount;

varying vec2 vUv;

void main(){
  vec2 p = vUv - 0.5;
  float r = length(p) * 2.0;          // 0 at center -> 1 at edge
  float ang = atan(p.y, p.x);

  // Sample the spectrum by radius: inner rings = bass, outer = treble.
  float band = clamp(r, 0.0, 1.0);
  float amp = texture2D(uAudioTex, vec2(band, 0.5)).r;

  // Animated concentric rings whose crest sharpness rises with amplitude.
  float rings = abs(sin(r * uRingCount * 3.14159 - uTime * 1.5));
  float crest = pow(rings, mix(8.0, 1.5, amp));

  // Each ring's brightness is driven by its band's energy + a global bass kick.
  float energy = amp * (0.6 + 0.8 * uBass);
  float glow = crest * energy;

  // Subtle angular shimmer so rings aren't perfectly uniform.
  glow *= 0.85 + 0.15 * sin(ang * 12.0 + uTime * 2.0);

  // Fade the disc out at the rim and punch a hole in the very center.
  glow *= smoothstep(1.0, 0.6, r) * smoothstep(0.04, 0.12, r);

  vec3 color = mix(uColorA, uColorB, band) * glow * 2.2;
  gl_FragColor = vec4(color, glow);
}
`;
