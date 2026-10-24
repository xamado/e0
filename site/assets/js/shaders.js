// Shaders for the Event Zero background: a Lorenz attractor simulated on the GPU
// (WebGL2 / GLSL ES 3.00).
//
// Passes, in order: backdrop (palette gradient + optional grid) → simulation step
// (position/velocity ping-pong textures) → points into a fading trail buffer →
// composite trails over the backdrop → post (upscale, grain) to the screen.

(() => {
  // Fullscreen triangle
  const fullscreenVS = /* glsl */ `#version 300 es
void main(){ vec2 p = vec2(gl_VertexID == 1 ? 3. : -1., gl_VertexID == 2 ? 3. : -1.); gl_Position = vec4(p, 0., 1.); }`;

  // ── Backdrop: palette gradient, grid overlay, sub-screen dimming, vignette ──
  const backdropFS = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 R; uniform float V, uGrid;
uniform vec3 uTop, uMid, uHor, uSunCol;
out vec4 O;
float gridLine(vec2 q){ vec2 g = abs(fract(q - .5) - .5) / max(fwidth(q), vec2(1e-4)); return 1. - clamp(min(g.x, g.y), 0., 1.); }
void main(){
  vec2 uv = gl_FragCoord.xy / R;
  float y = uv.y + V * .18;
  float grid = gridLine(vec2(uv.x * R.x / R.y, y) * 10.);
  vec3 c = mix(uHor, uMid, smoothstep(0., .55, y));
  c = mix(c, uTop, smoothstep(.4, 1.05, y));
  c = c * c * .45;
  c = mix(c, uSunCol, grid * uGrid);                                     // uGrid = grid opacity (0 = off)
  float l = dot(c, vec3(.299, .587, .114));
  c = mix(c, mix(vec3(l), c, .7) * vec3(.85, .8, 1.), V * .6);           // sub-screens: desaturate and cool
  c *= 1. - V * .35;
  c *= 1. - .35 * pow(length(uv - .5) * 1.2, 2.);
  O = vec4(c, 1.);
}`;

  // ── Simulation: one texel per particle, position.xyz / velocity.xyz ──
  // Lorenz (1963): dx = σ(y − x), dy = x(ρ − z) − y, dz = xy − βz, with σ = 10, ρ = 28, β = 8/3.
  const simFS = /* glsl */ `#version 300 es
precision highp float;
uniform highp sampler2D uPos, uVel;
uniform int uReset, uN;
uniform float uDt, uT, uImpulse;
layout(location = 0) out vec4 oPos;
layout(location = 1) out vec4 oVel;
const vec3 CENTER = vec3(0., 0., 25.);
const float EXTENT = 45., RATE = .3;
float hs(float n){ return fract(sin(n) * 43758.5453123); }
vec3 h3(float n){ return vec3(hs(n * .1031 + 1.3), hs(n * .1173 + 7.9), hs(n * .0937 + 3.7)); }
vec3 lorenz(vec3 p){ return vec3(10. * (p.y - p.x), p.x * (28. - p.z) - p.y, p.x * p.y - 8. / 3. * p.z); }
vec3 rk2(vec3 p, float h){ vec3 k1 = lorenz(p); return p + lorenz(p + k1 * h * .5) * h; }
void main(){
  ivec2 ij = ivec2(gl_FragCoord.xy);
  float id = float(ij.y * uN + ij.x);
  vec3 p = texelFetch(uPos, ij, 0).xyz;
  vec3 h = h3(id);
  if (uReset == 1) {
    // Seed near the attractor, then advance a random amount so particles start spread along it
    p = CENTER + (h - .5) * EXTENT * .3;
    for (int i = 0; i < 400; i++) { if (float(i) > h.x * 400.) break; p = rk2(p, .01); }
  }
  float hs2 = uDt * RATE * .5;
  vec3 q = rk2(rk2(p, hs2), hs2);
  vec3 v = (q - p) / max(uDt, 1e-4);
  p = q + (h - .5) * EXTENT * .25 * uImpulse;          // burst when the menu selection changes
  // Re-seed particles that blew up, escaped, or got trapped on the equilibrium at the origin
  // (once x = y = 0, which GPUs reach by flushing denormals to zero, it never moves again).
  bool stuck = length(lorenz(p)) < EXTENT * .01;
  if (any(isnan(p)) || length(p - CENTER) > EXTENT * 1.5 || stuck) p = CENTER + (h3(id + uT) - .5) * EXTENT * .2;
  oPos = vec4(p, 1.);
  oVel = vec4(v, 0.);
}`;

  // ── Points: orbit camera projection, colour by palette / speed / spectrum ──
  const pointsVS = /* glsl */ `#version 300 es
precision highp float;
uniform highp sampler2D uPos, uVel;
uniform int uN, uColor;
uniform mat3 uRot;
uniform float uAsp, uPx, uBright;
uniform vec2 uShift;
uniform vec3 uSunCol, uGlow, uFog, uHor, uMid;
out vec3 vCol;
const vec3 CENTER = vec3(0., 0., 25.);
const float SCALE = .042, CAM_DIST = 2.8, FOCAL = 1.5, SPEED_K = .012;
float hs(float n){ return fract(sin(n) * 43758.5453123); }
vec3 hue(float x){ return clamp(abs(fract(x + vec3(0., 2. / 3., 1. / 3.)) * 6. - 3.) - 1., 0., 1.); }
void main(){
  int id = gl_VertexID;
  ivec2 ij = ivec2(id % uN, id / uN);
  vec3 v = texelFetch(uVel, ij, 0).xyz;
  vec3 q = uRot * ((texelFetch(uPos, ij, 0).xyz - CENTER) * SCALE).xzy;   // swap so the attractor's z axis points up
  float z = q.z + CAM_DIST;
  float h = hs(float(id) * .1031 + 1.3);
  vec2 sp = q.xy * FOCAL / z + uShift;
  gl_Position = vec4(sp.x / uAsp, sp.y, 0., 1.);
  gl_PointSize = uPx * clamp(CAM_DIST / z, .4, 3.) * (.8 + h * .6);
  float depth = clamp((z - CAM_DIST + 1.) / 2., 0., 1.);
  float spd = clamp(length(v) * SPEED_K, 0., 1.5);
  vec3 c;
  if (uColor == 1) c = mix(mix(uMid * 1.4, uHor, smoothstep(0., .5, spd)), mix(uSunCol, vec3(1.), .5), smoothstep(.45, 1., spd));
  else if (uColor == 2) c = hue(h * .2 + spd * .45 + depth * .2) * .9 + .1;
  else c = mix(uSunCol, mix(uGlow, uFog, .5), h) * (.65 + .6 * smoothstep(0., 1., spd));
  vCol = c * uBright * (1.15 - depth * .5);
}`;
  const pointsFS = /* glsl */ `#version 300 es
precision highp float;
in vec3 vCol; out vec4 O;
void main(){ float a = smoothstep(.5, .1, length(gl_PointCoord - .5)); O = vec4(vCol * a, 1.); }`;

  // ── Trails: fade the previous frame; composite adds them over the backdrop ──
  const trailFS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform float uDecay; uniform vec2 R;
out vec4 O;
void main(){ vec3 c = texture(uTex, gl_FragCoord.xy / R).rgb * uDecay; O = vec4(max(c - .001, 0.), 1.); }`;
  const compositeFS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform vec2 R;
out vec4 O;
void main(){ vec3 c = texture(uTex, gl_FragCoord.xy / R).rgb; O = vec4(1. - exp(-c * 1.3), 1.); }`;

  // ── Post: upscale to the screen, grain ──
  const postFS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform vec2 R; uniform float T;
out vec4 O;
float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec3 c = texture(uTex, gl_FragCoord.xy / R).rgb;
  c += (hh(gl_FragCoord.xy + fract(T) * 100.) - .5) * .03;
  O = vec4(c, 1.);
}`;

  window.E0_SHADERS = { fullscreenVS, backdropFS, simFS, pointsVS, pointsFS, trailFS, compositeFS, postFS };
})();
