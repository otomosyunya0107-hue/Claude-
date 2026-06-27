// Render shaders for the particle cloud. The vertex shader reads each
// particle's position from the GPGPU position texture (so the CPU never touches
// per-particle data) and the fragment shader draws a soft, additively-blended
// sprite tinted by speed and audio energy.
export const particlesVertex = /* glsl */ `
uniform sampler2D texturePosition;
uniform sampler2D textureVelocity;
uniform float uTime;
uniform float uSize;
uniform float uAudioTreble;
uniform float uPixelRatio;

attribute vec2 aReference; // texel coordinate of this particle in the GPGPU textures

varying float vSpeed;
varying float vLife;

void main(){
  vec4 posData = texture2D(texturePosition, aReference);
  vec4 velData = texture2D(textureVelocity, aReference);

  vSpeed = length(velData.xyz);
  vLife  = posData.w;

  vec4 mvPosition = modelViewMatrix * vec4(posData.xyz, 1.0);

  // Treble sparkle: high frequencies make particles flicker larger.
  float twinkle = 1.0 + uAudioTreble * 1.6 * (0.5 + 0.5 * sin(uTime * 30.0 + aReference.x * 100.0));
  float size = uSize * twinkle * uPixelRatio;

  // Perspective size attenuation, fade in/out over life at the edges.
  gl_PointSize = size * (45.0 / -mvPosition.z) * smoothstep(0.0, 0.15, vLife) * smoothstep(0.0, 0.15, 1.0 - vLife);
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const particlesFragment = /* glsl */ `
uniform vec3 uColorSlow;
uniform vec3 uColorFast;
uniform float uAudioMid;

varying float vSpeed;
varying float vLife;

void main(){
  // Round soft sprite.
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float alpha = smoothstep(0.5, 0.0, d);

  // Color ramps from cool (slow) to hot (fast); mids boost brightness so the
  // particles themselves participate in the selective-bloom glow on the beat.
  float t = clamp(vSpeed * 0.6, 0.0, 1.0);
  vec3 color = mix(uColorSlow, uColorFast, t);
  color *= 0.55 + uAudioMid * 0.6;

  // Core hot-spot pushes the brightest pixels above the bloom threshold.
  float core = smoothstep(0.18, 0.0, d);
  color += core * t * 0.5;

  // Keep individual sprites dim; brightness comes from additive accumulation
  // and selective bloom, not from each particle being blown out.
  gl_FragColor = vec4(color, alpha * 0.32);
}
`;
