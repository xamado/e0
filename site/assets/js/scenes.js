// Scene shaders for the Event Zero menu background (WebGL2 / GLSL ES 3.00).
//
// Every scene is a fragment shader that defines `vec3 scene(vec2 uv)` and fills the
// debug globals (gN normal, gZ depth 0..1, gCost 0..1, gWire 0..1) so the debug
// views work everywhere. COMMON is prepended to each one and `main` is appended.
// `scale` is the scene's base render resolution (expensive scenes render smaller
// and get upscaled; the engine scales this further when frames run long).

(() => {
  const COMMON = /* glsl */ `
precision highp float;
uniform vec2 R; uniform float T; uniform vec2 M; uniform float V; uniform int uDebug;
uniform vec3 uTop, uMid, uHor, uGlow, uFog, uFar, uNear, uSunCol, uSun;
uniform float uStars, uEmbers, uFogAmt, uRough, uAurora, uCloud;
out vec4 O;

vec3 gN = vec3(0., 0., 1.);
float gZ = 1., gCost = 0., gWire = 0.;

float h1(float x){ return fract(sin(x * 127.1) * 43758.5453); }
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float n1(float x){ float i = floor(x), f = fract(x); return mix(h1(i), h1(i + 1.), f * f * (3. - 2. * f)); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
float fbm1(float x){ float v = 0., a = .5; for (int i = 0; i < 5; i++){ v += a * n1(x); x *= 2.03; a *= .5; } return v; }
float fbm2(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++){ v += a * n2(p); p = p * 2.03 + 17.1; a *= .5; } return v; }
float fbm3(vec3 p){ float v = 0., a = .5; for (int i = 0; i < 4; i++){ v += a * n3(p); p = p * 2.02 + 11.7; a *= .5; } return v; }
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float gridLine(vec2 q){ vec2 g = abs(fract(q - .5) - .5) / max(fwidth(q), vec2(1e-4)); return 1. - clamp(min(g.x, g.y), 0., 1.); }
float hline(float d){ return 1. - clamp(abs(d) / max(fwidth(d), 1e-4) * .7, 0., 1.); }

// ── 2D sky for layered scenes. y already includes the camera tilt.
vec2 sunPos2(float asp){ return vec2(uSun.x * asp, uSun.y) + M * vec2(-.01, .005); }
vec3 sky2(vec2 uv, float y, float asp){
  vec2 p = vec2(uv.x * asp, y);
  vec3 col = mix(uHor, uMid, smoothstep(.32, .62, y));
  col = mix(col, uTop, smoothstep(.6, 1.05, y));
  col = mix(uGlow, col, smoothstep(.2, .42, y));
  vec2 sq = vec2(uv.x * asp, uv.y + V * .05) * 90.;
  vec2 sg = floor(sq);
  vec2 sf = fract(sq) - .5 - (vec2(h2(sg + 1.), h2(sg + 2.)) - .5) * .6;
  float s = h2(sg);
  col += step(1. - .008 * uStars, s) * smoothstep(.09, .0, length(sf)) * smoothstep(.5, .9, y) * (.6 + .4 * sin(T * 2. + s * 40.));
  float ax = p.x * 1.6 + T * .03;
  float curve = .74 + .06 * sin(ax * 2.1 + T * .2) + .05 * n1(ax * 3. + T * .1);
  float band = exp(-pow((y - curve) * 6., 2.)) + .5 * exp(-pow((y - curve - .08) * 4., 2.));
  float rays = .35 + .65 * n2(vec2(p.x * 16. + T * .5, y * 1.2));
  col += mix(vec3(.15, 1., .55), vec3(.75, .3, 1.), smoothstep(curve - .02, curve + .14, y)) * band * rays * uAurora * .5 * smoothstep(.45, .65, y);
  float d = length(p - sunPos2(asp));
  col += uSunCol * smoothstep(uSun.z, uSun.z - .005, d) * .9;
  col += mix(uSunCol, uHor, .5) * exp(-d * 5.) * .45;
  col += uSunCol * exp(-d * 18.) * .5;
  float cl = n2(vec2(p.x * 3. + T * .02, p.y * 14.)) * n2(vec2(p.x * 1.2 - T * .01, p.y * 5.));
  col = mix(col, mix(uFog, uGlow, .3), smoothstep(.25, .6, cl) * smoothstep(.45, .7, y) * smoothstep(1., .7, y) * .35 * uCloud);
  return col;
}

// ── 3D helpers. Camera convention: +z forward, +y up.
vec3 sunDir(){
  float az = (uSun.x - .5) * 1.4, el = (uSun.y - .36) * 1.2;
  return normalize(vec3(sin(az) * cos(el), sin(el), cos(az) * cos(el)));
}
vec3 sky3(vec3 rd){
  vec3 sd = sunDir();
  float y = rd.y;
  vec3 col = mix(uHor, uMid, smoothstep(0., .28, y));
  col = mix(col, uTop, smoothstep(.22, .8, y));
  col = mix(uGlow, col, smoothstep(-.03, .1, y));
  col = mix(col, uNear * .6 + uFog * .15, smoothstep(0., -.25, y));
  if (y > 0.) {
    vec2 sph = vec2(atan(rd.x, rd.z), asin(clamp(y, -1., 1.))) * 70.;
    vec2 sg = floor(sph), sf = fract(sph) - .5;
    float s = h2(sg);
    col += step(1. - .008 * uStars, s) * smoothstep(.12, 0., length(sf)) * smoothstep(.15, .5, y) * (.6 + .4 * sin(T * 2. + s * 40.));
    float ax = atan(rd.x, rd.z) * 2. + T * .03;
    float curve = .32 + .05 * sin(ax * 2.1 + T * .2) + .05 * n1(ax * 3. + T * .1);
    float band = exp(-pow((y - curve) * 7., 2.)) + .5 * exp(-pow((y - curve - .07) * 5., 2.));
    float rays = .35 + .65 * n2(vec2(ax * 10. + T * .5, y * 2.));
    col += mix(vec3(.15, 1., .55), vec3(.75, .3, 1.), smoothstep(curve - .02, curve + .12, y)) * band * rays * uAurora * .5;
    vec2 cp = rd.xz / (y + .08) * .9 + vec2(T * .02, T * .01);
    col = mix(col, mix(uFog, uGlow, .35), smoothstep(.45, .8, fbm2(cp)) * smoothstep(0., .12, y) * .55 * uCloud);
  }
  float sdot = max(dot(rd, sd), 0.);
  col += mix(uSunCol, uHor, .5) * pow(sdot, 8.) * .45;
  col += uSunCol * pow(sdot, 90.) * .5;
  float rad = uSun.z * .45;
  col += uSunCol * smoothstep(cos(rad), cos(rad * .94), sdot) * .9;
  return col;
}
vec3 haze(vec3 rd){
  vec3 sd = sunDir();
  float s = max(dot(normalize(vec3(rd.x, 0., rd.z) + 1e-5), normalize(vec3(sd.x, 0., sd.z) + 1e-5)), 0.);
  return mix(uHor, uGlow, .3) * .85 + mix(uSunCol, uHor, .5) * pow(s, 6.) * .35 * smoothstep(-.25, .1, sd.y);
}
mat3 camera(vec3 fw){ fw = normalize(fw); vec3 rt = normalize(cross(vec3(0, 1, 0), fw)); return mat3(rt, cross(fw, rt), fw); }

// Embers / fireflies drifting up (screen space)
vec3 embers(vec2 uv, float asp, float yMax){
  vec2 ep = vec2(uv.x * asp * 18., uv.y * 18. - T * .7);
  vec2 ec = floor(ep);
  float er = h2(ec);
  vec2 eo = vec2(h2(ec + 3.1), h2(ec + 7.7));
  float e = smoothstep(.06, 0., length(fract(ep) - eo)) * step(1. - .07 * uEmbers, er);
  return uSunCol * e * smoothstep(yMax, .1, uv.y) * (.5 + .5 * sin(T * 3. + er * 50.));
}

vec3 finish(vec3 col, vec2 uv){
  if (uDebug == 1) return mix(vec3(.03, .04, .07), vec3(.35, .95, 1.), clamp(gWire, 0., 1.));
  if (uDebug == 2) return normalize(gN) * .5 + .5;
  if (uDebug == 3) return vec3(pow(1. - clamp(gZ, 0., 1.), 1.6));
  if (uDebug == 4) return vec3(clamp(gCost, 0., 1.));
  float l = dot(col, vec3(.299, .587, .114));
  col = mix(col, mix(vec3(l), col, .7) * vec3(.85, .8, 1.), V * .6);
  col *= 1. - V * .35;
  col *= 1. - .35 * pow(length(uv - .5) * 1.2, 2.);
  return col;
}
`;

  const MAIN = /* glsl */ `
void main(){ vec2 uv = gl_FragCoord.xy / R; O = vec4(finish(scene(uv), uv), 1.); }
`;

  // ── Mountains: layered ridges with fog (the original v5 scene) ───────────
  const mountains = /* glsl */ `
float ridgeAt(float x, float fi, float depth){
  float r = .44 - depth * .07 + (fbm1(x) - .5) * (.16 + depth * .12) * uRough;
  return r + (1. - abs(n1(x * 3.1) * 2. - 1.)) * .015 * (1. + depth) * uRough;
}
vec3 scene(vec2 uv){
  float asp = R.x / R.y;
  float y = uv.y + V * .18;
  vec2 p = vec2(uv.x * asp, y);
  vec3 col = sky2(uv, y, asp);
  float cover = 0., wire = 0.;
  for (int i = 0; i < 6; i++){
    float fi = float(i), depth = fi / 5.;
    float ly = uv.y + V * (.16 + depth * .3);
    float x = p.x * (1.2 + fi * .55) + fi * 13.7 + T * (.004 + depth * .018) + M.x * (.02 + depth * .12) * 4.;
    float ridge = ridgeAt(x, fi, depth);
    vec3 lc = mix(uFar, uNear, pow(depth, .7));
    lc = mix(lc, uFog, (1. - depth) * .45);
    float m = smoothstep(ridge + .0015, ridge - .0015, ly);
    lc += uSunCol * smoothstep(.012, 0., ridge - ly) * (1. - depth) * .25;
    col = mix(col, lc, m);
    float fb = exp(-max(0., ly - (ridge - .06)) * 22.) * smoothstep(ridge + .02, ridge - .1, ly);
    float drift = n2(vec2(p.x * 2. - T * .03 * (1. + fi), ly * 8. + fi));
    col = mix(col, uFog * (.55 + .45 * (1. - depth)), min(1., fb * drift * .22 * (1. - depth * .5) * uFogAmt));
    wire = max(wire, hline(ly - ridge) * (.45 + .55 * depth));
    if (ly < ridge) {
      cover += 1.;
      float slope = (ridgeAt(x + .02, fi, depth) - ridge) / .02;
      gN = normalize(vec3(-slope * .5, 1., .7));
      gZ = .9 - depth * .75;
    }
  }
  col += embers(uv, asp, .65);
  gWire = max(wire, gridLine(p * 10.) * .12);
  gCost = cover / 6.;
  return col;
}
`;

  // ── Terrain: flight along a river canyon ─────────────────────────────────
  // The camera follows a huge circle (radius PATH_R) at a constant height, so world
  // coordinates stay small forever (no noise precision breakdown) and it never has to
  // climb. A valley is carved along that circle so the mountains rise on both sides.
  const terrain = /* glsl */ `
const mat2 RT = mat2(.8, -.6, .6, .8);
const float PATH_R = 70., CAM_Y = 1.35, WL = .05, FAR = 75.;
float tH(vec2 p){
  float h = 0., a = 1.;
  vec2 q = p * .09;
  for (int i = 0; i < 6; i++){ float n = 1. - abs(n2(q) * 2. - 1.); h += n * n * a; a *= .47; q = RT * q * 2.05; }
  h = (h * 2.4 - 1.) * uRough;
  // Valley along the flight path, its floor below the water line
  float valley = smoothstep(.7, 4.5, abs(length(p) - PATH_R));
  return mix(-.35 + h * .12, h, valley);
}
vec3 tNormal(vec2 p, float e){
  return normalize(vec3(tH(p - vec2(e, 0.)) - tH(p + vec2(e, 0.)), 2. * e, tH(p - vec2(0., e)) - tH(p + vec2(0., e))));
}
// Rock / grass / snow, darker and wetter just above the waterline
vec3 landColor(vec3 pos, vec3 n, float shadow){
  float hgt = pos.y;
  vec3 rock = mix(uNear * 1.8 + .03, uFar * .55, .35);
  vec3 grass = mix(rock, mix(uFar, uMid, .5) * .5, .5);
  vec3 alb = mix(rock, grass, smoothstep(.75, .9, n.y) * smoothstep(1.4, .6, hgt));
  alb = mix(alb, uGlow * .9, smoothstep(1.5, 1.9, hgt + n.y * .4) * smoothstep(.6, .8, n.y));
  alb *= mix(.55, 1., smoothstep(WL, WL + .15, hgt));
  vec3 amb = mix(uTop, uMid, .5) * (.35 + .25 * n.y);
  return alb * (uSunCol * max(dot(n, sunDir()), 0.) * shadow * 1.4 + amb);
}
vec3 fogged(vec3 col, vec3 rd, float t){ return mix(col, mix(uFog * .8, haze(rd), .5), 1. - exp(-t * .03 * uFogAmt)); }

vec3 scene(vec2 uv){
  float asp = R.x / R.y;
  vec2 p = (uv - .5) * vec2(asp, 1.);
  float ang = T * .022;
  vec3 ro = vec3(cos(ang) * PATH_R, CAM_Y, sin(ang) * PATH_R);
  vec3 tangent = vec3(-sin(ang), 0., cos(ang));
  vec3 rd = camera(tangent + vec3(0., -.14 + V * .45, 0.)) * normalize(vec3(p, 1.4));
  // The water is a flat plane, so intersect it exactly; the terrain march only has to
  // search up to that point (marching down to the water at grazing angles never arrives).
  float tWater = rd.y < -1e-4 ? (WL - ro.y) / rd.y : 1e9;
  float tMax = min(FAR, tWater);
  float t = .2, tPrev = .2, steps = 0.; bool hit = false; vec3 pos;
  for (int i = 0; i < 160; i++){
    pos = ro + rd * t;
    float d = pos.y - tH(pos.xz);
    if (d < .0015 * t){ hit = true; break; }
    tPrev = t;
    t += max(d * .4, .01 + t * .003); steps += 1.;
    if (t > tMax) break;
  }
  if (hit) {
    // Refine the terrain hit with a short bisection
    float lo = tPrev, hi = t;
    for (int k = 0; k < 6; k++){
      float mid = (lo + hi) * .5;
      vec3 q = ro + rd * mid;
      if (q.y - tH(q.xz) > 0.) lo = mid; else hi = mid;
    }
    t = hi; pos = ro + rd * t;
  } else if (tWater < 400.) {
    hit = true; t = tWater; pos = ro + rd * t;
  }
  vec3 sd = sunDir();
  vec3 col = sky3(rd);
  gCost = steps / 160.;
  if (hit) {
    float hgt = tH(pos.xz);
    vec3 n;
    if (t >= tWater - 1e-3 || hgt < WL + .001) {
      // Water: ripples, mountain reflections, shallows near the shore
      vec2 w = pos.xz * 1.5 + T * .4;
      n = normalize(vec3((n2(w) - .5) * .06, 1., (n2(w + 7.3) - .5) * .06));
      vec3 r = reflect(rd, n);
      vec3 refl = sky3(r);
      float rt = .05; bool rh = false; vec3 q;
      for (int k = 0; k < 64; k++){
        q = pos + r * rt;
        float dd = q.y - tH(q.xz);
        if (dd < .003 * rt + .002){ rh = true; break; }
        rt += max(dd * .5, .03 + rt * .01);
        if (rt > 40. || q.y > 4.) break;
      }
      if (rh) refl = fogged(landColor(vec3(q.x, tH(q.xz), q.z), tNormal(q.xz, .05 + rt * .002), .8), r, rt);
      float fr = .1 + .9 * pow(1. - max(dot(n, -rd), 0.), 4.);
      float depth = WL - hgt;
      vec3 deep = uNear * .6 + uTop * .2;
      vec3 shallow = mix(landColor(vec3(pos.x, hgt, pos.z), vec3(0., 1., 0.), 1.), uFog * .5, .4);
      vec3 body = mix(deep, shallow, exp(-depth * 9.));
      col = mix(body, refl, fr);
      col = mix(col, uGlow * .8, smoothstep(.035, 0., depth) * .3);   // faint foam line at the shore
    } else {
      n = tNormal(pos.xz, .02 + t * .0015);
      // Soft shadow against the same surface that is drawn
      float sh = 1., st = .15;
      for (int k = 0; k < 14; k++){
        vec3 q = pos + sd * st;
        float dd = q.y - tH(q.xz);
        sh = min(sh, 7. * dd / st);
        st += clamp(dd, .15, 1.);
        if (sh < 0. || st > 12.) break;
      }
      col = landColor(vec3(pos.x, hgt, pos.z), n, clamp(sh, 0., 1.));
    }
    gN = n; gZ = t / FAR;
    gWire = gridLine(pos.xz * 1.2);
    col = fogged(col, rd, t);
  }
  return col;
}
`;

  // ── Planet: orbit view with atmosphere, clouds, city lights and a sunrise ─
  const planet = /* glsl */ `
vec2 sphere(vec3 ro, vec3 rd, vec3 c, float r){
  vec3 oc = ro - c; float b = dot(oc, rd), h = b * b - dot(oc, oc) + r * r;
  if (h < 0.) return vec2(-1.); h = sqrt(h); return vec2(-b - h, -b + h);
}
vec3 scene(vec2 uv){
  float asp = R.x / R.y;
  vec2 p = (uv - .5) * vec2(asp, 1.);
  vec3 ro = vec3(0., 0., -2.6);
  vec3 rd = normalize(vec3(p + M * vec2(.04, .02), 1.6));
  rd.y += V * .1; rd = normalize(rd);
  vec3 C = vec3(0., -1.32, 0.);
  vec3 sd = normalize(vec3((uSun.x - .5) * 2., (uSun.y - .42) * 1.4, 1.3));
  // Background: stars, aurora-ish nebula, drifting debris
  vec3 col = mix(uTop * .5, uMid * .35, smoothstep(.6, -.2, p.y));
  vec2 sq = p * 110.; vec2 sg = floor(sq);
  float s = h2(sg);
  col += step(1. - .012 * max(uStars, .3), s) * smoothstep(.13, 0., length(fract(sq) - .5)) * (.6 + .4 * sin(T * 2. + s * 40.));
  col += mix(uMid, uHor, .5) * smoothstep(.55, .9, fbm2(p * 2.5 + vec2(T * .005, 0.))) * .25 * (uCloud * .5 + uAurora * .5);
  vec2 hit = sphere(ro, rd, C, 1.);
  vec2 atm = sphere(ro, rd, C, 1.07);
  gCost = .15;
  if (hit.x > 0.) {
    vec3 pos = ro + rd * hit.x, n = normalize(pos - C);
    vec3 q = n;
    q.xz = rot(T * .012) * q.xz;
    float land = smoothstep(.5, .53, fbm3(q * 2.6));
    float cl = smoothstep(.5, .72, fbm3(q * 4.5 + vec3(T * .01, 0., 0.)));
    vec3 ocean = mix(uTop, uMid, .45) * .55 + uFog * .05;
    vec3 ground = mix(uNear * 2. + .05, uFar * .7, .55 + .3 * n2(q.xy * 20.));
    vec3 alb = mix(ocean, ground, land);
    alb = mix(alb, uGlow * .95, cl * .85);
    float dif = dot(n, sd);
    float lit = smoothstep(-.08, .25, dif);
    col = alb * (uSunCol * max(dif, 0.) * 1.3 + uMid * .05);
    float spec = pow(max(dot(reflect(rd, n), sd), 0.), 40.) * (1. - land) * (1. - cl);
    col += uSunCol * spec * .6;
    // City lights on the night side
    vec2 cg = q.xy * 90. + q.z * 37.;
    float city = step(.82, h2(floor(cg))) * smoothstep(.45, .1, length(fract(cg) - .5)) * land * (1. - cl);
    col += mix(uSunCol, vec3(1., .75, .45), .5) * city * (1. - lit) * .9;
    float fres = pow(1. - max(dot(n, -rd), 0.), 3.);
    col += mix(uHor, uGlow, .4) * fres * smoothstep(-.3, .4, dif) * .8;
    gN = n; gZ = (hit.x - 1.) / 2.;
    vec2 ll = vec2(atan(q.z, q.x), asin(q.y)) * 6. / 3.1416;
    gWire = max(gridLine(ll), .4 * gridLine(ll * 3.)) * .9;
    gCost = .25 + .5 * (land + cl) * .5 + .25;
  }
  if (atm.x > 0.) {
    // Atmosphere glow: thicker toward the limb, lit on the sun side
    vec3 oc = ro - C; float b = dot(oc, rd);
    float dmin = sqrt(max(dot(oc, oc) - b * b, 0.));
    vec3 cp = ro + rd * max(-b, 0.);
    float a = smoothstep(1.07, 1., dmin);
    float l = clamp(dot(normalize(cp - C), sd) * 1.4 + .35, 0., 1.);
    vec3 ac = mix(uHor, uGlow, .3);
    col += ac * pow(a, hit.x > 0. ? 3. : 1.6) * l * (hit.x > 0. ? .5 : 1.1);
    gWire = max(gWire, hline(dmin - 1.) * .6);
  }
  // Sun, only if not behind the planet
  vec2 sunHit = sphere(ro, sd, C, 1.);
  float vis = sunHit.x > 0. ? 0. : 1.;
  float sdot = max(dot(rd, sd), 0.);
  if (hit.x < 0.) col += uSunCol * smoothstep(cos(uSun.z * .4), cos(uSun.z * .37), sdot) * vis;
  col += uSunCol * (pow(sdot, 12.) * .35 + pow(sdot, 200.) * 1.5) * mix(.35, 1., vis);
  // Lens ghosts
  vec2 ss = sd.xy / sd.z * 1.6 - M * vec2(.04, .02);
  for (int k = 1; k <= 3; k++){
    float fk = float(k);
    vec2 gp = ss * (-.35 * fk);
    float r = .03 + .025 * fk;
    col += mix(uSunCol, uHor, .5) * smoothstep(r, r * .7, length(p - gp)) * .05 * vis;
  }
  // Debris / satellites
  vec2 dp = p * vec2(9., 9.) + vec2(T * .05, 0.);
  vec2 dg = floor(dp);
  float dh = h2(dg + 13.);
  col += vec3(.9) * step(.985, dh) * smoothstep(.06, 0., length(fract(dp) - .5)) * (.5 + .5 * step(.5, fract(T * .7 + dh * 7.)));
  return col;
}
`;

  // ── Ocean: open water at the horizon with sun glitter ────────────────────
  const ocean = /* glsl */ `
float wv(vec2 p){
  float h = 0., a = .32, f = .35; vec2 d = vec2(1., .3);
  for (int i = 0; i < 6; i++){
    float ph = dot(normalize(d), p) * f + T * (.9 + float(i) * .3);
    float w = 1. - abs(sin(ph));
    h += a * w * w;
    d = rot(1.9) * d; a *= .55; f *= 1.75;
  }
  return (h - .3) * uRough;
}
vec3 scene(vec2 uv){
  float asp = R.x / R.y;
  vec2 p = (uv - .5) * vec2(asp, 1.);
  vec3 ro = vec3(0., 1.8, T * 1.2);
  vec3 rd = camera(vec3(M.x * .3, -.1 + V * .45 - M.y * .08, 1.)) * normalize(vec3(p, 1.4));
  vec3 sd = sunDir();
  vec3 col = sky3(rd);
  if (rd.y < 0.) {
    float t = 0., steps = 0.; vec3 pos;
    for (int i = 0; i < 80; i++){
      pos = ro + rd * t;
      float d = pos.y - wv(pos.xz);
      if (d < .002 * t + .001) break;
      t += max(d * .6, .01 * t + .02); steps += 1.;
      if (t > 90.) break;
    }
    t = min(t, 90.); pos = ro + rd * t;
    float e = .02 + t * .002;
    vec3 n = normalize(vec3(wv(pos.xz - vec2(e, 0.)) - wv(pos.xz + vec2(e, 0.)), 2. * e, wv(pos.xz - vec2(0., e)) - wv(pos.xz + vec2(0., e))));
    float fr = .02 + .98 * pow(1. - max(dot(n, -rd), 0.), 5.);
    vec3 body = mix(uNear * .8 + uTop * .25, mix(uMid, uFog, .5) * .6, clamp(pos.y * 1.2 + .3, 0., 1.)) * (.4 + .6 * max(dot(n, sd), 0.));
    vec3 c = mix(body, sky3(reflect(rd, n)), fr);
    c += uSunCol * pow(max(dot(reflect(rd, n), sd), 0.), 400.) * 12.;
    float foam = smoothstep(.35, .5, pos.y + (n2(pos.xz * 3.) - .5) * .2);
    c = mix(c, uGlow * .9, foam * .4);
    col = mix(c, haze(rd), 1. - exp(-t * .015 * uFogAmt));
    gN = n; gZ = t / 90.; gWire = gridLine(pos.xz * .8); gCost = steps / 80.;
  }
  return col;
}
`;

  // ── Backdrop for the particles: a plain palette gradient, nothing else ───
  const sky = /* glsl */ `
vec3 scene(vec2 uv){
  float asp = R.x / R.y, y = uv.y + V * .18;
  vec3 c = mix(uHor, uMid, smoothstep(0., .55, y));
  c = mix(c, uTop, smoothstep(.4, 1.05, y));
  gWire = gridLine(vec2(uv.x * asp, y) * 10.) * .1;
  return c * c * .45;
}
`;

  // ── Particles: GPU simulation ─────────────────────────────────────────────
  // State lives in two float textures (position.xyz + w, velocity.xyz + w), one
  // texel per particle, ping-ponged every frame. Styles:
  // 0 flow · 1 attractor · 2 galaxy · 4 shapes · 6 gravity waves · 7 swarm
  const simFS = /* glsl */ `#version 300 es
precision highp float;
uniform highp sampler2D uPos, uVel;
uniform int uStyle, uReset, uShape, uAttr, uN;
uniform float uDt, uT, uImpulse, uBurst, uAsp;
uniform vec2 uMouse;
layout(location = 0) out vec4 oPos;
layout(location = 1) out vec4 oVel;

float hs(float n){ return fract(sin(n) * 43758.5453123); }
vec3 h3(float n){ return vec3(hs(n * .1031 + 1.3), hs(n * .1173 + 7.9), hs(n * .0937 + 3.7)); }
float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
float psi(vec2 p, float t){ return vn(p + vec2(t, -t * .7)) + .5 * vn(p * 2.1 - vec2(t * 1.3, t)) + .25 * vn(p * 4.3 + t); }
// Curl of a scalar noise field: divergence-free, so particles swirl instead of bunching.
vec2 curl2(vec2 p, float t){
  const float e = .01;
  return vec2(psi(p + vec2(0, e), t) - psi(p - vec2(0, e), t), -(psi(p + vec2(e, 0), t) - psi(p - vec2(e, 0), t))) / (2. * e);
}
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// Strange attractors (continuous ODEs, so they leave smooth trails)
vec3 attr(vec3 p){
  if (uAttr == 0) return vec3(10. * (p.y - p.x), p.x * (28. - p.z) - p.y, p.x * p.y - 8. / 3. * p.z);              // Lorenz
  if (uAttr == 1) { const float a = .95, b = .7, c = .6, d = 3.5, e = .25, f = .1;                                    // Aizawa
    return vec3((p.z - b) * p.x - d * p.y, d * p.x + (p.z - b) * p.y, c + a * p.z - p.z * p.z * p.z / 3. - (p.x * p.x + p.y * p.y) * (1. + e * p.z) + f * p.z * p.x * p.x * p.x); }
  if (uAttr == 2) { const float b = .208186; return vec3(sin(p.y) - b * p.x, sin(p.z) - b * p.y, sin(p.x) - b * p.z); } // Thomas
  const float a = 1.89;                                                                                                // Halvorsen
  return vec3(-a * p.x - 4. * p.y - 4. * p.z - p.y * p.y, -a * p.y - 4. * p.z - 4. * p.x - p.z * p.z, -a * p.z - 4. * p.x - 4. * p.y - p.x * p.x);
}
float attrRate(){ return uAttr == 0 ? .3 : uAttr == 1 ? .8 : uAttr == 2 ? 2.2 : .3; }
vec3 attrCenter(){ return uAttr == 0 ? vec3(0., 0., 25.) : uAttr == 1 ? vec3(0., 0., .6) : uAttr == 2 ? vec3(0.) : vec3(-1.6); }
float attrExtent(){ return uAttr == 0 ? 45. : uAttr == 1 ? 3. : uAttr == 2 ? 8. : 15.; }
vec3 rk2(vec3 p, float h){ vec3 k1 = attr(p); return p + attr(p + k1 * h * .5) * h; }

// Morph targets for the shapes style
vec3 shapeT(int k, float id, vec3 h){
  float N = float(uN * uN);
  if (k == 0) { float y = 1. - 2. * (id + .5) / N; float r = sqrt(max(0., 1. - y * y)); float ph = id * 2.39996; return vec3(r * cos(ph), y, r * sin(ph)) * .8; }
  if (k == 1) { float u = h.x * 6.2832, v = h.y * 6.2832; return vec3((.62 + .24 * cos(v)) * cos(u), .24 * sin(v), (.62 + .24 * cos(v)) * sin(u)); }
  if (k == 2) { float f = floor(h.z * 6.); vec2 q = h.xy * 2. - 1.;
    vec3 c = f < 1. ? vec3(1, q) : f < 2. ? vec3(-1, q) : f < 3. ? vec3(q.x, 1, q.y) : f < 4. ? vec3(q.x, -1, q.y) : f < 5. ? vec3(q, 1) : vec3(q, -1);
    return c * .55; }
  if (k == 3) { float t = h.x * 2. - 1., a = t * 10.;
    if (h.z < .18) { float s = h.y * 2. - 1.; return vec3(cos(a) * .32 * s, t * .95, sin(a) * .32 * s); }
    float st = step(.5, h.y) * 3.1416; return vec3(cos(a + st) * .32, t * .95, sin(a + st) * .32) + (h3(id + 9.) - .5) * .02; }
  float t = h.x * 6.2832;
  return vec3(sin(t) + 2. * sin(2. * t), cos(t) - 2. * cos(2. * t), -sin(3. * t)) * .22 + (h3(id + 5.) - .5) * .07;
}

void main(){
  ivec2 ij = ivec2(gl_FragCoord.xy);
  float id = float(ij.y * uN + ij.x);
  vec4 P = texelFetch(uPos, ij, 0), Vv = texelFetch(uVel, ij, 0);
  vec3 p = P.xyz, v = Vv.xyz;
  float w = P.w, vw = Vv.w;
  vec3 h = h3(id);
  float dt = uDt;
  bool reset = uReset == 1;
  vec2 md = p.xy - uMouse;
  vec2 push = normalize(md + 1e-4) * exp(-dot(md, md) * 18.) * 2.5;

  if (uStyle == 0) {                       // ── Flow
    if (reset) { p = vec3((h.x * 2. - 1.) * uAsp, h.y * 2. - 1., 0.); v = vec3(0.); w = h.z * 8.; }
    vec2 f = curl2(p.xy * 1.1, uT * .04) * .1;
    v.xy = mix(v.xy, f, 1. - exp(-dt * 3.)) + push * dt;
    v.xy += normalize(p.xy + 1e-4) * uImpulse * (.5 + h.x);
    p.xy += v.xy * dt; w -= dt;
    if (w < 0. || abs(p.x) > uAsp * 1.1 || abs(p.y) > 1.1) {
      vec3 r = h3(id + floor(uT * 3.) * 13.7);
      p = vec3((r.x * 2. - 1.) * uAsp, r.y * 2. - 1., 0.); v = vec3(0.); w = 4. + r.z * 6.;
    }
  } else if (uStyle == 1) {                // ── Attractor
    vec3 c = attrCenter();
    if (reset) {
      p = c + (h - .5) * attrExtent() * .3;
      for (int i = 0; i < 400; i++) { if (float(i) > h.x * 400.) break; p = rk2(p, .01); }
      v = vec3(0.);
    }
    float hs2 = dt * attrRate() * .5;
    vec3 q = rk2(rk2(p, hs2), hs2);
    v = (q - p) / max(dt, 1e-4);
    p = q + (h - .5) * attrExtent() * .25 * uImpulse;
    if (any(isnan(p)) || length(p - c) > attrExtent() * 1.5) p = c + (h3(id + uT) - .5) * attrExtent() * .2;
  } else if (uStyle == 2) {                // ── Galaxy: stacked rotated ellipses keep the arms stable
    float a = .03 + pow(h.x, .7) * .95;
    if (reset) { w = h.y * 6.2832; vw = 0.; }
    vw = vw * exp(-dt * 1.5) + uImpulse * 3.;
    w += dt * .55 / (a + .2) * (1. + vw) * .25;
    vec2 e = rot(a * 3.6 + .3) * vec2(a * cos(w), a * .62 * sin(w));
    e += (h3(id + 2.).xy - .5) * .025 * a;
    float bulge = exp(-a * 6.);
    vec3 q = vec3(e.x, (h.z - .5) * (.05 + .25 * bulge) * (1.2 - a), e.y);
    v = reset ? vec3(0.) : (q - p) / max(dt, 1e-4);
    p = q;
  } else if (uStyle == 4) {                // ── Shapes: springs toward the current morph target
    vec3 tg = shapeT(uShape, id, h);
    if (reset) { p = tg + (h3(id + 1.) - .5) * 2.; v = vec3(0.); }
    tg += (h3(id + floor(uT * .5)) - .5) * .004;
    v += ((tg - p) * (5. + h.x * 3.) - v * 2.6) * dt;
    v += (h3(id + 4.) - .5) * 4. * uImpulse;
    p += v * dt;
  } else if (uStyle == 6) {                // ── Gravity waves: a binary black hole inspiral on a spacetime sheet
    // Chirp: time to merger tau drives separation (~tau^1/4) and orbital phase (~ -tau^5/8),
    // so the orbit speeds up as the pair spirals in. Waves carry the phase outward at speed C,
    // with the quadrupole (2θ) pattern that gives the spiral arms. Then merge, ring down, repeat.
    // 16 s cycle: ~13 s inspiral, merger, ~3 s ring-down. The renderer's clock starts at 20,
    // so offsetting by 18 makes every page load begin near the start of an inspiral.
    const float CYCLE = 16., TM = 13., C = 1.6, K = 4.6, TMIN = .15, OM_MAX = 5.86;
    vec2 g = (vec2(ij) + .5) / float(uN);
    vec2 xz = (g - .5) * 6.;
    float tc = mod(uT - 18., CYCLE), tau = TM - tc;
    float r = length(xz), th = atan(xz.y, xz.x);
    float wake = smoothstep(0., 1., tc);
    // Wells
    float y;
    if (tau > TMIN) {
      float ph = -K * pow(tau, .625), a = pow(tau / TM, .25);
      vec2 b1 = a * vec2(cos(ph), sin(ph));
      y = -.09 / sqrt(dot(xz - b1, xz - b1) + .03) - .09 / sqrt(dot(xz + b1, xz + b1) + .03);
    } else {
      y = -.17 / sqrt(r * r + .03 + .2 * exp(-(TMIN - tau) * 2.));
    }
    y *= wake;
    float glow = clamp(-y * .5, 0., 1.5);
    // Outgoing waves, evaluated at the retarded time
    float tr = tau + r / C, wave;
    if (tr > TMIN) {
      float om = .625 * K * pow(tr, -.375);
      wave = (.08 + .18 * pow(om / OM_MAX, .67)) * cos(2. * (th + K * pow(tr, .625)));
      wave *= smoothstep(TM + 1., TM - .5, tr);
    } else {
      float sd = TMIN - tr;
      wave = .24 * exp(-sd * 1.6) * cos(2. * (th + K * pow(TMIN, .625)) + sd * 9.);
    }
    wave *= 1.5 * smoothstep(.15, .7, r) / (1. + r * .9);
    y += wave;
    y += uBurst * .14 * sin(r * 7. - uT * 10.) * exp(-r * .4);
    vec3 q = vec3(xz.x, y - .25, xz.y);
    v = reset ? vec3(0.) : (q - p) / max(dt, 1e-4);
    p = q;
    // Brightness for the point shader: fade at the edge, light up crests and the wells
    w = smoothstep(3., 2.2, r) * (.35 + abs(wave) * 7. + glow * .9);
  } else {                                 // ── Swarm: streams following moving leaders
    // Each particle steers to its own slot orbiting a leader (so they can't all merge onto
    // one path) and hands over to another leader every so often, so the streams keep mixing.
    if (reset) { p = vec3((h.x * 2. - 1.) * uAsp, h.y * 2. - 1., 0.); v = vec3(0.); }
    float k = mod(id + floor(uT / 14. + h.x * 3.), 5.);
    vec2 L = vec2(sin(uT * .23 * (1. + k * .37) + k * 1.7) * .8 * uAsp, sin(uT * .31 * (1. + k * .29) + k * 2.9) * .7);
    float dir = h.y < .5 ? -1. : 1.;
    vec2 slot = L + rot(uT * (.25 + h.y * .5) * dir + h.z * 6.2832) * vec2(.05 + h.z * .4, 0.) * vec2(1.3, 1.);
    vec2 want = (slot - p.xy) * 1.8;
    float wl = length(want), mx = .7 + h.x * .5;
    if (wl > mx) want *= mx / wl;
    v.xy = mix(v.xy, want + curl2(p.xy * 1.6, uT * .08) * .05, 1. - exp(-dt * 1.4)) + push * dt;
    v.xy += (h.xy - .5) * 3. * uImpulse;
    p.xy += v.xy * dt;
  }
  oPos = vec4(p, w);
  oVel = vec4(v, vw);
}
`;

  // Draws one point per particle, projected per style (flat or orbit camera).
  const pointsVS = /* glsl */ `#version 300 es
precision highp float;
uniform highp sampler2D uPos, uVel;
uniform int uN, uMode, uColor, uDebug, uSwap, uFadeW;
uniform mat3 uRot; uniform vec3 uCenter;
uniform float uScale, uCamDist, uFocal, uAsp, uPx, uBright, uSpeedK;
uniform vec2 uShift;
uniform vec3 uSunCol, uGlow, uFog, uHor, uMid;
out vec3 vCol;
float hs(float n){ return fract(sin(n) * 43758.5453123); }
vec3 hue(float x){ return clamp(abs(fract(x + vec3(0., 2. / 3., 1. / 3.)) * 6. - 3.) - 1., 0., 1.); }
void main(){
  int id = gl_VertexID;
  ivec2 ij = ivec2(id % uN, id / uN);
  vec4 P = texelFetch(uPos, ij, 0);
  vec3 v = texelFetch(uVel, ij, 0).xyz;
  float h = hs(float(id) * .1031 + 1.3);
  vec2 sp; float size = 1., depth = .5;
  if (uMode == 0) sp = P.xy;
  else {
    vec3 q = (P.xyz - uCenter) * uScale;
    if (uSwap == 1) q = q.xzy;
    q = uRot * q;
    float z = q.z + uCamDist;
    if (z < .05) { gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 0.; vCol = vec3(0.); return; }
    sp = q.xy * uFocal / z;
    size = clamp((uCamDist > 0. ? uCamDist : 2.) / z, .4, 3.);
    depth = clamp(uCamDist > 0. ? (z - uCamDist + 1.) / 2. : z / 10., 0., 1.);
  }
  if (uMode != 0) sp += uShift;
  gl_Position = vec4(sp.x / uAsp, sp.y, 0., 1.);
  gl_PointSize = uPx * size * (.8 + h * .6);
  float spd = clamp(length(v) * uSpeedK, 0., 1.5);
  vec3 c;
  if (uColor == 1) c = mix(mix(uMid * 1.4, uHor, smoothstep(0., .5, spd)), mix(uSunCol, vec3(1.), .5), smoothstep(.45, 1., spd));
  else if (uColor == 2) c = hue(h * .2 + spd * .45 + depth * .2) * .9 + .1;
  else c = mix(uSunCol, mix(uGlow, uFog, .5), h) * (.65 + .6 * smoothstep(0., 1., spd));
  float b = uBright * (1.15 - depth * .5) * (uFadeW == 1 ? P.w : 1.);
  if (uDebug == 4) { c = vec3(.04); b = 1.; }
  else if (uDebug == 2) { c = normalize(v + 1e-5) * .5 + .5; b = .5; }
  else if (uDebug == 3) { c = vec3(1. - depth); b = .5; }
  else if (uDebug == 1) { c = vec3(.35, .95, 1.); b = .4; }
  vCol = c * b;
}
`;
  const pointsFS = /* glsl */ `#version 300 es
precision highp float;
in vec3 vCol; out vec4 O;
void main(){ float a = smoothstep(.5, .1, length(gl_PointCoord - .5)); O = vec4(vCol * a, 1.); }
`;
  // Fades the previous trail frame; composite adds the trails over the sky with a soft roll-off.
  const trailFS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform float uDecay; uniform vec2 R;
out vec4 O;
void main(){ vec3 c = texture(uTex, gl_FragCoord.xy / R).rgb * uDecay; O = vec4(max(c - .001, 0.), 1.); }
`;
  const compositeFS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform vec2 R; uniform int uDebug;
out vec4 O;
void main(){ vec3 c = texture(uTex, gl_FragCoord.xy / R).rgb; O = vec4(uDebug == 4 ? c : 1. - exp(-c * 1.3), 1.); }
`;

  // ── Post: crossfade, cost heat map, grain ────────────────────────────────
  const post = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D A, B; uniform float uMix; uniform int uDebug; uniform vec2 R; uniform float T;
out vec4 O;
float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 heat(float x){
  x = clamp(x, 0., 1.);
  return clamp(vec3(smoothstep(.3, .65, x) + smoothstep(.9, 1., x), smoothstep(.55, .9, x), smoothstep(0., .3, x) * (1. - smoothstep(.35, .6, x)) + smoothstep(.9, 1., x)), 0., 1.) * (.15 + .85 * smoothstep(0., .1, x)) + vec3(.02, .02, .06);
}
void main(){
  vec2 uv = gl_FragCoord.xy / R;
  vec3 c = mix(texture(B, uv).rgb, texture(A, uv).rgb, uMix);
  if (uDebug == 4) c = heat(c.r);
  if (uDebug == 0) c += (hh(gl_FragCoord.xy + fract(T) * 100.) - .5) * .03;
  O = vec4(c, 1.);
}
`;

  window.E0_SCENES = {
    COMMON, MAIN, post, simFS, pointsVS, pointsFS, trailFS, compositeFS,
    types: {
      mountains: { label: "Mountains", scale: 1, src: mountains },
      terrain:   { label: "Terrain",   scale: .75, src: terrain },
      planet:    { label: "Planet",    scale: .85, src: planet },
      ocean:     { label: "Ocean",     scale: .7, src: ocean },
      particles: { label: "Particles", scale: 1, src: sky, particles: true },
    },
  };
})();
