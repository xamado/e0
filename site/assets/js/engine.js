// Event Zero background renderer (WebGL2).
//
// Each scene renders into an offscreen target at a reduced resolution, then a post
// pass upscales it to the screen, crossfades between scenes, applies the cost
// heat map and adds grain. Resolution adapts to frame time when autoRes is on.

(() => {
  const FSQ = `#version 300 es
void main(){ vec2 p = vec2(gl_VertexID == 1 ? 3. : -1., gl_VertexID == 2 ? 3. : -1.); gl_Position = vec4(p, 0., 1.); }`;
  const VEC = ["top", "mid", "hor", "glow", "fog", "far", "near", "sunCol", "sun"];
  const NUM = ["stars", "embers", "fogAmt", "rough", "aurora", "cloud"];
  const uName = (k) => "u" + k[0].toUpperCase() + k.slice(1);

  function createEngine(canvas) {
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" });
    if (!gl) return null;
    const S = window.E0_SCENES;

    // ── Programs ──────────────────────────────────────
    function compile(vsSrc, fsSrc, label) {
      const mk = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(`[${label}]`, gl.getShaderInfoLog(s));
        return s;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, mk(gl.VERTEX_SHADER, vsSrc));
      gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, fsSrc));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) console.error(`[${label}] link`, gl.getProgramInfoLog(prog));
      const cache = {};
      return { prog, u: (n) => (n in cache ? cache[n] : (cache[n] = gl.getUniformLocation(prog, n))) };
    }
    const progs = {};
    const sceneProg = (type) => progs[type] || (progs[type] = compile(FSQ, "#version 300 es\n" + S.COMMON + S.types[type].src + S.MAIN, type));
    const post = compile(FSQ, S.post, "post");

    // ── Render targets ────────────────────────────────
    function target() {
      const tex = gl.createTexture(), fb = gl.createFramebuffer();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return { tex, fb, w: 0, h: 0 };
    }
    function size(t, w, h) {
      if (t.w === w && t.h === h) return;
      t.w = w; t.h = h;
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
    }
    const targets = [target(), target()];

    // ── Particles: GPU simulation + trails ────────────
    // Float render targets are needed for the simulation state.
    const floatOK = !!gl.getExtension("EXT_color_buffer_float");
    const STYLES = {
      flow:      { id: 0, mode: 0, speedK: 5 },
      attractor: { id: 1, mode: 1, camDist: 2.8, focal: 1.5, pitch: .2 },
      galaxy:    { id: 2, mode: 1, camDist: 2.4, focal: 1.5, pitch: -.95, speedK: 2.5 },
      shapes:    { id: 4, mode: 1, camDist: 2.8, focal: 1.6, pitch: .3, speedK: .8 },
      gravity:   { id: 6, mode: 1, camDist: 4.2, focal: 1.6, pitch: -.58, speedK: 2.5, fadeW: 1 },
      swarm:     { id: 7, mode: 0, speedK: 1.2 },
    };
    // Per-attractor framing: centre, scale, swap y/z so the "up" axis is vertical, speed→colour
    const ATTR = [
      { center: [0, 0, 25], scale: .042, swap: 1, speedK: .012, yaw: .5 },  // yaw: face-on view of the wings
      { center: [0, 0, .6], scale: .5, swap: 1, speedK: .5 },
      { center: [0, 0, 0], scale: .2, swap: 0, speedK: 1.2 },
      { center: [-1.6, -1.6, -1.6], scale: .075, swap: 0, speedK: .06 },
    ];
    let sim = null, simProg = null, ptsProg = null, trailProg = null, compProg = null;
    const trails = [target(), target()];
    let trailCur = 0;
    let pcfg = { style: "flow", attr: 0, trail: .6, density: 256, color: 0, bright: 1, shape: 0 };
    let needReset = true;

    function floatTex(N) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, N, N, 0, gl.RGBA, gl.FLOAT, null);
      return t;
    }
    function simAlloc(N) {
      if (sim) for (const s of sim.bufs) { gl.deleteTexture(s.pos); gl.deleteTexture(s.vel); gl.deleteFramebuffer(s.fb); }
      const bufs = [0, 1].map(() => {
        const pos = floatTex(N), vel = floatTex(N), fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, pos, 0);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, vel, 0);
        return { pos, vel, fb };
      });
      sim = { N, bufs, cur: 0 };
      needReset = true;
    }
    function setParticles(cfg) {
      const prevStyle = pcfg.style, prevAttr = pcfg.attr;
      pcfg = Object.assign({}, pcfg, cfg);
      if (pcfg.style !== prevStyle || pcfg.attr !== prevAttr) needReset = true;
      if (sim && sim.N !== pcfg.density) simAlloc(pcfg.density);
    }
    function trailSize(t, w, h) {
      if (t.w === w && t.h === h) return false;
      t.w = w; t.h = h;
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      return true;
    }
    // Camera: a slow automatic sway around each style's best angle, never more than
    // ±25° (side views of the attractors look bad). No mouse rotation. Pitch eases when
    // switching styles so the angle change isn't a jump.
    const SWAY_MAX = 25 * Math.PI / 180;
    const cam = { pitch: null };
    function cameraAngles(st, o, baseYaw = 0) {
      const target = st.pitch || 0;
      const k = o.reduce || cam.pitch === null ? 1 : 1 - Math.exp(-Math.min(o.dt, .05) * 3);
      cam.pitch = cam.pitch === null ? target : cam.pitch + (target - cam.pitch) * k;
      const amp = Math.min(st.sway ?? SWAY_MAX, SWAY_MAX);
      const yaw = o.reduce ? 0 : amp * Math.sin(o.t * (st.swaySpeed || .12));
      return [baseYaw + yaw, cam.pitch];
    }
    function rotMat(yaw, pitch) {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      // R = Rx(pitch) · Ry(yaw), column-major for uniformMatrix3fv
      return new Float32Array([cy, sp * sy, -cp * sy, 0, cp, sp, sy, -sp * cy, cp * cy]);
    }

    function drawParticles(o, layer, w, h, scale) {
      if (!floatOK) return;
      if (!sim) simAlloc(pcfg.density);
      if (!simProg) {
        simProg = compile(FSQ, S.simFS, "sim");
        ptsProg = compile(S.pointsVS, S.pointsFS, "points");
        trailProg = compile(FSQ, S.trailFS, "trail");
        compProg = compile(FSQ, S.compositeFS, "composite");
      }
      const st = STYLES[pcfg.style] || STYLES.flow;
      const asp = canvas.width / canvas.height;

      // 1. Simulate
      const src = sim.bufs[sim.cur], dst = sim.bufs[1 - sim.cur];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      gl.viewport(0, 0, sim.N, sim.N);
      gl.useProgram(simProg.prog);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.pos);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, src.vel);
      gl.uniform1i(simProg.u("uPos"), 0); gl.uniform1i(simProg.u("uVel"), 1);
      gl.uniform1i(simProg.u("uStyle"), st.id);
      gl.uniform1i(simProg.u("uReset"), needReset ? 1 : 0);
      gl.uniform1i(simProg.u("uShape"), pcfg.shape % 5);
      gl.uniform1i(simProg.u("uAttr"), pcfg.attr);
      gl.uniform1i(simProg.u("uN"), sim.N);
      gl.uniform1f(simProg.u("uDt"), o.reduce ? 0 : Math.min(o.dt, 1 / 30));
      gl.uniform1f(simProg.u("uT"), o.t);
      gl.uniform1f(simProg.u("uImpulse"), needReset ? 0 : o.impulse);
      gl.uniform1f(simProg.u("uBurst"), o.burst);
      gl.uniform1f(simProg.u("uAsp"), asp);
      gl.uniform2f(simProg.u("uMouse"), o.mouse[0] * 2 * asp, -o.mouse[1] * 2);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
      sim.cur = 1 - sim.cur;
      needReset = false;

      // 2. Trails: fade last frame, then add this frame's points
      const resized = trailSize(trails[0], w, h) | trailSize(trails[1], w, h);
      const prevT = trails[trailCur], nextT = trails[1 - trailCur];
      gl.bindFramebuffer(gl.FRAMEBUFFER, nextT.fb);
      gl.viewport(0, 0, w, h);
      const decay = o.debug ? 0 : pcfg.trail * .97;
      if (decay > 0 && !resized) {
        gl.useProgram(trailProg.prog);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, prevT.tex);
        gl.uniform1i(trailProg.u("uTex"), 0);
        gl.uniform1f(trailProg.u("uDecay"), decay);
        gl.uniform2f(trailProg.u("R"), w, h);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      } else { gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }

      const cur = sim.bufs[sim.cur];
      gl.useProgram(ptsProg.prog);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, cur.pos);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, cur.vel);
      gl.uniform1i(ptsProg.u("uPos"), 0); gl.uniform1i(ptsProg.u("uVel"), 1);
      const at = ATTR[pcfg.attr] || ATTR[0];
      const isAttr = pcfg.style === "attractor";
      gl.uniform1i(ptsProg.u("uN"), sim.N);
      gl.uniform1i(ptsProg.u("uMode"), st.mode);
      gl.uniform1i(ptsProg.u("uColor"), pcfg.color);
      gl.uniform1i(ptsProg.u("uDebug"), o.debug);
      gl.uniform1i(ptsProg.u("uSwap"), isAttr ? at.swap : 0);
      gl.uniform1i(ptsProg.u("uFadeW"), st.fadeW || 0);
      gl.uniformMatrix3fv(ptsProg.u("uRot"), false, rotMat(...cameraAngles(st, o, isAttr ? at.yaw || 0 : 0)));
      gl.uniform3fv(ptsProg.u("uCenter"), isAttr ? at.center : [0, 0, 0]);
      gl.uniform1f(ptsProg.u("uScale"), isAttr ? at.scale : 1);
      gl.uniform1f(ptsProg.u("uCamDist"), st.camDist || 0);
      gl.uniform1f(ptsProg.u("uFocal"), st.focal || 1);
      gl.uniform2f(ptsProg.u("uShift"), o.shift || 0, 0);
      gl.uniform1f(ptsProg.u("uAsp"), asp);
      gl.uniform1f(ptsProg.u("uPx"), 1.5 * Math.max(scale, .5) * (canvas.width / Math.max(1, canvas.clientWidth)));
      // Keep overall brightness roughly constant across particle counts and trail lengths
      const count = sim.N * sim.N;
      gl.uniform1f(ptsProg.u("uBright"), 1.1 * pcfg.bright * Math.sqrt(65536 / count) * (1 - decay * .8));
      gl.uniform1f(ptsProg.u("uSpeedK"), isAttr ? at.speedK : st.speedK || 1);
      gl.uniform3fv(ptsProg.u("uSunCol"), o.palette.sunCol);
      gl.uniform3fv(ptsProg.u("uGlow"), o.palette.glow);
      gl.uniform3fv(ptsProg.u("uFog"), o.palette.fog);
      gl.uniform3fv(ptsProg.u("uHor"), o.palette.hor);
      gl.uniform3fv(ptsProg.u("uMid"), o.palette.mid);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArrays(gl.POINTS, 0, count);
      trailCur = 1 - trailCur;

      // 3. Composite the trails over the sky already in the layer
      gl.bindFramebuffer(gl.FRAMEBUFFER, layer.fb);
      gl.viewport(0, 0, w, h);
      gl.useProgram(compProg.prog);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, nextT.tex);
      gl.uniform1i(compProg.u("uTex"), 0);
      gl.uniform2f(compProg.u("R"), w, h);
      gl.uniform1i(compProg.u("uDebug"), o.debug);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disable(gl.BLEND);
    }

    // ── Timing ────────────────────────────────────────
    const timer = gl.getExtension("EXT_disjoint_timer_query_webgl2");
    let query = null;
    const stats = { ms: 16.7, fps: 60, gpuMs: null, scale: 1, history: new Float32Array(120), head: 0 };
    let dyn = 1, nextAdjust = 0;

    // ── Layers / crossfade ────────────────────────────
    let cur = null, prev = null, fade = 1;
    function setScene(type) {
      if (!S.types[type] || (cur && cur.type === type)) return;
      sceneProg(type); // compile up front so the fade starts smoothly
      if (cur) { prev = cur; fade = 0; }
      cur = { type, t: prev ? targets.find((t) => t !== prev.t) : targets[0] };
    }

    function setSceneUniforms(p, o, w, h) {
      gl.uniform2f(p.u("R"), w, h);
      gl.uniform1f(p.u("T"), o.t);
      gl.uniform2f(p.u("M"), o.mouse[0], o.mouse[1]);
      gl.uniform1f(p.u("V"), o.view);
      gl.uniform1i(p.u("uDebug"), o.debug);
      for (const k of VEC) gl.uniform3fv(p.u(uName(k)), o.palette[k]);
      for (const k of NUM) gl.uniform1f(p.u(uName(k)), o.palette[k]);
    }

    function drawLayer(layer, o, scale) {
      const def = S.types[layer.type];
      const w = Math.max(16, Math.round(canvas.width * def.scale * scale));
      const h = Math.max(16, Math.round(canvas.height * def.scale * scale));
      size(layer.t, w, h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, layer.t.fb);
      gl.viewport(0, 0, w, h);
      const p = sceneProg(layer.type);
      gl.useProgram(p.prog);
      setSceneUniforms(p, o, w, h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (def.particles) drawParticles(o, layer.t, w, h, scale * def.scale);
    }

    // ── Frame ─────────────────────────────────────────
    function render(o) {
      // o: { t, dt, view, mouse, palette, debug, impulse, burst, autoRes, res, reduce }
      const dtMs = o.dt * 1000;
      stats.ms += (dtMs - stats.ms) * .05;
      stats.fps = 1000 / stats.ms;
      stats.history[stats.head] = dtMs;
      stats.head = (stats.head + 1) % stats.history.length;

      const now = performance.now();
      if (o.autoRes) {
        if (stats.ms > 19.5 && now > nextAdjust) { dyn = Math.max(.4, dyn - .1); nextAdjust = now + 600; }
        else if (stats.ms < 17.4 && now > nextAdjust) { dyn = Math.min(1, dyn + .05); nextAdjust = now + 1200; }
      } else dyn = o.res;
      const scale = Math.round(dyn * 20) / 20;
      stats.scale = scale;

      // GPU time for the scene passes, when the browser exposes it
      if (timer && query && gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
        if (!gl.getParameter(timer.GPU_DISJOINT_EXT)) {
          const ms = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
          stats.gpuMs = stats.gpuMs == null ? ms : stats.gpuMs + (ms - stats.gpuMs) * .1;
        }
        gl.deleteQuery(query); query = null;
      }
      const timing = timer && !query;
      if (timing) { query = gl.createQuery(); gl.beginQuery(timer.TIME_ELAPSED_EXT, query); }

      fade = Math.min(1, fade + o.dt / .9);
      if (fade >= 1) prev = null;
      drawLayer(cur, o, scale);
      if (prev) drawLayer(prev, o, scale);
      if (timing) gl.endQuery(timer.TIME_ELAPSED_EXT);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(post.prog);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, cur.t.tex);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, (prev || cur).t.tex);
      gl.uniform1i(post.u("A"), 0);
      gl.uniform1i(post.u("B"), 1);
      gl.uniform1f(post.u("uMix"), prev ? fade * fade * (3 - 2 * fade) : 1);
      gl.uniform1i(post.u("uDebug"), o.debug);
      gl.uniform2f(post.u("R"), canvas.width, canvas.height);
      gl.uniform1f(post.u("T"), o.t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(innerWidth * dpr);
      canvas.height = Math.round(innerHeight * dpr);
    }
    resize();
    addEventListener("resize", resize);

    return { setScene, render, setParticles, stats, floatOK, get type() { return cur && cur.type; }, gpuTimer: !!timer };
  }

  window.E0Engine = { createEngine, VEC, NUM };
})();
