  (() => {
    // ── Content ───────────────────────────────────────────
    // Compiled by Hugo from content/**/*.md into <script id="site-data"> (see layouts/home.html).
    const DATA = JSON.parse(document.getElementById("site-data").textContent);
    const EMAIL = DATA.email;
    const TABS = DATA.tabs;
    // TEST ONLY: filler cards to exercise scrolling. Set params.testFiller = 0 in hugo.toml before launch.
    function fillerGames(n) {
      const hues = [[255, 122, 89], [94, 231, 223], [217, 72, 95], [31, 122, 108], [122, 42, 158], [184, 86, 47], [42, 63, 143], [255, 201, 120]];
      return Array.from({ length: n }, (_, i) => {
        const [r, g, b] = hues[i % hues.length];
        return { label: `Test Title ${String(i + 9).padStart(2, "0")}`, meta: String(2010 + (i % 15)), d: { type: "game",
          art: `radial-gradient(circle at ${30 + (i * 17) % 50}% 30%, rgba(255,255,255,.45), transparent 45%), linear-gradient(${150 + i * 9}deg, rgb(${r},${g},${b}), #120a24)`,
          role: "Test data", platforms: ["PS5 · Xbox Series · PC", "Switch", "PC", "Multiplatform", "Meta Quest"][i % 5] } };
      });
    }
    const gridTab = TABS.find((t) => t.layout === "grid");
    if (gridTab && DATA.testFiller > 0) gridTab.rows.push(...fillerGames(DATA.testFiller));

    // ── Elements ─────────────────────────────────────────
    const $ = (s) => document.querySelector(s);
    const narrow = matchMedia("(max-width: 900px)");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const body = document.body;
    const menuEl = $("#menu"), tabsEl = $("#tabs"), pane = $("#pane"), detail = $("#detail"), desc = $("#desc"), meta = $("#sub-meta"), sweep = $("#sweep");
    document.querySelectorAll(".year").forEach((y) => (y.textContent = new Date().getFullYear()));
    const pad2 = (n) => String(n).padStart(2, "0");
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

    menuEl.innerHTML = TABS.map((t, i) =>
      `<li class="stag" style="--i:${i + 3}"><button type="button" data-i="${i}"><span class="n">0${i + 1}</span><span>${esc(t.label)}<small>${esc(t.blurb)}</small></span></button></li>`).join("");
    tabsEl.innerHTML = TABS.map((t, i) => `<button class="tab" role="tab" type="button" data-i="${i}">${esc(t.label)}</button>`).join("");
    const menuBtns = [...menuEl.querySelectorAll("button")];
    const tabBtns = [...tabsEl.querySelectorAll(".tab")];

    // ── Persistence (per-viewer convenience only) ────────
    const store = {
      get(k, d) { try { const v = localStorage.getItem("e0lab11:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
      set(k, v) { try { localStorage.setItem("e0lab11:" + k, JSON.stringify(v)); } catch {} },
    };

    // ── Scenes ───────────────────────────────────────────
    // Colours are linear-ish RGB 0–1. sun = [x, y, size].
    const PRESETS = {
      dusk:   { name: "Dusk",   accent: "#ffc978", top: [.07, .04, .16], mid: [.42, .14, .42], hor: [1, .5, .32], glow: [1, .82, .55], fog: [1, .55, .45], far: [.85, .38, .45], near: [.06, .03, .12], sunCol: [1, .82, .55], sun: [.68, .40, .075], stars: 1, embers: 1, fogAmt: 1, rough: 1, aurora: 0, cloud: 1 },
      golden: { name: "Golden", accent: "#ffd27a", top: [.16, .2, .42], mid: [.82, .45, .32], hor: [1, .7, .38], glow: [1, .92, .7], fog: [1, .76, .55], far: [.9, .58, .45], near: [.12, .06, .08], sunCol: [1, .95, .75], sun: [.3, .46, .09], stars: .2, embers: .6, fogAmt: 1.2, rough: .9, aurora: 0, cloud: 1.2 },
      dawn:   { name: "Dawn",   accent: "#ffd3c4", top: [.22, .3, .55], mid: [.66, .52, .72], hor: [1, .74, .68], glow: [1, .95, .86], fog: [.95, .8, .85], far: [.72, .62, .78], near: [.14, .13, .24], sunCol: [1, .97, .9], sun: [.5, .36, .06], stars: .3, embers: 0, fogAmt: 1.6, rough: .8, aurora: 0, cloud: .8 },
      night:  { name: "Night",  accent: "#a9c4ff", top: [.01, .02, .06], mid: [.04, .07, .18], hor: [.12, .18, .35], glow: [.6, .7, .9], fog: [.3, .4, .6], far: [.18, .24, .4], near: [.01, .02, .05], sunCol: [.92, .95, 1], sun: [.72, .7, .035], stars: 1.6, embers: 0, fogAmt: .8, rough: 1, aurora: .9, cloud: .4 },
      mist:   { name: "Mist",   accent: "#f2f4f7", top: [.28, .32, .4], mid: [.48, .53, .6], hor: [.74, .77, .8], glow: [.95, .95, .92], fog: [.8, .83, .86], far: [.55, .6, .66], near: [.1, .12, .16], sunCol: [1, 1, .95], sun: [.62, .5, .05], stars: 0, embers: 0, fogAmt: 2.2, rough: .9, aurora: 0, cloud: 1.5 },
      ember:  { name: "Ember",  accent: "#ff8a4d", top: [.06, .01, .02], mid: [.35, .04, .04], hor: [1, .3, .1], glow: [1, .6, .25], fog: [.9, .3, .15], far: [.6, .15, .1], near: [.04, .01, .01], sunCol: [1, .5, .2], sun: [.5, .34, .11], stars: .4, embers: 3, fogAmt: 1.3, rough: 1.3, aurora: 0, cloud: .6 },
      alien:  { name: "Alien",  accent: "#8dffcf", top: [.02, .1, .12], mid: [.05, .4, .42], hor: [.5, 1, .75], glow: [.85, 1, .8], fog: [.4, .95, .8], far: [.6, .25, .55], near: [.08, .02, .1], sunCol: [.9, 1, .85], sun: [.25, .55, .12], stars: .8, embers: .5, fogAmt: 1, rough: 1.4, aurora: .3, cloud: .8 },
      arctic: { name: "Arctic", accent: "#bfe3ff", top: [.05, .12, .3], mid: [.3, .55, .8], hor: [.8, .9, 1], glow: [1, 1, 1], fog: [.8, .9, 1], far: [.7, .8, .95], near: [.15, .2, .32], sunCol: [1, 1, 1], sun: [.2, .3, .05], stars: .3, embers: 0, fogAmt: 1.4, rough: 1.2, aurora: .5, cloud: 1 },
    };
    const VEC = ["top", "mid", "hor", "glow", "fog", "far", "near", "sunCol", "sun"];
    const NUM = ["stars", "embers", "fogAmt", "rough", "aurora", "cloud"];
    const clone = (o) => JSON.parse(JSON.stringify(o));
    const DEFAULTS = clone(PRESETS);
    const saved = store.get("presets", null);
    if (saved) for (const id in PRESETS) if (saved[id]) {
      for (const k of VEC) if (Array.isArray(saved[id][k]) && saved[id][k].length === 3) PRESETS[id][k] = saved[id][k];
      for (const k of NUM) if (typeof saved[id][k] === "number") PRESETS[id][k] = saved[id][k];
    }
    const TYPES = window.E0_SCENES ? Object.keys(window.E0_SCENES.types) : ["mountains"];
    const okType = (t) => (TYPES.includes(t) ? t : "mountains");
    const okPal = (id) => (PRESETS[id] ? id : "dusk");
    const MAP_DEFAULT = {
      menu: { type: "mountains", preset: "dusk" }, services: { type: "terrain", preset: "golden" }, shipped: { type: "planet", preset: "night" },
      team: { type: "particles", preset: "dusk" }, clients: { type: "ocean", preset: "dawn" }, engage: { type: "mountains", preset: "mist" },
      contact: { type: "particles", preset: "night" },
    };
    const storedMap = store.get("map", {});
    const lab = {
      type: okType(store.get("type", "mountains")),
      preset: okPal(store.get("preset", "dusk")),
      per: !!store.get("per", false),
      map: Object.fromEntries(["menu", ...TABS.map((t) => t.id)].map((k) => {
        const d = MAP_DEFAULT[k] || { type: "mountains", preset: "dusk" }, v = storedMap[k] || {};
        return [k, { type: okType(v.type || d.type), preset: okPal(v.preset || d.preset) }];
      })),
      clock: !!store.get("clock", false),
      debug: 0,
      autoRes: store.get("autores", true) !== false,
      pstyle: ["flow", "attractor", "galaxy", "shapes", "gravity", "swarm"].includes(store.get("pstyle")) ? store.get("pstyle") : "flow",
      attr: +store.get("attr", 0),
      trail: +store.get("trail", .6),
      pbright: +store.get("pbright", 1),
      density: +store.get("density", 256),
      pcolor: +store.get("pcolor", 0),
      res: +store.get("res", 1),
    };
    const scene = clone(PRESETS[lab.preset]); // live palette, eased toward the target each frame
    let sceneTarget = PRESETS[lab.preset];

    // ── Sound: tiny synthesized UI sounds (no audio files) ─
    const Sound = (() => {
      let ctx, master, wet, lastMove = 0;
      let on = store.get("snd", true), vol = store.get("vol", .6);
      const level = () => (on ? vol * .5 : 0);
      function init() {
        if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = level(); master.connect(ctx.destination);
        // Short filtered echo for a bit of space
        const delay = ctx.createDelay(); delay.delayTime.value = .13;
        const fb = ctx.createGain(); fb.gain.value = .28;
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2400;
        wet = ctx.createGain(); wet.gain.value = .35;
        wet.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(master);
      }
      function tone(freq, { type = "sine", t = 0, dur = .12, gain = .3, to = 0, attack = .004, echo = true } = {}) {
        const now = ctx.currentTime + t;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, now);
        if (to) o.frequency.exponentialRampToValueAtTime(to, now + dur);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(gain, now + attack);
        g.gain.exponentialRampToValueAtTime(.0001, now + dur);
        o.connect(g); g.connect(master); if (echo) g.connect(wet);
        o.start(now); o.stop(now + dur + .05);
      }
      function noise({ dur = .08, gain = .2, freq = 2000, q = 1 } = {}) {
        const now = ctx.currentTime;
        const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource(); src.buffer = buf;
        const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(freq * .6, now); bp.frequency.exponentialRampToValueAtTime(freq * 1.6, now + dur); bp.Q.value = q;
        const g = ctx.createGain(); g.gain.setValueAtTime(gain, now); g.gain.exponentialRampToValueAtTime(.0001, now + dur);
        src.connect(bp); bp.connect(g); g.connect(master);
        src.start(now);
      }
      const sounds = {
        move() { const n = performance.now(); if (n - lastMove < 35) return; lastMove = n; tone(1320, { type: "triangle", dur: .05, gain: .12, echo: false }); tone(2640, { dur: .03, gain: .03, echo: false }); },
        select() { tone(660, { dur: .18, gain: .16 }); tone(990, { t: .06, dur: .35, gain: .14 }); tone(1980, { t: .06, dur: .25, gain: .03 }); },
        back() { tone(740, { dur: .16, gain: .14, to: 440 }); },
        tab() { noise({ dur: .07, gain: .12, freq: 2600, q: .8 }); tone(980, { dur: .05, gain: .07, type: "triangle", echo: false }); },
        bump() { tone(180, { dur: .09, gain: .2, to: 120, echo: false }); },
        start() { [440, 554.37, 659.25, 880].forEach((f, i) => tone(f, { t: i * .07, dur: 1.4, gain: .08, attack: .02 })); tone(220, { dur: 1.6, gain: .07, attack: .05 }); },
      };
      return {
        init,
        play(k) { if (!ctx || !on) return; if (ctx.state === "suspended") ctx.resume(); sounds[k](); },
        get on() { return on; }, get vol() { return vol; },
        setOn(v) { on = v; store.set("snd", v); if (master) master.gain.value = level(); },
        setVol(v) { vol = v; store.set("vol", v); if (master) master.gain.value = level(); },
      };
    })();
    addEventListener("pointerdown", () => Sound.init(), true);
    addEventListener("keydown", () => Sound.init(), true);

    // ── State ────────────────────────────────────────────
    let state = "splash", menuIdx = 0, tabIdx = 0, rowIdx = 0, pushed = false;
    const setState = (s) => {
      const from = state;
      state = s;
      if (from === "splash" && s === "menu") Sound.play("start");
      else if (s === "sub" && from !== "sub") Sound.play("select");
      else if (from !== s && from !== "splash") Sound.play("back");
      body.classList.toggle("is-splash", s === "splash");
      body.classList.toggle("is-menu", s === "menu");
      body.classList.toggle("is-sub", s === "sub");
      view.target = s === "sub" ? 1 : 0;
      sweep.classList.remove("go"); void sweep.offsetWidth; sweep.classList.add("go");
      applyScene();
    };
    const anim = (el, cls) => { el.classList.remove("swap-l", "swap-r", "swap-f"); void el.offsetWidth; el.classList.add(cls); };

    const selectMenu = (i, silent) => {
      const next = (i + TABS.length) % TABS.length;
      if (next !== menuIdx && !silent) Sound.play("move");
      menuIdx = next;
      menuBtns.forEach((b, k) => b.classList.toggle("is-active", k === menuIdx));
    };

    function extrasHtml(d) {
      let html = "";
      if (d.type === "mail") html += `<a class="big-mail" href="mailto:${EMAIL}">${EMAIL}</a>`;
      if (d.bul) html += `<ul class="bul">${d.bul.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`;
      if (d.facts) html += `<dl class="facts">${d.facts.map((f) => (Array.isArray(f) ? f : [f.label, f.value])).map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join("")}</dl>`;
      if (d.tags) html += `<ul class="tags">${d.tags.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`;
      // Logo wall: inline SVG icons from the build (Simple Icons), text tiles where there is no icon
      if (d.logos) html += `<div class="logos">${d.logos.map((g) => `<section><h4>${esc(g.group)}</h4><ul>${g.items.map((it) =>
        `<li title="${esc(it.name)}">${it.svg || `<span class="wm">${esc(it.name)}</span>`}${it.svg ? `<span class="nm">${esc(it.name)}</span>` : ""}</li>`).join("")}</ul></section>`).join("")}</div>`;
      return html;
    }

    // ── Team: a single designed page (content from team/_index.md) ──
    function teamHtml(t) {
      const m = t.team, last = m.headline.length - 1;
      const L = m.location || {};
      const zones = Array.from({ length: 24 }, (_, i) => i - 11); // UTC−11 … UTC+12
      return `<div class="tm">
        <header class="tm__hero">
          <div>
            <span class="pane__kicker caps">0${tabIdx + 1} / ${esc(t.label)}</span>
            <h2 class="tm__headline">${m.headline.map((l, i) => `<span${i === last ? ' class="hl"' : ""}>${esc(l)}</span>`).join("")}</h2>
          </div>
          <div class="tm__lede">
            <p>${esc(m.lede)}</p>
            <p class="tm__live caps"><i></i>${esc(L.city || "")} · <span data-clock="${esc(L.timezone || "")}">--:--</span> local</p>
          </div>
        </header>

        <section class="tm__pillars">${(m.pillars || []).map((p, i) => `
          <article><span class="tm__num" aria-hidden="true">0${i + 1}</span><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></article>`).join("")}
        </section>

        <section class="tm__eras">
          <h3 class="tm__label caps">${esc(m.erasTitle || "")}</h3>
          <ol>${(m.eras || []).map((e, i, a) => `<li${i === a.length - 1 ? ' class="now"' : ""}><i></i><b>${esc(e.label)}</b><span>${esc(e.text)}</span></li>`).join("")}</ol>
        </section>

        <section class="tm__story">
          <blockquote>${m.story}</blockquote>
          <div class="tm__place">
            <h3>${esc(L.city || "")}</h3>
            <p class="caps">${esc(L.country || "")} · ${esc(L.coords || "")}</p>
            <div class="tm__tz" aria-label="Time zones, home base UTC${L.utc}">${zones.map((z) =>
              `<i class="${z === L.utc ? "home" : z >= -8 && z <= 2 ? "near" : ""}" title="UTC${z >= 0 ? "+" : "−"}${Math.abs(z)}"></i>`).join("")}</div>
            <div class="tm__tzlabels caps"><span>Americas</span><span>UTC${L.utc >= 0 ? "+" : "−"}${Math.abs(L.utc)}</span><span>Europe</span></div>
            <p class="tm__note">${esc(L.note || "")}</p>
          </div>
        </section>

        <section class="tm__logos">
          <h3 class="tm__label caps">${esc(m.logosTitle || "")}</h3>
          <ul>${(m.logos || []).map((l) => `<li title="${esc(l.name)}">${l.svg || `<span>${esc(l.name)}</span>`}</li>`).join("")}</ul>
        </section>

        ${m.cta ? `<footer class="tm__cta"><h3>${esc(m.cta.title)}</h3><button type="button" class="tm__btn" data-goto="contact">${esc(m.cta.button)} <span aria-hidden="true">▶</span></button></footer>` : ""}
      </div>`;
    }
    // Live local time for any [data-clock] on screen
    function tickClocks() {
      document.querySelectorAll("[data-clock]").forEach((el) => {
        try { el.textContent = new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit", timeZone: el.dataset.clock }).format(new Date()); } catch {}
      });
    }
    setInterval(tickClocks, 15000);

    function renderDetail(dir) {
      const t = TABS[tabIdx], r = t.rows[rowIdx], d = r.d;
      if (t.layout === "grid") {
        const info = pane.querySelector("#lvl-info");
        info.innerHTML = `<span class="k caps">Stage ${pad2(rowIdx + 1)} / ${pad2(t.rows.length)}</span><h3>${esc(r.label)}</h3><p class="m">${esc(d.role)} · ${esc(d.platforms)} · ${esc(r.meta)}</p>`;
        anim(info, dir || "swap-f");
        desc.textContent = `${r.label} · ${d.role} · ${d.platforms}`;
        return;
      }
      let html = "";
      if (d.type === "game") {
        html = `<div class="art" style="--art:${d.art}"></div>
          <span class="detail__k caps">${esc(r.meta)}</span><h3>${esc(r.label)}</h3>
          <dl class="facts"><dt>Our role</dt><dd>${esc(d.role)}</dd><dt>Platforms</dt><dd>${esc(d.platforms)}</dd><dt>Released</dt><dd>${esc(r.meta)}</dd></dl>
          <p class="note">Credits include work at previous studios. All trademarks belong to their respective owners.</p>`;
      } else if (d.type === "client") {
        html = `<div class="logo-slot">Logo</div><span class="detail__k caps">Client</span><h3>${esc(r.label)}</h3>${d.bodyHtml || `<p>${esc(d.body)}</p>`}`;
      } else {
        html = `<span class="detail__k caps">${esc(d.k)}</span><h3>${esc(r.label)}</h3>${d.bodyHtml || `<p>${esc(d.body)}</p>`}`;
        html += extrasHtml(d);
      }
      if (r.href) html += `<p class="action"><span class="hint"><span class="glyph glyph--a"><span data-kb>Enter</span><span data-pad>A</span></span>${esc(d.action || "Open email")}</span></p>`;
      detail.innerHTML = html;
      anim(detail, dir || "swap-f");
      desc.textContent = d.body ? d.body.split(". ")[0].replace(/\.$/, "") + "." : `${r.label} · ${r.meta}`;
    }

    // byPointer: selected by hover/click, so don't scroll the list (only keyboard/gamepad moves scroll it)
    const selectRow = (i, quiet, byPointer) => {
      const rows = TABS[tabIdx].rows;
      const next = Math.max(0, Math.min(rows.length - 1, i));
      if (next !== i) Sound.play("bump");
      if (next === rowIdx && quiet !== true && pane.querySelector(".row.is-active, .cell.is-active")) return;
      if (next !== rowIdx) Sound.play("move");
      rowIdx = next;
      pane.querySelectorAll(".row, .cell").forEach((b, k) => b.classList.toggle("is-active", k === rowIdx));
      if (!byPointer) pane.querySelector(".row.is-active, .cell.is-active")?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
      renderDetail();
    };

    function renderTab(i, dir) {
      tabIdx = (i + TABS.length) % TABS.length;
      rowIdx = 0;
      const t = TABS[tabIdx];
      tabBtns.forEach((b, k) => b.setAttribute("aria-selected", k === tabIdx));
      tabBtns[tabIdx].scrollIntoView({ block: "nearest", inline: "nearest" });
      meta.textContent = `0${tabIdx + 1} / 0${TABS.length}`;
      const grid = t.layout === "grid", page = t.layout === "page" || t.layout === "team";
      body.classList.toggle("is-grid", grid);
      body.classList.toggle("is-page", page);
      $("#nav-kb").textContent = grid ? "↑↓←→" : "↑↓";
      const head = `<span class="pane__kicker caps">0${tabIdx + 1} / ${esc(t.label)}</span><h2>${esc(t.label)}</h2><p class="pane__intro">${esc(t.intro)}</p>`;
      if (page) {
        // Everything on one scrollable page; no list/detail
        pane.innerHTML = t.team ? teamHtml(t) : `<div class="pg"><div>${head}</div><div class="pg__body">${t.rows.map((r) =>
          `<section class="pg__block${r.d.logos ? " pg__block--wide" : ""}"><span class="detail__k caps">${esc(r.meta || "")}</span><h3>${esc(r.label)}</h3>${r.d.bodyHtml || ""}${extrasHtml(r.d)}</section>`).join("")}</div></div>`;
        tickClocks();
        pane.querySelectorAll("[data-goto]").forEach((b) => b.addEventListener("click", () => {
          const i = TABS.findIndex((x) => x.id === b.dataset.goto);
          if (i >= 0) renderTab(i, i > tabIdx ? 1 : -1);
        }));
        anim(pane, dir === -1 ? "swap-l" : dir === 1 ? "swap-r" : "swap-f");
        desc.textContent = t.blurb;
        $("#nav-kb").textContent = "↑↓";
        if (state === "sub") history.replaceState({ sub: t.id }, "", "#" + t.id);
        if (dir) { Sound.play("tab"); kick(); }
        applyScene();
        return;
      }
      pane.innerHTML = grid
        ? `<div class="lvl"><div class="lvl__head"><div>${head}</div><div class="lvl__info" id="lvl-info" aria-live="polite"></div></div>
            <div class="lvl__grid has-active" role="listbox" aria-label="${esc(t.label)}">${t.rows.map((r, k) =>
              `<button class="cell${k === 0 ? " is-active" : ""}" type="button" role="option" data-i="${k}"${r.d.poster ? ` data-poster="${r.d.poster}"` : ""} style="--art:${r.d.art}">
                <span class="num" aria-hidden="true">${pad2(k + 1)}</span>
                <span class="stage caps"><span>Stage ${pad2(k + 1)}</span><span>${esc(r.d.tag || r.meta)}</span></span>
                <span><span class="t">${esc(r.label)}</span><span class="m caps">${esc(r.d.platforms)}</span></span></button>`).join("")}</div>
            <p class="note">Credits include work at previous studios. All trademarks belong to their respective owners.</p></div>`
        : `${head}<div class="rows" role="listbox" aria-label="${esc(t.label)}">${t.rows.map((r, k) =>
          `<button class="row${k === 0 ? " is-active" : ""}" type="button" role="option" data-i="${k}"><span class="n">0${k + 1}</span><span class="label">${esc(r.label)}</span><span class="meta">${esc(r.meta)}</span></button>`).join("")}</div>`;
      // Real poster art: use assets/posters/<slug>.jpg when it exists, otherwise keep the placeholder
      pane.querySelectorAll(".cell[data-poster]").forEach((c) => {
        const img = new Image();
        img.onload = () => { c.style.setProperty("--poster", `url("${c.dataset.poster}")`); c.classList.add("has-poster"); };
        img.src = c.dataset.poster;
      });
      pane.querySelectorAll(".row, .cell").forEach((b) => {
        const k = +b.dataset.i;
        b.addEventListener("mouseenter", () => { if (lastInput !== "pad") selectRow(k, false, true); });
        b.addEventListener("click", () => {
          selectRow(k, false, true);
          if (grid) { Sound.play("select"); return; }
          activate();
          if (narrow.matches) detail.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        });
      });
      anim(pane, dir === -1 ? "swap-l" : dir === 1 ? "swap-r" : "swap-f");
      renderDetail(dir === -1 ? "swap-l" : dir === 1 ? "swap-r" : "swap-f");
      if (state === "sub") history.replaceState({ sub: t.id }, "", "#" + t.id);
      if (dir) { Sound.play("tab"); kick(); }
      applyScene();
    }

    function openSub(i, fromHistory) {
      renderTab(i, 0);
      selectMenu(i, true);
      kick();
      setState("sub");
      if (!fromHistory) { history.pushState({ sub: TABS[tabIdx].id }, "", "#" + TABS[tabIdx].id); pushed = true; }
    }
    function back(fromHistory) {
      if (state === "sub") {
        setState("menu");
        if (!fromHistory) {
          if (pushed) { pushed = false; history.back(); }
          else history.replaceState(null, "", location.pathname);
        }
        menuBtns[menuIdx].focus({ preventScroll: true });
      } else if (state === "menu") {
        setState("splash");
      }
    }
    function activate() {
      if (state === "splash") return setState("menu");
      if (state === "menu") return openSub(menuIdx);
      const r = TABS[tabIdx].rows[rowIdx];
      if (r && r.href) { Sound.play("select"); location.href = r.href; }
    }
    const isGrid = () => state === "sub" && TABS[tabIdx].layout === "grid";
    // Columns of the poster grid, read from the live layout (it reflows with the window)
    const gridCols = () => {
      const g = pane.querySelector(".lvl__grid");
      return g ? getComputedStyle(g).gridTemplateColumns.split(" ").length : 1;
    };
    const move = (d) => {
      if (state === "menu") { selectMenu(menuIdx + d); menuBtns[menuIdx].focus({ preventScroll: true }); }
      else if (state === "sub") {
        if (TABS[tabIdx].layout === "page") {
          // Accumulate presses so holding the key keeps scrolling smoothly
          const el = narrow.matches ? document.querySelector(".sub") : pane.querySelector(".pg__body, .tm");
          if (!el) return;
          const max = el.scrollHeight - el.clientHeight;
          const from = Math.abs((el._scrollGoal ?? el.scrollTop) - el.scrollTop) < 4 ? el.scrollTop : el._scrollGoal;
          el._scrollGoal = Math.max(0, Math.min(max, from + d * 180));
          if (el._scrollGoal === from) return Sound.play("bump");
          return el.scrollTo({ top: el._scrollGoal, behavior: reduce ? "auto" : "smooth" });
        }
        if (!isGrid()) return selectRow(rowIdx + d);
        const next = rowIdx + d * gridCols();
        if (next < 0 || next >= TABS[tabIdx].rows.length) return Sound.play("bump");
        selectRow(next);
      }
    };
    // Left/right: move across the grid on level select, switch tabs elsewhere
    const side = (d) => {
      if (!isGrid()) return tab(d);
      const cols = gridCols(), col = rowIdx % cols, next = rowIdx + d;
      if (col + d < 0 || col + d >= cols || next >= TABS[tabIdx].rows.length) return Sound.play("bump");
      selectRow(next);
    };
    const tab = (d) => { if (state === "sub") renderTab(tabIdx + d, d); };

    // ── Input: mouse ─────────────────────────────────────
    let lastInput = "kb";
    const setInput = (k) => { if (k === lastInput) return; lastInput = k; body.classList.toggle("is-pad", k === "pad"); };
    menuBtns.forEach((b, i) => {
      b.addEventListener("mouseenter", () => selectMenu(i));
      b.addEventListener("focus", () => selectMenu(i));
      b.addEventListener("click", () => openSub(i));
    });
    tabBtns.forEach((b, i) => b.addEventListener("click", () => renderTab(i, i > tabIdx ? 1 : -1)));
    document.querySelectorAll("[data-tab-step]").forEach((b) => b.addEventListener("click", () => tab(+b.dataset.tabStep)));
    $("#back").addEventListener("click", () => back());
    $("#brand").addEventListener("click", () => back());
    $("#splash").addEventListener("click", () => state === "splash" && setState("menu"));
    addEventListener("mousemove", () => setInput("kb"));
    addEventListener("contextmenu", (e) => { if (state === "sub") { e.preventDefault(); back(); } });

    // ── Input: keyboard ──────────────────────────────────
    addEventListener("keydown", (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "p" || e.key === "P") { e.preventDefault(); return toggleLab(); }
      if (e.key === "m" || e.key === "M") { e.preventDefault(); return setSound(!Sound.on); }
      if (e.key === "v" || e.key === "V") { e.preventDefault(); return setView((lab.debug + 1) % 5); }
      const t = e.target;
      if (t.matches && t.matches("input, select, textarea")) { if (e.key === "Escape") toggleLab(false); return; }
      if (t.closest && t.closest(".lab, .tools") && (e.key === "Enter" || e.key === " ")) return;
      if (e.key === "Escape" && labEl.classList.contains("is-open")) { e.preventDefault(); return toggleLab(false); }
      setInput("kb");
      if (state === "splash") { e.preventDefault(); return setState("menu"); }
      const k = e.key;
      if (k === "ArrowDown" || k === "s" || k === "S") { e.preventDefault(); move(1); }
      else if (k === "ArrowUp" || k === "w" || k === "W") { e.preventDefault(); move(-1); }
      else if (k === "ArrowRight" || k === "d" || k === "D") { e.preventDefault(); side(1); }
      else if (k === "ArrowLeft" || k === "a" || k === "A") { e.preventDefault(); side(-1); }
      else if (k === "e" || k === "E" || k === "]") { e.preventDefault(); tab(1); }
      else if (k === "q" || k === "Q" || k === "[") { e.preventDefault(); tab(-1); }
      else if (k === "Enter" || k === " ") { e.preventDefault(); activate(); }
      else if (k === "Escape" || k === "Backspace") { e.preventDefault(); back(); }
    });

    // ── Input: browser history (Back button = B) ─────────
    addEventListener("popstate", () => {
      const id = location.hash.slice(1);
      const i = TABS.findIndex((t) => t.id === id);
      if (i >= 0) { pushed = false; if (state !== "sub") openSub(i, true); else renderTab(i, 0); }
      else if (state === "sub") { pushed = false; back(true); }
    });

    // ── Input: gamepad (standard mapping) ────────────────
    const prev = [];
    let axisDir = 0, axisNext = 0, axisXDir = 0, axisXNext = 0;
    function pollPad(now) {
      const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
      const p = pads[0];
      if (!p) return;
      const pressed = (i) => p.buttons[i]?.pressed;
      const edge = (i) => { const v = pressed(i), was = prev[i]; prev[i] = v; return v && !was; };
      const any = p.buttons.some((b) => b.pressed);
      if (any) setInput("pad");
      if (state === "splash" && any && !prev.some(Boolean)) { p.buttons.forEach((_, i) => (prev[i] = pressed(i))); setInput("pad"); return setState("menu"); }
      if (edge(0)) activate();
      if (edge(1)) back();
      if (edge(4)) tab(-1);
      if (edge(5)) tab(1);
      if (edge(12)) move(-1);
      if (edge(13)) move(1);
      if (edge(14)) side(-1);
      if (edge(15)) side(1);
      edge(9) && state === "splash" && setState("menu");
      // Left stick with repeat
      const y = p.axes[1] || 0;
      const d = y > 0.55 ? 1 : y < -0.55 ? -1 : 0;
      if (d !== axisDir) { axisDir = d; if (d) { setInput("pad"); move(d); axisNext = now + 380; } }
      else if (d && now > axisNext) { move(d); axisNext = now + 140; }
      const x = p.axes[0] || 0;
      const dx = x > 0.55 ? 1 : x < -0.55 ? -1 : 0;
      if (dx !== axisXDir) { axisXDir = dx; if (dx) { setInput("pad"); side(dx); axisXNext = now + 380; } }
      else if (dx && now > axisXNext) { side(dx); axisXNext = now + 160; }
    }

    // ── Background renderer ──────────────────────────────
    const view = { v: 0, target: 0 };
    const canvas = $("#sky");
    const engine = window.E0Engine ? E0Engine.createEngine(canvas) : null;
    if (!engine) canvas.style.background = "linear-gradient(#1a0f3a, #6b2a6e 55%, #ff8a5b 75%, #2a1645 76%)";

    const mouse = { x: 0, y: 0 }, m = { x: 0, y: 0 };
    addEventListener("pointermove", (e) => { mouse.x = e.clientX / innerWidth - .5; mouse.y = e.clientY / innerHeight - .5; });
    let burst = 0, impulse = 0, shape = 0, shapeTimer = 0, shift = 0;
    // A burst: one-frame kick for the particle sim plus a decaying level; shapes morph to the next form.
    const kick = () => { burst = 1; impulse = 1; if (lab.pstyle === "shapes") { shape++; shapeTimer = 0; } };

    const start = performance.now();
    let last = start;
    // First frame waits a tick so everything below (scene lab) is initialised.
    requestAnimationFrame(function frame(now) {
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      // Critically damped ease toward the target view (snappy, no overshoot).
      view.v += (view.target - view.v) * (reduce ? 1 : 1 - Math.exp(-dt * 5));
      const ks = reduce ? 1 : 1 - Math.exp(-dt * 2.5);
      for (const k of VEC) for (let j = 0; j < 3; j++) scene[k][j] += (sceneTarget[k][j] - scene[k][j]) * ks;
      for (const k of NUM) scene[k] += (sceneTarget[k] - scene[k]) * ks;
      m.x += (mouse.x - m.x) * .04; m.y += (mouse.y - m.y) * .04;
      burst *= Math.exp(-dt * 3);
      // 3D particle styles sit to the right of the main menu so they don't fight the text
      const shiftT = state === "menu" && !narrow.matches ? innerWidth / innerHeight * .32 : 0;
      shift += (shiftT - shift) * (reduce ? 1 : 1 - Math.exp(-dt * 2));
      shapeTimer += dt;
      if (lab.pstyle === "shapes" && shapeTimer > 9) { shape++; shapeTimer = 0; }
      if (engine) engine.setParticles({ style: lab.pstyle, attr: lab.attr, trail: lab.trail, bright: lab.pbright, density: lab.density, color: lab.pcolor, shape });
      if (engine) engine.render({
        t: reduce ? 20 : (now - start) / 1000 + 20, dt, view: view.v, mouse: [m.x, m.y], palette: scene,
        debug: lab.debug, impulse, burst,
        autoRes: lab.autoRes, res: lab.res, reduce, shift,
      });
      impulse = 0;
      updatePerf(now);
      pollPad(now);
      requestAnimationFrame(frame);
    });

    // ── Scene lab ────────────────────────────────────────
    const SCREENS = [["menu", "Menu"], ...TABS.map((t) => [t.id, t.label])];
    const SLIDERS = [
      ["sun", 1, "Sun height", .1, .85, .01], ["sun", 0, "Sun position", 0, 1, .01], ["sun", 2, "Sun size", .015, .16, .001],
      ["fogAmt", -1, "Fog", 0, 3, .05], ["cloud", -1, "Clouds", 0, 2, .05], ["stars", -1, "Stars", 0, 3, .05],
      ["aurora", -1, "Aurora", 0, 1.5, .05], ["embers", -1, "Embers", 0, 4, .05], ["rough", -1, "Roughness", .3, 2, .05],
    ];
    const labEl = $("#lab"), labBtn = $("#lab-btn"), sndBtn = $("#snd-btn");
    const presetsEl = $("#lab-presets"), typesEl = $("#lab-types"), mapEl = $("#lab-map"), slidersEl = $("#lab-sliders");
    const typeLabel = (t) => (window.E0_SCENES ? E0_SCENES.types[t].label : t);
    const css = (c) => `rgb(${c.map((v) => Math.round(Math.min(1, v) * 255)).join(",")})`;
    const screenKey = () => (state === "sub" ? TABS[tabIdx].id : "menu");
    const clockPreset = () => { const h = new Date().getHours(); return h >= 5 && h < 8 ? "dawn" : h >= 8 && h < 17 ? "golden" : h >= 17 && h < 20 ? "dusk" : "night"; };
    const activeId = () => (lab.clock ? clockPreset() : lab.per ? lab.map[screenKey()].preset : lab.preset);
    const activeType = () => (lab.per ? lab.map[screenKey()].type : lab.type);
    const save = () => {
      store.set("preset", lab.preset); store.set("type", lab.type); store.set("per", lab.per); store.set("map", lab.map);
      store.set("clock", lab.clock);
      store.set("autores", lab.autoRes); store.set("res", lab.res);
      store.set("pstyle", lab.pstyle); store.set("attr", lab.attr); store.set("trail", lab.trail);
      store.set("pbright", lab.pbright); store.set("density", lab.density); store.set("pcolor", lab.pcolor);
    };

    function applyScene() {
      const P = PRESETS[activeId()];
      sceneTarget = P;
      document.documentElement.style.setProperty("--sun", P.accent);
      if (engine) engine.setScene(activeType());
      refreshLab();
    }

    presetsEl.innerHTML = Object.entries(PRESETS).map(([id, P]) =>
      `<button class="chip" type="button" data-id="${id}"><i style="background:linear-gradient(${css(P.top)}, ${css(P.mid)} 45%, ${css(P.hor)} 70%, ${css(P.near)} 72%)"></i>${P.name}</button>`).join("");
    presetsEl.addEventListener("click", (e) => {
      const b = e.target.closest(".chip"); if (!b) return;
      if (lab.per) lab.map[screenKey()].preset = b.dataset.id; else lab.preset = b.dataset.id;
      if (lab.clock) lab.clock = false;
      save(); Sound.play("move"); applyScene();
    });
    typesEl.innerHTML = TYPES.map((t) => `<button class="chip" type="button" data-t="${t}">${esc(typeLabel(t))}</button>`).join("");
    typesEl.addEventListener("click", (e) => {
      const b = e.target.closest(".chip"); if (!b) return;
      if (lab.per) lab.map[screenKey()].type = b.dataset.t; else lab.type = b.dataset.t;
      save(); Sound.play("move"); applyScene();
    });

    const opts = Object.entries(PRESETS).map(([id, P]) => `<option value="${id}">${P.name}</option>`).join("");
    const typeOpts = TYPES.map((t) => `<option value="${t}">${esc(typeLabel(t))}</option>`).join("");
    mapEl.innerHTML = SCREENS.map(([k, label]) => `<span data-k="${k}">${esc(label)}</span>
      <select data-k="${k}" data-f="type" aria-label="Scene for ${esc(label)}">${typeOpts}</select>
      <select data-k="${k}" data-f="preset" aria-label="Palette for ${esc(label)}">${opts}</select>`).join("");
    mapEl.addEventListener("change", (e) => { lab.map[e.target.dataset.k][e.target.dataset.f] = e.target.value; save(); applyScene(); });
    $("#lab-clock").addEventListener("change", (e) => { lab.clock = e.target.checked; save(); applyScene(); });
    $("#lab-view").addEventListener("change", (e) => setView(+e.target.value));
    $("#lab-autores").addEventListener("change", (e) => { lab.autoRes = e.target.checked; save(); refreshLab(); });
    $("#lab-res").addEventListener("input", (e) => { lab.res = +e.target.value; $("#lab-res-out").textContent = Math.round(lab.res * 100) + "%"; save(); });

    const PSTYLES = [["flow", "Flow"], ["attractor", "Attractor"], ["galaxy", "Galaxy"], ["shapes", "Shapes"], ["gravity", "Gravity waves"], ["swarm", "Swarm"]];
    const pstylesEl = $("#lab-pstyles");
    pstylesEl.innerHTML = PSTYLES.map(([id, label]) => `<button class="chip" type="button" data-p="${id}">${label}</button>`).join("");
    pstylesEl.addEventListener("click", (e) => {
      const b = e.target.closest(".chip"); if (!b) return;
      lab.pstyle = b.dataset.p; save(); Sound.play("move"); refreshLab();
    });
    $("#lab-attr").addEventListener("change", (e) => { lab.attr = +e.target.value; save(); });
    $("#lab-trail").addEventListener("input", (e) => { lab.trail = +e.target.value; $("#lab-trail-out").textContent = lab.trail.toFixed(2); save(); });
    $("#lab-pbright").addEventListener("input", (e) => { lab.pbright = +e.target.value; $("#lab-pbright-out").textContent = lab.pbright.toFixed(2); save(); });
    $("#lab-density").addEventListener("change", (e) => { lab.density = +e.target.value; save(); });
    $("#lab-pcolor").addEventListener("change", (e) => { lab.pcolor = +e.target.value; save(); });

    const VIEW_NAMES = ["Final", "Wireframe", "Normals", "Depth", "Cost heat map"];
    function setView(v) {
      lab.debug = v;
      $("#lab-view").value = String(v);
      $("#dbg-name").textContent = VIEW_NAMES[v];
      $("#dbg").classList.toggle("is-on", v > 0);
      Sound.play("tab");
    }

    // Frame-time readout + graph (lab and debug HUD)
    let perfNext = 0;
    function drawGraph(cv) {
      const st = engine.stats, x = cv.getContext("2d"), W = cv.width, H = cv.height, n = st.history.length;
      x.clearRect(0, 0, W, H);
      const max = 40, bw = W / n;
      for (let i = 0; i < n; i++) {
        const v = st.history[(st.head + i) % n];
        const h = Math.min(1, v / max) * H;
        x.fillStyle = v > 20 ? "#ff6b6b" : v > 17.5 ? "#ffc978" : "#5af0ff";
        x.fillRect(i * bw, H - h, Math.max(1, bw - .5), h);
      }
      const y = H - (16.67 / max) * H;
      x.fillStyle = "rgba(255,255,255,.45)"; x.fillRect(0, Math.round(y), W, 1);
    }
    function updatePerf(now) {
      if (!engine || now < perfNext) return;
      perfNext = now + 150;
      const st = engine.stats;
      const txt = `${st.ms.toFixed(1)} ms · ${Math.round(st.fps)} fps · res ${Math.round(st.scale * 100)}%` + (st.gpuMs != null ? ` · GPU ${st.gpuMs.toFixed(1)} ms` : "");
      if (labEl.classList.contains("is-open")) { $("#lab-perf").textContent = txt; drawGraph($("#lab-graph")); }
      if (lab.debug) { $("#dbg-perf").textContent = txt; drawGraph($("#dbg-graph")); }
    }
    $("#lab-per").addEventListener("change", (e) => { lab.per = e.target.checked; save(); applyScene(); });

    slidersEl.innerHTML = SLIDERS.map(([k, j, label, min, max, step], n) =>
      `<label class="slider"><span>${label}</span><input type="range" data-n="${n}" min="${min}" max="${max}" step="${step}"><output></output></label>`).join("");
    slidersEl.addEventListener("input", (e) => {
      const [k, j] = SLIDERS[+e.target.dataset.n];
      const P = PRESETS[activeId()], v = +e.target.value;
      if (j >= 0) P[k][j] = v; else P[k] = v;
      e.target.nextElementSibling.textContent = v.toFixed(2);
      store.set("presets", PRESETS);
    });
    $("#lab-reset").addEventListener("click", () => {
      const id = activeId();
      PRESETS[id] = clone(DEFAULTS[id]);
      store.set("presets", PRESETS);
      applyScene();
    });

    function refreshLab() {
      const id = activeId(), P = PRESETS[id];
      $("#lab-where").textContent = lab.per ? SCREENS.find(([k]) => k === screenKey())[1] : "All screens";
      $("#lab-editing").textContent = P.name;
      presetsEl.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-on", c.dataset.id === id));
      typesEl.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-on", c.dataset.t === activeType()));
      $("#lab-per").checked = lab.per;
      mapEl.hidden = !lab.per;
      mapEl.querySelectorAll("select").forEach((s) => (s.value = lab.map[s.dataset.k][s.dataset.f]));
      $("#lab-clock").checked = lab.clock;
      $("#lab-clock-note").textContent = lab.clock
        ? `It's ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} here, so: ${PRESETS[clockPreset()].name}. Dawn 5–8, Golden 8–17, Dusk 17–20, Night after.`
        : "";
      $("#lab-particles").hidden = activeType() !== "particles";
      pstylesEl.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-on", c.dataset.p === lab.pstyle));
      $("#lab-pstyle-name").textContent = PSTYLES.find(([id]) => id === lab.pstyle)[1];
      $("#lab-attr").hidden = lab.pstyle !== "attractor";
      $("#lab-attr").value = String(lab.attr);
      $("#lab-trail").value = lab.trail; $("#lab-trail-out").textContent = lab.trail.toFixed(2);
      $("#lab-pbright").value = lab.pbright; $("#lab-pbright-out").textContent = lab.pbright.toFixed(2);
      $("#lab-density").value = String(lab.density);
      $("#lab-pcolor").value = String(lab.pcolor);
      if (engine && !engine.floatOK) $("#lab-pnote").textContent = "This browser can't run the particle simulation (no float render targets), so only the sky shows.";
      $("#lab-autores").checked = lab.autoRes;
      $("#lab-res").disabled = lab.autoRes;
      $("#lab-res").value = lab.res; $("#lab-res-out").textContent = Math.round(lab.res * 100) + "%";
      mapEl.querySelectorAll("span").forEach((s) => s.classList.toggle("is-here", s.dataset.k === screenKey()));
      slidersEl.querySelectorAll("input").forEach((inp) => {
        const [k, j] = SLIDERS[+inp.dataset.n];
        const v = j >= 0 ? P[k][j] : P[k];
        inp.value = v; inp.nextElementSibling.textContent = (+v).toFixed(2);
      });
    }

    function toggleLab(force) {
      const open = force ?? !labEl.classList.contains("is-open");
      labEl.classList.toggle("is-open", open);
      labBtn.setAttribute("aria-expanded", open);
      if (!open && labEl.contains(document.activeElement)) document.activeElement.blur();
    }
    labBtn.addEventListener("click", () => toggleLab());
    $("#lab-close").addEventListener("click", () => toggleLab(false));

    function setSound(v) {
      Sound.setOn(v);
      sndBtn.setAttribute("aria-pressed", v);
      $("#lab-snd").checked = v;
      if (v) { Sound.init(); Sound.play("move"); }
    }
    sndBtn.addEventListener("click", () => setSound(!Sound.on));
    $("#lab-snd").addEventListener("change", (e) => setSound(e.target.checked));
    const volEl = $("#lab-vol");
    volEl.value = Sound.vol; $("#lab-vol-out").textContent = Math.round(Sound.vol * 100);
    volEl.addEventListener("input", () => { Sound.setVol(+volEl.value); $("#lab-vol-out").textContent = Math.round(volEl.value * 100); });
    volEl.addEventListener("change", () => Sound.play("move"));
    sndBtn.setAttribute("aria-pressed", Sound.on); $("#lab-snd").checked = Sound.on;

    $("#lab-copy").addEventListener("click", async (e) => {
      const used = lab.per ? [...new Set(Object.values(lab.map).map((v) => v.preset))] : [lab.clock ? clockPreset() : lab.preset];
      const out = {
        perSection: lab.per, scene: lab.type, palette: lab.preset, clock: lab.clock, map: lab.per ? lab.map : undefined,
        particles: { style: lab.pstyle, attractor: lab.attr, trails: lab.trail, brightness: lab.pbright, count: lab.density * lab.density, colour: lab.pcolor },
        palettes: Object.fromEntries(used.map((id) => [id, PRESETS[id]])),
      };
      const btn = e.currentTarget;
      try { await navigator.clipboard.writeText(JSON.stringify(out, null, 1)); btn.textContent = "Copied!"; }
      catch { btn.textContent = "Copy failed"; }
      setTimeout(() => (btn.textContent = "Copy settings"), 1600);
    });

    // ── Boot ─────────────────────────────────────────────
    selectMenu(0, true);
    applyScene();
    Object.assign(scene, clone(sceneTarget));
    const deep = TABS.findIndex((t) => "#" + t.id === location.hash);
    if (deep >= 0) { setState("menu"); openSub(deep, true); }
  })();
