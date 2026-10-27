  (() => {
    // ── Structure ─────────────────────────────────────────
    // Sections and their page URLs, from <script id="site-data"> (layouts/all.html). Each page arrives with its own
    // section's screen already rendered; the other sections' screens are taken from their pages (see Sections below).
    const DATA = JSON.parse(document.getElementById("site-data").textContent);
    const EMAIL = DATA.email;
    const TABS = DATA.tabs;

    // ── Elements ─────────────────────────────────────────
    const $ = (s) => document.querySelector(s);
    const narrow = matchMedia("(max-width: 900px)");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const body = document.body;
    const menuEl = $("#menu"), tabsEl = $("#tabs"), pane = $("#pane"), detail = $("#detail"), meta = $("#sub-meta"), sweep = $("#sweep");
    document.querySelectorAll(".year").forEach((y) => (y.textContent = new Date().getFullYear()));
    const pad2 = (n) => String(n).padStart(2, "0");
    // Menu entries and tabs are real links to their pages: a plain click stays in the menu,
    // a middle/modified click opens the page as usual
    const plainClick = (e) => !(e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);

    const menuBtns = [...menuEl.querySelectorAll("a")];
    const tabBtns = [...tabsEl.querySelectorAll(".tab")];

    // ── Persistence (per-viewer convenience only) ────────
    const store = {
      get(k, d) { try { const v = localStorage.getItem("e0lab12:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
      set(k, v) { try { localStorage.setItem("e0lab12:" + k, JSON.stringify(v)); } catch {} },
      // Forget every saved scene-lab setting (any version of the key prefix)
      clear() { try { Object.keys(localStorage).filter((k) => k.startsWith("e0lab")).forEach((k) => localStorage.removeItem(k)); } catch {} },
    };

    // ── Palettes (linear-ish RGB 0–1; accent is the UI colour) ──
    const PALETTES = {
      dusk:   { name: "Dusk",   accent: "#ffc978", top: [.07, .04, .16], mid: [.42, .14, .42], hor: [1, .5, .32], glow: [1, .82, .55], fog: [1, .55, .45], sunCol: [1, .82, .55] },
      golden: { name: "Golden", accent: "#ffd27a", top: [.16, .2, .42], mid: [.82, .45, .32], hor: [1, .7, .38], glow: [1, .92, .7], fog: [1, .76, .55], sunCol: [1, .95, .75] },
      dawn:   { name: "Dawn",   accent: "#ffd3c4", top: [.22, .3, .55], mid: [.66, .52, .72], hor: [1, .74, .68], glow: [1, .95, .86], fog: [.95, .8, .85], sunCol: [1, .97, .9] },
      night:  { name: "Night",  accent: "#a9c4ff", top: [.01, .02, .06], mid: [.04, .07, .18], hor: [.12, .18, .35], glow: [.6, .7, .9], fog: [.3, .4, .6], sunCol: [.92, .95, 1] },
      mist:   { name: "Mist",   accent: "#f2f4f7", top: [.28, .32, .4], mid: [.48, .53, .6], hor: [.74, .77, .8], glow: [.95, .95, .92], fog: [.8, .83, .86], sunCol: [1, 1, .95] },
      ember:  { name: "Ember",  accent: "#ff8a4d", top: [.06, .01, .02], mid: [.35, .04, .04], hor: [1, .3, .1], glow: [1, .6, .25], fog: [.9, .3, .15], sunCol: [1, .5, .2] },
      alien:  { name: "Alien",  accent: "#8dffcf", top: [.02, .1, .12], mid: [.05, .4, .42], hor: [.5, 1, .75], glow: [.85, 1, .8], fog: [.4, .95, .8], sunCol: [.9, 1, .85] },
      arctic: { name: "Arctic", accent: "#bfe3ff", top: [.05, .12, .3], mid: [.3, .55, .8], hor: [.8, .9, 1], glow: [1, 1, 1], fog: [.8, .9, 1], sunCol: [1, 1, 1] },
    };
    const PALETTE_KEYS = ["top", "mid", "hor", "glow", "fog", "sunCol"];
    const lab = {
      preset: PALETTES[store.get("preset")] ? store.get("preset") : "arctic",
      autoRes: store.get("autores", true) !== false,
      trail: +store.get("trail", 1),
      pbright: +store.get("pbright", .2),
      density: +store.get("density", 512),
      pcolor: +store.get("pcolor", 0),
      grid: !!store.get("grid", true),
      gridAmt: +store.get("gridamt", .03),
      res: +store.get("res", 1),
    };
    // Live palette, eased toward the selected one each frame
    const palette = Object.fromEntries(PALETTE_KEYS.map((k) => [k, [...PALETTES[lab.preset][k]]]));

    // ── Sound: tiny synthesized UI sounds (no audio files) ─
    const Sound = (() => {
      let ctx, master, wet, lastMove = 0;
      const VOLUME = .3;   // master gain for all UI sounds
      let on = store.get("snd", true);
      const level = () => (on ? VOLUME : 0);
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
        get on() { return on; },
        setOn(v) { on = v; store.set("snd", v); if (master) master.gain.value = level(); },
      };
    })();
    addEventListener("pointerdown", () => Sound.init(), true);
    addEventListener("keydown", () => Sound.init(), true);

    // ── State ────────────────────────────────────────────
    let state = "splash", menuIdx = 0, tabIdx = 0, rowIdx = 0, pushed = false;
    // instant: no sound, sweep or easing (a page that was loaded directly just appears)
    const setState = (s, instant) => {
      const from = state;
      state = s;
      if (!instant) {
        if (from === "splash" && s === "menu") Sound.play("start");
        else if (s === "sub" && from !== "sub") Sound.play("select");
        else if (from !== s && from !== "splash") Sound.play("back");
      }
      body.classList.toggle("is-splash", s === "splash");
      body.classList.toggle("is-menu", s === "menu");
      body.classList.toggle("is-sub", s === "sub");
      view.target = s === "sub" ? 1 : 0;
      if (instant) view.v = view.target;
      else { sweep.classList.remove("go"); void sweep.offsetWidth; sweep.classList.add("go"); }
      applyScene();
    };
    const anim = (el, cls) => { el.classList.remove("swap-l", "swap-r", "swap-f"); void el.offsetWidth; el.classList.add(cls); };

    // ── URLs: every section has its own page (layouts/), the address bar follows the screen ──
    function syncUrl(push) {
      const t = TABS[tabIdx];
      const at = state !== "sub" ? DATA : t;
      const url = at.url || DATA.home;
      document.title = at.title;
      if (push) history.pushState({ sub: t.id }, "", url);
      else if (location.pathname !== url || location.hash) history.replaceState(state === "sub" ? { sub: t.id } : null, "", url);
    }
    // Page path → section index, or -1 for the home page
    const route = (path) => TABS.findIndex((t) => t.url === path);

    const selectMenu = (i, silent) => {
      const next = (i + TABS.length) % TABS.length;
      if (next !== menuIdx && !silent) Sound.play("move");
      menuIdx = next;
      menuBtns.forEach((b, k) => b.classList.toggle("is-active", k === menuIdx));
    };

    // Live local time for any [data-clock] on screen
    function tickClocks() {
      document.querySelectorAll("[data-clock]").forEach((el) => {
        try { el.textContent = new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit", timeZone: el.dataset.clock }).format(new Date()); } catch {}
      });
    }
    setInterval(tickClocks, 15000);

    // ── Contact: a small terminal that composes an email ──
    // Flow: name → email → company (optional) → message (multi-line) → confirm → send.
    // Sends via params.contactEndpoint (JSON POST) when set, otherwise opens a mailto: link.
    let activeGame = null;   // the hidden raycaster, while it runs (gets gamepad input)
    function mountTerminal(root, cfg) {
      const out = root.querySelector(".term__out"), input = root.querySelector(".term__in"), promptEl = root.querySelector(".term__prompt");
      const scroller = root.querySelector(".term__body");
      const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      let step, msg, lines, busy = false;
      const print = (text, cls = "") => {
        const p = document.createElement("div");
        p.className = "term__o " + cls;
        p.textContent = text;
        out.appendChild(p);
        scroller.scrollTop = scroller.scrollHeight;
      };
      const echo = (text) => print(promptEl.textContent + text, "echo");
      const STEPS = {
        name: { prompt: "? your name › " },
        email: { prompt: "? email › " },
        company: { prompt: "? company (optional) › " },
        message: { prompt: "  " },
        confirm: { prompt: `Send this to ${EMAIL}? [Y/n] › ` },
        done: { prompt: "guest@event-0:~$ " },
      };
      const go = (s) => { step = s; promptEl.textContent = STEPS[s].prompt; input.value = ""; };
      const start = (fresh) => {
        if (fresh) out.textContent = "";
        msg = { name: "", email: "", company: "", message: "" }; lines = [];
        cfg.banner.forEach((b) => print(b, "dim"));
        print("Ctrl+C to cancel.", "dim");
        print("guest@event-0:~$ ./contact", "echo");
        go("name");
      };
      const help = () => {
        print("commands: help · clear · restart · email · exit · Ctrl+C to cancel", "dim");
        print("Answer each prompt and press Enter. Finish the message with an empty line.", "dim");
        if (cfg.tips?.length) print("Good things to include: " + cfg.tips.join("; ") + ".", "dim");
      };
      async function send() {
        busy = true; input.disabled = true;
        const subject = `New project enquiry from ${msg.name}${msg.company ? ` (${msg.company})` : ""}`;
        const bodyText = `${msg.message}\n\n— ${msg.name}${msg.company ? `, ${msg.company}` : ""}\n${msg.email}`;
        if (cfg.endpoint) {
          print("sending…", "dim");
          try {
            const r = await fetch(cfg.endpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify({
                ...(cfg.key ? { access_key: cfg.key } : {}),   // Web3Forms
                name: msg.name, email: msg.email, company: msg.company, message: msg.message, subject,
                from_name: "event-0.com contact", replyto: msg.email, _replyto: msg.email,
                botcheck: "", _gotcha: "",                      // honeypots (Web3Forms / Formspree)
              }) });
            if (!r.ok) throw new Error(r.status);
            Sound.play("select");
            print("✓ Message sent. We'll get back to you soon.", "ok");
          } catch (err) {
            Sound.play("bump");
            print(`✗ Couldn't send (${err.message}). Please email ${EMAIL} directly.`, "err");
          }
        } else {
          Sound.play("select");
          location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
          print("✓ Opening your mail app with the message ready to send.", "ok");
          print(`  Nothing happened? Email ${EMAIL} directly.`, "dim");
        }
        busy = false; input.disabled = false;
        print("Type `restart` to write another message.", "dim");
        go("done"); input.focus();
      }
      // Hidden easter egg: `./do-not-run` launches an ASCII raycaster inside the terminal
      let game = null;
      const body = root.querySelector(".term__body"), line = root.querySelector(".term__line");
      function launchGame() {
        if (!window.E0Raycaster) return print("permission denied", "err");
        print("WARNING: this program was not meant to be run.", "err");
        print("loading e0engine…", "dim");
        setTimeout(() => {
          out.hidden = true; line.style.position = "absolute"; line.style.opacity = "0"; line.style.pointerEvents = "none";
          game = activeGame = E0Raycaster.start(body, {
            sound: (k) => Sound.play(k),
            onExit: (message) => {
              game = activeGame = null;
              out.hidden = false; line.style.position = ""; line.style.opacity = ""; line.style.pointerEvents = "";
              print(message, "ok");
              input.focus();
              scroller.scrollTop = scroller.scrollHeight;
            },
          });
          input.focus();
        }, 700);
      }
      input.addEventListener("keyup", (e) => { if (game) game.key(e, false); });
      input.addEventListener("keydown", (e) => {
        // Ctrl+C: interrupt like a shell (unless there's a text selection to copy)
        if (e.ctrlKey && (e.key === "c" || e.key === "C") && input.selectionStart === input.selectionEnd && !window.getSelection().toString()) {
          e.preventDefault(); e.stopPropagation();
          if (game) return game.stop("^C");
          if (busy) return;
          if (step === "done") { print(promptEl.textContent + input.value + "^C", "echo"); input.value = ""; return; }
          print(promptEl.textContent + input.value + "^C", "echo");
          Sound.play("back");
          lines = [];
          print("run ./contact to start again", "dim");
          go("done");
          return;
        }
        if (game) { e.stopPropagation(); return game.key(e, true); }
        if (e.key === "Escape") { input.blur(); e.stopPropagation(); return; }
        if (e.key === "l" && e.ctrlKey) { e.preventDefault(); out.textContent = ""; return; }
        if (e.key !== "Enter" || busy) return;
        e.preventDefault();
        const raw = input.value, v = raw.trim();
        echo(raw);
        input.value = "";
        const cmd = v.toLowerCase();
        // Commands only work at the shell prompt; inside ./contact everything typed is an answer
        if (step === "done") {
          if (!cmd) return;
          if (cmd === "help") { help(); input.value = ""; return; }
          if (cmd === "clear") { out.textContent = ""; input.value = ""; return; }
          if (cmd === "restart") { Sound.play("back"); start(true); return; }
          if (cmd === "email") { print(EMAIL); input.value = ""; return; }
          if (cmd === "exit") { back(); return; }
          if (cmd === "ls" || cmd === "ls -la" || cmd === "ls -l") { print("contact*   README.md   do-not-run*", "dim"); return; }
          // A tiny pretend filesystem: cat/less/more/head on the three files `ls` shows
          const view = cmd.match(/^(cat|less|more|head)\s+(\S+)$/);
          if (view) {
            const file = view[2].replace(/^\.\//, "");
            if (file === "readme.md") { (cfg.readme || []).forEach((l) => print(l || " ", l.startsWith("#") ? "q" : "")); return; }
            if (file === "do-not-run" || file === "contact") { print(`${view[1]}: ${file}: binary file (e0engine v0.0.1, x86_64), refusing to print`, "err"); return; }
            print(`${view[1]}: ${view[2]}: No such file or directory`, "err"); return;
          }
          if (cmd === "./do-not-run" || cmd === "do-not-run" || cmd === "sh do-not-run") { launchGame(); return; }
          if (step === "done" && (cmd === "./contact" || cmd === "contact")) { Sound.play("select"); msg = { name: "", email: "", company: "", message: "" }; lines = []; go("name"); return; }
        }
        Sound.play("move");
        if (step === "name") {
          if (!v) return print("  please tell us your name", "err");
          msg.name = v; go("email");
        } else if (step === "email") {
          if (!EMAIL_RE.test(v)) return print("  that doesn't look like an email address", "err");
          msg.email = v; go("company");
        } else if (step === "company") {
          msg.company = v;
          print("? message (finish with an empty line)", "q");
          if (cfg.tips?.length) print("  e.g. " + cfg.tips.slice(0, 3).join(" · "), "dim");
          go("message");
        } else if (step === "message") {
          if (v || lines.length === 0) {
            if (!v) return print("  write at least a line", "err");
            lines.push(raw.replace(/\s+$/, "")); input.value = ""; return;
          }
          msg.message = lines.join("\n");
          print("──────────────", "dim");
          print(`from: ${msg.name} <${msg.email}>${msg.company ? ` · ${msg.company}` : ""}`, "dim");
          print(`${lines.length} line${lines.length > 1 ? "s" : ""}, ${msg.message.length} characters`, "dim");
          go("confirm");
        } else if (step === "confirm") {
          if (cmd === "" || cmd === "y" || cmd === "yes") send();
          else { print("  cancelled. Type `restart` to begin again.", "dim"); go("done"); }
        } else {
          print(`${v.split(" ")[0]}: command not found. Try \`help\`.`, "err");
          input.value = "";
        }
      });
      root.querySelector(".term").addEventListener("click", () => { if (!window.getSelection().toString()) input.focus(); });
      start(false);
      if (!narrow.matches) setTimeout(() => input.focus({ preventScroll: true }), 450);
    }

    // Main-menu caption describing the background (content/_index.md → caption)
    let capDensity = 0;
    function updateCaption() {
      if (lab.density === capDensity) return;
      capDensity = lab.density;
      const c = DATA.caption || {};
      $("#scene-cap").hidden = !c.title;
      $("#scene-cap-t").textContent = c.title || "";
      $("#scene-cap-d").textContent = (c.text || "").replace("{count}", (lab.density * lab.density).toLocaleString("en-US"));
    }

    // The selected item's details: its hidden block in the section's screen, shown in the detail panel (or the grid's corner)
    function renderDetail(dir, instant) {
      const src = pane.querySelector(`[data-detail="${rowIdx}"]`);
      if (!src) return;
      const target = TABS[tabIdx].layout === "grid" ? pane.querySelector("#lvl-info") : detail;
      if (instant && target.childElementCount) return;   // the page arrived with it
      target.innerHTML = src.innerHTML;
      if (!instant) anim(target, dir || "swap-f");
    }

    // byPointer: selected by hover/click, so don't scroll the list (only keyboard/gamepad moves scroll it)
    const selectRow = (i, quiet, byPointer) => {
      const next = Math.max(0, Math.min(TABS[tabIdx].items - 1, i));
      if (next !== i) Sound.play("bump");
      if (next === rowIdx && quiet !== true && pane.querySelector(".row.is-active, .cell.is-active")) return;
      if (next !== rowIdx) Sound.play("move");
      rowIdx = next;
      pane.querySelectorAll(".row, .cell").forEach((b, k) => b.classList.toggle("is-active", k === rowIdx));
      if (!byPointer) pane.querySelector(".row.is-active, .cell.is-active")?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
      renderDetail();
    };

    // ── Sections: each page arrives with its own section's screen (layouts/_partials/pane.html); the others are
    // fetched from their pages once, in the background, and swapped in, so switching never reloads the page ──
    const panes = {};      // section id → its screen's markup
    const loading = {};
    function loadPane(t) {
      return (loading[t.id] ||= fetch(t.url)
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then((html) => { panes[t.id] = new DOMParser().parseFromString(html, "text/html").getElementById("pane").innerHTML; })
        .catch((err) => { delete loading[t.id]; throw err; }));
    }

    // instant: the page just loaded on it
    function renderTab(i, dir, instant) {
      tabIdx = (i + TABS.length) % TABS.length;
      rowIdx = 0;
      const t = TABS[tabIdx];
      tabBtns.forEach((b, k) => b.setAttribute("aria-selected", k === tabIdx));
      tabBtns[tabIdx].scrollIntoView({ block: "nearest", inline: "nearest" });
      meta.textContent = `${pad2(tabIdx + 1)} / ${pad2(TABS.length)}`;
      if (state === "sub") syncUrl();
      if (dir) { Sound.play("tab"); kick(); }
      if (panes[t.id] != null) return showPane(dir, instant);
      // Not fetched yet (the prefetch usually gets there first): show it the moment it arrives, or go to its page
      pane.replaceChildren(); detail.replaceChildren();
      loadPane(t).then(() => TABS[tabIdx] === t && showPane(dir), () => (location.href = t.url));
    }
    function showPane(dir, instant) {
      const t = TABS[tabIdx], grid = t.layout === "grid", page = t.layout === "team" || t.layout === "terminal";
      body.classList.toggle("is-grid", grid);
      body.classList.toggle("is-page", page);
      body.classList.toggle("is-term", t.layout === "terminal");
      $("#nav-kb").textContent = grid ? "↑↓←→" : "↑↓";
      // Fresh markup every time (so listeners never pile up), except the screen the page arrived with
      if (!instant || pane.dataset.section !== t.id) { pane.innerHTML = panes[t.id]; pane.dataset.section = t.id; }
      const swap = dir === -1 ? "swap-l" : dir === 1 ? "swap-r" : "swap-f";
      if (!instant) anim(pane, swap);
      pane.querySelectorAll(".row, .cell").forEach((b) => {
        const k = +b.dataset.i;
        b.classList.toggle("is-active", k === rowIdx);
        b.addEventListener("mouseenter", () => { if (lastInput !== "pad") selectRow(k, false, true); });
        b.addEventListener("click", () => {
          selectRow(k, false, true);
          if (grid) Sound.play("select");
          else if (narrow.matches) detail.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        });
      });
      pane.querySelectorAll("[data-goto]").forEach((b) => b.addEventListener("click", (e) => {
        const i = TABS.findIndex((x) => x.id === b.dataset.goto);
        if (i < 0 || !plainClick(e)) return;
        e.preventDefault();
        renderTab(i, i > tabIdx ? 1 : -1);
      }));
      tickClocks();
      if (t.terminal) mountTerminal(pane, t.terminal);
      if (!page) renderDetail(swap, instant);
      applyScene();
    }

    function openSub(i, fromHistory, instant) {
      renderTab(i, 0, instant);
      selectMenu(i, true);
      if (!instant) kick();
      setState("sub", instant);
      syncUrl(!fromHistory);
      if (!fromHistory) pushed = true;
    }
    function back(fromHistory) {
      if (state === "sub") {
        setState("menu");
        if (!fromHistory) {
          if (pushed) { pushed = false; history.back(); }
          else syncUrl();
        }
        document.title = DATA.title;
        menuBtns[menuIdx].focus({ preventScroll: true });
      } else if (state === "menu") {
        setState("splash");
      }
    }
    function activate() {
      if (state === "splash") return setState("menu");
      if (state === "menu") return openSub(menuIdx);
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
        // Single-page screens (Team, Contact…) have no list: up/down scroll them instead
        if (["page", "team", "terminal"].includes(TABS[tabIdx].layout) || !TABS[tabIdx].items) {
          // Accumulate presses so holding the key keeps scrolling smoothly
          const el = narrow.matches ? document.querySelector(".sub") : pane.querySelector(".pg__body, .tm, .term__body");
          if (!el) return;
          const max = el.scrollHeight - el.clientHeight;
          const from = Math.abs((el._scrollGoal ?? el.scrollTop) - el.scrollTop) < 4 ? el.scrollTop : el._scrollGoal;
          el._scrollGoal = Math.max(0, Math.min(max, from + d * 180));
          if (el._scrollGoal === from) return Sound.play("bump");
          return el.scrollTo({ top: el._scrollGoal, behavior: reduce ? "auto" : "smooth" });
        }
        if (!isGrid()) return selectRow(rowIdx + d);
        const next = rowIdx + d * gridCols();
        if (next < 0 || next >= TABS[tabIdx].items) return Sound.play("bump");
        selectRow(next);
      }
    };
    // Left/right only move across the poster grid; tabs switch with Q/E (LB/RB) as the top bar shows
    const side = (d) => {
      if (!isGrid()) return;
      const cols = gridCols(), col = rowIdx % cols, next = rowIdx + d;
      if (col + d < 0 || col + d >= cols || next >= TABS[tabIdx].items) return Sound.play("bump");
      selectRow(next);
    };
    const tab = (d) => { if (state === "sub") renderTab(tabIdx + d, d); };

    // ── Input: mouse ─────────────────────────────────────
    let lastInput = "kb";
    const setInput = (k) => { if (k === lastInput) return; lastInput = k; body.classList.toggle("is-pad", k === "pad"); };
    menuBtns.forEach((b, i) => {
      b.addEventListener("mouseenter", () => selectMenu(i));
      b.addEventListener("focus", () => selectMenu(i));
      b.addEventListener("click", (e) => { if (!plainClick(e)) return; e.preventDefault(); openSub(i); });
    });
    tabBtns.forEach((b, i) => b.addEventListener("click", (e) => {
      if (!plainClick(e)) return;
      e.preventDefault();
      if (i !== tabIdx) renderTab(i, i > tabIdx ? 1 : -1);
    }));
    document.querySelectorAll("[data-tab-step]").forEach((b) => b.addEventListener("click", () => tab(+b.dataset.tabStep)));
    $("#back").addEventListener("click", () => back());
    $("#brand").addEventListener("click", () => back());
    $("#splash").addEventListener("click", () => state === "splash" && setState("menu"));
    addEventListener("mousemove", () => setInput("kb"));
    addEventListener("contextmenu", (e) => { if (state === "sub") { e.preventDefault(); back(); } });

    // ── Input: keyboard ──────────────────────────────────
    addEventListener("keydown", (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.matches && e.target.matches("input, select, textarea")) { if (e.key === "Escape") toggleLab(false); return; }
      const t = e.target;
      if (t.matches && t.matches("input, select, textarea")) { if (e.key === "Escape") toggleLab(false); return; }
      if (t.closest && t.closest(".lab, .tools") && (e.key === "Enter" || e.key === " ")) return;
      if (e.key === "Escape" && palPop.classList.contains("is-open")) { e.preventDefault(); return togglePal(false); }
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
      const to = route(location.pathname);
      if (to >= 0) { pushed = false; if (state !== "sub") openSub(to, true); else renderTab(to, 0); }
      else if (state === "sub") { pushed = false; back(true); }
    });

    // ── Input: gamepad (standard mapping) ────────────────
    const prev = [];
    let axisDir = 0, axisNext = 0, axisXDir = 0, axisXNext = 0;
    function pollPad(now) {
      const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
      const p = pads[0];
      if (!p) return;
      if (activeGame) { activeGame.pad(p); p.buttons.forEach((b, i) => (prev[i] = b.pressed)); return; }
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

    let impulse = 0, shift = 0;
    const kick = () => { impulse = 1; };   // one-frame burst through the particles

    const start = performance.now();
    let last = start;
    // First frame waits a tick so everything below (scene lab) is initialised.
    requestAnimationFrame(function frame(now) {
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      // Critically damped ease toward the target view (snappy, no overshoot).
      view.v += (view.target - view.v) * (reduce ? 1 : 1 - Math.exp(-dt * 5));
      const ks = reduce ? 1 : 1 - Math.exp(-dt * 2.5);
      const target = PALETTES[lab.preset];
      for (const k of PALETTE_KEYS) for (let j = 0; j < 3; j++) palette[k][j] += (target[k][j] - palette[k][j]) * ks;
      // The attractor sits to the right of the main menu so it doesn't fight the text
      const shiftT = state === "menu" && !narrow.matches ? innerWidth / innerHeight * .32 : 0;
      shift += (shiftT - shift) * (reduce ? 1 : 1 - Math.exp(-dt * 2));
      if (engine) engine.setParticles({ trail: lab.trail, bright: lab.pbright, density: lab.density, color: lab.pcolor });
      updateCaption();
      if (engine) engine.render({
        t: reduce ? 20 : (now - start) / 1000 + 20, dt, view: view.v, palette,
        impulse,
        autoRes: lab.autoRes, res: lab.res, reduce, shift, grid: lab.grid ? lab.gridAmt : 0,
      });
      impulse = 0;
      updatePerf(now);
      try { pollPad(now); } catch (err) { console.error(err); }
      requestAnimationFrame(frame);
    });

    // ── Scene lab ────────────────────────────────────────
    const labEl = $("#lab"), labBtn = $("#lab-btn"), sndBtn = $("#snd-btn");
    const css = (c) => `rgb(${c.map((v) => Math.round(Math.min(1, v) * 255)).join(",")})`;
    const save = () => {
      store.set("preset", lab.preset);
      store.set("autores", lab.autoRes); store.set("res", lab.res); store.set("grid", lab.grid); store.set("gridamt", lab.gridAmt);
      store.set("trail", lab.trail);
      store.set("pbright", lab.pbright); store.set("density", lab.density); store.set("pcolor", lab.pcolor);
    };

    function applyScene() {
      document.documentElement.style.setProperty("--sun", PALETTES[lab.preset].accent);
      refreshLab();
    }

    // ── Palette picker (top-right swatches) ──
    const palBtn = $("#pal-btn"), palPop = $("#palpop");
    palPop.innerHTML = Object.entries(PALETTES).map(([id, P]) =>
      `<button type="button" role="radio" data-id="${id}" title="${P.name}" aria-label="${P.name}" style="--a:${css(P.hor)};--b:${css(P.mid)};--c:${P.accent}"></button>`).join("");
    const togglePal = (force) => {
      const open = force ?? !palPop.classList.contains("is-open");
      palPop.classList.toggle("is-open", open);
      palBtn.setAttribute("aria-expanded", open);
    };
    palBtn.addEventListener("click", (e) => { e.stopPropagation(); togglePal(); });
    palPop.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      e.stopPropagation();
      lab.preset = b.dataset.id;
      save(); Sound.play("move"); applyScene();
    });
    addEventListener("click", (e) => { if (!e.target.closest(".palpick")) togglePal(false); });

    const setGrid = (v) => { lab.grid = v; $("#lab-grid").checked = v; save(); Sound.play("tab"); };
    $("#lab-grid").addEventListener("change", (e) => setGrid(e.target.checked));
    $("#lab-gridamt").addEventListener("input", (e) => {
      lab.gridAmt = +e.target.value; $("#lab-gridamt-out").textContent = lab.gridAmt.toFixed(3);
      if (!lab.grid) setGrid(true); else save();
    });
    $("#lab-autores").addEventListener("change", (e) => { lab.autoRes = e.target.checked; save(); refreshLab(); });
    $("#lab-res").addEventListener("input", (e) => { lab.res = +e.target.value; $("#lab-res-out").textContent = Math.round(lab.res * 100) + "%"; save(); });

    $("#lab-trail").addEventListener("input", (e) => { lab.trail = +e.target.value; $("#lab-trail-out").textContent = lab.trail.toFixed(2); save(); });
    $("#lab-pbright").addEventListener("input", (e) => { lab.pbright = +e.target.value; $("#lab-pbright-out").textContent = lab.pbright.toFixed(2); save(); });
    $("#lab-density").addEventListener("change", (e) => { lab.density = +e.target.value; save(); });
    $("#lab-pcolor").addEventListener("change", (e) => { lab.pcolor = +e.target.value; save(); });

    // Frame-time readout + graph in the scene lab
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
    }

    function refreshLab() {
      const id = lab.preset;
      palPop.querySelectorAll("button").forEach((c) => { c.classList.toggle("is-on", c.dataset.id === id); c.setAttribute("aria-checked", c.dataset.id === id); });
      $("#lab-trail").value = lab.trail; $("#lab-trail-out").textContent = lab.trail.toFixed(2);
      $("#lab-pbright").value = lab.pbright; $("#lab-pbright-out").textContent = lab.pbright.toFixed(2);
      $("#lab-density").value = String(lab.density);
      $("#lab-pcolor").value = String(lab.pcolor);
      if (engine && !engine.floatOK) $("#lab-pnote").textContent = "This browser can't run the particle simulation (no float render targets), so only the backdrop shows.";
      $("#lab-autores").checked = lab.autoRes;
      $("#lab-grid").checked = lab.grid;
      $("#lab-gridamt").value = lab.gridAmt; $("#lab-gridamt-out").textContent = lab.gridAmt.toFixed(3);
      $("#lab-res").disabled = lab.autoRes;
      $("#lab-res").value = lab.res; $("#lab-res-out").textContent = Math.round(lab.res * 100) + "%";
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
      if (v) { Sound.init(); Sound.play("move"); }
    }
    sndBtn.addEventListener("click", () => setSound(!Sound.on));
    sndBtn.setAttribute("aria-pressed", Sound.on);

    $("#lab-forget").addEventListener("click", () => {
      store.clear();
      location.reload();
    });

    $("#lab-copy").addEventListener("click", async (e) => {
      const out = {
        palette: lab.preset,
        grid: lab.grid ? lab.gridAmt : 0,
        particles: { trails: lab.trail, brightness: lab.pbright, count: lab.density * lab.density, colour: lab.pcolor },
      };
      const btn = e.currentTarget;
      try { await navigator.clipboard.writeText(JSON.stringify(out, null, 1)); btn.textContent = "Copied!"; }
      catch { btn.textContent = "Copy failed"; }
      setTimeout(() => (btn.textContent = "Copy settings"), 1600);
    });

    // ── Boot ─────────────────────────────────────────────
    selectMenu(0, true);
    applyScene();
    // A section's page shows that section straight away, as if you'd navigated there (old #section links too).
    // The body arrives as is-sub + is-boot from the server (layouts/all.html), so nothing plays in between.
    const legacy = TABS.findIndex((t) => "#" + t.id === location.hash);
    const deep = route(location.pathname) >= 0 ? route(location.pathname) : legacy;
    if (pane.dataset.section) panes[pane.dataset.section] = pane.innerHTML;
    if (deep >= 0) openSub(deep, true, true);
    else setState("splash", true);
    // Fetch the other sections' screens once the page has settled, so switching to them is instant
    // (with a timeout: the background renders every frame, so the browser may never be fully idle)
    const prefetch = () => TABS.forEach((t) => panes[t.id] == null && loadPane(t).catch(() => {}));
    if (window.requestIdleCallback) requestIdleCallback(prefetch, { timeout: 1500 }); else setTimeout(prefetch, 1000);
    requestAnimationFrame(() => requestAnimationFrame(() => body.classList.remove("is-boot")));
  })();
