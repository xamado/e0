// Event Zero background renderer (WebGL2): the Lorenz attractor particles.
//
// The scene renders into an offscreen target at a reduced resolution (backdrop, then
// particles composited from a fading trail buffer); a post pass upscales it to the
// screen. Resolution adapts to frame time when autoRes is on.

(() => {
  const SWAY_MAX = 25 * Math.PI / 180;   // side views of the attractor look bad: never sway further
  const BASE_YAW = .5, PITCH = .2;       // face-on view of the butterfly's wings

  function createEngine(canvas) {
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" });
    if (!gl) return null;
    const S = window.E0_SHADERS;
    // Float render targets hold the simulation state; without them only the backdrop draws
    const floatOK = !!gl.getExtension("EXT_color_buffer_float");

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
    const P = {
      backdrop: compile(S.fullscreenVS, S.backdropFS, "backdrop"),
      sim: compile(S.fullscreenVS, S.simFS, "sim"),
      points: compile(S.pointsVS, S.pointsFS, "points"),
      trail: compile(S.fullscreenVS, S.trailFS, "trail"),
      composite: compile(S.fullscreenVS, S.compositeFS, "composite"),
      post: compile(S.fullscreenVS, S.postFS, "post"),
    };

    // ── Render targets ────────────────────────────────
    function target(internal, format, type) {
      const tex = gl.createTexture(), fb = gl.createFramebuffer();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return { tex, fb, w: 0, h: 0, internal, format, type };
    }
    // Returns true when the target was (re)allocated, so callers can clear history
    function size(t, w, h) {
      if (t.w === w && t.h === h) return false;
      t.w = w; t.h = h;
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, t.internal, w, h, 0, t.format, t.type, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      return true;
    }
    const sceneRT = target(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    const trails = [target(gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT), target(gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT)];
    let trailCur = 0;

    // ── Simulation state: N×N particles, position + velocity, ping-ponged ──
    let sim = null, needReset = true;
    let cfg = { trail: 1, density: 512, color: 0, bright: .2 };
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
    function setParticles(next) {
      cfg = { ...cfg, ...next };
      if (sim && sim.N !== cfg.density) simAlloc(cfg.density);
    }

    // Camera: slow automatic sway around the face-on view, rotation R = Rx(pitch)·Ry(yaw)
    function rotation(o) {
      const yaw = BASE_YAW + (o.reduce ? 0 : SWAY_MAX * Math.sin(o.t * .12));
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(PITCH), sp = Math.sin(PITCH);
      return new Float32Array([cy, sp * sy, -cp * sy, 0, cp, sp, sy, -sp * cy, cp * cy]);   // column-major
    }

    const fullscreen = () => gl.drawArrays(gl.TRIANGLES, 0, 3);
    const bindTex = (unit, tex, p, name) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(p.u(name), unit); };

    function drawParticles(o, w, h, scale) {
      if (!sim) simAlloc(cfg.density);
      const asp = canvas.width / canvas.height;

      // 1. Step the simulation
      const src = sim.bufs[sim.cur], dst = sim.bufs[1 - sim.cur];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      gl.viewport(0, 0, sim.N, sim.N);
      gl.useProgram(P.sim.prog);
      bindTex(0, src.pos, P.sim, "uPos"); bindTex(1, src.vel, P.sim, "uVel");
      gl.uniform1i(P.sim.u("uReset"), needReset ? 1 : 0);
      gl.uniform1i(P.sim.u("uN"), sim.N);
      gl.uniform1f(P.sim.u("uDt"), o.reduce ? 0 : Math.min(o.dt, 1 / 30));
      gl.uniform1f(P.sim.u("uT"), o.t);
      gl.uniform1f(P.sim.u("uImpulse"), needReset ? 0 : o.impulse);
      fullscreen();
      gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
      sim.cur = 1 - sim.cur;
      needReset = false;

      // 2. Trails: fade last frame, then add this frame's points
      const resized = size(trails[0], w, h) | size(trails[1], w, h);
      const prevT = trails[trailCur], nextT = trails[1 - trailCur];
      gl.bindFramebuffer(gl.FRAMEBUFFER, nextT.fb);
      gl.viewport(0, 0, w, h);
      const decay = cfg.trail * .97;
      if (decay > 0 && !resized) {
        gl.useProgram(P.trail.prog);
        bindTex(0, prevT.tex, P.trail, "uTex");
        gl.uniform1f(P.trail.u("uDecay"), decay);
        gl.uniform2f(P.trail.u("R"), w, h);
        fullscreen();
      } else { gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }

      const cur = sim.bufs[sim.cur], p = P.points, count = sim.N * sim.N;
      gl.useProgram(p.prog);
      bindTex(0, cur.pos, p, "uPos"); bindTex(1, cur.vel, p, "uVel");
      gl.uniform1i(p.u("uN"), sim.N);
      gl.uniform1i(p.u("uColor"), cfg.color);
      gl.uniformMatrix3fv(p.u("uRot"), false, rotation(o));
      gl.uniform2f(p.u("uShift"), o.shift || 0, 0);
      gl.uniform1f(p.u("uAsp"), asp);
      gl.uniform1f(p.u("uPx"), 1.5 * Math.max(scale, .5) * (canvas.width / Math.max(1, canvas.clientWidth)));
      // Keep overall brightness roughly constant across particle counts and trail lengths
      gl.uniform1f(p.u("uBright"), 1.1 * cfg.bright * Math.sqrt(65536 / count) * (1 - decay * .8));
      for (const k of ["sunCol", "glow", "fog", "hor", "mid"]) gl.uniform3fv(p.u("u" + k[0].toUpperCase() + k.slice(1)), o.palette[k]);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArrays(gl.POINTS, 0, count);
      trailCur = 1 - trailCur;

      // 3. Composite the trails over the backdrop
      gl.bindFramebuffer(gl.FRAMEBUFFER, sceneRT.fb);
      gl.viewport(0, 0, w, h);
      gl.useProgram(P.composite.prog);
      bindTex(0, nextT.tex, P.composite, "uTex");
      gl.uniform2f(P.composite.u("R"), w, h);
      fullscreen();
      gl.disable(gl.BLEND);
    }

    // ── Timing ────────────────────────────────────────
    const timer = gl.getExtension("EXT_disjoint_timer_query_webgl2");
    let query = null;
    const stats = { ms: 16.7, fps: 60, gpuMs: null, scale: 1, history: new Float32Array(120), head: 0 };
    let dyn = 1, nextAdjust = 0;

    // ── Frame ─────────────────────────────────────────
    function render(o) {
      // o: { t, dt, view, palette, impulse, grid, shift, autoRes, res, reduce }
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

      const w = Math.max(16, Math.round(canvas.width * scale)), h = Math.max(16, Math.round(canvas.height * scale));
      size(sceneRT, w, h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, sceneRT.fb);
      gl.viewport(0, 0, w, h);
      const b = P.backdrop;
      gl.useProgram(b.prog);
      gl.uniform2f(b.u("R"), w, h);
      gl.uniform1f(b.u("V"), o.view);
      gl.uniform1f(b.u("uGrid"), o.grid || 0);
      for (const k of ["top", "mid", "hor", "sunCol"]) gl.uniform3fv(b.u("u" + k[0].toUpperCase() + k.slice(1)), o.palette[k]);
      fullscreen();
      if (floatOK) drawParticles(o, w, h, scale);
      if (timing) gl.endQuery(timer.TIME_ELAPSED_EXT);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(P.post.prog);
      bindTex(0, sceneRT.tex, P.post, "uTex");
      gl.uniform2f(P.post.u("R"), canvas.width, canvas.height);
      gl.uniform1f(P.post.u("T"), o.t);
      fullscreen();
    }

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(innerWidth * dpr);
      canvas.height = Math.round(innerHeight * dpr);
    }
    resize();
    addEventListener("resize", resize);

    return { render, setParticles, stats, floatOK };
  }

  window.E0Engine = { createEngine };
})();
